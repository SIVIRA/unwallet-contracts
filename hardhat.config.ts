import { HardhatUserConfig } from "hardhat/config";
import { NetworksUserConfig } from "hardhat/types";

import "@nomicfoundation/hardhat-toolbox";

const networks: NetworksUserConfig = {};
if (
  process.env.NETWORK !== undefined &&
  process.env.RPC_URL !== undefined &&
  process.env.PRIVATE_KEY !== undefined
) {
  networks[process.env.NETWORK] = {
    url: process.env.RPC_URL,
    accounts: [process.env.PRIVATE_KEY],
  };
}

const config: HardhatUserConfig = {
  solidity: "0.8.17",
  networks: networks,
  gasReporter: {
    enabled: true,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
