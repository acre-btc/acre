// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "@thesis-co/solidity-contracts/contracts/token/IReceiveApproval.sol";

import "../../PausableOwnable.sol";
import "../../lib/ERC4626Fees.sol";
import "../../interfaces/IDispatcher.sol";
import {ZeroAddress} from "../../utils/Errors.sol";

/// @title stBTCV2
/// @notice This contract implements the ERC-4626 tokenized vault standard. By
///         staking tBTC, users acquire a liquid staking token called stBTC,
///         commonly referred to as "shares".
///         Users have the flexibility to redeem stBTC, enabling them to
///         withdraw their deposited tBTC along with the accrued yield.
/// @dev ERC-4626 is a standard to optimize and unify the technical parameters
///      of yield-bearing vaults. This contract facilitates the minting and
///      burning of shares (stBTC), which are represented as standard ERC20
///      tokens, providing a seamless exchange with tBTC tokens.
// slither-disable-next-line missing-inheritance
contract stBTCV2 is ERC4626Fees, PausableOwnable {
    using SafeERC20 for IERC20;

    /// Dispatcher contract that routes tBTC from stBTC to a given allocation
    /// contract and back.
    IDispatcher public dispatcher;

    /// Address of the treasury wallet, where fees should be transferred to.
    address public treasury;

    /// Minimum amount for a single deposit operation. The value should be set
    /// low enough so the deposits routed through Bitcoin Depositor contract won't
    /// be rejected. It means that minimumDepositAmount should be lower than
    /// tBTC protocol's depositDustThreshold reduced by all the minting fees taken
    /// before depositing in the Acre contract.
    uint256 public minimumDepositAmount;

    /// Entry fee basis points applied to entry fee calculation.
    uint256 public entryFeeBasisPoints;

    /// Exit fee basis points applied to exit fee calculation.
    uint256 public exitFeeBasisPoints;

    /// @notice Returns the maximum amount of the underlying asset for which the
    ///      shares can be minted without the coverage in deposited assets.
    mapping(address => uint256) public allowedDebt;

    /// @notice Returns the current debt of the debtor.
    mapping(address => uint256) public currentDebt;

    /// @notice Total amount of debt across all debtors.
    /// @dev This is the total amount of assets for which shares have been minted
    ///      without the coverage in deposited assets. The value is used to
    ///      adjust the total assets held by the vault.
    uint256 public totalDebt;

    /// @notice Address of ERC-4626 contract to migrate to.
    address public migrateTo;

    /// @notice Whether the migration has started.
    bool public migrationStarted;

    // TEST: New variable.
    uint256 public newVariable;

    /// Emitted when the treasury wallet address is updated.
    /// @param oldTreasury Address of the old treasury wallet.
    /// @param newTreasury Address of the new treasury wallet.
    event TreasuryUpdated(address oldTreasury, address newTreasury);

    /// Emitted when deposit parameters are updated.
    /// @param minimumDepositAmount New value of the minimum deposit amount.
    event MinimumDepositAmountUpdated(uint256 minimumDepositAmount);

    /// Emitted when the dispatcher contract is updated.
    /// @param oldDispatcher Address of the old dispatcher contract.
    /// @param newDispatcher Address of the new dispatcher contract.
    event DispatcherUpdated(address oldDispatcher, address newDispatcher);

    /// Emitted when the entry fee basis points are updated.
    /// @param entryFeeBasisPoints New value of the fee basis points.
    event EntryFeeBasisPointsUpdated(uint256 entryFeeBasisPoints);

    /// Emitted when the exit fee basis points are updated.
    /// @param exitFeeBasisPoints New value of the fee basis points.
    event ExitFeeBasisPointsUpdated(uint256 exitFeeBasisPoints);

    /// Emitted when the maximum debt allowance of the debtor is updated.
    /// @param debtor Address of the debtor.
    /// @param newAllowance Maximum debt allowance of the debtor.
    event DebtAllowanceUpdated(address indexed debtor, uint256 newAllowance);

    /// Emitted when debt is minted.
    /// @param debtor Address of the debtor.
    /// @param currentDebt Current debt of the debtor.
    /// @param assets Amount of assets for which debt will be taken.
    /// @param shares Amount of shares minted.
    event DebtMinted(
        address indexed debtor,
        uint256 currentDebt,
        uint256 assets,
        uint256 shares
    );

    /// Emitted when debt is repaid.
    /// @param debtor Address of the debtor.
    /// @param currentDebt Current debt of the debtor.
    /// @param assets Amount of assets repaying the debt.
    /// @param shares Amount of shares burned.
    event DebtRepaid(
        address indexed debtor,
        uint256 currentDebt,
        uint256 assets,
        uint256 shares
    );

    // TEST: New event.
    event NewEvent();

    /// Reverts if the amount is less than the minimum deposit amount.
    /// @param amount Amount to check.
    /// @param min Minimum amount to check 'amount' against.
    error LessThanMinDeposit(uint256 amount, uint256 min);

    /// Reverts if the address is disallowed.
    error DisallowedAddress();

    /// Reverts if the fee basis points exceed the maximum value.
    error ExceedsMaxFeeBasisPoints();

    /// Reverts if the treasury address is the same.
    error SameTreasury();

    /// Reverts if the dispatcher address is the same.
    error SameDispatcher();

    /// @notice Emitted when the debt allowance of a debtor is insufficient.
    /// @dev Used in the debt minting function.
    /// @param debtor Address of the debtor.
    /// @param allowance Maximum debt allowance of the debtor.
    /// @param needed Requested amount of debt of the debtor.
    error InsufficientDebtAllowance(
        address debtor,
        uint256 allowance,
        uint256 needed
    );

    /// @notice Emitted when the debt of the debtor is insufficient - the debtor
    ///         tries to repay more than they borrowed.
    /// @dev Used in the debt repayment function.
    /// @param debtor Address of the debtor.
    /// @param debt Current debt of the debtor.
    /// @param needed Requested amount of assets repaying the debt.
    error ExcessiveDebtRepayment(address debtor, uint256 debt, uint256 needed);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(IERC20 asset, address _treasury) public initializer {
        // TEST: Removed content of initialize function. Initialize shouldn't be
        //       called again during the upgrade because of the `initializer`
        //       modifier.
    }

    function initializeV2(uint256 _newVariable) public reinitializer(2) {
        newVariable = _newVariable;
    }

    /// @notice Updates treasury wallet address.
    /// @param newTreasury New treasury wallet address.
    function updateTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) {
            revert ZeroAddress();
        }
        if (newTreasury == address(this)) {
            revert DisallowedAddress();
        }
        if (newTreasury == treasury) {
            revert SameTreasury();
        }

        emit TreasuryUpdated(treasury, newTreasury);

        treasury = newTreasury;
    }

    /// @notice Updates minimum deposit amount.
    /// @param newMinimumDepositAmount New value of the minimum deposit amount. It
    ///        is the minimum amount for a single deposit operation.
    function updateMinimumDepositAmount(
        uint256 newMinimumDepositAmount
    ) external onlyOwner {
        minimumDepositAmount = newMinimumDepositAmount;

        emit MinimumDepositAmountUpdated(newMinimumDepositAmount);
    }

    /// @notice Updates the dispatcher contract and gives it an unlimited
    ///         allowance to transfer deposited tBTC.
    /// @param newDispatcher Address of the new dispatcher contract.
    function updateDispatcher(IDispatcher newDispatcher) external onlyOwner {
        if (address(newDispatcher) == address(0)) {
            revert ZeroAddress();
        }
        if (address(newDispatcher) == address(dispatcher)) {
            revert SameDispatcher();
        }

        address oldDispatcher = address(dispatcher);

        emit DispatcherUpdated(oldDispatcher, address(newDispatcher));
        dispatcher = newDispatcher;

        if (oldDispatcher != address(0)) {
            // Setting allowance to zero for the old dispatcher
            IERC20(asset()).forceApprove(oldDispatcher, 0);
        }

        // Setting allowance to max for the new dispatcher
        IERC20(asset()).forceApprove(address(dispatcher), type(uint256).max);
    }

    /// @notice Update the entry fee basis points.
    /// @param newEntryFeeBasisPoints New value of the fee basis points.
    function updateEntryFeeBasisPoints(
        uint256 newEntryFeeBasisPoints
    ) external onlyOwner {
        if (newEntryFeeBasisPoints > _BASIS_POINT_SCALE) {
            revert ExceedsMaxFeeBasisPoints();
        }
        entryFeeBasisPoints = newEntryFeeBasisPoints;

        emit EntryFeeBasisPointsUpdated(newEntryFeeBasisPoints);
    }

    /// @notice Update the exit fee basis points.
    /// @param newExitFeeBasisPoints New value of the fee basis points.
    function updateExitFeeBasisPoints(
        uint256 newExitFeeBasisPoints
    ) external onlyOwner {
        if (newExitFeeBasisPoints > _BASIS_POINT_SCALE) {
            revert ExceedsMaxFeeBasisPoints();
        }
        exitFeeBasisPoints = newExitFeeBasisPoints;

        emit ExitFeeBasisPointsUpdated(newExitFeeBasisPoints);
    }

    /// @notice Calls `receiveApproval` function on spender previously approving
    ///         the spender to withdraw from the caller multiple times, up to
    ///         the `value` amount. If this function is called again, it
    ///         overwrites the current allowance with `value`. Reverts if the
    ///         approval reverted or if `receiveApproval` call on the spender
    ///         reverted.
    /// @dev If the `value` is set to `type(uint256).max` then
    ///      `transferFrom` and `burnFrom` will not reduce an allowance.
    /// @param spender The address which will spend the funds.
    /// @param value The amount of tokens to be spent.
    /// @param extraData Additional data.
    /// @return True if both approval and `receiveApproval` calls succeeded.
    function approveAndCall(
        address spender,
        uint256 value,
        bytes memory extraData
    ) external returns (bool) {
        if (approve(spender, value)) {
            IReceiveApproval(spender).receiveApproval(
                msg.sender,
                value,
                address(this),
                extraData
            );
            return true;
        }
        return false;
    }

    /// @notice Disables non-fungible withdrawals.
    function disableNonFungibleWithdrawals() external onlyOwner {
        _disableNonFungibleWithdrawals();
    }

    /// @notice Sets the maximum debt allowance of the debtor.
    /// @param debtor Address of the debtor.
    /// @param newAllowance Maximum debt allowance of the debtor.
    function updateDebtAllowance(
        address debtor,
        uint256 newAllowance
    ) external onlyOwner {
        emit DebtAllowanceUpdated(debtor, newAllowance);

        allowedDebt[debtor] = newAllowance;
    }

    /// @notice Mints the requested amount of shares and registers a debt in
    ///         asset corresponding to the minted amount of shares.
    /// @dev The debt is calculated based on the current conversion
    ///      rate from the shares to assets.
    /// @param shares The amount of shares to mint.
    /// @param receiver The receiver of the shares.
    /// @return assets The debt amount in asset taken for the shares minted.
    function mintDebt(
        uint256 shares,
        address receiver
    ) external whenNotPaused returns (uint256 assets) {
        assets = convertToAssets(shares);

        // Increase the debt of the debtor.
        currentDebt[msg.sender] += assets;

        // Check the maximum debt allowance of the debtor.
        if (currentDebt[msg.sender] > allowedDebt[msg.sender]) {
            revert InsufficientDebtAllowance(
                msg.sender,
                allowedDebt[msg.sender],
                currentDebt[msg.sender]
            );
        }

        emit DebtMinted(msg.sender, currentDebt[msg.sender], assets, shares);

        // Increase the total debt.
        totalDebt += assets;

        // Mint the shares to the receiver.
        super._mint(receiver, shares);

        return shares;
    }

    /// @notice Repay the asset debt, fully of partially with the provided shares.
    /// @dev The debt to be repaid is calculated based on the current conversion
    ///      rate from the shares to assets.
    /// @dev The debtor has to approve the transfer of the shares. To determine
    ///      the asset debt that is going to be repaid, the caller can use
    ///      the `previewRepayDebt` function.
    /// @param shares The amount of shares to return.
    /// @return assets The amount of debt in asset paid off.
    function repayDebt(
        uint256 shares
    ) external whenNotPaused returns (uint256 assets) {
        assets = convertToAssets(shares);

        // Check the current debt of the debtor.
        if (currentDebt[msg.sender] < assets) {
            revert ExcessiveDebtRepayment(
                msg.sender,
                currentDebt[msg.sender],
                assets
            );
        }

        // Decrease the debt of the debtor.
        currentDebt[msg.sender] -= assets;

        emit DebtRepaid(msg.sender, currentDebt[msg.sender], assets, shares);

        // Decrease the total debt.
        totalDebt -= assets;

        // Burn the shares from the debtor.
        super._burn(msg.sender, shares);

        return shares;
    }

    // TEST: Modified function.
    function deposit(
        uint256 assets,
        address receiver
    ) public override returns (uint256) {
        if (assets < minimumDepositAmount) {
            revert LessThanMinDeposit(assets, minimumDepositAmount);
        }
        // TEST: Emit new event.
        emit NewEvent();

        return super.deposit(assets, receiver);
    }

    /// @notice Mints shares to receiver by depositing tBTC tokens.
    /// @dev Takes into account a deposit parameter, minimum deposit amount,
    ///      which determines the minimum amount for a single deposit operation.
    ///      The amount of the assets has to be pre-approved in the tBTC
    ///      contract.
    ///      The msg.sender is required to grant approval for the transfer of a
    ///      certain amount of tBTC, and in addition, approval for the associated
    ///      fee. Specifically, the total amount to be approved (amountToApprove)
    ///      should be equal to the sum of the deposited amount and the fee.
    ///      To determine the total assets amount necessary for approval
    ///      corresponding to a given share amount, use the `previewMint` function.
    /// @param shares Amount of shares to mint.
    /// @param receiver The address to which the shares will be minted.
    /// @return assets Used assets to mint shares.
    function mint(
        uint256 shares,
        address receiver
    ) public override returns (uint256 assets) {
        if ((assets = super.mint(shares, receiver)) < minimumDepositAmount) {
            revert LessThanMinDeposit(assets, minimumDepositAmount);
        }
    }

    /// @notice Withdraws assets from the vault and transfers them to the
    ///         receiver.
    /// @dev Withdraw unallocated assets first and and if not enough, then pull
    ///      the assets from the dispatcher.
    /// @param assets Amount of assets to withdraw.
    /// @param receiver The address to which the assets will be transferred.
    /// @param owner The address of the owner of the shares.
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public override returns (uint256) {
        uint256 currentAssetsBalance = IERC20(asset()).balanceOf(address(this));
        // If there is not enough assets in stBTC to cover user withdrawals and
        // withdrawal fees then pull the assets from the dispatcher.
        uint256 assetsWithFees = assets + _feeOnRaw(assets, exitFeeBasisPoints);
        if (assetsWithFees > currentAssetsBalance) {
            dispatcher.withdraw(assetsWithFees - currentAssetsBalance);
        }

        return super.withdraw(assets, receiver, owner);
    }

    /// @notice Redeems shares for assets and transfers them to the receiver.
    /// @dev Redeem unallocated assets first and and if not enough, then pull
    ///      the assets from the dispatcher.
    /// @param shares Amount of shares to redeem.
    /// @param receiver The address to which the assets will be transferred.
    /// @param owner The address of the owner of the shares.
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public override returns (uint256) {
        uint256 assets = convertToAssets(shares);
        uint256 currentAssetsBalance = IERC20(asset()).balanceOf(address(this));
        if (assets > currentAssetsBalance) {
            dispatcher.withdraw(assets - currentAssetsBalance);
        }

        return super.redeem(shares, receiver, owner);
    }

    /// @notice Returns the total amount of assets held by the vault across all
    ///         allocations and this contract.
    /// @dev The value contains virtual assets reflecting the debt minted by the
    ///      debtors. The debt is not backed by the deposited assets, and it is
    ///      used to adjust the total assets held by the vault, to allow shares
    ///      and assets conversion calculations.
    function totalAssets() public view override returns (uint256) {
        return
            IERC20(asset()).balanceOf(address(this)) +
            dispatcher.totalAssets() +
            totalDebt;
    }

    /// @dev Returns the maximum amount of the underlying asset that can be
    ///      deposited into the Vault for the receiver, through a deposit call.
    ///      If the Vault is paused, returns 0.
    function maxDeposit(address) public view override returns (uint256) {
        if (paused()) {
            return 0;
        }
        return type(uint256).max;
    }

    /// @dev Returns the maximum amount of the Vault shares that can be minted
    ///      for the receiver, through a mint call.
    ///      If the Vault is paused, returns 0.
    function maxMint(address) public view override returns (uint256) {
        if (paused()) {
            return 0;
        }
        return type(uint256).max;
    }

    /// @dev Returns the maximum amount of the underlying asset that can be
    ///      withdrawn from the owner balance in the Vault, through a withdraw call.
    ///      If the Vault is paused, returns 0.
    function maxWithdraw(address owner) public view override returns (uint256) {
        if (paused()) {
            return 0;
        }
        return super.maxWithdraw(owner);
    }

    /// @dev Returns the maximum amount of Vault shares that can be redeemed from
    ///      the owner balance in the Vault, through a redeem call.
    ///      If the Vault is paused, returns 0.
    function maxRedeem(address owner) public view override returns (uint256) {
        if (paused()) {
            return 0;
        }
        return super.maxRedeem(owner);
    }

    /// @notice Returns the number of assets that corresponds to the amount of
    ///         shares held by the specified account.
    /// @dev    This function is used to convert shares to assets position for
    ///         the given account. It does not take fees into account.
    /// @param account The owner of the shares.
    /// @return The amount of assets.
    function assetsBalanceOf(address account) public view returns (uint256) {
        return convertToAssets(balanceOf(account));
    }

    /// @notice Previews the amount of shares that will be burned for the given
    ///         amount of repaid debt assets.
    function previewRepayDebt(uint256 shares) public view returns (uint256) {
        return convertToAssets(shares);
    }

    /// @return Returns entry fee basis point used in deposits.
    function _entryFeeBasisPoints() internal view override returns (uint256) {
        return entryFeeBasisPoints;
    }

    /// @return Returns exit fee basis point used in withdrawals.
    function _exitFeeBasisPoints() internal view override returns (uint256) {
        return exitFeeBasisPoints;
    }

    /// @notice Returns the address of the treasury wallet, where fees should be
    ///         transferred to.
    function _feeRecipient() internal view override returns (address) {
        return treasury;
    }
}
