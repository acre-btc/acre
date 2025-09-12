// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Maintainable} from "../utils/Maintainable.sol";
import {IVault} from "./IVault.sol";
import {ZeroAddress} from "../utils/Errors.sol";
import {ITBTCToken} from "../bridge/ITBTCToken.sol";
import {acreBTC} from "../acreBTC.sol";
import {MidasAllocator} from "./MidasAllocator.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IBridge} from "../bridge/IBridge.sol";

contract WithdrawalQueue is Maintainable {
    using SafeERC20 for IERC20;
    using Math for uint256;

    /// @notice Struct representing a redemption request with bridging to Bitcoin.
    /// @param redeemer The owner of the acreBTC shares to be redeemed.
    /// @param tbtcAmount Amount of tBTC to be redeemed (after exit fee).
    /// @param exitFeeInTbtc Exit fee amount in tBTC.
    /// @param completedAt Timestamp when the request was completed (0 if not completed).
    /// @param redeemerOutputScriptHash Hash of the output script for the Bitcoin redeemer.
    struct RedeemAndBridgeRequest {
        address redeemer;
        uint256 tbtcAmount;
        uint256 exitFeeInTbtc;
        uint256 completedAt;
        bytes32 redeemerOutputScriptHash;
    }

    /// @notice tBTC token contract.
    ITBTCToken public tbtc;

    /// @notice Midas Vault contract.
    IVault public midasVault;

    /// @notice Midas Vault receipt token (ERC20).
    IERC20 public vaultSharesToken;

    /// @notice Mapping of withdrawal request IDs to their data.
    mapping(uint256 => RedeemAndBridgeRequest) public redemAndBridgeRequests;

    /// @notice Counter for withdrawal requests (auto-incremented).
    uint256 public count;

    /// @notice Midas Allocator contract.
    MidasAllocator public midasAllocator;

    /// @notice tBTC Vault contract address (used for bridging).
    address public tbtcVault;

    /// @notice acreBTC contract.
    acreBTC public acrebtc;

    /// @notice tBTC Bridge contract.
    address public tbtcBridge;

    /// @notice Error thrown if caller is not the Midas Allocator.
    error NotMidasAllocator();

    /// @notice Error thrown if caller is not the acreBTC contract.
    error NotAcreBTC();

    /// @notice Error thrown if the provided address is not the tBTC token owner.
    error NotTbtcTokenOwner();

    /// @notice Error thrown if the tBTC token owner is not as expected.
    error UnexpectedTbtcTokenOwner();

    /// @notice Error thrown if the redemption amount is too small.
    error RedemptionAmountTooSmall(uint256 amount, uint256 minimumAmount);

    /// @notice Error thrown if approveAndCall fails.
    error ApproveAndCallFailed();

    /// @notice Error thrown if a withdrawal request is already completed.
    error WithdrawalRequestAlreadyCompleted();

    /// @notice Error thrown if a withdrawal request is not found.
    error WithdrawalRequestNotFound();

    /// @notice Error thrown if redemption data is invalid.
    /// @param redeemer The redeemer address in the redemption data.
    /// @param expectedRedeemer The expected redeemer address.
    /// @param redeemerOutputScriptHash The output script hash in the redemption data.
    /// @param expectedRedeemerOutputScriptHash The expected output script hash.
    error InvalidRedemptionData(
        address redeemer,
        address expectedRedeemer,
        bytes32 redeemerOutputScriptHash,
        bytes32 expectedRedeemerOutputScriptHash
    );

    /// @notice Emitted when a redemption is requested.
    /// @param requestId The withdrawal request ID.
    /// @param receiver The address to receive the tBTC.
    /// @param midasRequestId The Midas Vault redemption request ID.
    /// @param tbtcAmount The amount of tBTC to be redeemed (after exit fee).
    /// @param midasShares The amount of Midas Vault shares to redeem.
    event RedeemRequested(
        uint256 indexed requestId,
        address indexed receiver,
        uint256 indexed midasRequestId,
        uint256 tbtcAmount,
        uint256 midasShares
    );

    /// @notice Emitted when a redemption of shares corresponding to a fee is requested.
    /// @param requestId The withdrawal request ID.
    /// @param midasRequestId The Midas Vault redemption request ID for the fee.
    /// @param exitFeeInTbtc The exit fee in tBTC.
    /// @param exitFeeInMidasShares The exit fee in Midas Vault shares.
    event RedeemFeeRequested(
        uint256 indexed requestId,
        uint256 indexed midasRequestId,
        uint256 exitFeeInTbtc,
        uint256 exitFeeInMidasShares
    );

    /// @notice Emitted when a redemption with bridging to Bitcoin is requested.
    /// @param requestId The withdrawal request ID.
    /// @param midasRequestId The Midas Vault redemption request ID.
    /// @param tbtcAmount The amount of tBTC to be redeemed (after exit fee).
    /// @param exitFeeInTbtc The exit fee in tBTC.
    /// @param midasSharesWithFee The amount of Midas Vault shares to redeem (including exit fee).
    event RedeemAndBridgeRequested(
        uint256 indexed requestId,
        address indexed redeemer,
        uint256 indexed midasRequestId,
        uint256 tbtcAmount,
        uint256 exitFeeInTbtc,
        uint256 midasSharesWithFee
    );

    /// @notice Emitted when a RedeemAndBridge request is completed and bridging to
    ///         Bitcoin is requested.
    /// @param requestId The withdrawal request ID.
    /// @param redeemer The redeemer address.
    /// @param tbtcAmount The amount of tBTC to be bridged.
    event RedeemCompletedAndBridgeRequested(
        uint256 indexed requestId,
        address indexed redeemer,
        uint256 tbtcAmount
    );

    /// @notice Emitted when the tBTC vault address is updated.
    /// @param oldTbtcVault The previous tBTC vault address.
    /// @param newTbtcVault The new tBTC vault address.
    event TbtcVaultUpdated(address oldTbtcVault, address newTbtcVault);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Restricts function to only be callable by the acreBTC contract.
    modifier onlyAcreBTC() {
        if (msg.sender != address(acrebtc)) {
            revert NotAcreBTC();
        }
        _;
    }

    /// @notice Initializes the WithdrawalQueue contract.
    /// @param _tbtc Address of the tBTC token contract.
    /// @param _midasVault Address of the Midas Vault contract.
    /// @param _midasAllocator Address of the Midas Allocator contract.
    /// @param _tbtcVault Address of the tBTC Vault contract.
    /// @param _acreBTC Address of the acreBTC contract.
    function initialize(
        address _tbtc,
        address _midasVault,
        address _midasAllocator,
        address _tbtcVault,
        address _acreBTC,
        address _tbtcBridge
    ) public initializer {
        __MaintainableOwnable_init(msg.sender);

        if (_tbtc == address(0)) {
            revert ZeroAddress();
        }
        if (_midasVault == address(0)) {
            revert ZeroAddress();
        }
        if (_tbtcVault == address(0)) {
            revert ZeroAddress();
        }
        if (_acreBTC == address(0)) {
            revert ZeroAddress();
        }
        if (_tbtcBridge == address(0)) {
            revert ZeroAddress();
        }

        tbtc = ITBTCToken(_tbtc);
        midasVault = IVault(_midasVault);
        tbtcVault = _tbtcVault;
        acrebtc = acreBTC(_acreBTC);
        tbtcBridge = _tbtcBridge;

        vaultSharesToken = IERC20(midasVault.share());
        if (address(vaultSharesToken) == address(0)) {
            revert ZeroAddress();
        }

        if (_midasAllocator == address(0)) {
            revert ZeroAddress();
        }

        midasAllocator = MidasAllocator(_midasAllocator);
    }

    /// @notice Requests a redemption of shares for tBTC, optionally charging an exit fee.
    /// @dev Only callable by the acreBTC contract.
    /// @param _shares Amount of acreBTC shares to redeem.
    /// @param _receiver Address to receive the tBTC.
    /// @param _exitFeeInTbtc Exit fee in tBTC to be charged and sent to the treasury.
    /// @return requestId The ID of the withdrawal request.
    function requestRedeem(
        uint256 _shares,
        address _receiver,
        uint256 _exitFeeInTbtc
    ) external onlyAcreBTC returns (uint256 requestId) {
        requestId = ++count;

        (
            uint256 midasShares,
            uint256 tbtcAmountWithFee
        ) = _prepareSharesRedemption(_shares);

        if (_exitFeeInTbtc > 0) {
            uint256 exitFeeInMidasShares = midasVault.convertToShares(
                _exitFeeInTbtc
            );

            // TODO: Consider accumulating the exit fees and redeeming them in a
            // single request to optimize the number of requests and reduce gas fees.
            uint256 feeMidasRequestId = midasVault.requestRedeem(
                exitFeeInMidasShares,
                acrebtc.treasury()
            );

            emit RedeemFeeRequested(
                requestId,
                feeMidasRequestId,
                _exitFeeInTbtc,
                exitFeeInMidasShares
            );

            midasShares -= exitFeeInMidasShares;
        }

        uint256 midasRequestId = midasVault.requestRedeem(
            midasShares,
            _receiver
        );

        emit RedeemRequested(
            requestId,
            _receiver,
            midasRequestId,
            tbtcAmountWithFee - _exitFeeInTbtc,
            midasShares
        );
    }

    /// @notice Requests a redemption with bridging to Bitcoin.
    /// @dev Only callable by the acreBTC contract.
    /// @param _shares Amount of acreBTC shares to redeem.
    /// @param _redeemer The owner of the acreBTC shares to be redeemed.
    /// @param _redeemerOutputScript The output script for the Bitcoin redeemer.
    /// @param _exitFeeInTbtc Exit fee in tBTC to be charged and sent to the treasury.
    /// @return requestId The ID of the withdrawal request.
    function requestRedeemAndBridge(
        uint256 _shares,
        address _redeemer,
        bytes calldata _redeemerOutputScript,
        uint256 _exitFeeInTbtc
    ) external onlyAcreBTC returns (uint256 requestId) {
        requestId = ++count;

        (
            uint256 midasSharesWithFee,
            uint256 tbtcAmountWithFee
        ) = _prepareSharesRedemption(_shares);

        uint256 midasRequestId = midasVault.requestRedeem(
            midasSharesWithFee,
            address(this)
        );

        uint256 tbtcAmount = tbtcAmountWithFee - _exitFeeInTbtc;

        // Check if the redemption amount is greater than the minimum redemption
        // amount for bridging to Bitcoin.
        uint64 minimumTbtcAmount = minimumBridgeRedemptionTbtcAmount();
        if (tbtcAmount < minimumTbtcAmount) {
            revert RedemptionAmountTooSmall(tbtcAmount, minimumTbtcAmount);
        }

        redemAndBridgeRequests[requestId] = RedeemAndBridgeRequest({
            redeemer: _redeemer,
            tbtcAmount: tbtcAmount,
            exitFeeInTbtc: _exitFeeInTbtc,
            redeemerOutputScriptHash: keccak256(_redeemerOutputScript),
            completedAt: 0
        });

        emit RedeemAndBridgeRequested(
            requestId,
            _redeemer,
            midasRequestId,
            tbtcAmount,
            _exitFeeInTbtc,
            midasSharesWithFee
        );
    }

    /// @notice Returns the minimum redemption amount of tBTC for bridging to Bitcoin.
    /// @return The minimum redemption amount of tBTC.
    function minimumBridgeRedemptionTbtcAmount() public view returns (uint64) {
        // slither-disable-next-line unused-return
        (uint64 redemptionDustThresholdInSatoshis, , , , , , ) = IBridge(
            tbtcBridge
        ).redemptionParameters();

        return redemptionDustThresholdInSatoshis * 10 ** 10;
    }

    /// @notice Completes a withdrawal request and initiates the bridge to Bitcoin.
    /// @dev Only callable by a maintainer.
    /// @param _requestId ID of the withdrawal request.
    /// @param _tbtcRedemptionData Additional data required for the tBTC redemption.
    ///        See `redemptionData` parameter description of `Bridge.requestRedemption`.
    function finalizeRedeemAndBridge(
        uint256 _requestId,
        bytes calldata _tbtcRedemptionData
    ) external onlyMaintainer {
        RedeemAndBridgeRequest storage request = redemAndBridgeRequests[
            _requestId
        ];
        if (request.redeemer == address(0)) revert WithdrawalRequestNotFound();
        if (request.completedAt > 0) revert WithdrawalRequestAlreadyCompleted();

        // Mark request as completed.
        request.completedAt = block.timestamp;

        emit RedeemCompletedAndBridgeRequested(
            _requestId,
            request.redeemer,
            request.tbtcAmount
        );

        // Take exit fee.
        if (request.exitFeeInTbtc > 0) {
            IERC20(address(tbtc)).safeTransfer(
                acrebtc.treasury(),
                request.exitFeeInTbtc
            );
        }

        _bridgeToBitcoin(request, _tbtcRedemptionData);
    }

    /// @notice Initiates bridging to Bitcoin via tBTC Bridge.
    /// @dev Redemption data must be formatted as expected by the tBTC Bridge's
    ///      `receiveBalanceApproval`.
    ///      The tBTC token owner (the TBTCVault contract) is used as the spender
    ///      of tBTC for redemption.
    ///      The redemption data must include a `redeemer` address and output script
    ///      matching the original request.
    ///      If the tBTC Bridge redemption process fails or times out, the redeemer
    ///      can claim tBTC from the tBTC Bank contract.
    /// @param _request The withdrawal request.
    /// @param _tbtcRedemptionData Additional data required for the tBTC redemption.
    function _bridgeToBitcoin(
        RedeemAndBridgeRequest storage _request,
        bytes calldata _tbtcRedemptionData
    ) internal {
        // Ensure the tBTC token owner is the expected TBTCVault contract.
        if (tbtc.owner() != tbtcVault) revert UnexpectedTbtcTokenOwner();

        // Decode redemption data.
        (address redeemer, , , , , bytes memory redeemerOutputScript) = abi
            .decode(
                _tbtcRedemptionData,
                (address, bytes20, bytes32, uint32, uint64, bytes)
            );

        // Check if redemption data matches the owner (redeemer) and the redeemer
        // output script passed in the initial redemption request.
        if (
            redeemer != _request.redeemer ||
            keccak256(redeemerOutputScript) != _request.redeemerOutputScriptHash
        )
            revert InvalidRedemptionData(
                redeemer,
                _request.redeemer,
                keccak256(redeemerOutputScript),
                _request.redeemerOutputScriptHash
            );

        // Initialize tBTC Bridge redemption process.
        if (
            !tbtc.approveAndCall(
                tbtcVault,
                _request.tbtcAmount,
                _tbtcRedemptionData
            )
        ) {
            revert ApproveAndCallFailed();
        }
    }

    /// @notice Updates the TBTCVault contract address.
    /// @param newTbtcVault The new TBTCVault contract address.
    function updateTbtcVault(address newTbtcVault) external onlyOwner {
        if (newTbtcVault == address(0)) {
            revert ZeroAddress();
        }

        if (newTbtcVault != tbtc.owner()) {
            revert NotTbtcTokenOwner();
        }

        emit TbtcVaultUpdated(tbtcVault, newTbtcVault);

        tbtcVault = newTbtcVault;
    }

    /// @notice Prepares for a shares redemption in the Midas Vault.
    /// @dev Pulls the Midas shares from the Midas Allocator, which causes
    ///      `MidasAllocator.totalAssets` to decrease. To maintain the balance
    ///      between totalAssets and totalSupply of the Acre Vault, burns the
    ///      corresponding acreBTC shares. Approves the Midas shares to the vault
    ///      for redemption. Returns the calculated tBTC amount for the given acreBTC shares.
    /// @param _acreShares Number of acreBTC shares to redeem.
    /// @return midasShares Number of Midas shares corresponding to the provided acreBTC shares.
    /// @return tbtcAmount Amount of tBTC corresponding to the provided acreBTC shares.
    function _prepareSharesRedemption(
        uint256 _acreShares
    ) internal returns (uint256 midasShares, uint256 tbtcAmount) {
        // Calculate the tBTC amount corresponding to the provided acreBTC shares amount.
        tbtcAmount = acrebtc.convertToAssets(_acreShares);

        // Calculate the number of midas shares corresponding to the provided tBTC amount.
        midasShares = midasVault.convertToShares(tbtcAmount);

        // Withdraw the midas shares from the Midas Allocator.
        midasAllocator.withdrawShares(midasShares);

        // Burn the corresponding acreBTC shares.
        acrebtc.burn(_acreShares);

        // Approve the midas shares to the vault to be able to redeem them later.
        vaultSharesToken.forceApprove(address(midasVault), midasShares);
    }
}
