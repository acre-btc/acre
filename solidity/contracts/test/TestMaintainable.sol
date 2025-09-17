pragma solidity 0.8.24;

import {Maintainable} from "../utils/Maintainable.sol";

contract TestMaintainable is Maintainable {
    function initialize() public initializer {
        __MaintainableOwnable_init(msg.sender);
    }
}
