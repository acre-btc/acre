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

    /// @notice Not tBTC token owner.
    error NotTbtcTokenOwner();

    /// @notice Unexpected tBTC token owner.
    error UnexpectedTbtcTokenOwner();

    /// @notice Approve and call failed.
    error ApproveAndCallFailed();

    /// @notice Withdrawal request already completed.
    error WithdrawalRequestAlreadyCompleted();

    /// @notice Withdrawal request not found.
    error WithdrawalRequestNotFound();

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
    event TbtcVaultUpdated(address oldTbtcVault, address newTbtcVault);

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
        (uint256 midasShares, uint256 tbtcAmount) = _prepareSharesRedemption(
            _shares
        );

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
        uint256 exitFeeInTbtc
    ) external onlyAcreBTC returns (uint256 requestId) {
        (
            uint256 midasShares,
            uint256 tbtcAmountWithFee
        ) = _prepareSharesRedemption(_shares);

        uint256 midasRequestId = vault.requestRedeem(
            midasShares,
            address(this)
        );

        requestId = count++;

        uint256 tbtcAmount = tbtcAmountWithFee - exitFeeInTbtc;

        withdrawalRequests[requestId] = WithdrawalRequest({
            redeemer: _redeemer,
            shares: midasShares,
            tbtcAmount: tbtcAmount,
            exitFeeInTbtc: exitFeeInTbtc,
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
        WithdrawalRequest memory request = withdrawalRequests[_requestId];
        if (request.owner == address(0)) revert WithdrawalRequestNotFound();
        if (request.completedAt > 0) revert WithdrawalRequestAlreadyCompleted();

        // Mark request as completed.
        request.completedAt = block.timestamp;

        // Take exit fee.
        if (request.exitFeeInTbtc > 0) {
            IERC20(address(tbtc)).safeTransfer(
                acrebtc.treasury(),
                request.exitFeeInTbtc
            );
        }

        emit WithdrawalRequestCompleted(
            _requestId,
            request.tbtcAmount,
            request.exitFeeInTbtc
        );

        _bridgeToBitcoin(request, _tbtcRedemptionData);
    }

    /// @notice Requests bridging to Bitcoin via tBTC Bridge.
    /// @dev Redemption data in a format expected from `redemptionData` parameter
    ///      of Bridge's `receiveBalanceApproval`.
    ///      It uses tBTC token owner which is the TBTCVault contract as spender
    ///      of tBTC requested for redemption.
    /// @dev tBTC Bridge redemption process has a path where request can timeout.
    ///      It is a scenario that is unlikely to happen with the current Bridge
    ///      setup. This contract remains upgradable to have flexibility to handle
    ///      adjustments to tBTC Bridge changes.
    /// @dev Redemption data should include a `redeemer` address matching the
    ///      address of the deposit owner who is redeeming the shares. In case anything
    ///      goes wrong during the tBTC unminting process, the redeemer will be
    ///      able to claim the tBTC tokens back from the tBTC Bank contract.
    /// @param _request The withdrawal request.
    /// @param _tbtcRedemptionData Additional data required for the tBTC redemption.
    ///        See `redemptionData` parameter description of `Bridge.requestRedemption`
    ///        function.
    function _bridgeToBitcoin(
        WithdrawalRequest memory _request,
        bytes calldata _tbtcRedemptionData
    ) internal {
        // TBTC Token contract owner resolves to the TBTCVault contract.
        if (tbtc.owner() != tbtcVault) revert UnexpectedTbtcTokenOwner();

        // Decode redemption data.
        (address redeemer, , , , , bytes memory redeemerOutputScript) = abi
            .decode(
                _tbtcRedemptionData,
                (address, bytes20, bytes32, uint32, uint64, bytes)
            );

        // Check if redemption data matches the owner (redeemer) and the redeemer
        // output script passed in the initial redemption request.
        if (
            redeemer != _request.redeemer ||
            !_equal(redeemerOutputScript, _request.redeemerOutputScript)
        )
            revert InvalidRedemptionData(
                redeemer,
                _request.redeemer,
                redeemerOutputScript,
                _request.redeemerOutputScript
            );

        // Initialize tBTC Bridge redemption process.
        if (
            !tbtc.approveAndCall(
                tbtcVault,
                _request.tbtcAmount,
                _tbtcRedemptionData
            )
        ) {
            revert ApproveAndCallFailed();
        }
    }

    /// @notice Updates TBTCVault contract address.
    /// @param newTbtcVault New TBTCVault contract address.
    function updateTbtcVault(address newTbtcVault) external onlyOwner {
        if (newTbtcVault == address(0)) {
            revert ZeroAddress();
        }

        if (newTbtcVault != tbtc.owner()) {
            revert NotTbtcTokenOwner();
        }

        emit TbtcVaultUpdated(tbtcVault, newTbtcVault);

        tbtcVault = newTbtcVault;
    }

    /**
     * @notice Prepares for a shares redemption in the Midas Vault.
     *
     *         It includes pulling the midas shares from the Midas Allocator which will
     *         cause the `MidasAllocator.totalAssets` function to adjust the
     *         total assets to be decreased. To maintain the balance between
     *         totalAssets and totalSupply of the Acre Vault, it burns the corresponding
     *         acreBTC shares.
     *
     *         Then it approves the midas shares to the vault to be able to redeem them later.
     *
     *          It also returns the calculated tBTC amount corresponding to the provided
     *          acreBTC shares amount.
     * @param _acreShares Number of acreBTC shares to redeem.
     * @return midasShares Number of midas shares corresponding to the provided
     *                     acreBTC shares.
     * @return tbtcAmount Amount of tBTC corresponding to the provided
     *                   acreBTC shares.
     */
    function _prepareSharesRedemption(
        uint256 _acreShares
    ) internal returns (uint256 midasShares, uint256 tbtcAmount) {
        // Calculate the tBTC amount corresponding to the provided acreBTC shares amount.
        tbtcAmount = acrebtc.convertToAssets(_acreShares);

        // Calculate the number of midas shares corresponding to the provided tBTC amount.
        midasShares = vault.convertToShares(tbtcAmount);

        // Withdraw the midas shares from the Midas Allocator.
        midasAllocator.withdraw(midasShares);

        // Burn the corresponding acreBTC shares.
        acrebtc.burn(_acreShares);

        // Approve the midas shares to the vault to be able to redeem them later.
        vaultSharesToken.approve(address(vault), midasShares);
    }

    function _equal(
        bytes memory a,
        bytes memory b
    ) internal pure returns (bool) {
        return a.length == b.length && keccak256(a) == keccak256(b);
    }
}
