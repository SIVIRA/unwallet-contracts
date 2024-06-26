import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  ArbRelayerModule,
  Identity,
  IdentityProxyFactory,
  LockManager,
  ModuleManager,
  ModuleRegistry,
  TestERC20,
  TestModule,
} from "../../../typechain-types";

import * as constants from "../../constants";
import * as utils from "../../utils";

describe("ArbRelayerModule", () => {
  let deployer: utils.Deployer;
  let identityOpManager: utils.IdentityOpManager;

  let identityProxyOwner: HardhatEthersSigner;
  let relayer: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  let identityProxyFactory: IdentityProxyFactory;
  let identity: Identity;

  let moduleRegistry: ModuleRegistry;
  let moduleManager: ModuleManager;

  let lockManager: LockManager;

  let arbRelayerModule: ArbRelayerModule;
  let testModule: TestModule;

  let identityProxy: Identity;

  before(async () => {
    let runner;
    [runner, identityProxyOwner, relayer, other] = await ethers.getSigners();

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

    arbRelayerModule = await deployer.deployModule(
      "ArbRelayerModule",
      [await lockManager.getAddress()],
      true
    );
    testModule = await deployer.deployModule("TestModule", [], true);

    identityProxy = await deployer.deployIdentityProxy(
      await identity.getAddress(),
      utils.randomUint256(),
      identity.interface.encodeFunctionData("initialize", [
        identityProxyOwner.address,
        await moduleManager.getAddress(),
        [await arbRelayerModule.getAddress(), await testModule.getAddress()],
        [],
        [],
      ]),
      "Identity"
    );

    identityOpManager = new utils.IdentityOpManager(
      await identityProxy.getAddress(),
      identityProxyOwner,
      relayer,
      arbRelayerModule
    );
  });

  describe("initial state", () => {
    it("success", async () => {
      expect(
        await arbRelayerModule.getNonce(await identityProxy.getAddress())
      ).to.equal(0);
    });
  });

  describe("execute", () => {
    it("failure: invalid signer", async () => {
      identityOpManager.setOwner(other);

      {
        const { transact } = await identityOpManager.prepareTxToPing();
        await expect(transact).to.be.revertedWith("ARM: invalid signer");
      }
    });

    it("success: without refund", async () => {
      {
        const { identityOpHash, txReceipt } = await identityOpManager.ping();
        await identityOpManager.expectIdentityOpSuccess(
          identityOpHash,
          txReceipt
        );
      }

      expect(
        await arbRelayerModule.getNonce(await identityProxy.getAddress())
      ).to.equal(1);
    });

    it("success: with refund", async () => {
      await utils.waitTx(
        identityProxyOwner.sendTransaction({
          to: await identityProxy.getAddress(),
          value: ethers.parseEther("1"),
        })
      );

      const identityOpConfig: utils.IdentityOpConfig = {
        gasPrice: ethers.parseUnits("1", "gwei"),
        gasLimit: BigInt(100_000),
      };

      const identityProxyBalanceBefore = await ethers.provider.getBalance(
        await identityProxy.getAddress()
      );

      let gasFeeRefunded;

      {
        const relayerBalanceBefore = await ethers.provider.getBalance(
          relayer.address
        );

        const { identityOpHash, txReceipt } = await identityOpManager.ping(
          identityOpConfig
        );
        await identityOpManager.expectIdentityOpSuccess(
          identityOpHash,
          txReceipt
        );

        const relayerBalanceAfter = await ethers.provider.getBalance(
          relayer.address
        );

        gasFeeRefunded =
          relayerBalanceAfter -
          (relayerBalanceBefore - txReceipt.gasPrice * txReceipt.gasUsed);

        await expect(txReceipt.hash)
          .to.emit(arbRelayerModule, "Refunded")
          .withArgs(
            await identityProxy.getAddress(),
            relayer.address,
            ethers.ZeroAddress,
            gasFeeRefunded
          );
      }

      expect(
        await arbRelayerModule.getNonce(await identityProxy.getAddress())
      ).to.equal(1);

      expect(gasFeeRefunded).to.equal(
        identityOpConfig.gasPrice * identityOpConfig.gasLimit
      );

      const identityProxyBalanceAfter = await ethers.provider.getBalance(
        await identityProxy.getAddress()
      );

      expect(identityProxyBalanceAfter).equal(
        identityProxyBalanceBefore - gasFeeRefunded
      );
    });
  });

  describe("executeThroughIdentity", () => {
    it("failure: caller must be myself", async () => {
      await expect(
        arbRelayerModule.executeThroughIdentity(
          await identityProxy.getAddress(),
          utils.randomAddress(),
          0,
          new Uint8Array()
        )
      ).to.be.revertedWith("BM: caller must be myself");
    });

    it("failure: identity must be unlocked", async () => {
      await utils.waitTx(
        testModule.lockIdentity(
          await lockManager.getAddress(),
          await identityProxy.getAddress()
        )
      );

      {
        const { identityOpHash, txReceipt } =
          await identityOpManager.executeThroughIdentity([
            await identityProxy.getAddress(),
            utils.randomAddress(),
            0,
            new Uint8Array(),
          ]);
        await identityOpManager.expectIdentityOpFailure(
          identityOpHash,
          txReceipt,
          "BM: identity must be unlocked"
        );
      }
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
        {
          const { identityOpHash, txReceipt } =
            await identityOpManager.executeThroughIdentity([
              await identityProxy.getAddress(),
              await testERC20.getAddress(),
              0,
              testERC20.interface.encodeFunctionData("transfer", [
                identityProxyOwner.address,
                1,
              ]),
            ]);
          await identityOpManager.expectIdentityOpFailure(
            identityOpHash,
            txReceipt,
            "ERC20: transfer amount exceeds balance"
          );
        }
      });

      it("success", async () => {
        await utils.waitTx(
          testERC20.transfer(await identityProxy.getAddress(), totalSupply)
        );

        expect(
          await testERC20.balanceOf(await identityProxy.getAddress())
        ).to.equal(totalSupply);

        {
          const { identityOpHash, txReceipt } =
            await identityOpManager.executeThroughIdentity([
              await identityProxy.getAddress(),
              await testERC20.getAddress(),
              0,
              testERC20.interface.encodeFunctionData("transfer", [
                identityProxyOwner.address,
                totalSupply,
              ]),
            ]);
          await identityOpManager.expectIdentityOpSuccess(
            identityOpHash,
            txReceipt,
            {
              types: ["bool"],
              values: [true],
            }
          );
        }

        expect(await testERC20.balanceOf(identityProxyOwner.address)).to.equal(
          totalSupply
        );
        expect(
          await testERC20.balanceOf(await identityProxy.getAddress())
        ).to.equal(0);
      });
    });
  });
});
