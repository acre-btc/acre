// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.8.24;

import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IMezoPortal} from "./interfaces/IMezoPortal.sol";
import {ZeroAddress} from "./utils/Errors.sol";

/// @notice AcreMultiAssetVault is a contract that allows users to deposit and withdraw
///         multiple assets. It uses MezoPortal to deposit and withdraw assets.
contract AcreMultiAssetVault is
    Ownable2StepUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    /// @notice Address of the MezoPortal contract.
    IMezoPortal public mezoPortal;

    /// @notice Reverts when a new asset is added to the list of supported assets.
    error AssetAlreadySupported();

    /// @notice Reverts when the asset being deposited is not on the supported
    ///         assets list.
    ///         Also reverts when the asset being removed from the supported
    ///         assets list is not on the supported assets list.
    error AssetNotSupported();

    /// @notice Reverts when a checked amount is invalid.
    error InvalidAmount(uint256 amount);

    /// @notice Reverts when the deposit owner is invalid:
    ///         - the deposit owner is the zero address,
    ///         - the deposit owner is the asset itself.
    error InvalidDepositOwner(address depositOwner);

    /// @notice Reverts when the receiver is invalid:
    ///         - the receiver is the zero address,
    ///         - the receiver is the asset itself.
    error InvalidReceiver(address receiver);

    /// @notice Reverts when a deposit is not found.
    error DepositNotFound();

    /// @notice Reverts when the amount withdrawn from the Mezo Portal doesn't
    ///         match the deposited amount. This indicates an unexpected problem
    ///         with the Mezo Portal integration.
    error UnexpectedWithdrawnAmount(
        uint256 withdrawnAmount,
        uint256 depositedAmount
    );

    /// @notice Emitted when an asset is added to the list of supported assets.
    event SupportedAssetAdded(address asset);

    /// @notice Emitted when an asset is removed from the list of supported assets.
    event SupportedAssetRemoved(address asset);

    /// @notice Emitted when a new deposit is created.
    event DepositCreated(
        address indexed depositOwner,
        address indexed asset,
        uint256 indexed depositId,
        uint256 amount
    );

    /// @notice Emitted when a deposit is withdrawn.
    event DepositWithdrawn(
        address indexed depositOwner,
        address indexed asset,
        uint256 indexed depositId,
        uint256 amount,
        address receiver
    );

    /// @notice Details of a deposit.
    struct DepositInfo {
        uint256 balance;
        uint256 mezoDepositId;
    }

    /// @notice The number of deposits created. Includes the deposits that
    ///         were fully withdrawn. This is also the identifier of the most
    ///         recently created deposit.
    uint256 public depositCount;

    mapping(address => bool) public supportedAssets;

    /// @notice Mapping of the details of deposits:
    ///         deposit owner -> asset -> deposit id -> DepositInfo
    /// @dev The deposit ID is unique for each deposit.
    /// @dev When a deposit is withdrawn, the DepositInfo is deleted.
    mapping(address => mapping(address => mapping(uint256 => DepositInfo)))
        public deposits;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _owner,
        address _mezoPortal,
        address[] memory _supportedAssets
    ) public initializer {
        __Ownable2Step_init();
        __ReentrancyGuard_init();

          if (_mezoPortal == address(0)) {
            revert ZeroAddress();
    }

        mezoPortal = IMezoPortal(_mezoPortal);

        for (uint256 i = 0; i < _supportedAssets.length; i++) {
            _addSupportedAsset(_supportedAssets[i]);
    }
}

    /// @notice Adds an asset to the list of assets supported by the vault.
    /// @dev This function can only be called by the owner.
    /// @param asset Address of the asset to be added to the supported assets.
    function addSupportedAsset(address asset) external onlyOwner {
        return _addSupportedAsset(asset);
    }

    /// @notice Adds an asset to the list of assets supported by the vault.
    /// @param asset Address of the asset to be added to the supported assets.
    function _addSupportedAsset(address asset) internal {
        if (asset == address(0)) {
            revert ZeroAddress();
        }
        if (supportedAssets[asset]) {
            revert AssetAlreadySupported();
        }

        emit SupportedAssetAdded(asset);

        supportedAssets[asset] = true;
    }

    /// @notice Removes an asset from the list of assets supported by the vault.
    /// @dev This function can only be called by the owner.
    /// @param asset Address of the asset to be removed from the supported assets.
    function removeSupportedAsset(address asset) external onlyOwner {
        if (!supportedAssets[asset]) {
            revert AssetNotSupported();
        }

        emit SupportedAssetRemoved(asset);

        supportedAssets[asset] = false;
    }

    /// @notice Deposits an asset into the vault.
    /// @param asset Address of the asset to be deposited.
    /// @param amount Amount of the asset to be deposited (in the asset precision).
    /// @return The ID of the deposit.
    function deposit(address asset, uint256 amount) external returns (uint256) {
        return depositFor(asset, amount, msg.sender);
    }

    /// @notice Deposits assets into the vault on behalf of a specified account,
    ///         which will become the owner of the deposit. Only the owner of the
    ///         deposit can withdraw the assets.
    /// @param asset Address of the asset to be deposited.
    /// @param amount The amount of deposit.
    /// @param depositOwner The address of the account for which the deposit is
    ///        being made.
    /// @return The ID of the deposit.
    function depositFor(
        address asset,
        uint256 amount,
        address depositOwner
    ) public nonReentrant returns (uint256) {
        if (!supportedAssets[asset]) {
            revert AssetNotSupported();
        }
        if (amount == 0) {
            revert InvalidAmount(amount);
        }
        if (depositOwner == address(0) || supportedAssets[depositOwner]) {
            revert InvalidDepositOwner(depositOwner);
        }

        // Generate a new deposit ID.
        uint256 depositId = ++depositCount;

        emit DepositCreated(depositOwner, asset, depositId, amount);

        // Transfer the asset from the deposit owner to the vault and approve
        // Mezo Portal to pull them.
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(asset).forceApprove(address(mezoPortal), amount);

        // Create a deposit in Mezo Portal.
        // 0 denotes no lock period for this deposit.
        mezoPortal.deposit(address(asset), uint96(amount), 0);

        // MezoPortal doesn't return depositId, so we have to read depositCounter
        // which assigns depositId to the current deposit.
        uint256 mezoDepositId = mezoPortal.depositCount();

        // Register the deposit info.
        // slither-disable-next-line reentrancy-benign
        deposits[depositOwner][asset][depositId] = DepositInfo({
            balance: amount,
            mezoDepositId: mezoDepositId
        });

        return depositId;
    }

    /// @notice Withdraws all deposited assets from the given deposit.
    /// @dev It can be called by the deposit owner only.
    /// @param asset Address of the asset to be withdrawn.
    /// @param depositId ID of the deposit.
    /// @param receiver Address of the account to which the assets will be sent.
    /// @return The amount of assets withdrawn.
    function withdraw(
        address asset,
        uint256 depositId,
        address receiver
    ) external nonReentrant returns (uint256) {
        if (receiver == address(0) || supportedAssets[receiver]) {
            revert InvalidReceiver(receiver);
        }

        // Read the deposit info before it gets deleted from the storage.
        DepositInfo memory selectedDeposit = deposits[msg.sender][asset][
            depositId
        ];
        uint256 depositedAmount = selectedDeposit.balance;

        // Delete the deposit info, as the deposit is being fully withdrawn.
        delete deposits[msg.sender][asset][depositId];

        // Check if the deposit exists. If the deposit was not created or was
        // already withdrawn, the depositedAmount will be 0.
        if (depositedAmount == 0) {
            revert DepositNotFound();
        }

        // Withdraw the assets from the MezoPortal. Check if the withdrawn amount
        // matches the deposited amount.
        uint256 initialBalance = IERC20(asset).balanceOf(address(this));

        mezoPortal.withdraw(asset, selectedDeposit.mezoDepositId);

        uint256 withdrawnAmount = IERC20(asset).balanceOf(address(this)) -
            initialBalance;

        if (withdrawnAmount != depositedAmount) {
            revert UnexpectedWithdrawnAmount(withdrawnAmount, depositedAmount);
        }

        emit DepositWithdrawn(
            msg.sender,
            asset,
            depositId,
            withdrawnAmount,
            receiver
        );

        // Transfer the withdrawn assets to the receiver.
        IERC20(asset).safeTransfer(receiver, withdrawnAmount);

        return withdrawnAmount;
    }

    /// @notice Get details of a deposit.
    /// @dev If the deposit was not created or was already withdrawn, the
    ///      function will return a DepositInfo with balance 0.
    /// @param depositOwner Address of the deposit owner.
    /// @param asset Address of the asset used in the deposit.
    /// @param depositId ID of the deposit.
    function getDeposit(
        address depositOwner,
        address asset,
        uint256 depositId
    ) external view returns (DepositInfo memory) {
        return deposits[depositOwner][asset][depositId];
    }
}
