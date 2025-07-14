// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Maintainable} from "../utils/Maintainable.sol";
import {IVault} from "./IVault.sol";
import {ZeroAddress} from "../utils/Errors.sol";
import {ITBTCToken} from "../bridge/ITBTCToken.sol";
import {stBTC} from "../stBTC.sol";
import {MidasAllocator} from "./MidasAllocator.sol";

contract WithdrawalQueue is Maintainable {
    using SafeERC20 for IERC20;

    struct WithdrawalRequest {
        address redeemer;
        uint256 shares;
        uint256 tbtcAmount;
        uint256 createdAt;
        uint256 completedAt;
        bool isCompleted;
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

    /// @notice stBTC contract.
    stBTC public stbtc;

    /// @notice Not Midas Allocator.
    error NotMidasAllocator();

    /// @notice Unexpected tBTC token owner.
    error UnexpectedTbtcTokenOwner();

    /// @notice Approve and call failed.
    error ApproveAndCallFailed();

    /// @notice Withdrawal request already completed.
    error WithdrawalRequestAlreadyCompleted();

    /// @notice Emitted when a withdrawal request is created.
    event WithdrawalRequestCreated(
        uint256 indexed requestId,
        address indexed redeemer,
        uint256 shares,
        uint256 tbtcAmount,
        bytes redeemerOutputScript,
        uint256 midasRequestId
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the WithdrawalQueue contract.
    /// @param _tbtc Address of the tBTC token contract.
    /// @param _vault Address of the Midas Vault contract.
    function initialize(
        address _tbtc,
        address _vault,
        address _midasAllocator,
        address _tbtcVault,
        address _stbtc
    ) public initializer {
        __MaintainableOwnable_init(msg.sender);

        if (_tbtc == address(0)) {
            revert ZeroAddress();
        }
        if (address(_vault) == address(0)) {
            revert ZeroAddress();
        }
        if (_tbtcVault == address(0)) {
            revert ZeroAddress();
        }
        if (_stbtc == address(0)) {
            revert ZeroAddress();
        }

        tbtc = ITBTCToken(_tbtc);
        vault = IVault(_vault);
        tbtcVault = _tbtcVault;
        stbtc = stBTC(_stbtc);

        vaultSharesToken = IERC20(vault.share());
        if (address(vaultSharesToken) == address(0)) {
            revert ZeroAddress();
        }

        if (_midasAllocator == address(0)) {
            revert ZeroAddress();
        }

        midasAllocator = MidasAllocator(_midasAllocator);
    }

    /// @notice Creates a new withdrawal request.
    /// @param _shares Amount of shares to withdraw.
    /// @param _redeemerOutputScript Redeemer output script.
    function createWithdrawalRequest(
        uint256 _shares,
        bytes memory _redeemerOutputScript
    ) external {
        stbtc.transferFrom(msg.sender, address(this), _shares);
        stbtc.burn(_shares);
        uint256 tbtcAmount = stbtc.convertToAssets(_shares);
        uint256 midasShares = vault.convertToShares(tbtcAmount);
        midasAllocator.withdraw(midasShares);
        uint256 requestId = vault.requestRedeem(midasShares);
        withdrawalRequests[count] = WithdrawalRequest({
            redeemer: msg.sender,
            shares: midasShares,
            tbtcAmount: tbtcAmount,
            createdAt: block.timestamp,
            completedAt: 0,
            isCompleted: false,
            redeemerOutputScript: _redeemerOutputScript,
            midasRequestId: requestId
        });

        count++;

        emit WithdrawalRequestCreated(
            count,
            msg.sender,
            midasShares,
            tbtcAmount,
            _redeemerOutputScript,
            requestId
        );
    }

    function completeWithdrawalRequest(
        uint256 _requestId
    ) external onlyMaintainer {
        // TBTC Token contract owner resolves to the TBTCVault contract.
        if (tbtc.owner() != tbtcVault) revert UnexpectedTbtcTokenOwner();
        if (withdrawalRequests[_requestId].isCompleted)
            revert WithdrawalRequestAlreadyCompleted();
        WithdrawalRequest storage request = withdrawalRequests[_requestId];
        request.completedAt = block.timestamp;
        request.isCompleted = true;
        uint256 tbtcAmount = request.tbtcAmount; // cache the tbtc amount
        uint256 exitFee = (tbtcAmount * stbtc.exitFeeBasisPoints()) /
            BASIS_POINT_SCALE;
        if (exitFee > 0) {
            stbtc.transfer(stbtc.treasury(), exitFee);
        }

        if (
            !tbtc.approveAndCall(
                tbtcVault,
                tbtcAmount - exitFee,
                request.redeemerOutputScript
            )
        ) {
            revert ApproveAndCallFailed();
        }
    }
}
