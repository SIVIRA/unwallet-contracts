import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  Identity,
  IdentityProxyFactory,
  ModuleManager,
  ModuleRegistry,
  Proxy,
} from "../../typechain-types";

import * as utils from "../utils";

describe("IdentityProxyFactory", () => {
  let deployer: utils.Deployer;

  let owner: HardhatEthersSigner;
  let identityProxyOwner: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  let identityProxyFactory: IdentityProxyFactory;
  let identity: Identity;

  let moduleRegistry: ModuleRegistry;
  let moduleManager: ModuleManager;

  before(async () => {
    [owner, identityProxyOwner, other] = await ethers.getSigners();

    deployer = new utils.Deployer(owner);
  });

  beforeEach(async () => {
    identityProxyFactory = await deployer.deploy("IdentityProxyFactory");
    identity = await deployer.deploy("Identity");

    moduleRegistry = await deployer.deploy("ModuleRegistry");
    moduleManager = await deployer.deploy("ModuleManager", [
      await moduleRegistry.getAddress(),
    ]);
  });

  describe("initial state", () => {
    it("success", async () => {
      expect(await identityProxyFactory.owner()).to.equal(
        await owner.getAddress()
      );
    });
  });

  describe("getProxyAddress", () => {
    it("success", async () => {
      const salt = utils.randomUint256();

      expect(
        await identityProxyFactory.getProxyAddress(
          await identity.getAddress(),
          ethers.toBeHex(salt, 32)
        )
      ).to.equal(
        await utils.getProxyCreate2Address(
          await identityProxyFactory.getAddress(),
          salt,
          await identity.getAddress()
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
            await identity.getAddress(),
            ethers.randomBytes(32),
            identity.interface.encodeFunctionData("initialize", [
              other.address,
              await moduleManager.getAddress(),
              [],
              [],
              [],
            ])
          )
      ).to.be.revertedWith("O: caller must be the owner");
    });

    it("success", async () => {
      const salt = utils.randomUint256();

      const expectedIdentityProxyAddress = await utils.getProxyCreate2Address(
        await identityProxyFactory.getAddress(),
        salt,
        await identity.getAddress()
      );

      await expect(
        identityProxyFactory.createProxy(
          await identity.getAddress(),
          ethers.toBeHex(salt, 32),
          identity.interface.encodeFunctionData("initialize", [
            identityProxyOwner.address,
            await moduleManager.getAddress(),
            [],
            [],
            [],
          ])
        )
      )
        .to.emit(identityProxyFactory, "ProxyCreated")
        .withArgs(expectedIdentityProxyAddress);

      const identityProxyAsProxy: Proxy = await ethers.getContractAt(
        "Proxy",
        expectedIdentityProxyAddress
      );

      expect(await identityProxyAsProxy.implementation()).to.equal(
        await identity.getAddress()
      );
    });
  });
});
