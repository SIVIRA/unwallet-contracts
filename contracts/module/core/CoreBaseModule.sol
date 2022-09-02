// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
pragma solidity 0.8.16;

import "../../interface/ILockManager.sol";

contract CoreBaseModule {
    ILockManager internal immutable _lockManager;

    constructor(address lockManager) {
        require(
            lockManager != address(0),
            "CBM: lock manager must not be the zero address"
        );

        _lockManager = ILockManager(lockManager);
    }

    modifier onlySelf() {
        require(_isSelf(msg.sender), "CBM: caller must be myself");
        _;
    }

    modifier onlyWhenIdentityUnlocked(address identity) {
        require(!_isIdentityLocked(identity), "CBM: identity must be unlocked");
        _;
    }

    function _isSelf(address addr) internal view returns (bool) {
        return addr == address(this);
    }

    function _isIdentityLocked(address identity) internal view returns (bool) {
        return _lockManager.isIdentityLocked(identity);
    }

    function ping() external view onlySelf {}
}
