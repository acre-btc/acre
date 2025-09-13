// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Maintainable} from "../utils/Maintainable.sol";
import {ZeroAddress} from "../utils/Errors.sol";
import "../interfaces/IDispatcherV2.sol";
import {IVault} from "./IVault.sol";
import {WithdrawalQueue} from "./WithdrawalQueue.sol";

/// @notice MidasAllocator routes tBTC to/from Midas Vault.
contract MidasAllocator is IDispatcherV2, Maintainable {
    using SafeERC20 for IERC20;

    /// @notice tBTC token contract.
    IERC20 public tbtc;

    /// @notice Acre Vault contract (acreBTC).
    address public acreVault;

    /// @notice Address of the Midas Vault contract.
    IVault public midasVault;

    /// @notice Address of the VaultReceiptToken contract.
    IERC20 public vaultSharesToken;

    /// @notice Address of the WithdrawalQueue contract.
    WithdrawalQueue public withdrawalQueue;

    /// @notice Emitted when tBTC is deposited to Midas Vault.
    event DepositAllocated(uint256 addedAmount, uint256 shares);

    /// @notice Emitted when the withdrawal queue address is updated.
    event WithdrawalQueueUpdated(
        address oldWithdrawalQueue,
        address newWithdrawalQueue
    );

    /// @notice Not withdrawal queue.
    error NotWithdrawalQueue();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the MidasAllocator contract.
    /// @param _tbtc Address of the tBTC token contract.
    /// @param _acreVault Address of the Acre Vault contract (acreBTC).
    /// @param _midasVault Address of the Midas Vault contract.
    function initialize(
        address _tbtc,
        address _acreVault,
        address _midasVault
    ) public initializer {
        __MaintainableOwnable_init(msg.sender);

        if (_tbtc == address(0)) {
            revert ZeroAddress();
        }
        if (address(_acreVault) == address(0)) {
            revert ZeroAddress();
        }
        if (address(_midasVault) == address(0)) {
            revert ZeroAddress();
        }

        tbtc = IERC20(_tbtc);
        acreVault = _acreVault;
        midasVault = IVault(_midasVault);

        vaultSharesToken = IERC20(midasVault.share());
        if (address(vaultSharesToken) == address(0)) {
            revert ZeroAddress();
        }
    }

    /// @notice Allocate tBTC to the Midas Vault.
    /// @dev This function can be invoked periodically by a maintainer.
    function allocate() external onlyMaintainer {
        // Fetch unallocated tBTC from Acre Vault contract.
        // slither-disable-next-line arbitrary-send-erc20
        tbtc.safeTransferFrom(
            address(acreVault),
            address(this),
            tbtc.balanceOf(address(acreVault))
        );

        uint256 idleAmount = tbtc.balanceOf(address(this));

        // Deposit tBTC to Midas Vault.
        tbtc.forceApprove(address(midasVault), idleAmount);
        uint256 shares = midasVault.deposit(idleAmount, address(this));

        // slither-disable-next-line reentrancy-events
        emit DepositAllocated(idleAmount, shares);
    }

    /// @notice Withdraw Midas Vault shares from the allocator to the withdrawal
    ///         queue. This function is called by the withdrawal queue as a
    ///         preparation for requesting a redemption from the Midas Vault.
    function withdrawShares(uint256 midasShares) external {
        if (msg.sender != address(withdrawalQueue)) {
            revert NotWithdrawalQueue();
        }

        vaultSharesToken.safeTransfer(address(withdrawalQueue), midasShares);
    }

    /// @notice Returns the total amount of tBTC allocated to Midas Vault including
    ///         the amount that is currently held by this contract.
    function totalAssets() external view returns (uint256) {
        return
            tbtc.balanceOf(address(this)) +
            midasVault.convertToAssets(
                vaultSharesToken.balanceOf(address(this))
            );
    }

    /// @notice Releases deposit in full from Midas Vault and transfers it to the
    ///         Acre Vault contract.
    /// @dev This is a special function that can be used to migrate funds during
    ///      allocator upgrade or in case of emergencies.
    function emergencyWithdraw() external onlyOwner returns (uint256) {
        uint256 shares = vaultSharesToken.balanceOf(address(this));
        vaultSharesToken.forceApprove(address(midasVault), shares);
        return midasVault.requestRedeem(shares, address(acreVault));
    }

    /// @notice Sets the withdrawal queue address.
    /// @param _withdrawalQueue Address of the withdrawal queue.
    function setWithdrawalQueue(address _withdrawalQueue) external onlyOwner {
        emit WithdrawalQueueUpdated(address(withdrawalQueue), _withdrawalQueue);

        withdrawalQueue = WithdrawalQueue(_withdrawalQueue);
    }
}
