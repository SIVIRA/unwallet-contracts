import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

import {
  Identity,
  IdentityProxyFactory,
  LockManager,
  ModuleManager,
  ModuleRegistry,
  TestModule,
} from "../../typechain-types";

import * as helpers from "@nomicfoundation/hardhat-network-helpers";
import * as constants from "../constants";
import * as utils from "../utils";

describe("LockManager", () => {
  let deployer: utils.Deployer;

  let identityProxyOwner: HardhatEthersSigner;

  let identityProxyFactory: IdentityProxyFactory;
  let identity: Identity;

  let moduleRegistry: ModuleRegistry;
  let moduleManager: ModuleManager;

  let lockManager: LockManager;

  let testModule1: TestModule;
  let testModule2: TestModule;

  let identityProxy: Identity;
  let moduleManagerProxy: ModuleManager;

  before(async () => {
    let runner;
    [runner, identityProxyOwner] = await ethers.getSigners();

    deployer = new utils.Deployer(runner);
  });

  beforeEach(async () => {
    identityProxyFactory = await deployer.deploy("IdentityProxyFactory");
    deployer.setIdentityProxyFactory(identityProxyFactory);

    identity = await deployer.deploy("Identity");

    moduleRegistry = await deployer.deploy("ModuleRegistry");
    deployer.setModuleRegistry(moduleRegistry);

    moduleManager = await deployer.deploy("ModuleManager", [
      await moduleRegistry.getAddress(),
    ]);

    lockManager = await deployer.deploy("LockManager", [constants.LOCK_PERIOD]);

    testModule1 = await deployer.deployModule("TestModule", [], true);
    testModule2 = await deployer.deployModule("TestModule", [], true);

    identityProxy = await deployer.deployIdentityProxy(
      await identity.getAddress(),
      utils.randomUint256(),
      identity.interface.encodeFunctionData("initialize", [
        identityProxyOwner.address,
        await moduleManager.getAddress(),
        [await testModule1.getAddress()],
        [],
        [],
      ]),
      "Identity"
    );
    moduleManagerProxy = await ethers.getContractAt(
      "ModuleManager",
      await identityProxy.moduleManager()
    );
  });

  describe("initial state", () => {
    it("success", async () => {
      expect(
        await lockManager.isIdentityLocked(await identityProxy.getAddress())
      ).to.be.false;
      expect(
        await lockManager.getIdentityLockExpireAt(
          await identityProxy.getAddress()
        )
      ).to.equal(0);
    });
  });

  describe("lockIdentity", () => {
    it("failure: caller must be an enabled module", async () => {
      await expect(
        testModule2.lockIdentity(
          await lockManager.getAddress(),
          await identityProxy.getAddress()
        )
      ).to.be.revertedWith("LM: caller must be an enabled module");
    });

    it("success -> failure: identity must be unlocked -> expiration", async () => {
      let lockExpireAt: number;
      {
        const assertion = expect(
          testModule1.lockIdentity(
            await lockManager.getAddress(),
            await identityProxy.getAddress()
          )
        ).to.emit(lockManager, "IdentityLocked");
        await assertion;

        lockExpireAt = (await utils.now()) + constants.LOCK_PERIOD;

        await assertion.withArgs(
          await identityProxy.getAddress(),
          await testModule1.getAddress(),
          lockExpireAt
        );
      }

      expect(
        await lockManager.isIdentityLocked(await identityProxy.getAddress())
      ).to.be.true;
      expect(
        await lockManager.getIdentityLockExpireAt(
          await identityProxy.getAddress()
        )
      ).to.equal(lockExpireAt);

      await expect(
        testModule1.lockIdentity(
          await lockManager.getAddress(),
          await identityProxy.getAddress()
        )
      ).to.be.revertedWith("LM: identity must be unlocked");

      await helpers.time.increase(constants.LOCK_PERIOD);

      expect(
        await lockManager.isIdentityLocked(await identityProxy.getAddress())
      ).to.be.false;
      expect(
        await lockManager.getIdentityLockExpireAt(
          await identityProxy.getAddress()
        )
      ).to.equal(lockExpireAt);
    });
  });

  describe("unlockIdentity", () => {
    let lockExpireAt: number;

    beforeEach(async () => {
      await utils.waitTx(
        testModule1.lockIdentity(
          await lockManager.getAddress(),
          await identityProxy.getAddress()
        )
      );

      lockExpireAt = (await utils.now()) + constants.LOCK_PERIOD;
    });

    it("failure: caller must be an enabled module", async () => {
      await expect(
        testModule2.unlockIdentity(
          await lockManager.getAddress(),
          await identityProxy.getAddress()
        )
      ).to.be.revertedWith("LM: caller must be an enabled module");
    });

    it("failure: caller must be the locker", async () => {
      await utils.waitTx(
        testModule1.execute(
          await identityProxy.getAddress(),
          await moduleManagerProxy.getAddress(),
          0,
          new ethers.Interface([
            "function enableModule(address module)",
          ]).encodeFunctionData("enableModule", [
            await testModule2.getAddress(),
          ])
        )
      );

      await expect(
        testModule2.unlockIdentity(
          await lockManager.getAddress(),
          await identityProxy.getAddress()
        )
      ).to.be.revertedWith("LM: caller must be the locker");
    });

    it("failure: identity must be locked", async () => {
      await helpers.time.increase(constants.LOCK_PERIOD);

      await expect(
        testModule1.unlockIdentity(
          await lockManager.getAddress(),
          await identityProxy.getAddress()
        )
      ).to.be.revertedWith("LM: identity must be locked");
    });

    it("success", async () => {
      await expect(
        testModule1.unlockIdentity(
          await lockManager.getAddress(),
          await identityProxy.getAddress()
        )
      )
        .to.emit(lockManager, "IdentityUnlocked")
        .withArgs(await identityProxy.getAddress());

      expect(
        await lockManager.isIdentityLocked(await identityProxy.getAddress())
      ).to.be.false;
      expect(
        await lockManager.getIdentityLockExpireAt(
          await identityProxy.getAddress()
        )
      ).to.equal(0);
    });
  });
});
