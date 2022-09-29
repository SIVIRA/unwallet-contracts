import { expect } from "chai";
import { ethers } from "hardhat";

import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import * as helpers from "@nomicfoundation/hardhat-network-helpers";

import * as constants from "../constants";
import * as utils from "../utils";

describe("LockManager", () => {
  const deployer = new utils.Deployer();

  let owner: SignerWithAddress;

  let identityProxyFactory: Contract;
  let moduleRegistry: Contract;
  let moduleManager: Contract;
  let lockManager: Contract;

  let testModule1: Contract;
  let testModule2: Contract;

  let identity: Contract;
  let identityProxy: Contract;
  let moduleManagerProxy: Contract;

  before(async () => {
    [owner] = await ethers.getSigners();
  });

  beforeEach(async () => {
    moduleRegistry = await deployer.deployModuleRegistry();
    moduleManager = await deployer.deployModuleManager(moduleRegistry.address);
    identity = await deployer.deployIdentity();
    identityProxyFactory = await deployer.deployIdentityProxyFactory(
      identity.address
    );
    lockManager = await deployer.deployLockManager();

    const moduleDeployer = new utils.ModuleDeployer(moduleRegistry);

    testModule1 = await moduleDeployer.deployModule("TestModule", [], true);
    testModule2 = await moduleDeployer.deployModule("TestModule", [], true);

    const identityProxyDeployer = new utils.IdentityProxyDeployer(
      identityProxyFactory
    );

    identityProxy = await identityProxyDeployer.deployProxy(
      owner.address,
      moduleManager.address,
      [testModule1.address],
      [],
      [],
      ethers.utils.randomBytes(32),
      "Identity"
    );
    moduleManagerProxy = await ethers.getContractAt(
      "ModuleManager",
      await identityProxy.moduleManager()
    );
  });

  describe("lockIdentity", () => {
    it("failure: caller must be an enabled module", async () => {
      await expect(
        testModule2.lockIdentity(lockManager.address, identityProxy.address)
      ).to.be.revertedWith("LM: caller must be an enabled module");
    });

    it("success -> failure: identity must be unlocked -> expiration", async () => {
      expect(await lockManager.isIdentityLocked(identityProxy.address)).to.be
        .false;
      expect(
        await lockManager.getIdentityLockExpireAt(identityProxy.address)
      ).to.equal(0);

      let lockExpireAt: number;

      {
        const assertion = expect(
          testModule1.lockIdentity(lockManager.address, identityProxy.address)
        ).to.emit(lockManager, "IdentityLocked");
        await assertion;

        lockExpireAt = (await utils.now()) + constants.LOCK_PERIOD;

        await assertion.withArgs(
          identityProxy.address,
          testModule1.address,
          lockExpireAt
        );
      }

      expect(await lockManager.isIdentityLocked(identityProxy.address)).to.be
        .true;
      expect(
        await lockManager.getIdentityLockExpireAt(identityProxy.address)
      ).to.equal(lockExpireAt);

      await expect(
        testModule1.lockIdentity(lockManager.address, identityProxy.address)
      ).to.be.revertedWith("LM: identity must be unlocked");

      await helpers.time.increase(constants.LOCK_PERIOD);

      expect(await lockManager.isIdentityLocked(identityProxy.address)).to.be
        .false;
      expect(
        await lockManager.getIdentityLockExpireAt(identityProxy.address)
      ).to.equal(lockExpireAt);
    });
  });

  describe("unlockIdentity", () => {
    let lockExpireAt: number;

    beforeEach(async () => {
      await utils.executeContract(
        testModule1.lockIdentity(lockManager.address, identityProxy.address)
      );

      lockExpireAt = (await utils.now()) + constants.LOCK_PERIOD;
    });

    it("failure: caller must be an enabled module", async () => {
      await expect(
        testModule2.unlockIdentity(lockManager.address, identityProxy.address)
      ).to.be.revertedWith("LM: caller must be an enabled module");
    });

    it("failure: caller must be the locker", async () => {
      await utils.executeContract(
        testModule1.execute(
          identityProxy.address,
          moduleManagerProxy.address,
          0,
          new ethers.utils.Interface([
            "function enableModule(address module)",
          ]).encodeFunctionData("enableModule", [testModule2.address])
        )
      );

      await expect(
        testModule2.unlockIdentity(lockManager.address, identityProxy.address)
      ).to.be.revertedWith("LM: caller must be the locker");
    });

    it("failure: identity must be locked", async () => {
      await helpers.time.increase(constants.LOCK_PERIOD);

      await expect(
        testModule1.unlockIdentity(lockManager.address, identityProxy.address)
      ).to.be.revertedWith("LM: identity must be locked");
    });

    it("success", async () => {
      expect(await lockManager.isIdentityLocked(identityProxy.address)).to.be
        .true;
      expect(
        await lockManager.getIdentityLockExpireAt(identityProxy.address)
      ).to.equal(lockExpireAt);

      await expect(
        testModule1.unlockIdentity(lockManager.address, identityProxy.address)
      )
        .to.emit(lockManager, "IdentityUnlocked")
        .withArgs(identityProxy.address);

      expect(await lockManager.isIdentityLocked(identityProxy.address)).to.be
        .false;
      expect(
        await lockManager.getIdentityLockExpireAt(identityProxy.address)
      ).to.equal(0);
    });
  });
});
