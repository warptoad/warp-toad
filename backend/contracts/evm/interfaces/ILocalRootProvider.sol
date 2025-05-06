// SPDX-License-Identifier: MIT

pragma solidity 0.8.29;

interface ILocalRootProvider {
    function getLocalRootAndBlock() external returns (uint256, uint256);
}