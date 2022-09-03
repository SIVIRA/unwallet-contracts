// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
pragma solidity 0.8.16;

import "./base/Ownable.sol";
import "../interface/IIdentity.sol";
import "../utils/Address.sol";
import "../Proxy.sol";

contract IdentityProxyFactory is Ownable {
    using Address for address;

    address public immutable identityImplementation;

    event ProxyCreated(address indexed proxy);

    constructor(address identityImpl) {
        require(
            identityImpl.isContract(),
            "IPF: identity implementation must be an existing contract address"
        );

        identityImplementation = identityImpl;
    }

    function getProxyAddress(bytes32 salt) external view returns (address) {
        return
            address(
                uint160(
                    uint256(
                        keccak256(
                            abi.encodePacked(
                                bytes1(0xff),
                                address(this),
                                salt,
                                keccak256(
                                    abi.encodePacked(
                                        type(Proxy).creationCode,
                                        uint256(uint160(identityImplementation))
                                    )
                                )
                            )
                        )
                    )
                )
            );
    }

    function createProxy(
        address owner,
        address moduleManagerImpl,
        address[] calldata modules,
        bytes32 salt
    ) external onlyOwner returns (address) {
        address proxy = address(new Proxy{salt: salt}(identityImplementation));

        IIdentity(proxy).initialize(owner, moduleManagerImpl, modules);

        emit ProxyCreated(proxy);

        return proxy;
    }
}
