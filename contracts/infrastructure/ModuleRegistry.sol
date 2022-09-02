// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
pragma solidity 0.8.16;

import "./base/Ownable.sol";
import "../interface/IModuleRegistry.sol";

contract ModuleRegistry is Ownable, IModuleRegistry {
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
        require(!_modules[module], "MR: registered module");

        _modules[module] = true;

        emit ModuleRegistered(module);
    }

    function deregisterModule(address module) external override onlyOwner {
        require(_modules[module], "MR: unregistered module");

        delete _modules[module];

        emit ModuleDeregistered(module);
    }
}
