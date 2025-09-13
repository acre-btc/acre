// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.8.24;

/// @title Interface of TBTC token contract.
/// @notice This interface defines functions of TBTC token contract used by Acre
///         contracts.
interface IBridge {
    function redemptionParameters()
        external
        view
        returns (
            uint64 redemptionDustThreshold,
            uint64 redemptionTreasuryFeeDivisor,
            uint64 redemptionTxMaxFee,
            uint64 redemptionTxMaxTotalFee,
            uint32 redemptionTimeout,
            uint96 redemptionTimeoutSlashingAmount,
            uint32 redemptionTimeoutNotifierRewardMultiplier
        );
}
