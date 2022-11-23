import { expect } from "chai";
import { ethers } from "hardhat";

import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import * as utils from "../utils";

describe("IdentityProxyFactory", () => {
  const deployer = new utils.Deployer();

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
    moduleRegistry = await deployer.deployModuleRegistry();
    moduleManager = await deployer.deployModuleManager(moduleRegistry.address);
    identity = await deployer.deployIdentity();
    identityProxyFactory = await deployer.deployIdentityProxyFactory();
  });

  describe("getProxyAddress", () => {
    it("success", async () => {
      const salt = ethers.utils.randomBytes(32);

      expect(
        await identityProxyFactory.getProxyAddress(identity.address, salt)
      ).to.equal(
        await utils.expectProxyAddress(
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
          .createProxy(
            identity.address,
            ethers.utils.randomBytes(32),
            identity.interface.encodeFunctionData("initialize", [
              other.address,
              moduleManager.address,
              [],
              [],
              [],
            ])
          )
      ).to.be.revertedWith("O: caller must be the owner");
    });

    it("success", async () => {
      const salt = ethers.utils.randomBytes(32);

      const expectedProxyAddress = await utils.expectProxyAddress(
        identityProxyFactory.address,
        salt,
        identity.address
      );

      await expect(
        identityProxyFactory.createProxy(
          identity.address,
          salt,
          identity.interface.encodeFunctionData("initialize", [
            owner.address,
            moduleManager.address,
            [],
            [],
            [],
          ])
        )
      )
        .to.emit(identityProxyFactory, "ProxyCreated")
        .withArgs(expectedProxyAddress);

      const identityProxy = await ethers.getContractAt(
        "Proxy",
        expectedProxyAddress
      );

      expect(await identityProxy.implementation()).to.equal(identity.address);
    });
  });
});
