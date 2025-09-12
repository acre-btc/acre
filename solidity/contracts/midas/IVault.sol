// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IVault
 * @notice Interface for the Vault contract.
 * @dev This interface is used to interact with the Vault contract.
 *      It is used to deposit and redeem shares.
 *      It is used to get the price of the shares with convertToShares and convertToAssets.
 *      It is used to request an asynchronous redemption of shares.
 *      It assumes no fees are charged on deposits or redemptions.
 */
interface IVault {
    /**
     * @notice Emitted when assets are deposited into the vault.
     * @param sender The address that deposited the assets.
     * @param owner The address that received the shares.
     * @param assets The amount of assets deposited.
     * @param shares The amount of shares received.
     */
    event Deposit(
        address indexed sender,
        address indexed owner,
        uint256 assets,
        uint256 shares
    );

    /**
     * @notice Emitted when a redeem request is made.
     * @param requestId The request ID.
     * @param sender The address that made the request.
     * @param receiver The address that will received the assets.
     * @param shares The amount of shares that would be redeemed.
     */
    event RedeemRequest(
        uint256 indexed requestId,
        address indexed sender,
        address indexed receiver,
        uint256 shares
    );

    /**
     * @dev Returns the address of the share token. The address MAY be the same
     *      as the vault address.
     *
     * - MUST be an ERC-20 token contract.
     * - MUST NOT revert.
     */
    function share() external view returns (address shareTokenAddress);

    /**
     * @dev Returns the address of the asset token.
     *
     * - MUST be an ERC-20 token contract.
     * - MUST NOT revert.
     */
    function asset() external view returns (address assetTokenAddress);

    /**
     * @dev Returns the amount of shares that the Vault would exchange for the amount of assets provided, in an ideal
     * scenario where all the conditions are met.
     *
     * - MUST NOT be inclusive of any fees that are charged against assets in the Vault.
     * - MUST NOT show any variations depending on the caller.
     * - MUST NOT reflect slippage or other on-chain conditions, when performing the actual exchange.
     * - MUST NOT revert.
     *
     * NOTE: This calculation MAY NOT reflect the “per-user” price-per-share, and instead should reflect the
     * “average-user’s” price-per-share, meaning what the average user should expect to see when exchanging to and
     * from.
     */
    function convertToShares(
        uint256 assets
    ) external view returns (uint256 shares);

    /**
     * @dev Returns the amount of assets that the Vault would exchange for the amount of shares provided, in an ideal
     * scenario where all the conditions are met.
     *
     * - MUST NOT be inclusive of any fees that are charged against assets in the Vault.
     * - MUST NOT show any variations depending on the caller.
     * - MUST NOT reflect slippage or other on-chain conditions, when performing the actual exchange.
     * - MUST NOT revert.
     *
     * NOTE: This calculation MAY NOT reflect the “per-user” price-per-share, and instead should reflect the
     * “average-user’s” price-per-share, meaning what the average user should expect to see when exchanging to and
     * from.
     */
    function convertToAssets(
        uint256 shares
    ) external view returns (uint256 assets);

    /**
     * @dev Mints Vault shares to receiver by depositing exactly amount of underlying tokens.
     *
     * - MUST emit the Deposit event.
     *
     * @param assets The amount of assets to be deposited.
     * @param receiver The address that will received the shares.
     *
     * NOTE: Implementation requires pre-approval of the Vault with the Vault’s underlying asset token.
     */
    function deposit(
        uint256 assets,
        address receiver
    ) external returns (uint256 shares);

    /**
     * @dev Assumes control of shares from sender into the Vault and submits a Request for asynchronous redeem.
     *
     * - MUST emit the RedeemRequest event.
     * - Once a request is finalized MUST emit the RedeemFinalize event.
     *
     * @param shares The amount of shares to be redeemed.
     * @param receiver The address that will receive assets on request finalization.
     *
     * NOTE: Implementations requires pre-approval of the Vault with the Vault's share token.
     */
    function requestRedeem(
        uint256 shares,
        address receiver
    ) external returns (uint256 requestId);
}
