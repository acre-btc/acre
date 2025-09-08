// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.8.24;

import "../bridge/IBridge.sol";
import {MockBridge} from "@keep-network/tbtc-v2/contracts/test/TestTBTCDepositor.sol";

contract BridgeStub is IBridge, MockBridge {
    function redemptionParameters()
        external
        pure
        returns (
            uint64 redemptionDustThreshold,
            uint64 redemptionTreasuryFeeDivisor,
            uint64 redemptionTxMaxFee,
            uint64 redemptionTxMaxTotalFee,
            uint32 redemptionTimeout,
            uint96 redemptionTimeoutSlashingAmount,
            uint32 redemptionTimeoutNotifierRewardMultiplier
        )
    {
        // 900000 satoshi matches the mainnet configuration.
        return (900000, 0, 0, 0, 0, 0, 0);
    }
}
