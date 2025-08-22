// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./FarmGame.sol";

contract FarmGameV2 is FarmGame {
    function version() external pure returns (string memory) {
        return "v2";
    }
}
