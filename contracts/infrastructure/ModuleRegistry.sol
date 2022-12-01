// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
pragma solidity 0.8.17;

import "./base/Ownable.sol";
import "../interface/IModuleRegistry.sol";
import "../utils/Address.sol";

contract ModuleRegistry is Ownable, IModuleRegistry {
    using Address for address;

    mapping(address => bool) internal _modules;

    function isModuleRegistered(address module)
        external
        view
        override
        returns (bool)
    {
        return _modules[module];
    }

    function registerModule(address module) external override onlyOwner {
        require(
            module.isContract(),
            "MR: module must be an existing contract address"
        );
        require(!_modules[module], "MR: module is already registered");

        _modules[module] = true;

        emit ModuleRegistered(module);
    }

    function deregisterModule(address module) external override onlyOwner {
        require(_modules[module], "MR: module is already deregistered");

        delete _modules[module];

        emit ModuleDeregistered(module);
    }
}
