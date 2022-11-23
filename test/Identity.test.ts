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
  let identityProxy1: Contract;
  let identityProxy2: Contract;
  let moduleManagerProxy1: Contract;
  let moduleManagerProxy2: Contract;

  before(async () => {
    [owner, other] = await ethers.getSigners();
  });

  beforeEach(async () => {
    moduleRegistry = await deployer.deployModuleRegistry();
    moduleManager = await deployer.deployModuleManager(moduleRegistry.address);
    identity = await deployer.deployIdentity();
    identityProxyFactory = await deployer.deployIdentityProxyFactory();

    const moduleDeployer = new utils.ModuleDeployer(moduleRegistry);

    testModule1 = await moduleDeployer.deployModule("TestModule", [], true);
    testModule2 = await moduleDeployer.deployModule("TestModule", [], true);

    const identityProxyDeployer = new utils.IdentityProxyDeployer(
      identityProxyFactory
    );

    identityProxy1 = await identityProxyDeployer.deployProxy(
      identity.address,
      ethers.utils.randomBytes(32),
      identity.interface.encodeFunctionData("initialize", [
        owner.address,
        moduleManager.address,
        [testModule1.address],
        [testModule1.address],
        [constants.METHOD_ID_ERC165_SUPPORTS_INTERFACE],
      ]),
      "Identity"
    );
    moduleManagerProxy1 = await ethers.getContractAt(
      "ModuleManager",
      await identityProxy1.moduleManager()
    );

    identityProxy2 = await identityProxyDeployer.deployProxy(
      identity.address,
      ethers.utils.randomBytes(32),
      identity.interface.encodeFunctionData("initialize", [
        other.address,
        moduleManager.address,
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
      expect(await identityProxy1.owner()).to.equal(owner.address);
      expect(await identityProxy1.isModuleEnabled(testModule1.address)).to.be
        .true;
      expect(await identityProxy1.isModuleEnabled(testModule2.address)).to.be
        .false;
      expect(
        await identityProxy1.getDelegate(
          constants.METHOD_ID_ERC165_SUPPORTS_INTERFACE
        )
      ).to.equal(testModule1.address);

      expect(await identityProxy2.owner()).to.equal(other.address);
      expect(await identityProxy2.isModuleEnabled(testModule1.address)).to.be
        .false;
      expect(await identityProxy2.isModuleEnabled(testModule2.address)).to.be
        .false;
      expect(
        await identityProxy2.getDelegate(
          constants.METHOD_ID_ERC165_SUPPORTS_INTERFACE
        )
      ).to.equal(ethers.constants.AddressZero);
    });
  });

  describe("initialize", () => {
    it("failure: contract is already initialized", async () => {
      await expect(
        identityProxy1.initialize(
          other.address,
          moduleManager.address,
          [],
          [],
          []
        )
      ).to.be.revertedWith("I: contract is already initialized");
    });

    it("failure: delegate modules length and delegate method ids length do not match", async () => {
      const identityProxyDeployer = new utils.IdentityProxyDeployer(
        identityProxyFactory
      );

      await expect(
        identityProxyDeployer.deployProxy(
          identity.address,
          ethers.utils.randomBytes(32),
          identity.interface.encodeFunctionData("initialize", [
            other.address,
            moduleManager.address,
            [testModule1.address],
            [testModule1.address],
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
        testModule2.setOwner(identityProxy1.address, other.address)
      ).to.be.revertedWith("I: caller must be an enabled module");
    });

    it("failure: owner must not be the zero address", async () => {
      await expect(
        testModule1.setOwner(
          identityProxy1.address,
          ethers.constants.AddressZero
        )
      ).to.be.revertedWith("I: owner must not be the zero address");
    });

    it("success", async () => {
      await expect(testModule1.setOwner(identityProxy1.address, other.address))
        .to.emit(identityProxy1, "OwnershipTransferred")
        .withArgs(owner.address, other.address);

      expect(await identityProxy1.owner()).to.equal(other.address);
    });
  });

  describe("setModuleManager", () => {
    it("failure: caller must be an enabled module", async () => {
      await expect(
        testModule2.setModuleManager(
          identityProxy1.address,
          utils.randomAddress()
        )
      ).to.be.revertedWith("I: caller must be an enabled module");
    });

    it("failure: module manager must be an existing contract address", async () => {
      await expect(
        testModule1.setModuleManager(
          identityProxy1.address,
          utils.randomAddress()
        )
      ).to.be.revertedWith(
        "I: module manager must be an existing contract address"
      );
    });

    it("success", async () => {
      await expect(
        testModule1.setModuleManager(
          identityProxy1.address,
          moduleManagerProxy2.address
        )
      )
        .to.emit(identityProxy1, "ModuleManagerSwitched")
        .withArgs(moduleManagerProxy1.address, moduleManagerProxy2.address);

      expect(await identityProxy1.moduleManager()).to.equal(
        moduleManagerProxy2.address
      );
    });
  });

  describe("execute", () => {
    it("failure: caller must be an enabled module", async () => {
      await expect(
        testModule2.execute(
          identityProxy1.address,
          utils.randomAddress(),
          0,
          []
        )
      ).to.be.revertedWith("I: caller must be an enabled module");
    });

    it("failure: execution target must not be the zero address", async () => {
      await expect(
        testModule1.execute(
          identityProxy1.address,
          ethers.constants.AddressZero,
          0,
          []
        )
      ).to.be.revertedWith("I: execution target must not be the zero address");
    });

    describe("ModuleManager.enableModule", () => {
      it("success", async () => {
        await testModule1.execute(
          identityProxy1.address,
          moduleManagerProxy1.address,
          0,
          moduleManager.interface.encodeFunctionData("enableModule", [
            testModule2.address,
          ])
        );

        expect(await identityProxy1.isModuleEnabled(testModule2.address)).to.be
          .true;
        expect(await identityProxy2.isModuleEnabled(testModule2.address)).to.be
          .false;
      });
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
        expect(await testERC20.balanceOf(identityProxy1.address)).to.equal(0);

        await expect(
          testModule1.execute(
            identityProxy1.address,
            testERC20.address,
            0,
            testERC20.interface.encodeFunctionData("transfer", [
              owner.address,
              1,
            ])
          )
        ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
      });

      it("success", async () => {
        await utils.executeContract(
          testERC20.transfer(identityProxy1.address, totalSupply)
        );

        expect(await testERC20.balanceOf(owner.address)).to.equal(0);
        expect(await testERC20.balanceOf(identityProxy1.address)).to.equal(
          totalSupply
        );

        const data = testERC20.interface.encodeFunctionData("transfer", [
          owner.address,
          totalSupply,
        ]);

        await expect(
          testModule1.execute(
            identityProxy1.address,
            testERC20.address,
            0,
            data
          )
        )
          .to.emit(identityProxy1, "Executed")
          .withArgs(testModule1.address, testERC20.address, 0, data);

        expect(await testERC20.balanceOf(owner.address)).to.equal(totalSupply);
        expect(await testERC20.balanceOf(identityProxy1.address)).to.equal(0);
      });
    });
  });

  describe("fallback", () => {
    beforeEach(async () => {
      identityProxy1 = await ethers.getContractAt(
        "TestModule",
        identityProxy1.address
      );
    });

    it("success", async () => {
      expect(
        await identityProxy1.supportsInterface(constants.INTERFACE_ID_ERC165)
      ).to.be.true;
    });
  });

  describe("receive", () => {
    it("success", async () => {
      expect(await ethers.provider.getBalance(identityProxy1.address)).to.equal(
        0
      );

      {
        const tx = await owner.sendTransaction({
          to: identityProxy1.address,
          value: 1,
        });
        await tx.wait();
      }

      expect(await ethers.provider.getBalance(identityProxy1.address)).to.equal(
        1
      );
    });
  });
});
