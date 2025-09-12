// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import "@keep-network/tbtc-v2/contracts/integrator/AbstractTBTCDepositor.sol";

import {stBTC} from "./stBTC.sol";

/// @title Bitcoin Depositor contract.
/// @notice The contract integrates Acre depositing with tBTC minting.
///         User who wants to deposit BTC in Acre should submit a Bitcoin transaction
///         to the most recently created off-chain ECDSA wallets of the tBTC Bridge
///         using pay-to-script-hash (P2SH) or pay-to-witness-script-hash (P2WSH)
///         containing hashed information about this Depositor contract address,
///         and deposit owner's Ethereum address.
///         Then, the deposit owner initiates tBTC minting by revealing their Ethereum
///         address along with their deposit blinding factor, refund public key
///         hash and refund locktime on the tBTC Bridge through this Depositor
///         contract.
///         The off-chain ECDSA wallet and Optimistic Minting bots listen for these
///         sorts of messages and when they get one, they check the Bitcoin network
///         to make sure the deposit lines up. Majority of tBTC minting is finalized
///         by the Optimistic Minting process, where Minter bot initializes
///         minting process and if there is no veto from the Guardians, the
///         process is finalized and tBTC minted to the Depositor address. If
///         the revealed deposit is not handled by the Optimistic Minting process
///         the off-chain ECDSA wallet may decide to pick the deposit transaction
///         for sweeping, and when the sweep operation is confirmed on the Bitcoin
///         network, the tBTC Bridge and tBTC vault mint the tBTC token to the
///         Depositor address. After tBTC is minted to the Depositor, on the deposit
///         finalization tBTC is deposited in Acre and stBTC shares are emitted
///         to the deposit owner.
contract BitcoinDepositor is AbstractTBTCDepositor, Ownable2StepUpgradeable {
    using SafeERC20 for IERC20;

    /// @notice Reflects the deposit state:
    ///         - Unknown deposit has not been initialized yet.
    ///         - Initialized deposit has been initialized with a call to
    ///           `initializeDeposit` function and is known to this contract.
    ///         - Finalized deposit led to tBTC ERC20 minting and was finalized
    ///           with a call to `finalizeDeposit` function that deposited tBTC
    ///           to the stBTC contract.
    enum DepositState {
        Unknown,
        Initialized,
        Finalized
    }

    /// @notice Holds the deposit state, keyed by the deposit key calculated for
    ///         the individual deposit during the call to `initializeDeposit`
    ///         function.
    mapping(uint256 => DepositState) public deposits;

    /// @notice tBTC Token contract.
    IERC20 public tbtcToken;

    /// @notice stBTC contract.
    stBTC public stbtc;

    /// @notice Minimum amount of a single deposit (in tBTC token precision).
    /// @dev This parameter should be set to a value exceeding the minimum deposit
    ///      amount supported by the tBTC Bridge.
    uint256 public minDepositAmount;

    /// @notice Divisor used to compute the depositor fee taken from each deposit
    ///         and transferred to the treasury upon deposit finalization.
    /// @dev That fee is computed as follows:
    ///      `depositorFee = depositedAmount / depositorFeeDivisor`
    ///       for example, if the depositor fee needs to be 2% of each deposit,
    ///       the `depositorFeeDivisor` should be set to `50` because
    ///       `1/50 = 0.02 = 2%`.
    uint64 public depositorFeeDivisor;

    /// @notice Emitted when a deposit is initialized.
    /// @dev Deposit details can be fetched from {{ Bridge.DepositRevealed }}
    ///      event emitted in the same transaction.
    /// @param depositKey Deposit key identifying the deposit.
    /// @param caller Address that initialized the deposit.
    /// @param depositOwner The address to which the stBTC shares will be minted.
    /// @param initialAmount Amount of funding transaction.
    event DepositInitialized(
        uint256 indexed depositKey,
        address indexed caller,
        address indexed depositOwner,
        uint256 initialAmount
    );

    /// @notice Emitted when a deposit is finalized.
    /// @dev Deposit details can be fetched from {{ ERC4626.Deposit }}
    ///      event emitted in the same transaction.
    /// @param depositKey Deposit key identifying the deposit.
    /// @param caller Address that finalized the deposit.
    /// @param referral Data used for referral program.
    /// @param initialAmount Amount of funding transaction.
    /// @param bridgedAmount Amount of tBTC tokens that was bridged by the tBTC bridge.
    /// @param depositorFee Depositor fee amount.
    event DepositFinalized(
        uint256 indexed depositKey,
        address indexed caller,
        uint16 indexed referral,
        uint256 initialAmount,
        uint256 bridgedAmount,
        uint256 depositorFee
    );

    /// @notice Emitted when a minimum single deposit amount is updated.
    /// @param minDepositAmount New value of the minimum single deposit
    ///        amount (in tBTC token precision).
    event MinDepositAmountUpdated(uint256 minDepositAmount);

    /// @notice Emitted when a depositor fee divisor is updated.
    /// @param depositorFeeDivisor New value of the depositor fee divisor.
    event DepositorFeeDivisorUpdated(uint64 depositorFeeDivisor);

    /// Reverts if the tBTC Token address is zero.
    error TbtcTokenZeroAddress();

    /// Reverts if the stBTC address is zero.
    error StbtcZeroAddress();

    /// @dev Deposit owner address is zero.
    error DepositOwnerIsZeroAddress();

    /// @dev Attempted to execute function for deposit in unexpected current state.
    error UnexpectedDepositState(
        DepositState actualState,
        DepositState expectedState
    );

    /// @dev Calculated depositor fee exceeds the amount of minted tBTC tokens.
    error DepositorFeeExceedsBridgedAmount(
        uint256 depositorFee,
        uint256 bridgedAmount
    );

    /// @dev Attempted to set minimum deposit amount to a value lower than the
    ///      tBTC Bridge deposit dust threshold.
    error MinDepositAmountLowerThanBridgeMinDeposit(
        uint256 minDepositAmount,
        uint256 bridgeMinDepositAmount
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Bitcoin Depositor contract initializer.
    /// @param bridge tBTC Bridge contract instance.
    /// @param tbtcVault tBTC Vault contract instance.
    /// @param _tbtcToken tBTC token contract instance.
    /// @param _stbtc stBTC contract instance.
    function initialize(
        address bridge,
        address tbtcVault,
        address _tbtcToken,
        address _stbtc
    ) public initializer {
        __AbstractTBTCDepositor_initialize(bridge, tbtcVault);
        __Ownable2Step_init();
        __Ownable_init(msg.sender);

        if (address(_tbtcToken) == address(0)) {
            revert TbtcTokenZeroAddress();
        }
        if (address(_stbtc) == address(0)) {
            revert StbtcZeroAddress();
        }

        tbtcToken = IERC20(_tbtcToken);
        stbtc = stBTC(_stbtc);

        minDepositAmount = 0.015 * 1e18; // 0.015 BTC
        depositorFeeDivisor = 1000; // 1/1000 == 10bps == 0.1% == 0.001
    }

    /// @notice This function allows depositing process initialization for a Bitcoin
    ///         deposit made by an user with a P2(W)SH transaction. It uses the
    ///         supplied information to reveal a deposit to the tBTC Bridge contract.
    /// @dev Requirements:
    ///      - The revealed vault address must match the TBTCVault address,
    ///      - All requirements from {Bridge#revealDepositWithExtraData}
    ///        function must be met.
    ///      - `depositOwner` must be the deposit owner address used in the P2(W)SH BTC
    ///        deposit transaction as part of the extra data.
    ///      - `referral` must be the referral info used in the P2(W)SH BTC
    ///        deposit transaction as part of the extra data.
    ///      - BTC deposit for the given `fundingTxHash`, `fundingOutputIndex`
    ///        can be revealed only one time.
    /// @param fundingTx Bitcoin funding transaction data, see `IBridgeTypes.BitcoinTxInfo`.
    /// @param reveal Deposit reveal data, see `IBridgeTypes.DepositRevealInfo`.
    /// @param depositOwner The address to which the stBTC shares will be minted.
    /// @param referral Data used for referral program.
    function initializeDeposit(
        IBridgeTypes.BitcoinTxInfo calldata fundingTx,
        IBridgeTypes.DepositRevealInfo calldata reveal,
        address depositOwner,
        uint16 referral
    ) external {
        if (depositOwner == address(0)) revert DepositOwnerIsZeroAddress();

        // We don't check if the request was already initialized, as this check
        // is enforced in `_initializeDeposit` when calling the
        // `Bridge.revealDepositWithExtraData` function.
        (uint256 depositKey, uint256 initialAmount) = _initializeDeposit(
            fundingTx,
            reveal,
            encodeExtraData(depositOwner, referral)
        );

        // Validate current deposit state.
        if (deposits[depositKey] != DepositState.Unknown)
            revert UnexpectedDepositState(
                deposits[depositKey],
                DepositState.Unknown
            );

        // Transition to a new state.
        deposits[depositKey] = DepositState.Initialized;

        emit DepositInitialized(
            depositKey,
            msg.sender,
            depositOwner,
            initialAmount
        );
    }

    /// @notice This function should be called for previously initialized deposit
    ///         request, after tBTC minting process completed, meaning tBTC was
    ///         minted to this contract.
    /// @dev It calculates the amount to deposit based on the approximate minted
    ///      tBTC amount reduced by the depositor fee.
    /// @dev IMPORTANT NOTE: The minted tBTC amount used by this function is an
    ///      approximation. See documentation of the
    ///      {{AbstractTBTCDepositor#_calculateTbtcAmount}} responsible for calculating
    ///      this value for more details.
    /// @param depositKey Deposit key identifying the deposit.
    function finalizeDeposit(uint256 depositKey) external {
        // Validate current deposit state.
        if (deposits[depositKey] != DepositState.Initialized)
            revert UnexpectedDepositState(
                deposits[depositKey],
                DepositState.Initialized
            );

        // Transition to a new state.
        deposits[depositKey] = DepositState.Finalized;

        (
            uint256 initialAmount,
            uint256 tbtcAmount,
            bytes32 extraData
        ) = _finalizeDeposit(depositKey);

        // Compute depositor fee. The fee is calculated based on the initial funding
        // transaction amount, before the tBTC protocol network fees were taken.
        uint256 depositorFee = depositorFeeDivisor > 0
            ? Math.ceilDiv(initialAmount, depositorFeeDivisor)
            : 0;

        // Ensure the depositor fee does not exceed the approximate minted tBTC
        // amount.
        if (depositorFee >= tbtcAmount) {
            revert DepositorFeeExceedsBridgedAmount(depositorFee, tbtcAmount);
        }

        // Transfer depositor fee to the treasury wallet.
        if (depositorFee > 0) {
            tbtcToken.safeTransfer(stbtc.treasury(), depositorFee);
        }

        (address depositOwner, uint16 referral) = decodeExtraData(extraData);

        emit DepositFinalized(
            depositKey,
            msg.sender,
            referral,
            initialAmount,
            tbtcAmount,
            depositorFee
        );

        uint256 amountToDeposit = tbtcAmount - depositorFee;

        // Deposit tBTC in stBTC.
        tbtcToken.safeIncreaseAllowance(address(stbtc), amountToDeposit);
        // slither-disable-next-line unused-return
        stbtc.deposit(amountToDeposit, depositOwner);
    }

    /// @notice Updates the minimum deposit amount.
    /// @dev It requires that the new value is greater or equal to the tBTC Bridge
    ///      deposit dust threshold, to ensure deposit will be able to be bridged.
    /// @param newMinDepositAmount New minimum deposit amount (in tBTC precision).
    function updateMinDepositAmount(
        uint256 newMinDepositAmount
    ) external onlyOwner {
        uint256 minBridgeDepositAmount = _minDepositAmount();

        // Check if new value is at least equal the tBTC Bridge Deposit Dust Threshold.
        if (newMinDepositAmount < minBridgeDepositAmount)
            revert MinDepositAmountLowerThanBridgeMinDeposit(
                newMinDepositAmount,
                minBridgeDepositAmount
            );

        minDepositAmount = newMinDepositAmount;

        emit MinDepositAmountUpdated(newMinDepositAmount);
    }

    /// @notice Updates the depositor fee divisor.
    /// @param newDepositorFeeDivisor New depositor fee divisor value.
    function updateDepositorFeeDivisor(
        uint64 newDepositorFeeDivisor
    ) external onlyOwner {
        depositorFeeDivisor = newDepositorFeeDivisor;

        emit DepositorFeeDivisorUpdated(newDepositorFeeDivisor);
    }

    /// @notice Encodes deposit owner address and referral as extra data.
    /// @dev Packs the data to bytes32: 20 bytes of deposit owner address and
    ///      2 bytes of referral, 10 bytes of trailing zeros.
    /// @param depositOwner The address to which the stBTC shares will be minted.
    /// @param referral Data used for referral program.
    /// @return Encoded extra data.
    function encodeExtraData(
        address depositOwner,
        uint16 referral
    ) public pure returns (bytes32) {
        return bytes32(abi.encodePacked(depositOwner, referral));
    }

    /// @notice Decodes deposit owner address and referral from extra data.
    /// @dev Unpacks the data from bytes32: 20 bytes of deposit owner address and
    ///      2 bytes of referral, 10 bytes of trailing zeros.
    /// @param extraData Encoded extra data.
    /// @return depositOwner The address to which the stBTC shares will be minted.
    /// @return referral Data used for referral program.
    function decodeExtraData(
        bytes32 extraData
    ) public pure returns (address depositOwner, uint16 referral) {
        // First 20 bytes of extra data is deposit owner address.
        depositOwner = address(uint160(bytes20(extraData)));
        // Next 2 bytes of extra data is referral info.
        referral = uint16(bytes2(extraData << (8 * 20)));
    }
}
