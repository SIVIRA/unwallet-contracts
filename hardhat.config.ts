import { HardhatUserConfig } from "hardhat/types";

import "@nomicfoundation/hardhat-toolbox";
import "hardhat-preprocessor";

const config: HardhatUserConfig = {
  solidity: "0.8.4",
  networks: {},
  preprocess: {
    eachLine: () => ({
      transform: (line: string) =>
        line.startsWith("// SPDX-License-Identifier:") ? "" : line,
    }),
  },
};

export default config;
