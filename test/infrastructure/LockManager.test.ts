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
  let proxy: Contract;

  before(async () => {
    [owner] = await ethers.getSigners();
  });

  beforeEach(async () => {
    moduleRegistry = await deployer.deployModuleRegistry();
    moduleManager = await deployer.deployModuleManager(moduleRegistry.address);
    identity = await deployer.deployIdentity(moduleManager.address);
    identityProxyFactory = await deployer.deployIdentityProxyFactory(
      identity.address
    );
    lockManager = await deployer.deployLockManager();

    const moduleDeployer = new utils.ModuleDeployer(
      moduleRegistry,
      moduleManager
    );

    testModule1 = await moduleDeployer.deployModule(
      "TestModule",
      [],
      true,
      true
    );
    testModule2 = await moduleDeployer.deployModule("TestModule", [], true);

    const identityProxyDeployer = new utils.IdentityProxyDeployer(
      identityProxyFactory
    );

    proxy = await identityProxyDeployer.deployProxy(
      owner.address,
      ethers.utils.randomBytes(32),
      "Identity"
    );
  });

  describe("lockIdentity", () => {
    it("failure: caller must be an enabled module", async () => {
      await expect(
        testModule2.lockIdentity(lockManager.address, proxy.address)
      ).to.be.revertedWith("LM: caller must be an enabled module");
    });

    it("success -> failure: identity must be unlocked -> expiration", async () => {
      expect(await lockManager.isIdentityLocked(proxy.address)).to.be.false;
      expect(await lockManager.getIdentityLockExpireAt(proxy.address)).to.equal(
        0
      );

      let lockExpireAt: number;

      {
        const assertion = expect(
          testModule1.lockIdentity(lockManager.address, proxy.address)
        ).to.emit(lockManager, "IdentityLocked");
        await assertion;

        lockExpireAt = (await utils.now()) + constants.LOCK_PERIOD;

        await assertion.withArgs(
          proxy.address,
          testModule1.address,
          lockExpireAt
        );
      }

      expect(await lockManager.isIdentityLocked(proxy.address)).to.be.true;
      expect(await lockManager.getIdentityLockExpireAt(proxy.address)).to.equal(
        lockExpireAt
      );

      await expect(
        testModule1.lockIdentity(lockManager.address, proxy.address)
      ).to.be.revertedWith("LM: identity must be unlocked");

      await helpers.time.increase(constants.LOCK_PERIOD);

      expect(await lockManager.isIdentityLocked(proxy.address)).to.be.false;
      expect(await lockManager.getIdentityLockExpireAt(proxy.address)).to.equal(
        lockExpireAt
      );
    });
  });

  describe("unlockIdentity", () => {
    let lockExpireAt: number;

    beforeEach(async () => {
      await utils.executeContract(
        testModule1.lockIdentity(lockManager.address, proxy.address)
      );

      lockExpireAt = (await utils.now()) + constants.LOCK_PERIOD;
    });

    it("failure: caller must be an enabled module", async () => {
      await expect(
        testModule2.unlockIdentity(lockManager.address, proxy.address)
      ).to.be.revertedWith("LM: caller must be an enabled module");
    });

    it("failure: caller must be the locker", async () => {
      await utils.executeContract(
        moduleManager.enableModule(testModule2.address)
      );

      await expect(
        testModule2.unlockIdentity(lockManager.address, proxy.address)
      ).to.be.revertedWith("LM: caller must be the locker");
    });

    it("failure: identity must be locked", async () => {
      await helpers.time.increase(constants.LOCK_PERIOD);

      await expect(
        testModule1.unlockIdentity(lockManager.address, proxy.address)
      ).to.be.revertedWith("LM: identity must be locked");
    });

    it("success", async () => {
      expect(await lockManager.isIdentityLocked(proxy.address)).to.be.true;
      expect(await lockManager.getIdentityLockExpireAt(proxy.address)).to.equal(
        lockExpireAt
      );

      await expect(
        testModule1.unlockIdentity(lockManager.address, proxy.address)
      )
        .to.emit(lockManager, "IdentityUnlocked")
        .withArgs(proxy.address);

      expect(await lockManager.isIdentityLocked(proxy.address)).to.be.false;
      expect(await lockManager.getIdentityLockExpireAt(proxy.address)).to.equal(
        0
      );
    });
  });
});
