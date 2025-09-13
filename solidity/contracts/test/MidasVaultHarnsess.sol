// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IVault} from "../midas/IVault.sol";

contract MidasVaultStub is IVault {
    using SafeERC20 for IERC20;
    using Math for uint256;

    address public immutable asset;
    address public immutable share;

    uint256 public redeemRequestId = 100;

    event MidasVaultRedeemRequested(uint256 shares, address receiver);

    constructor(address _asset, address _share) {
        asset = _asset;
        share = _share;
    }

    function deposit(
        uint256 assets,
        address receiver
    ) external returns (uint256 shares) {
        shares = convertToShares(assets);

        IERC20(asset).safeTransferFrom(msg.sender, address(this), assets);
        MidasVaultSharesStub(share).mint(receiver, shares);
    }

    function requestRedeem(
        uint256 shares,
        address receiver
    ) external returns (uint256) {
        uint256 assets = convertToAssets(shares);

        MidasVaultSharesStub(share).burn(msg.sender, shares);

        emit MidasVaultRedeemRequested(shares, receiver);

        IERC20(asset).safeTransfer(receiver, assets);

        return ++redeemRequestId;
    }

    function totalAssets() public view returns (uint256) {
        return IERC20(asset).balanceOf(address(this));
    }

    function totalSupply() public view returns (uint256) {
        return IERC20(share).totalSupply();
    }

    function convertToShares(
        uint256 assets
    ) public view returns (uint256 shares) {
        return
            assets.mulDiv(
                totalSupply() + 1,
                totalAssets() + 1,
                Math.Rounding.Floor
            );
    }

    function convertToAssets(
        uint256 shares
    ) public view returns (uint256 assets) {
        return
            shares.mulDiv(
                totalAssets() + 1,
                totalSupply() + 1,
                Math.Rounding.Floor
            );
    }
}

contract MidasVaultSharesStub is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address account, uint256 value) external {
        _mint(account, value);
    }

    function burn(address account, uint256 value) external {
        _burn(account, value);
    }
}
