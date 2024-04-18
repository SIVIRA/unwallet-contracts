import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  Identity,
  IdentityProxyFactory,
  ModuleManager,
  ModuleRegistry,
  TestERC20,
  TestModule,
} from "../typechain-types";

import * as constants from "./constants";
import * as utils from "./utils";

describe("Identity", () => {
  let deployer: utils.Deployer;

  let identityProxyOwner1: HardhatEthersSigner;
  let identityProxyOwner2: HardhatEthersSigner;

  let identityProxyFactory: IdentityProxyFactory;
  let identity: Identity;

  let moduleRegistry: ModuleRegistry;
  let moduleManager: ModuleManager;

  let testModule1: TestModule;
  let testModule2: TestModule;

  let identityProxy1: Identity;
  let moduleManagerProxy1: ModuleManager;

  let identityProxy2: Identity;
  let moduleManagerProxy2: ModuleManager;

  before(async () => {
    let runner;
    [runner, identityProxyOwner1, identityProxyOwner2] =
      await ethers.getSigners();

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

    testModule1 = await deployer.deployModule("TestModule", [], true);
    testModule2 = await deployer.deployModule("TestModule", [], true);

    identityProxy1 = await deployer.deployIdentityProxy(
      await identity.getAddress(),
      utils.randomUint256(),
      identity.interface.encodeFunctionData("initialize", [
        identityProxyOwner1.address,
        await moduleManager.getAddress(),
        [await testModule1.getAddress()],
        [await testModule1.getAddress()],
        [constants.METHOD_ID_ERC165_SUPPORTS_INTERFACE],
      ]),
      "Identity"
    );
    moduleManagerProxy1 = await ethers.getContractAt(
      "ModuleManager",
      await identityProxy1.moduleManager()
    );

    identityProxy2 = await deployer.deployIdentityProxy(
      await identity.getAddress(),
      utils.randomUint256(),
      identity.interface.encodeFunctionData("initialize", [
        identityProxyOwner2.address,
        await moduleManager.getAddress(),
        [],
        [],
        [],
      ]),
      "Identity"
    );
    moduleManagerProxy2 = await ethers.getContractAt(
      "ModuleManager",
      await identityProxy2.moduleManager()
    );
  });

  describe("initial state", () => {
    it("success", async () => {
      expect(await identityProxy1.owner()).to.equal(
        identityProxyOwner1.address
      );
      expect(
        await identityProxy1.isModuleEnabled(await testModule1.getAddress())
      ).to.be.true;
      expect(
        await identityProxy1.isModuleEnabled(await testModule2.getAddress())
      ).to.be.false;
      expect(
        await identityProxy1.getDelegate(
          constants.METHOD_ID_ERC165_SUPPORTS_INTERFACE
        )
      ).to.equal(await testModule1.getAddress());

      expect(await identityProxy2.owner()).to.equal(
        identityProxyOwner2.address
      );
      expect(
        await identityProxy2.isModuleEnabled(await testModule1.getAddress())
      ).to.be.false;
      expect(
        await identityProxy2.isModuleEnabled(await testModule2.getAddress())
      ).to.be.false;
      expect(
        await identityProxy2.getDelegate(
          constants.METHOD_ID_ERC165_SUPPORTS_INTERFACE
        )
      ).to.equal(ethers.ZeroAddress);
    });
  });

  describe("initialize", () => {
    it("failure: contract is already initialized", async () => {
      await expect(
        identityProxy1.initialize(
          identityProxyOwner2.address,
          await moduleManager.getAddress(),
          [],
          [],
          []
        )
      ).to.be.revertedWith("I: contract is already initialized");
    });

    it("failure: delegate modules length and delegate method ids length do not match", async () => {
      await expect(
        deployer.deployIdentityProxy(
          await identity.getAddress(),
          utils.randomUint256(),
          identity.interface.encodeFunctionData("initialize", [
            identityProxyOwner1.address,
            await moduleManager.getAddress(),
            [await testModule1.getAddress()],
            [await testModule1.getAddress()],
            [],
          ])
        )
      ).to.be.revertedWith(
        "I: delegate modules length and delegate method ids length do not match"
      );
    });
  });

  describe("setOwner", () => {
    it("failure: caller must be an enabled module", async () => {
      await expect(
        testModule2.setOwner(
          await identityProxy1.getAddress(),
          identityProxyOwner2.address
        )
      ).to.be.revertedWith("I: caller must be an enabled module");
    });

    it("failure: owner must not be the zero address", async () => {
      await expect(
        testModule1.setOwner(
          await identityProxy1.getAddress(),
          ethers.ZeroAddress
        )
      ).to.be.revertedWith("I: owner must not be the zero address");
    });

    it("success", async () => {
      await expect(
        testModule1.setOwner(
          await identityProxy1.getAddress(),
          identityProxyOwner2.address
        )
      )
        .to.emit(identityProxy1, "OwnershipTransferred")
        .withArgs(identityProxyOwner1.address, identityProxyOwner2.address);

      expect(await identityProxy1.owner()).to.equal(
        identityProxyOwner2.address
      );
    });
  });

  describe("setModuleManager", () => {
    it("failure: caller must be an enabled module", async () => {
      await expect(
        testModule2.setModuleManager(
          await identityProxy1.getAddress(),
          utils.randomAddress()
        )
      ).to.be.revertedWith("I: caller must be an enabled module");
    });

    it("failure: module manager must be an existing contract address", async () => {
      await expect(
        testModule1.setModuleManager(
          await identityProxy1.getAddress(),
          utils.randomAddress()
        )
      ).to.be.revertedWith(
        "I: module manager must be an existing contract address"
      );
    });

    it("success", async () => {
      await expect(
        testModule1.setModuleManager(
          await identityProxy1.getAddress(),
          await moduleManagerProxy2.getAddress()
        )
      )
        .to.emit(identityProxy1, "ModuleManagerSwitched")
        .withArgs(
          await moduleManagerProxy1.getAddress(),
          await moduleManagerProxy2.getAddress()
        );

      expect(await identityProxy1.moduleManager()).to.equal(
        await moduleManagerProxy2.getAddress()
      );
    });
  });

  describe("execute", () => {
    it("failure: caller must be an enabled module", async () => {
      await expect(
        testModule2.execute(
          await identityProxy1.getAddress(),
          utils.randomAddress(),
          0,
          new Uint8Array()
        )
      ).to.be.revertedWith("I: caller must be an enabled module");
    });

    it("failure: execution target must not be the zero address", async () => {
      await expect(
        testModule1.execute(
          await identityProxy1.getAddress(),
          ethers.ZeroAddress,
          0,
          new Uint8Array()
        )
      ).to.be.revertedWith("I: execution target must not be the zero address");
    });

    describe("ModuleManager.enableModule", () => {
      it("success", async () => {
        await testModule1.execute(
          await identityProxy1.getAddress(),
          await moduleManagerProxy1.getAddress(),
          0,
          moduleManager.interface.encodeFunctionData("enableModule", [
            await testModule2.getAddress(),
          ])
        );

        expect(
          await identityProxy1.isModuleEnabled(await testModule2.getAddress())
        ).to.be.true;
      });
    });

    describe("ERC20.transfer", () => {
      const totalSupply: bigint = BigInt(100);

      let testERC20: TestERC20;

      beforeEach(async () => {
        testERC20 = await deployer.deploy("TestERC20", [
          "unWallet Coin",
          "UWC",
          totalSupply,
        ]);
      });

      it("failure: transfer amount exceeds balance", async () => {
        await expect(
          testModule1.execute(
            await identityProxy1.getAddress(),
            await testERC20.getAddress(),
            0,
            testERC20.interface.encodeFunctionData("transfer", [
              identityProxyOwner1.address,
              1,
            ])
          )
        ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
      });

      it("success", async () => {
        await utils.waitTx(
          testERC20.transfer(await identityProxy1.getAddress(), totalSupply)
        );

        expect(
          await testERC20.balanceOf(await identityProxy1.getAddress())
        ).to.equal(totalSupply);

        const data = testERC20.interface.encodeFunctionData("transfer", [
          identityProxyOwner1.address,
          totalSupply,
        ]);

        await expect(
          testModule1.execute(
            await identityProxy1.getAddress(),
            await testERC20.getAddress(),
            0,
            data
          )
        )
          .to.emit(identityProxy1, "Executed")
          .withArgs(
            await testModule1.getAddress(),
            await testERC20.getAddress(),
            0,
            data
          );

        expect(await testERC20.balanceOf(identityProxyOwner1.address)).to.equal(
          totalSupply
        );
        expect(
          await testERC20.balanceOf(await identityProxy1.getAddress())
        ).to.equal(0);
      });
    });
  });

  describe("fallback", () => {
    it("success", async () => {
      const identityProxy1AsTestModule = await ethers.getContractAt(
        "TestModule",
        await identityProxy1.getAddress()
      );

      expect(
        await identityProxy1AsTestModule.supportsInterface(
          constants.INTERFACE_ID_ERC165
        )
      ).to.be.true;
    });
  });

  describe("receive", () => {
    it("success", async () => {
      expect(
        await ethers.provider.getBalance(await identityProxy1.getAddress())
      ).to.equal(0);

      await utils.waitTx(
        identityProxyOwner1.sendTransaction({
          to: await identityProxy1.getAddress(),
          value: 1,
        })
      );

      expect(
        await ethers.provider.getBalance(await identityProxy1.getAddress())
      ).to.equal(1);
    });
  });
});
