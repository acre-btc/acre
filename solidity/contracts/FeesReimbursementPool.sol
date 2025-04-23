// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Fees Reimbursement Pool
/// @notice A contract that allows the Bitcoin Depositor to reimburse fees
///         for deposits.
contract FeesReimbursementPool is Ownable2StepUpgradeable {
    using SafeERC20 for IERC20;

    address public tbtcToken;
    address public bitcoinDepositor;

    /// @dev Caller is not the Bitcoin Depositor contract.
    error CallerNotBitcoinDepositor();

    /// @dev Attempted to reimburse zero amount.
    error ZeroAmount();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialize the fees reimbursement pool.
    /// @param _tbtcToken The tBTC token address.
    /// @param _bitcoinDepositor The bitcoin depositor address.
    function initialize(
        address _tbtcToken,
        address _bitcoinDepositor
    ) external initializer {
        __Ownable2Step_init();
        __Ownable_init(msg.sender);

        tbtcToken = _tbtcToken;
        bitcoinDepositor = _bitcoinDepositor;
    }

    /// @notice Reimburse the fees.
    /// @param reimbursedAmount The amount to reimburse.
    /// @return The amount reimbursed.
    function reimburse(uint256 reimbursedAmount) external returns (uint256) {
        if (msg.sender != bitcoinDepositor) revert CallerNotBitcoinDepositor();
        if (reimbursedAmount == 0) revert ZeroAmount();

        uint256 availableBalance = IERC20(tbtcToken).balanceOf(address(this));

        if (availableBalance < reimbursedAmount) {
            reimbursedAmount = availableBalance;
        }

        if (reimbursedAmount > 0) {
            IERC20(tbtcToken).safeTransfer(msg.sender, reimbursedAmount);
        }

        return reimbursedAmount;
    }

    /// @notice Withdraw the tokens from the pool.
    /// @param to The address to withdraw to.
    /// @param amount The amount to withdraw.
    function withdraw(address to, uint256 amount) external onlyOwner {
        IERC20(tbtcToken).safeTransfer(to, amount);
    }
}
