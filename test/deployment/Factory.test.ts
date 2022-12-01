import { expect } from "chai";
import { ethers } from "hardhat";

import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import * as utils from "../utils";

describe("Factory", () => {
  const deployer = new utils.Deployer();

  let owner: SignerWithAddress;

  let factory: Contract;
  let dummy: Contract;

  before(async () => {
    [owner] = await ethers.getSigners();
  });

  beforeEach(async () => {
    factory = await deployer.deployFactory();
    dummy = await deployer.deployContract("TestDummy");
  });

  describe("create", () => {
    let code: Uint8Array;
    let salt: Uint8Array;

    let expectedAddress: string;

    beforeEach(async () => {
      code = ethers.utils.concat([
        (await ethers.getContractFactory("IdentityProxyFactory")).bytecode,
        ethers.utils.defaultAbiCoder.encode(["address"], [dummy.address]),
      ]);
      salt = ethers.utils.randomBytes(32);

      expectedAddress = ethers.utils.getCreate2Address(
        factory.address,
        salt,
        ethers.utils.keccak256(code)
      );
    });

    it("success: without initialization", async () => {
      await expect(factory.create(code, salt, []))
        .to.emit(factory, "Created")
        .withArgs(expectedAddress);

      const identityProxyFactory = await ethers.getContractAt(
        "IdentityProxyFactory",
        expectedAddress
      );

      expect(await identityProxyFactory.owner()).to.equal(factory.address);
    });

    it("success: with initialization", async () => {
      await expect(
        factory.create(
          code,
          salt,
          (
            await ethers.getContractFactory("Ownable")
          ).interface.encodeFunctionData("transferOwnership", [owner.address])
        )
      )
        .to.emit(factory, "Created")
        .withArgs(expectedAddress);

      const identityProxyFactory = await ethers.getContractAt(
        "IdentityProxyFactory",
        expectedAddress
      );

      expect(await identityProxyFactory.owner()).to.equal(owner.address);
    });
  });
});
