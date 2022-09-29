// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
pragma solidity 0.8.16;

import "./CoreBaseModule.sol";
import "../../interface/IIdentity.sol";
import "../../utils/ECDSA.sol";
import "../../utils/Math.sol";

abstract contract CoreRelayerModule is CoreBaseModule {
    using ECDSA for bytes32;

    uint256 internal immutable _minGas;
    uint256 internal immutable _refundGas;

    mapping(address => uint256) internal _nonces;

    event Executed(
        address indexed identity,
        bool indexed success,
        bytes result,
        bytes32 txHash
    );

    event Refunded(
        address indexed identity,
        address indexed receiver,
        address token,
        uint256 amount
    );

    constructor(uint256 minGas, uint256 refundGas) {
        _minGas = minGas;
        _refundGas = refundGas;
    }

    function getNonce(address identity) external view returns (uint256) {
        return _nonces[identity];
    }

    function execute(
        address identity,
        bytes calldata data,
        uint256 gasPrice,
        uint256 gasLimit,
        address refundTo,
        bytes calldata sig
    ) external returns (bool) {
        uint256 gasInit = gasleft() + _minGas + msg.data.length * 8;

        bytes32 txHash = _getTxHash(
            identity,
            data,
            gasPrice,
            gasLimit,
            address(0),
            refundTo
        );

        address signer = txHash.toEthSignedMessageHash().recover(sig);

        require(signer == IIdentity(identity).owner(), "CRM: invalid signer");

        _nonces[identity]++;

        (bool success, bytes memory result) = address(this).call(data);

        emit Executed(identity, success, result, txHash);

        if (gasPrice > 0) {
            _refund(
                identity,
                refundTo,
                gasInit,
                gasPrice,
                gasLimit,
                address(0)
            );
        }

        return success;
    }

    function executeThroughIdentity(
        address identity,
        address to,
        uint256 value,
        bytes memory data
    )
        external
        onlySelf
        onlyWhenIdentityUnlocked(identity)
        returns (bytes memory)
    {
        return _executeThroughIdentity(identity, to, value, data);
    }

    function _getTxHash(
        address identity,
        bytes memory data,
        uint256 gasPrice,
        uint256 gasLimit,
        address gasToken,
        address refundTo
    ) internal view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    bytes1(0x19),
                    bytes1(0x0),
                    block.chainid,
                    address(this),
                    address(identity),
                    _nonces[identity],
                    data,
                    gasPrice,
                    gasLimit,
                    gasToken,
                    refundTo
                )
            );
    }

    function _refund(
        address identity,
        address to,
        uint256 gasInit,
        uint256 gasPrice,
        uint256 gasLimit,
        address gasToken
    ) internal {
        require(
            gasToken == address(0),
            "CRM: gas token must be the zero address"
        );

        to = to == address(0) ? msg.sender : to;

        uint256 gasConsumed = gasInit - gasleft() + _refundGas;
        uint256 refundAmount = Math.min(gasConsumed, gasLimit) *
            Math.min(tx.gasprice, gasPrice);

        _executeThroughIdentity(identity, to, refundAmount, "");

        emit Refunded(identity, to, gasToken, refundAmount);
    }

    function _executeThroughIdentity(
        address identity,
        address to,
        uint256 value,
        bytes memory data
    ) internal returns (bytes memory) {
        return IIdentity(identity).execute(to, value, data);
    }
}
