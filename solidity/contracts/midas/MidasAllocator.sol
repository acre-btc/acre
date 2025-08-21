// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Maintainable} from "../utils/Maintainable.sol";
import {ZeroAddress} from "../utils/Errors.sol";
import "../acreBTC.sol";
import "../interfaces/IDispatcher.sol";
import {IVault} from "./IVault.sol";
import {WithdrawalQueue} from "./WithdrawalQueue.sol";

/// @notice MidasAllocator routes tBTC to/from Midas Vault.
contract MidasAllocator is IDispatcher, Maintainable {
    using SafeERC20 for IERC20;

    /// @notice tBTC token contract.
    IERC20 public tbtc;

    /// @notice acreBTC token vault contract.
    acreBTC public acrebtc;

    /// @notice Address of the Vault contract.
    IVault public vault;

    /// @notice Address of the VaultReceiptToken contract.
    IERC20 public vaultSharesToken;

    /// @notice Address of the WithdrawalQueue contract.
    WithdrawalQueue public withdrawalQueue;

    /// @notice Emitted when tBTC is deposited to Midas Vault.
    event DepositAllocated(uint256 addedAmount, uint256 shares);

    /// @notice Not withdrawal queue.
    error NotWithdrawalQueue();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the MidasAllocator contract.
    /// @param _tbtc Address of the tBTC token contract.
    /// @param _acreBTC Address of the acreBTC vault contract.
    /// @param _vault Address of the Midas Vault contract.
    function initialize(
        address _tbtc,
        address _acreBTC,
        address _vault
    ) public initializer {
        __MaintainableOwnable_init(msg.sender);

        if (_tbtc == address(0)) {
            revert ZeroAddress();
        }
        if (_acreBTC == address(0)) {
            revert ZeroAddress();
        }
        if (_vault == address(0)) {
            revert ZeroAddress();
        }

        tbtc = IERC20(_tbtc);
        acrebtc = acreBTC(_acreBTC);
        vault = IVault(_vault);

        vaultSharesToken = IERC20(vault.share());
        if (address(vaultSharesToken) == address(0)) {
            revert ZeroAddress();
        }
    }

    /// @notice Allocate tBTC to Midas Vault.
    /// @dev This function can be invoked periodically by a maintainer.
    function allocate() external onlyMaintainer {
        // Fetch unallocated tBTC from acreBTC contract.
        // slither-disable-next-line arbitrary-send-erc20
        tbtc.safeTransferFrom(
            address(acrebtc),
            address(this),
            tbtc.balanceOf(address(acrebtc))
        );

        uint256 idleAmount = tbtc.balanceOf(address(this));

        // Deposit tBTC to Midas Vault.
        tbtc.forceApprove(address(vault), idleAmount);
        uint256 shares = vault.deposit(idleAmount, address(this));

        // slither-disable-next-line reentrancy-events
        emit DepositAllocated(idleAmount, shares);
    }

    /// @notice Withdraw shares from Midas Vault.
    /// @dev This function can be invoked by the withdrawal queue.
    /// @param amount Amount of shares to withdraw.
    function withdraw(uint256 amount) external {
        if (msg.sender != address(withdrawalQueue)) {
            revert NotWithdrawalQueue();
        }
        vaultSharesToken.transfer(address(withdrawalQueue), amount);
    }

    /// @notice Returns the total amount of tBTC allocated to MezoPortal including
    ///         the amount that is currently hold by this contract.
    function totalAssets() external view returns (uint256) {
        return
            tbtc.balanceOf(address(this)) +
            vault.convertToAssets(vaultSharesToken.balanceOf(address(this)));
    }

    /// @notice Releases deposit in full from Midas Vault and transfers it to the
    ///         acreBTC contract.
    /// @dev This is a special function that can be used to migrate funds during
    ///      allocator upgrade or in case of emergencies.
    function emergencyWithdraw() external onlyOwner {
        uint256 shares = vaultSharesToken.balanceOf(address(this));
        vaultSharesToken.approve(address(vault), shares);
        vault.requestRedeem(shares, address(acrebtc));
    }

    /// @notice Sets the withdrawal queue address.
    /// @param _withdrawalQueue Address of the withdrawal queue.
    function setWithdrawalQueue(address _withdrawalQueue) external onlyOwner {
        if (_withdrawalQueue == address(0)) {
            revert ZeroAddress();
        }
        withdrawalQueue = WithdrawalQueue(_withdrawalQueue);
    }
}
