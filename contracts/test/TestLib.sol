// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.16;

import "../utils/Address.sol";
import "../utils/ECDSA.sol";
import "../utils/Math.sol";
import "../utils/SafeCast.sol";

contract TestLib {
    using Address for address;
    using ECDSA for bytes32;
    using Math for uint256;
    using SafeCast for uint256;

    function isContract(address addr) external view returns (bool) {
        return addr.isContract();
    }

    function recover(
        bytes32 hash,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external pure returns (address) {
        return hash.recover(v, r, s);
    }

    function recover(bytes32 hash, bytes memory sig)
        external
        pure
        returns (address)
    {
        return hash.recover(sig);
    }

    function recover(
        bytes32 hash,
        bytes memory sig,
        uint256 index
    ) external pure returns (address) {
        return hash.recover(sig, index);
    }

    function toEthSignedMessageHash(bytes32 hash)
        external
        pure
        returns (bytes32)
    {
        return hash.toEthSignedMessageHash();
    }

    function min(uint256 a, uint256 b) external pure returns (uint256) {
        return Math.min(a, b);
    }

    function max(uint256 a, uint256 b) external pure returns (uint256) {
        return Math.max(a, b);
    }

    function ceilDiv(uint256 a, uint256 b) external pure returns (uint256) {
        return a.ceilDiv(b);
    }

    function toUint128(uint256 v) external pure returns (uint128) {
        return v.toUint128();
    }

    function toUint64(uint256 v) external pure returns (uint64) {
        return v.toUint64();
    }
}
