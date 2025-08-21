// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Maintainable} from "../utils/Maintainable.sol";
import {IVault} from "./IVault.sol";
import {ZeroAddress} from "../utils/Errors.sol";
import {ITBTCToken} from "../bridge/ITBTCToken.sol";
import {acreBTC} from "../acreBTC.sol";
import {MidasAllocator} from "./MidasAllocator.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

contract WithdrawalQueue is Maintainable {
    using SafeERC20 for IERC20;
    using Math for uint256;

    struct WithdrawalRequest {
        address redeemer;
        uint256 shares;
        uint256 tbtcAmount;
        uint256 createdAt;
        uint256 completedAt;
        bytes redeemerOutputScript;
        uint256 midasRequestId;
    }

    /// @notice Basis point scale.
    uint256 internal constant BASIS_POINT_SCALE = 1e4;

    /// @notice tBTC token contract.
    ITBTCToken public tbtc;

    /// @notice Address of the Vault contract.
    IVault public vault;

    /// @notice Address of the VaultReceiptToken contract.
    IERC20 public vaultSharesToken;

    /// @notice Withdrawal requests.
    mapping(uint256 => WithdrawalRequest) public withdrawalRequests;

    /// @notice Withdrawal request counter.
    uint256 public count;

    // Midas Allocator
    MidasAllocator public midasAllocator;

    /// @notice TBTC Vault contract.
    address public tbtcVault;

    /// @notice acreBTC contract.
    acreBTC public acrebtc;

    /// @notice Not Midas Allocator.
    error NotMidasAllocator();

    /// @notice Not acreBTC.
    error NotAcreBTC();

    /// @notice Unexpected tBTC token owner.
    error UnexpectedTbtcTokenOwner();

    /// @notice Approve and call failed.
    error ApproveAndCallFailed();

    /// @notice Withdrawal request already completed.
    error WithdrawalRequestAlreadyCompleted();

    /// @notice Invalid redemption data.
    error InvalidRedemptionData(
        address redeemer,
        address expectedRedeemer,
        bytes redeemerOutputScript,
        bytes expectedRedeemerOutputScript
    );

    /// @notice Emitted when a withdrawal request is created.
    event WithdrawalRequestCreated(
        uint256 indexed requestId,
        address indexed redeemer,
        uint256 shares,
        uint256 tbtcAmount,
        bytes redeemerOutputScript,
        uint256 midasRequestId
    );

    /// @notice Emitted when a withdrawal request is completed.
    event WithdrawalRequestCompleted(
        uint256 indexed requestId,
        uint256 tbtcAmount,
        uint256 exitFee
    );

    /// @notice Emitted when the tBTC vault is updated.
    event TbtcVaultUpdated(address indexed tbtcVault);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    modifier onlyAcreBTC() {
        if (msg.sender != address(acrebtc)) {
            revert NotAcreBTC();
        }
        _;
    }

    /// @notice Initializes the WithdrawalQueue contract.
    /// @param _tbtc Address of the tBTC token contract.
    /// @param _vault Address of the Midas Vault contract.
    /// @param _midasAllocator Address of the Midas Allocator contract.
    /// @param _tbtcVault Address of the tBTC Vault contract.
    /// @param _acreBTC Address of the acreBTC contract.
    function initialize(
        address _tbtc,
        address _vault,
        address _midasAllocator,
        address _tbtcVault,
        address _acreBTC
    ) public initializer {
        __MaintainableOwnable_init(msg.sender);

        if (_tbtc == address(0)) {
            revert ZeroAddress();
        }
        if (_vault == address(0)) {
            revert ZeroAddress();
        }
        if (_tbtcVault == address(0)) {
            revert ZeroAddress();
        }
        if (_acreBTC == address(0)) {
            revert ZeroAddress();
        }

        tbtc = ITBTCToken(_tbtc);
        vault = IVault(_vault);
        tbtcVault = _tbtcVault;
        acrebtc = acreBTC(_acreBTC);

        vaultSharesToken = IERC20(vault.share());
        if (address(vaultSharesToken) == address(0)) {
            revert ZeroAddress();
        }

        if (_midasAllocator == address(0)) {
            revert ZeroAddress();
        }

        midasAllocator = MidasAllocator(_midasAllocator);
    }

    function requestRedeem(
        uint256 _shares,
        address _receiver,
        uint256 _exitFeeInAssets
    ) external onlyAcreBTC {
        (
            uint256 midasShares,
            uint256 tbtcAmount
        ) = _calculateMidasSharesAndBurnAcreBtc(_shares);
        if (_exitFeeInAssets > 0) {
            uint256 exitFeeShares = vault.convertToShares(_exitFeeInAssets);
            vault.requestRedeem(exitFeeShares, acrebtc.treasury());
            midasShares -= exitFeeShares;
        }
        vault.requestRedeem(midasShares, _receiver);
    }

    /// @notice Requests a redemption with extra bridge data
    /// @param _shares Amount of shares to withdraw.
    /// @param _redeemerOutputScript Redeemer output script.
    /// @param _redeemer The original redeemer address.
    /// @return requestId The ID of the withdrawal request.
    function requestRedeemAndBridge(
        uint256 _shares,
        bytes calldata _redeemerOutputScript,
        address _redeemer
    ) external onlyAcreBTC returns (uint256 requestId) {
        (
            uint256 midasShares,
            uint256 tbtcAmount
        ) = _calculateMidasSharesAndBurnAcreBtc(_shares);

        uint256 midasRequestId = vault.requestRedeem(
            midasShares,
            address(this)
        );

        requestId = count++;
        withdrawalRequests[requestId] = WithdrawalRequest({
            redeemer: _redeemer,
            shares: midasShares,
            tbtcAmount: tbtcAmount,
            createdAt: block.timestamp,
            completedAt: 0,
            redeemerOutputScript: _redeemerOutputScript,
            midasRequestId: midasRequestId
        });

        emit WithdrawalRequestCreated(
            requestId,
            _redeemer,
            midasShares,
            tbtcAmount,
            _redeemerOutputScript,
            midasRequestId
        );
    }

    /// @notice Completes a withdrawal request.
    /// @param _requestId ID of the withdrawal request.
    /// @param _tbtcRedemptionData Additional data required for the tBTC redemption.
    ///        See `redemptionData` parameter description of `Bridge.requestRedemption`
    ///        function.
    function finalizeRedeemAndBridge(
        uint256 _requestId,
        bytes calldata _tbtcRedemptionData
    ) external onlyMaintainer {
        // TBTC Token contract owner resolves to the TBTCVault contract.
        if (tbtc.owner() != tbtcVault) revert UnexpectedTbtcTokenOwner();
        WithdrawalRequest memory request = withdrawalRequests[_requestId];
        if (request.completedAt > 0) revert WithdrawalRequestAlreadyCompleted();

        (uint256 tbtcAmount, uint256 exitFee) = _finalizeRequestAndTakeExitFee(
            _requestId
        );

        (address redeemer, , , , , bytes memory redeemerOutputScript) = abi
            .decode(
                _tbtcRedemptionData,
                (address, bytes20, bytes32, uint32, uint64, bytes)
            );
        if (
            redeemer != request.redeemer ||
            !_equal(redeemerOutputScript, request.redeemerOutputScript)
        )
            revert InvalidRedemptionData(
                redeemer,
                request.redeemer,
                redeemerOutputScript,
                request.redeemerOutputScript
            );

        if (
            !tbtc.approveAndCall(
                tbtcVault,
                tbtcAmount - exitFee,
                _tbtcRedemptionData
            )
        ) {
            revert ApproveAndCallFailed();
        }

        emit WithdrawalRequestCompleted(
            _requestId,
            tbtcAmount - exitFee,
            exitFee
        );
    }

    function updateTbtcVault(address _tbtcVault) external onlyMaintainer {
        tbtcVault = _tbtcVault;
        emit TbtcVaultUpdated(_tbtcVault);
    }

    function _finalizeRequestAndTakeExitFee(
        uint256 _requestId
    ) internal returns (uint256 tbtcAmount, uint256 exitFee) {
        WithdrawalRequest storage request = withdrawalRequests[_requestId];
        request.completedAt = block.timestamp;
        tbtcAmount = request.tbtcAmount; // cache the tbtc amount
        uint256 exitFeeBasisPoints = acrebtc.exitFeeBasisPoints();
        exitFee = tbtcAmount.mulDiv(
            exitFeeBasisPoints,
            exitFeeBasisPoints + BASIS_POINT_SCALE,
            Math.Rounding.Ceil
        );
        if (exitFee > 0) {
            IERC20(address(tbtc)).transfer(acrebtc.treasury(), exitFee);
        }
    }

    function _calculateMidasSharesAndBurnAcreBtc(
        uint256 _shares
    ) internal returns (uint256 midasShares, uint256 tbtcAmount) {
        tbtcAmount = acrebtc.convertToAssets(_shares);
        midasShares = vault.convertToShares(tbtcAmount);
        midasAllocator.withdraw(midasShares);
        acrebtc.burn(_shares);
        vaultSharesToken.approve(address(vault), midasShares);
    }

    function _equal(
        bytes memory a,
        bytes memory b
    ) internal pure returns (bool) {
        return a.length == b.length && keccak256(a) == keccak256(b);
    }
}
