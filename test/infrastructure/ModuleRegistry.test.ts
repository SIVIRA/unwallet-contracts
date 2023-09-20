import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  ModuleManager,
  ModuleRegistry,
  TestModule,
} from "../../typechain-types";

import * as utils from "../utils";

describe("ModuleRegistry", () => {
  let deployer: utils.Deployer;

  let owner: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  let moduleRegistry: ModuleRegistry;
  let moduleManager: ModuleManager;

  let testModule: TestModule;

  before(async () => {
    [owner, other] = await ethers.getSigners();

    deployer = new utils.Deployer(owner);
  });

  beforeEach(async () => {
    moduleRegistry = await deployer.deploy("ModuleRegistry");
    deployer.setModuleRegistry(moduleRegistry);

    moduleManager = await deployer.deploy("ModuleManager", [
      await moduleRegistry.getAddress(),
    ]);

    testModule = await deployer.deployModule("TestModule");
  });

  describe("initial state", () => {
    it("success", async () => {
      expect(await moduleRegistry.owner()).to.equal(await owner.getAddress());
      expect(
        await moduleRegistry.isModuleRegistered(await testModule.getAddress())
      ).to.be.false;
    });
  });

  describe("registerModule", () => {
    it("failure: caller must be the owner", async () => {
      await expect(
        moduleRegistry.connect(other).registerModule(utils.randomAddress())
      ).to.be.revertedWith("O: caller must be the owner");
    });

    it("failure: module must be an existing contract address", async () => {
      await expect(
        moduleRegistry.registerModule(utils.randomAddress())
      ).to.be.revertedWith("MR: module must be an existing contract address");
    });

    it("success -> failure: module is already registered", async () => {
      await expect(moduleRegistry.registerModule(await testModule.getAddress()))
        .to.emit(moduleRegistry, "ModuleRegistered")
        .withArgs(await testModule.getAddress());

      expect(
        await moduleRegistry.isModuleRegistered(await testModule.getAddress())
      ).to.be.true;

      await expect(
        moduleRegistry.registerModule(await testModule.getAddress())
      ).to.be.revertedWith("MR: module is already registered");
    });
  });

  describe("deregisterModule", () => {
    beforeEach(async () => {
      await utils.waitTx(
        moduleRegistry.registerModule(await testModule.getAddress())
      );
    });

    it("failure: caller must be the owner", async () => {
      await expect(
        moduleRegistry
          .connect(other)
          .deregisterModule(await testModule.getAddress())
      ).to.be.revertedWith("O: caller must be the owner");
    });

    it("success -> failure: module is already deregistered", async () => {
      await expect(
        moduleRegistry.deregisterModule(await testModule.getAddress())
      )
        .to.emit(moduleRegistry, "ModuleDeregistered")
        .withArgs(await testModule.getAddress());

      expect(
        await moduleRegistry.isModuleRegistered(await testModule.getAddress())
      ).to.be.false;

      await expect(
        moduleRegistry.deregisterModule(await testModule.getAddress())
      ).to.be.revertedWith("MR: module is already deregistered");
    });
  });
});
