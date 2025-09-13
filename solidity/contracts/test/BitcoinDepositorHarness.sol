// SPDX-License-Identifier: GPL-3.0-only
/* solhint-disable func-name-mixedcase */
pragma solidity 0.8.24;

import {BitcoinDepositor} from "../BitcoinDepositor.sol";
import {MockBridge, MockTBTCVault} from "@keep-network/tbtc-v2/contracts/test/TestTBTCDepositor.sol";
import {IBridge} from "@keep-network/tbtc-v2/contracts/integrator/IBridge.sol";
import {IBridgeTypes} from "@keep-network/tbtc-v2/contracts/integrator/IBridge.sol";

import {TestERC20} from "./TestERC20.sol";

/// @dev A test contract to stub tBTC Vault contract.
contract TBTCVaultStub is MockTBTCVault {
    TestERC20 public immutable tbtc;
    IBridge public immutable bridge;

    /// @notice Multiplier to convert satoshi to TBTC token units.
    uint256 public constant SATOSHI_MULTIPLIER = 10 ** 10;

    constructor(TestERC20 _tbtc, IBridge _bridge) {
        tbtc = _tbtc;
        bridge = _bridge;
    }

    function finalizeOptimisticMintingRequest(
        uint256 depositKey
    ) public override {
        IBridgeTypes.DepositRequest memory deposit = bridge.deposits(
            depositKey
        );

        uint256 amountSubTreasury = (deposit.amount - deposit.treasuryFee) *
            SATOSHI_MULTIPLIER;

        uint256 omFee = optimisticMintingFeeDivisor > 0
            ? (amountSubTreasury / optimisticMintingFeeDivisor)
            : 0;

        uint256 amountToMint = amountSubTreasury - omFee;

        finalizeOptimisticMintingRequestWithAmount(depositKey, amountToMint);
    }

    function finalizeOptimisticMintingRequestWithAmount(
        uint256 depositKey,
        uint256 amountToMint
    ) public {
        MockTBTCVault.finalizeOptimisticMintingRequest(depositKey);

        tbtc.mint(bridge.deposits(depositKey).depositor, amountToMint);
    }
}
