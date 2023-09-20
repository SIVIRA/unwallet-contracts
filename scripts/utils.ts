import { ethers } from "hardhat";

import { BigNumberish, BytesLike } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Factory } from "../typechain-types";

const FACTORY_ADDRESS = "0x0419677ca62aD4818Ceb005171376AE68d0B2f1F";

class Deployer {
  private runner: HardhatEthersSigner;
  private factory: Factory;

  constructor(runner: HardhatEthersSigner, factory: Factory) {
    this.runner = runner;
    this.factory = factory.connect(runner);
  }

  public async getCreate2Address(
    code: BytesLike,
    salt: BigNumberish
  ): Promise<string> {
    return ethers.getCreate2Address(
      await this.factory.getAddress(),
      ethers.toBeHex(salt, 32),
      ethers.keccak256(code)
    );
  }

  public async deploy(
    code: BytesLike,
    salt: BigNumberish,
    initData: BytesLike = new Uint8Array()
  ): Promise<void> {
    const tx = await this.factory.create(code, salt, initData);
    await tx.wait();
  }

  public async deployOwnable(
    code: BytesLike,
    salt: BigNumberish
  ): Promise<void> {
    const initData = new ethers.Interface([
      "function transferOwnership(address)",
    ]).encodeFunctionData("transferOwnership", [this.runner.address]);

    await this.deploy(code, salt, initData);
  }
}

async function initDeployer(runner: HardhatEthersSigner): Promise<Deployer> {
  let factory: Factory;
  {
    const network = await ethers.provider.getNetwork();

    switch (network.chainId) {
      case BigInt(31337): // hardhat
        const factoryFactory = await ethers.getContractFactory("Factory");
        factory = await factoryFactory.deploy();
        await factory.waitForDeployment();
        break;

      default:
        factory = await ethers.getContractAt("Factory", FACTORY_ADDRESS);
    }
  }

  return new Deployer(runner, factory);
}

async function isContractDeployed(address: string): Promise<boolean> {
  return (await ethers.provider.getCode(address)) !== "0x";
}

export { Deployer, initDeployer, isContractDeployed };
