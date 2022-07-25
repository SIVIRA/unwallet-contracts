import { expect } from "chai";
import { ethers } from "hardhat";

import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import * as utils from "../utils";

describe("ModuleRegistry", () => {
  let owner: SignerWithAddress;
  let other: SignerWithAddress;

  let moduleRegistry: Contract;
  let moduleManager: Contract;

  let testModule: Contract;

  before(async () => {
    [owner, other] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const deployer = new utils.Deployer();

    moduleRegistry = await deployer.deployModuleRegistry();
    moduleManager = await deployer.deployModuleManager(moduleRegistry.address);

    const moduleDeployer = new utils.ModuleDeployer(
      moduleRegistry,
      moduleManager
    );

    testModule = await moduleDeployer.deployModule("TestModule");
  });

  describe("registerModule", () => {
    it("failure: caller must be the owner", async () => {
      await expect(
        moduleRegistry.connect(other).registerModule(utils.randomAddress())
      ).to.be.revertedWith("O: caller must be the owner");
    });

    it("success -> failure: registered module", async () => {
      expect(await moduleRegistry.isModuleRegistered(testModule.address)).to.be
        .false;

      await expect(moduleRegistry.registerModule(testModule.address))
        .to.emit(moduleRegistry, "ModuleRegistered")
        .withArgs(testModule.address);

      expect(await moduleRegistry.isModuleRegistered(testModule.address)).to.be
        .true;

      await expect(
        moduleRegistry.registerModule(testModule.address)
      ).to.be.revertedWith("MR: registered module");
    });
  });

  describe("deregisterModule", () => {
    beforeEach(async () => {
      await utils.executeContract(
        moduleRegistry.registerModule(testModule.address)
      );
    });

    it("failure: caller must be the owner", async () => {
      await expect(
        moduleRegistry.connect(other).deregisterModule(testModule.address)
      ).to.be.revertedWith("O: caller must be the owner");
    });

    it("success -> failure: unregistered module", async () => {
      expect(await moduleRegistry.isModuleRegistered(testModule.address)).to.be
        .true;

      await expect(moduleRegistry.deregisterModule(testModule.address))
        .to.emit(moduleRegistry, "ModuleDeregistered")
        .withArgs(testModule.address);

      expect(await moduleRegistry.isModuleRegistered(testModule.address)).to.be
        .false;

      await expect(
        moduleRegistry.deregisterModule(testModule.address)
      ).to.be.revertedWith("MR: unregistered module");
    });
  });
});
