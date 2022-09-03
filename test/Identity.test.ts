import { expect } from "chai";
import { ethers } from "hardhat";

import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import * as constants from "./constants";
import * as utils from "./utils";

describe("Identity", () => {
  const deployer = new utils.Deployer();

  let owner: SignerWithAddress;
  let other: SignerWithAddress;

  let identityProxyFactory: Contract;
  let moduleRegistry: Contract;
  let moduleManager: Contract;

  let testModule1: Contract;
  let testModule2: Contract;

  let identity: Contract;
  let identityProxy: Contract;
  let moduleManagerProxy: Contract;

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
      ethers.utils.randomBytes(32),
      "Identity"
    );
    moduleManagerProxy = await ethers.getContractAt(
      "ModuleManager",
      await identityProxy.moduleManager()
    );

    await utils.executeContract(
      testModule1.execute(
        identityProxy.address,
        moduleManagerProxy.address,
        0,
        new ethers.utils.Interface([
          "function enableDelegation(bytes4 methodID, address module)",
        ]).encodeFunctionData("enableDelegation", [
          constants.METHOD_ID_ERC165_SUPPORTS_INTERFACE,
          testModule1.address,
        ])
      )
    );
  });

  describe("initialize", () => {
    it("failure: contract is already initialized", async () => {
      await expect(
        identityProxy.initialize(other.address, moduleManager.address, [])
      ).to.be.revertedWith("I: contract is already initialized");
    });

    it("success", async () => {
      expect(await identityProxy.owner()).to.equal(owner.address);
      expect(await identityProxy.moduleManager()).to.equal(
        moduleManagerProxy.address
      );
    });
  });

  describe("setOwner", () => {
    it("failure: caller must be an enabled module", async () => {
      await expect(
        testModule2.setOwner(identityProxy.address, other.address)
      ).to.be.revertedWith("I: caller must be an enabled module");
    });

    it("failure: owner must not be the zero address", async () => {
      await expect(
        testModule1.setOwner(
          identityProxy.address,
          ethers.constants.AddressZero
        )
      ).to.be.revertedWith("I: owner must not be the zero address");
    });

    it("success", async () => {
      await expect(testModule1.setOwner(identityProxy.address, other.address))
        .to.emit(identityProxy, "OwnershipTransferred")
        .withArgs(owner.address, other.address);

      expect(await identityProxy.owner()).to.equal(other.address);
    });
  });

  describe("setModuleManager", () => {
    it("failure: caller must be an enabled module", async () => {
      await expect(
        testModule2.setModuleManager(
          identityProxy.address,
          utils.randomAddress()
        )
      ).to.be.revertedWith("I: caller must be an enabled module");
    });

    it("failure: module manager must be an existing contract address", async () => {
      await expect(
        testModule1.setModuleManager(
          identityProxy.address,
          utils.randomAddress()
        )
      ).to.be.revertedWith(
        "I: module manager must be an existing contract address"
      );
    });

    it("success", async () => {
      await expect(
        testModule1.setModuleManager(
          identityProxy.address,
          moduleManager.address
        )
      )
        .to.emit(identityProxy, "ModuleManagerSwitched")
        .withArgs(moduleManagerProxy.address, moduleManager.address);

      expect(await identityProxy.moduleManager()).to.equal(
        moduleManager.address
      );
    });
  });

  describe("isModuleEnabled", () => {
    it("success", async () => {
      expect(await identityProxy.isModuleEnabled(testModule1.address)).to.be
        .true;
      expect(await identityProxy.isModuleEnabled(testModule2.address)).to.be
        .false;
    });
  });

  describe("getDelegate", () => {
    it("success", async () => {
      expect(
        await identityProxy.getDelegate(
          constants.METHOD_ID_ERC165_SUPPORTS_INTERFACE
        )
      ).to.equal(testModule1.address);
    });
  });

  describe("execute", () => {
    it("failure: caller must be an enabled module", async () => {
      await expect(
        testModule2.execute(identityProxy.address, utils.randomAddress(), 0, [])
      ).to.be.revertedWith("I: caller must be an enabled module");
    });

    it("failure: execution target must not be the zero address", async () => {
      await expect(
        testModule1.execute(
          identityProxy.address,
          ethers.constants.AddressZero,
          0,
          []
        )
      ).to.be.revertedWith("I: execution target must not be the zero address");
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

        await expect(
          testModule1.execute(identityProxy.address, testERC20.address, 0, data)
        ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
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

        await expect(
          testModule1.execute(identityProxy.address, testERC20.address, 0, data)
        )
          .to.emit(identityProxy, "Executed")
          .withArgs(testModule1.address, testERC20.address, 0, data);

        expect(await testERC20.balanceOf(owner.address)).to.equal(totalSupply);
        expect(await testERC20.balanceOf(identityProxy.address)).to.equal(0);
      });
    });
  });

  describe("fallback", () => {
    beforeEach(async () => {
      identityProxy = await ethers.getContractAt(
        "TestModule",
        identityProxy.address
      );
    });

    it("success", async () => {
      expect(
        await identityProxy.supportsInterface(constants.INTERFACE_ID_ERC165)
      ).to.be.true;
    });
  });

  describe("receive", () => {
    it("success", async () => {
      expect(await ethers.provider.getBalance(identityProxy.address)).to.equal(
        0
      );

      {
        const tx = await owner.sendTransaction({
          to: identityProxy.address,
          value: 1,
        });
        await tx.wait();
      }

      expect(await ethers.provider.getBalance(identityProxy.address)).to.equal(
        1
      );
    });
  });
});
