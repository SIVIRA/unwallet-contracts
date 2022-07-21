// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "../interface/IERC165.sol";
import "../interface/IIdentity.sol";
import "../interface/ILockManager.sol";

contract TestModule {
    function supportsInterface(bytes4 interfaceID)
        external
        pure
        returns (bool)
    {
        return interfaceID == type(IERC165).interfaceId;
    }

    function lockIdentity(address lockManager, address identity) external {
        ILockManager(lockManager).lockIdentity(identity);
    }

    function unlockIdentity(address lockManager, address identity) external {
        ILockManager(lockManager).unlockIdentity(identity);
    }

    function setOwner(address identity, address newOwner) external {
        IIdentity(identity).setOwner(newOwner);
    }

    function setModuleManager(address identity, address newModuleManager)
        external
    {
        IIdentity(identity).setModuleManager(newModuleManager);
    }

    function execute(
        address identity,
        address to,
        uint256 value,
        bytes calldata data
    ) external {
        IIdentity(identity).execute(to, value, data);
    }
}
