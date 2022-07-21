import { ethers } from "hardhat";

const PRIVATE_KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
  "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
  "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356",
  "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97",
  "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6",
  "0xf214f2b2cd398c806f84e317254e0f0b801d0643303237d97a22a48e01628897",
  "0x701b615bbdfb9de65240bc28bd21bbc0d996645a3dd57e7b12bc2bdf6f192c82",
  "0xa267530f49f8280200edf313ee7af6b827f2a8bce2897751d06a843f644967b1",
  "0x47c99abed3324a2707c28affff1267e45918ec8c3f20b8aa892e8b065d2942dd",
  "0xc526ee95bf44d8fc405a158bb884d9d1238d99f0612e9f33d006bb0789009aaa",
  "0x8166f546bab6da521a8369cab06c5d2b9e46670292d85c875ee9ec20e84ffb61",
  "0xea6c44ac03bff858b476bba40716402b03e41b8e97e276d1baec7c37d42484a0",
  "0x689af8efa8c651a91ad287602527f3af2fe9f6501a7ac4b061667b5a93e037fd",
  "0xde9be858da4a475276426320d5e9262ecfc3ba460bfac56360bfa6c4c28b4ee0",
  "0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e",
];

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
  PRIVATE_KEYS,
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