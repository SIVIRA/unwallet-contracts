// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
pragma solidity 0.8.16;

import "./CoreBaseModule.sol";
import "./CoreRelayerModule.sol";

contract CoreModuleAggregate is CoreBaseModule, CoreRelayerModule {
    constructor(address lockManager) CoreBaseModule(lockManager) {}
}
