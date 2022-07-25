import { expect } from "chai";
import { ethers } from "hardhat";

import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import * as utils from "../utils";

describe("ModuleManager", () => {
  let owner: SignerWithAddress;
  let other: SignerWithAddress;

  let moduleManager: Contract;
  let moduleRegistry: Contract;

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

    testModule = await moduleDeployer.deployModule("TestModule", [], true);
  });

  describe("enableModule", () => {
    it("failure: caller must be the owner", async () => {
      await expect(
        moduleManager.connect(other).enableModule(testModule.address)
      ).to.be.revertedWith("O: caller must be the owner");
    });

    it("failure: unregistered module", async () => {
      await expect(
        moduleManager.enableModule(utils.randomAddress())
      ).to.be.revertedWith("MM: unregistered module");
    });

    it("success -> failure: enabled module", async () => {
      expect(await moduleManager.isModuleEnabled(testModule.address)).to.be
        .false;
      expect(await moduleManager.isModuleFixed(testModule.address)).to.be.false;

      await expect(moduleManager.enableModule(testModule.address))
        .to.emit(moduleManager, "ModuleEnabled")
        .withArgs(testModule.address);

      expect(await moduleManager.isModuleEnabled(testModule.address)).to.be
        .true;
      expect(await moduleManager.isModuleFixed(testModule.address)).to.be.false;

      await expect(
        moduleManager.enableModule(testModule.address)
      ).to.be.revertedWith("MM: enabled module");
    });
  });

  describe("disableModule", () => {
    beforeEach(async () => {
      await utils.executeContract(
        moduleManager.enableModule(testModule.address)
      );
    });

    it("failure: caller must be the owner", async () => {
      await expect(
        moduleManager.connect(other).disableModule(testModule.address)
      ).to.be.revertedWith("O: caller must be the owner");
    });

    it("failure: fixed module", async () => {
      await utils.executeContract(moduleManager.fixModule(testModule.address));

      await expect(
        moduleManager.disableModule(testModule.address)
      ).to.be.revertedWith("MM: fixed module");
    });

    it("success -> failure: disabled module", async () => {
      expect(await moduleManager.isModuleEnabled(testModule.address)).to.be
        .true;
      expect(await moduleManager.isModuleFixed(testModule.address)).to.be.false;

      await expect(moduleManager.disableModule(testModule.address))
        .to.emit(moduleManager, "ModuleDisabled")
        .withArgs(testModule.address);

      expect(await moduleManager.isModuleEnabled(testModule.address)).to.be
        .false;
      expect(await moduleManager.isModuleFixed(testModule.address)).to.be.false;

      await expect(
        moduleManager.disableModule(testModule.address)
      ).to.be.revertedWith("MM: disabled module");
    });
  });

  describe("fixModule", () => {
    beforeEach(async () => {
      await utils.executeContract(
        moduleManager.enableModule(testModule.address)
      );
    });

    it("failure: caller must be the owner", async () => {
      await expect(
        moduleManager.connect(other).fixModule(testModule.address)
      ).to.be.revertedWith("O: caller must be the owner");
    });

    it("failure: disabled module", async () => {
      await expect(
        moduleManager.fixModule(utils.randomAddress())
      ).to.be.revertedWith("MM: disabled module");
    });

    it("success -> failure: fixed module", async () => {
      expect(await moduleManager.isModuleEnabled(testModule.address)).to.be
        .true;
      expect(await moduleManager.isModuleFixed(testModule.address)).to.be.false;

      await expect(moduleManager.fixModule(testModule.address))
        .to.emit(moduleManager, "ModuleFixed")
        .withArgs(testModule.address);

      expect(await moduleManager.isModuleEnabled(testModule.address)).to.be
        .true;
      expect(await moduleManager.isModuleFixed(testModule.address)).to.be.true;

      await expect(
        moduleManager.fixModule(testModule.address)
      ).to.be.revertedWith("MM: fixed module");
    });
  });

  describe("enableDelegation", () => {
    let methodID: string;

    beforeEach(() => {
      methodID = utils.randomMethodID();
    });

    it("failure: caller must be the owner", async () => {
      await expect(
        moduleManager
          .connect(other)
          .enableDelegation(methodID, testModule.address)
      ).to.be.revertedWith("O: caller must be the owner");
    });

    it("failure: disabled module", async () => {
      await expect(
        moduleManager.enableDelegation(methodID, testModule.address)
      ).to.be.revertedWith("MM: disabled module");
    });

    it("success -> failure: enabled delegation", async () => {
      await utils.executeContract(
        moduleManager.enableModule(testModule.address)
      );

      expect(await moduleManager.getDelegate(methodID)).to.equal(
        ethers.constants.AddressZero
      );

      await expect(moduleManager.enableDelegation(methodID, testModule.address))
        .to.emit(moduleManager, "DelegationEnabled")
        .withArgs(methodID, testModule.address);

      expect(await moduleManager.getDelegate(methodID)).to.equal(
        testModule.address
      );

      await expect(
        moduleManager.enableDelegation(methodID, testModule.address)
      ).to.be.revertedWith("MM: enabled delegation");
    });
  });

  describe("disableDelegation", () => {
    let methodID: string;

    beforeEach(async () => {
      methodID = utils.randomMethodID();

      await utils.executeContract(
        moduleManager.enableModule(testModule.address)
      );
      await utils.executeContract(
        moduleManager.enableDelegation(methodID, testModule.address)
      );
    });

    it("failure: caller must be the owner", async () => {
      await expect(
        moduleManager.connect(other).disableDelegation(methodID)
      ).to.be.revertedWith("O: caller must be the owner");
    });

    it("success", async () => {
      expect(await moduleManager.getDelegate(methodID)).to.equal(
        testModule.address
      );

      await expect(moduleManager.disableDelegation(methodID))
        .to.emit(moduleManager, "DelegationDisabled")
        .withArgs(methodID);

      expect(await moduleManager.getDelegate(methodID)).to.equal(
        ethers.constants.AddressZero
      );

      await expect(
        moduleManager.disableDelegation(methodID)
      ).to.be.revertedWith("MM: disabled delegation");
    });
  });
});
