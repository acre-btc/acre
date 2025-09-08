// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";

import "@thesis-co/solidity-contracts/contracts/token/IReceiveApproval.sol";

import "./acreBTC.sol";
import "./bridge/ITBTCToken.sol";
import {ZeroAddress} from "./utils/Errors.sol";

/// @title Bitcoin Redeemer
/// @notice This contract facilitates redemption of acreBTC tokens to Bitcoin through
///         tBTC redemption process.
contract BitcoinRedeemerV2 is Ownable2StepUpgradeable, IReceiveApproval {
    using SafeERC20 for IERC20;

    /// Interface for tBTC token contract.
    ITBTCToken public tbtcToken;

    /// Address of the Acre Vault contract.
    acreBTC public acreBtc;

    /// Emitted when redemption is requested.
    /// @param owner Owner of acreBTC tokens.
    /// @param requestId ID of the redemption request.
    /// @param shares Number of acreBTC tokens.
    event RedemptionRequested(
        address indexed owner,
        uint256 indexed requestId,
        uint256 shares
    );

    /// Reverts if the tBTC Token address is zero.
    error TbtcTokenZeroAddress();

    /// Reverts if the Acre Vault address is zero.
    error AcreBtcZeroAddress();

    /// Attempted to call receiveApproval by supported token.
    error CallerNotAllowed(address caller);

    /// Attempted to call receiveApproval with empty data.
    error EmptyExtraData();

    /// Reverts if the redeemer is not the deposit owner.
    error RedeemerNotOwner(address redeemer, address owner);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the contract with tBTC token and acreBTC token addresses.
    /// @param _tbtcToken The address of the tBTC token contract.
    /// @param _acreBtc The address of the acreBTC token contract.
    function initialize(
        address _tbtcToken,
        address _acreBtc
    ) public initializer {
        __Ownable2Step_init();
        __Ownable_init(msg.sender);

        if (address(_tbtcToken) == address(0)) {
            revert TbtcTokenZeroAddress();
        }
        if (address(_acreBtc) == address(0)) {
            revert AcreBtcZeroAddress();
        }

        tbtcToken = ITBTCToken(_tbtcToken);
        acreBtc = acreBTC(_acreBtc);
    }

    /// @notice Redeems shares for tBTC and requests bridging to Bitcoin.
    /// @param from Shares token holder executing redemption.
    /// @param amount Amount of shares to redeem.
    /// @param extraData Redemption data in a format expected from
    ///        `redemptionData` parameter of Bridge's `receiveBalanceApproval`
    ///        function.
    function receiveApproval(
        address from,
        uint256 amount,
        address,
        bytes calldata extraData
    ) external {
        if (msg.sender != address(acreBtc)) revert CallerNotAllowed(msg.sender);
        if (extraData.length == 0) revert EmptyExtraData();

        _requestRedemption(from, amount, extraData);
    }

    function _requestRedemption(
        address owner,
        uint256 shares,
        bytes calldata tbtcRedemptionData
    ) internal {
        // Decode the redemption data to get the redeemer address and the redeemer
        // output script.
        (address redeemer, , , , , bytes memory redeemerOutputScript) = abi
            .decode(
                tbtcRedemptionData,
                (address, bytes20, bytes32, uint32, uint64, bytes)
            );
        if (redeemer != owner) revert RedeemerNotOwner(redeemer, owner);

        uint256 requestId = acreBtc.requestRedeemAndBridge(
            shares,
            owner,
            redeemerOutputScript
        );

        // slither-disable-next-line reentrancy-events
        emit RedemptionRequested(owner, requestId, shares);
    }
}
