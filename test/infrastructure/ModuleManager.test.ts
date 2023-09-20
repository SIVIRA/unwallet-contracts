import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  ModuleManager,
  ModuleRegistry,
  TestModule,
} from "../../typechain-types";

import * as utils from "../utils";

describe("ModuleManager", () => {
  let deployer: utils.Deployer;

  let owner: HardhatEthersSigner;
  let proxyOwner: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  let moduleRegistry: ModuleRegistry;
  let moduleManager: ModuleManager;

  let testModule: TestModule;

  let methodID: string;

  before(async () => {
    [owner, proxyOwner, other] = await ethers.getSigners();

    deployer = new utils.Deployer(owner);

    methodID = utils.randomMethodID();
  });

  beforeEach(async () => {
    moduleRegistry = await deployer.deploy("ModuleRegistry");
    deployer.setModuleRegistry(moduleRegistry);

    moduleManager = await deployer.deploy("ModuleManager", [
      await moduleRegistry.getAddress(),
    ]);

    testModule = await deployer.deployModule("TestModule", [], true);
  });

  describe("initial state", () => {
    it("success", async () => {
      expect(await moduleManager.owner()).to.equal(await owner.getAddress());
      expect(await moduleManager.isModuleEnabled(await testModule.getAddress()))
        .to.be.false;
      expect(await moduleManager.getDelegate(methodID)).to.equal(
        ethers.ZeroAddress
      );
    });
  });

  describe("constructor", () => {
    it("failure: registry must be an existing contract address", async () => {
      await expect(
        deployer.deploy("ModuleManager", [utils.randomAddress()])
      ).to.be.revertedWith("MM: registry must be an existing contract address");
    });
  });

  describe("initialize", () => {
    it("failure: contract is already initialized", async () => {
      await expect(moduleManager.initialize(other.address)).to.be.revertedWith(
        "MM: contract is already initialized"
      );
    });

    it("success -> failure: contract is already initialized", async () => {
      const moduleManagerProxy: ModuleManager = await deployer.deploy(
        "Proxy",
        [await moduleManager.getAddress()],
        "ModuleManager"
      );

      await moduleManagerProxy.initialize(proxyOwner.address);

      expect(await moduleManagerProxy.owner()).to.equal(proxyOwner.address);

      await expect(
        moduleManagerProxy.initialize(other.address)
      ).to.be.revertedWith("MM: contract is already initialized");
    });
  });

  describe("enableModule", () => {
    it("failure: caller must be the owner", async () => {
      await expect(
        moduleManager.connect(other).enableModule(await testModule.getAddress())
      ).to.be.revertedWith("O: caller must be the owner");
    });

    it("failure: module must be registered", async () => {
      await expect(
        moduleManager.enableModule(utils.randomAddress())
      ).to.be.revertedWith("MM: module must be registered");
    });

    it("success -> failure: module is already enabled", async () => {
      await expect(moduleManager.enableModule(await testModule.getAddress()))
        .to.emit(moduleManager, "ModuleEnabled")
        .withArgs(await testModule.getAddress());

      expect(await moduleManager.isModuleEnabled(await testModule.getAddress()))
        .to.be.true;

      await expect(
        moduleManager.enableModule(await testModule.getAddress())
      ).to.be.revertedWith("MM: module is already enabled");
    });
  });

  describe("disableModule", () => {
    beforeEach(async () => {
      await utils.waitTx(
        moduleManager.enableModule(await testModule.getAddress())
      );
    });

    it("failure: caller must be the owner", async () => {
      await expect(
        moduleManager
          .connect(other)
          .disableModule(await testModule.getAddress())
      ).to.be.revertedWith("O: caller must be the owner");
    });

    it("success -> failure: module is already disabled", async () => {
      await expect(moduleManager.disableModule(await testModule.getAddress()))
        .to.emit(moduleManager, "ModuleDisabled")
        .withArgs(await testModule.getAddress());

      expect(await moduleManager.isModuleEnabled(await testModule.getAddress()))
        .to.be.false;

      await expect(
        moduleManager.disableModule(await testModule.getAddress())
      ).to.be.revertedWith("MM: module is already disabled");
    });
  });

  describe("enableDelegation", () => {
    it("failure: caller must be the owner", async () => {
      await expect(
        moduleManager
          .connect(other)
          .enableDelegation(methodID, await testModule.getAddress())
      ).to.be.revertedWith("O: caller must be the owner");
    });

    it("failure: module must be enabled", async () => {
      await expect(
        moduleManager.enableDelegation(methodID, await testModule.getAddress())
      ).to.be.revertedWith("MM: module must be enabled");
    });

    it("success -> failure: delegation is already enabled", async () => {
      await utils.waitTx(
        moduleManager.enableModule(await testModule.getAddress())
      );

      await expect(
        moduleManager.enableDelegation(methodID, await testModule.getAddress())
      )
        .to.emit(moduleManager, "DelegationEnabled")
        .withArgs(methodID, await testModule.getAddress());

      expect(await moduleManager.getDelegate(methodID)).to.equal(
        await testModule.getAddress()
      );

      await expect(
        moduleManager.enableDelegation(methodID, await testModule.getAddress())
      ).to.be.revertedWith("MM: delegation is already enabled");
    });
  });

  describe("disableDelegation", () => {
    beforeEach(async () => {
      await utils.waitTx(
        moduleManager.enableModule(await testModule.getAddress())
      );
      await utils.waitTx(
        moduleManager.enableDelegation(methodID, await testModule.getAddress())
      );
    });

    it("failure: caller must be the owner", async () => {
      await expect(
        moduleManager.connect(other).disableDelegation(methodID)
      ).to.be.revertedWith("O: caller must be the owner");
    });

    it("success -> failure: delegation is already disabled", async () => {
      await expect(moduleManager.disableDelegation(methodID))
        .to.emit(moduleManager, "DelegationDisabled")
        .withArgs(methodID);

      expect(await moduleManager.getDelegate(methodID)).to.equal(
        ethers.ZeroAddress
      );

      await expect(
        moduleManager.disableDelegation(methodID)
      ).to.be.revertedWith("MM: delegation is already disabled");
    });
  });
});
