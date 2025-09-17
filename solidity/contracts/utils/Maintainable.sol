// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.8.24;

import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {ZeroAddress} from "../utils/Errors.sol";

contract Maintainable is Ownable2StepUpgradeable {
    /// @notice Keeps track of the addresses that are allowed to trigger deposit
    ///         allocations.
    mapping(address => bool) public isMaintainer;

    /// @notice List of maintainers.
    address[] public maintainers;

    /// @notice Emitted when the maintainer address is updated.
    event MaintainerAdded(address indexed maintainer);

    /// @notice Emitted when the maintainer address is updated.
    event MaintainerRemoved(address indexed maintainer);

    /// @notice Reverts if the caller is not a maintainer.
    error CallerNotMaintainer();

    /// @notice Reverts if the maintainer is not registered.
    error MaintainerNotRegistered();

    /// @notice Reverts if the maintainer has been already registered.
    error MaintainerAlreadyRegistered();

    modifier onlyMaintainer() {
        if (!isMaintainer[msg.sender]) {
            revert CallerNotMaintainer();
        }
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function __MaintainableOwnable_init(
        address initialOwner
    ) public initializer {
        __Ownable2Step_init();
        __Ownable_init(initialOwner);
    }

    /// @notice Adds a new maintainer address.
    /// @param maintainerToAdd Address of the new maintainer.
    function addMaintainer(address maintainerToAdd) external onlyOwner {
        if (maintainerToAdd == address(0)) {
            revert ZeroAddress();
        }
        if (isMaintainer[maintainerToAdd]) {
            revert MaintainerAlreadyRegistered();
        }
        maintainers.push(maintainerToAdd);
        isMaintainer[maintainerToAdd] = true;

        emit MaintainerAdded(maintainerToAdd);
    }

    /// @notice Removes the maintainer address.
    /// @param maintainerToRemove Address of the maintainer to remove.
    function removeMaintainer(address maintainerToRemove) external onlyOwner {
        if (!isMaintainer[maintainerToRemove]) {
            revert MaintainerNotRegistered();
        }
        delete (isMaintainer[maintainerToRemove]);

        for (uint256 i = 0; i < maintainers.length; i++) {
            if (maintainers[i] == maintainerToRemove) {
                maintainers[i] = maintainers[maintainers.length - 1];
                // slither-disable-next-line costly-loop
                maintainers.pop();
                break;
            }
        }

        emit MaintainerRemoved(maintainerToRemove);
    }

    /// @notice Returns the list of maintainers.
    function getMaintainers() external view returns (address[] memory) {
        return maintainers;
    }
}
