import { expect } from "chai";
import { ethers } from "hardhat";

import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import * as utils from "../utils";

describe("IdentityProxyFactory", () => {
  let owner: SignerWithAddress;
  let other: SignerWithAddress;

  let identityProxyFactory: Contract;
  let moduleRegistry: Contract;
  let moduleManager: Contract;

  let identity: Contract;

  before(async () => {
    [owner, other] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const deployer = new utils.Deployer();

    moduleRegistry = await deployer.deployModuleRegistry();
    moduleManager = await deployer.deployModuleManager(moduleRegistry.address);
    identity = await deployer.deployIdentity(moduleManager.address);
    identityProxyFactory = await deployer.deployIdentityProxyFactory(
      identity.address
    );
  });

  describe("constructor", () => {
    it("success", async () => {
      expect(await identityProxyFactory.identityImplementation()).to.equal(
        identity.address
      );
    });
  });

  describe("getProxyAddress", () => {
    it("success", async () => {
      const salt = ethers.utils.randomBytes(32);

      expect(await identityProxyFactory.getProxyAddress(salt)).to.equal(
        await utils.getProxyAddress(
          identityProxyFactory.address,
          salt,
          identity.address
        )
      );
    });
  });

  describe("createProxy", () => {
    it("failure: caller must be the owner", async () => {
      await expect(
        identityProxyFactory
          .connect(other)
          .createProxy(other.address, ethers.utils.randomBytes(32))
      ).to.be.revertedWith("O: caller must be the owner");
    });

    it("success", async () => {
      const salt = ethers.utils.randomBytes(32);

      const proxyAddr = await utils.getProxyAddress(
        identityProxyFactory.address,
        salt,
        identity.address
      );

      await expect(identityProxyFactory.createProxy(owner.address, salt))
        .to.emit(identityProxyFactory, "ProxyCreated")
        .withArgs(proxyAddr);

      const proxy = (await ethers.getContractFactory("Proxy")).attach(
        proxyAddr
      );

      expect(await proxy.implementation()).to.equal(identity.address);
    });
  });
});
