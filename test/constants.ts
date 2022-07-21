import { ethers } from "hardhat";

const UINT64_MAX = ethers.BigNumber.from("0xffffffffffffffff");
const UINT128_MAX = ethers.BigNumber.from("0xffffffffffffffffffffffffffffffff");

const INTERFACE_ID_ERC165 = "0x01ffc9a7";
const INTERFACE_ID_ERC721_RECEIVER = "0x150b7a02";
const INTERFACE_ID_ERC1155 = "0xd9b67a26";
const INTERFACE_ID_ERC1155_METADATA_URI = "0x0e89341c";
const INTERFACE_ID_ERC1155_RECEIVER = "0x4e2312e0";
const INTERFACE_ID_ERC1271 = "0x1626ba7e";
const INTERFACE_ID_ZERO = "0x00000000";

const METHOD_ID_ERC165_SUPPORTS_INTERFACE = "0x01ffc9a7"; // bytes4(keccak256("supportsInterface(bytes4)"))
const METHOD_ID_ERC721_ON_ERC721_RECEIVED = "0x150b7a02"; // bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"))
const METHOD_ID_ERC1155_ON_ERC1155_RECEIVED = "0xf23a6e61"; // bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)"))
const METHOD_ID_ERC1155_ON_ERC1155_BATCH_RECEIVED = "0xbc197c81"; // bytes4(keccak256("onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"))
const METHOD_ID_ERC1271_IS_VALID_SIGNATURE = "0x1626ba7e"; // bytes4(keccak256("isValidSignature(bytes32,bytes)")
const METHOD_ID_ZERO = "0x00000000";

const LOCK_PERIOD = 604800;

const EMPTY_EXECUTION_GAS_CONFIG = {
  price: 0,
  limit: 0,
  token: ethers.constants.AddressZero,
  refundTo: ethers.constants.AddressZero,
};

const EMPTY_EXECUTION_RESULT = {
  types: [] as string[],
  values: [] as any[],
};

export {
  UINT64_MAX,
  UINT128_MAX,
  INTERFACE_ID_ERC165,
  INTERFACE_ID_ERC721_RECEIVER,
  INTERFACE_ID_ERC1155,
  INTERFACE_ID_ERC1155_METADATA_URI,
  INTERFACE_ID_ERC1155_RECEIVER,
  INTERFACE_ID_ERC1271,
  INTERFACE_ID_ZERO,
  METHOD_ID_ERC165_SUPPORTS_INTERFACE,
  METHOD_ID_ERC721_ON_ERC721_RECEIVED,
  METHOD_ID_ERC1155_ON_ERC1155_RECEIVED,
  METHOD_ID_ERC1155_ON_ERC1155_BATCH_RECEIVED,
  METHOD_ID_ERC1271_IS_VALID_SIGNATURE,
  METHOD_ID_ZERO,
  LOCK_PERIOD,
  EMPTY_EXECUTION_GAS_CONFIG,
  EMPTY_EXECUTION_RESULT,
};
