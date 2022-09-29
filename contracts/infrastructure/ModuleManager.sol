// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
pragma solidity 0.8.16;

import "./base/Ownable.sol";
import "../interface/IModuleManager.sol";
import "../interface/IModuleRegistry.sol";
import "../utils/Address.sol";

contract ModuleManager is Ownable, IModuleManager {
    using Address for address;

    bool internal _isInitialized;
    IModuleRegistry internal immutable _registry;

    struct ModuleState {
        bool isEnabled;
        bool isFixed;
    }

    mapping(address => ModuleState) internal _moduleStates;
    mapping(bytes4 => address) internal _delegates;

    constructor(address registry) {
        require(
            registry.isContract(),
            "MM: registry must be an existing contract address"
        );

        _isInitialized = true;
        _registry = IModuleRegistry(registry);
    }

    function initialize(address initialOwner) external {
        require(!_isInitialized, "MM: contract is already initialized");

        _isInitialized = true;

        _setOwner(initialOwner);
    }

    function isModuleEnabled(address module)
        external
        view
        override
        returns (bool)
    {
        return _moduleStates[module].isEnabled;
    }

    function isModuleFixed(address module)
        external
        view
        override
        returns (bool)
    {
        return _moduleStates[module].isFixed;
    }

    function enableModule(address module) external override onlyOwner {
        require(!_moduleStates[module].isEnabled, "MM: enabled module");
        require(
            _registry.isModuleRegistered(module),
            "MM: unregistered module"
        );

        _moduleStates[module].isEnabled = true;

        emit ModuleEnabled(module);
    }

    function disableModule(address module) external override onlyOwner {
        require(_moduleStates[module].isEnabled, "MM: disabled module");
        require(!_moduleStates[module].isFixed, "MM: fixed module");

        delete _moduleStates[module];

        emit ModuleDisabled(module);
    }

    function fixModule(address module) external override onlyOwner {
        require(!_moduleStates[module].isFixed, "MM: fixed module");
        require(_moduleStates[module].isEnabled, "MM: disabled module");

        _moduleStates[module].isFixed = true;

        emit ModuleFixed(module);
    }

    function getDelegate(bytes4 methodID)
        external
        view
        override
        returns (address)
    {
        return _delegates[methodID];
    }

    function enableDelegation(bytes4 methodID, address module)
        external
        override
        onlyOwner
    {
        require(_delegates[methodID] != module, "MM: enabled delegation");
        require(_moduleStates[module].isEnabled, "MM: disabled module");

        _delegates[methodID] = module;

        emit DelegationEnabled(methodID, module);
    }

    function disableDelegation(bytes4 methodID) external override onlyOwner {
        require(_delegates[methodID] != address(0), "MM: disabled delegation");

        delete _delegates[methodID];

        emit DelegationDisabled(methodID);
    }
}
