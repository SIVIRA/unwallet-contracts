import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { BytesLike } from "ethers";
import { Factory } from "../../typechain-types";

import * as utils from "../utils";

describe("Factory", () => {
  let deployer: utils.Deployer;

  let identityProxyFactoryOwner: HardhatEthersSigner;

  let factory: Factory;

  before(async () => {
    let runner;
    [runner, identityProxyFactoryOwner] = await ethers.getSigners();

    deployer = new utils.Deployer(runner);
  });

  beforeEach(async () => {
    factory = await deployer.deploy("Factory");
  });

  describe("create", () => {
    let code: BytesLike;
    let salt: bigint;

    let expectedAddress: string;

    before(async () => {
      code = (await ethers.getContractFactory("IdentityProxyFactory")).bytecode;
      salt = utils.randomUint256();
    });

    beforeEach(async () => {
      expectedAddress = ethers.getCreate2Address(
        await factory.getAddress(),
        ethers.toBeHex(salt, 32),
        ethers.keccak256(code)
      );
    });

    it("success: without initialization", async () => {
      await expect(factory.create(code, salt, new Uint8Array()))
        .to.emit(factory, "Created")
        .withArgs(expectedAddress);

      const identityProxyFactory = await ethers.getContractAt(
        "IdentityProxyFactory",
        expectedAddress
      );

      expect(await identityProxyFactory.owner()).to.equal(
        await factory.getAddress()
      );
    });

    it("success: with initialization", async () => {
      await expect(
        factory.create(
          code,
          salt,
          new ethers.Interface([
            "function transferOwnership(address)",
          ]).encodeFunctionData("transferOwnership", [
            identityProxyFactoryOwner.address,
          ])
        )
      )
        .to.emit(factory, "Created")
        .withArgs(expectedAddress);

      const identityProxyFactory = await ethers.getContractAt(
        "IdentityProxyFactory",
        expectedAddress
      );

      expect(await identityProxyFactory.owner()).to.equal(
        identityProxyFactoryOwner.address
      );
    });
  });
});
