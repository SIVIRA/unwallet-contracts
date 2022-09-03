import { expect } from "chai";
import { ethers } from "hardhat";

import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import * as constants from "../../constants";
import * as utils from "../../utils";

describe("CoreRelayerModule", () => {
  const deployer = new utils.Deployer();

  let owner: SignerWithAddress;
  let other: SignerWithAddress;

  let identityProxyFactory: Contract;
  let moduleRegistry: Contract;
  let moduleManager: Contract;
  let lockManager: Contract;

  let module: Contract;
  let testModule: Contract;

  let identity: Contract;
  let identityProxy: Contract;

  let metaTxManager: utils.MetaTxManager;

  before(async () => {
    [owner, other] = await ethers.getSigners();
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

    module = await moduleDeployer.deployModule(
      "CoreModuleAggregate",
      [lockManager.address, 21000, 31000],
      true
    );
    testModule = await moduleDeployer.deployModule("TestModule", [], true);

    const identityProxyDeployer = new utils.IdentityProxyDeployer(
      identityProxyFactory
    );

    identityProxy = await identityProxyDeployer.deployProxy(
      owner.address,
      moduleManager.address,
      [module.address, testModule.address],
      ethers.utils.randomBytes(32),
      "Identity"
    );

    metaTxManager = new utils.MetaTxManager([owner], identityProxy, module);
  });

  describe("execute", () => {
    it("failure: invalid signer", async () => {
      metaTxManager.setSigners([other]);

      {
        const { executor } = await metaTxManager.prepareMetaTxWithoutRefund(
          "ping",
          []
        );
        await expect(executor).to.be.revertedWith("CRM: invalid signer");
      }
    });

    it("success: without refund", async () => {
      expect(await module.getNonce(identityProxy.address)).to.equal(0);

      await metaTxManager.expectMetaTxSuccessWithoutRefund(
        "ping",
        [],
        constants.EMPTY_EXECUTION_RESULT
      );

      expect(await module.getNonce(identityProxy.address)).to.equal(1);
    });

    it("success: with refund", async () => {
      {
        const tx = await owner.sendTransaction({
          to: identityProxy.address,
          value: ethers.utils.parseEther("1"),
        });
        await tx.wait();
      }

      const ownerBalanceBefore = await owner.getBalance();
      const proxyBalanceBefore = await ethers.provider.getBalance(
        identityProxy.address
      );
      const gasPrice = ethers.BigNumber.from(1_000_000_000);
      const gasLimit = ethers.BigNumber.from(100_000);

      expect(await module.getNonce(identityProxy.address)).to.equal(0);

      const receipt = await metaTxManager.expectMetaTxSuccess(
        "ping",
        [],
        {
          price: gasPrice,
          limit: gasLimit,
          token: ethers.constants.AddressZero,
          refundTo: owner.address,
        },
        constants.EMPTY_EXECUTION_RESULT
      );

      const ownerBalanceAfter = await owner.getBalance();
      const proxyBalanceAfter = await ethers.provider.getBalance(
        identityProxy.address
      );

      expect(await module.getNonce(identityProxy.address)).to.equal(1);
      expect(ownerBalanceAfter).to.be.above(ownerBalanceBefore);
      expect(proxyBalanceAfter).to.be.below(proxyBalanceBefore);

      const ownerBalanceDiff = ownerBalanceAfter.sub(ownerBalanceBefore);
      const proxyBalanceDiff = proxyBalanceBefore.sub(proxyBalanceAfter);
      const acceptableGasError = ethers.BigNumber.from(5_000);

      expect(ownerBalanceDiff).to.be.below(
        acceptableGasError.mul(receipt.effectiveGasPrice)
      );
      expect(proxyBalanceDiff).to.be.below(gasLimit.mul(gasPrice));
      expect(proxyBalanceDiff).to.be.below(
        receipt.gasUsed.add(acceptableGasError).mul(receipt.effectiveGasPrice)
      );
    });
  });

  describe("executeThroughIdentity", () => {
    it("failure: caller must be myself", async () => {
      await expect(
        module.executeThroughIdentity(
          identityProxy.address,
          utils.randomAddress(),
          0,
          []
        )
      ).to.be.revertedWith("CBM: caller must be myself");
    });

    it("failure: identity must be unlocked", async () => {
      await utils.executeContract(
        testModule.lockIdentity(lockManager.address, identityProxy.address)
      );

      await metaTxManager.expectMetaTxFailureWithoutRefund(
        "executeThroughIdentity",
        [identityProxy.address, utils.randomAddress(), 0, []],
        "CBM: identity must be unlocked"
      );
    });

    describe("ERC20.transfer", () => {
      const totalSupply: number = 100;

      let testERC20: Contract;

      beforeEach(async () => {
        const deployer = new utils.Deployer();

        testERC20 = await deployer.deployContract("TestERC20", [
          "unWallet Coin",
          "UWC",
          totalSupply,
        ]);
      });

      it("failure: transfer amount exceeds balance", async () => {
        expect(await testERC20.balanceOf(identityProxy.address)).to.equal(0);

        const data = testERC20.interface.encodeFunctionData("transfer", [
          owner.address,
          1,
        ]);

        await metaTxManager.expectMetaTxFailureWithoutRefund(
          "executeThroughIdentity",
          [identityProxy.address, testERC20.address, 0, data],
          "ERC20: transfer amount exceeds balance"
        );
      });

      it("success", async () => {
        await utils.executeContract(
          testERC20.transfer(identityProxy.address, totalSupply)
        );

        expect(await testERC20.balanceOf(owner.address)).to.equal(0);
        expect(await testERC20.balanceOf(identityProxy.address)).to.equal(
          totalSupply
        );

        const data = testERC20.interface.encodeFunctionData("transfer", [
          owner.address,
          totalSupply,
        ]);

        await metaTxManager.expectMetaTxSuccessWithoutRefund(
          "executeThroughIdentity",
          [identityProxy.address, testERC20.address, 0, data],
          {
            types: ["bool"],
            values: [true],
          }
        );

        expect(await testERC20.balanceOf(owner.address)).to.equal(totalSupply);
        expect(await testERC20.balanceOf(identityProxy.address)).to.equal(0);
      });
    });
  });
});
