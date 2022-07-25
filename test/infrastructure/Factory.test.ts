import { expect } from "chai";
import { ethers } from "hardhat";

import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import * as utils from "../utils";

describe("Factory", () => {
  let owner: SignerWithAddress;

  let factory: Contract;

  before(async () => {
    [owner] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const deployer = new utils.Deployer();

    factory = await deployer.deployFactory();
  });

  describe("create", () => {
    let identityImplAddr: string;
    let code: Uint8Array;
    let salt: Uint8Array;
    let addr: string;

    beforeEach(async () => {
      identityImplAddr = utils.randomAddress();
      code = ethers.utils.concat([
        (await ethers.getContractFactory("IdentityProxyFactory")).bytecode,
        ethers.utils.defaultAbiCoder.encode(["address"], [identityImplAddr]),
      ]);
      salt = ethers.utils.randomBytes(32);
      addr = ethers.utils.getCreate2Address(
        factory.address,
        salt,
        ethers.utils.keccak256(code)
      );
    });

    it("success: without initialization", async () => {
      await expect(factory.create(code, salt, []))
        .to.emit(factory, "Created")
        .withArgs(addr);

      const identityProxyFactory = (
        await ethers.getContractFactory("IdentityProxyFactory")
      ).attach(addr);

      expect(await identityProxyFactory.owner()).to.equal(factory.address);
      expect(await identityProxyFactory.identityImplementation()).to.equal(
        identityImplAddr
      );
    });

    it("success: with initialization", async () => {
      const data = (
        await ethers.getContractFactory("Ownable")
      ).interface.encodeFunctionData("transferOwnership", [owner.address]);

      await expect(factory.create(code, salt, data))
        .to.emit(factory, "Created")
        .withArgs(addr);

      const identityProxyFactory = (
        await ethers.getContractFactory("IdentityProxyFactory")
      ).attach(addr);

      expect(await identityProxyFactory.owner()).to.equal(owner.address);
      expect(await identityProxyFactory.identityImplementation()).to.equal(
        identityImplAddr
      );
    });
  });
});
