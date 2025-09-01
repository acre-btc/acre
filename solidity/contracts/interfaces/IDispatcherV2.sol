// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.8.24;

/// @title IDispatcherV2
/// @notice Interface for the Dispatcher contract used in acreBTC for async
///         withdrawals.
interface IDispatcherV2 {
    /// @notice Returns the total amount of assets held by the Dispatcher.
    function totalAssets() external view returns (uint256);
}
