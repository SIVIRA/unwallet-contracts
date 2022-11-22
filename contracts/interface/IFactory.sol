// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.8.16;

interface IFactory {
    function create(
        bytes memory code,
        uint256 salt,
        bytes calldata data
    ) external returns (address);
}
