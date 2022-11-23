import { ethers } from "hardhat";

import { BytesLike, Contract } from "ethers";

class Deployer {
  public factory: Contract;

  constructor(factory: Contract) {
    this.factory = factory;
  }

  public expectAddress(code: BytesLike, salt: BytesLike): string {
    return ethers.utils.getCreate2Address(
      this.factory.address,
      salt,
      ethers.utils.keccak256(code)
    );
  }

  public async deploy(
    code: BytesLike,
    salt: BytesLike,
    initData: BytesLike = []
  ): Promise<void> {
    const tx = await this.factory.create(code, salt, initData);
    console.log(`txHash: ${tx.hash}`);
    await tx.wait();
  }

  public async deployAndInitializeOwnership(
    code: BytesLike,
    salt: BytesLike,
    owner: string
  ): Promise<void> {
    await this.deploy(
      code,
      salt,
      (
        await ethers.getContractFactory("Ownable")
      ).interface.encodeFunctionData("transferOwnership", [owner])
    );
  }
}

async function isContractDeployed(address: string): Promise<boolean> {
  return (await ethers.provider.getCode(address)) !== "0x";
}

export { Deployer, isContractDeployed };
