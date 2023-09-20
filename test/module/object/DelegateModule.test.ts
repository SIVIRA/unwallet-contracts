import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  DelegateModule,
  Identity,
  IdentityProxyFactory,
  ModuleManager,
  ModuleRegistry,
  TestModule,
} from "../../../typechain-types";

import * as constants from "../../constants";
import * as utils from "../../utils";

describe("DelegateModule", () => {
  let deployer: utils.Deployer;

  let identityProxyOwner: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  let identityProxyFactory: IdentityProxyFactory;
  let identity: Identity;

  let moduleRegistry: ModuleRegistry;
  let moduleManager: ModuleManager;

  let delegateModule: DelegateModule;
  let testModule: TestModule;

  let identityProxy: Identity;
  let identityProxyAsDelegateModule: DelegateModule;
  let moduleManagerProxy: ModuleManager;

  before(async () => {
    let runner;
    [runner, identityProxyOwner, other] = await ethers.getSigners();

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

    delegateModule = await deployer.deployModule("DelegateModule", [], true);
    testModule = await deployer.deployModule("TestModule", [], true);

    identityProxy = await deployer.deployIdentityProxy(
      await identity.getAddress(),
      utils.randomUint256(),
      identity.interface.encodeFunctionData("initialize", [
        identityProxyOwner.address,
        await moduleManager.getAddress(),
        [await delegateModule.getAddress(), await testModule.getAddress()],
        [
          await delegateModule.getAddress(),
          await delegateModule.getAddress(),
          await delegateModule.getAddress(),
          await delegateModule.getAddress(),
          await delegateModule.getAddress(),
        ],
        [
          constants.METHOD_ID_ERC165_SUPPORTS_INTERFACE,
          constants.METHOD_ID_ERC721_ON_ERC721_RECEIVED,
          constants.METHOD_ID_ERC1155_ON_ERC1155_RECEIVED,
          constants.METHOD_ID_ERC1155_ON_ERC1155_BATCH_RECEIVED,
          constants.METHOD_ID_ERC1271_IS_VALID_SIGNATURE,
        ],
      ]),
      "Identity"
    );
    moduleManagerProxy = await ethers.getContractAt(
      "ModuleManager",
      await identityProxy.moduleManager()
    );

    identityProxyAsDelegateModule = await ethers.getContractAt(
      "DelegateModule",
      await identityProxy.getAddress()
    );
  });

  describe("supportsInterface", () => {
    it("success", async () => {
      expect(
        await identityProxyAsDelegateModule.supportsInterface(
          constants.INTERFACE_ID_ERC165
        )
      ).to.be.true;
      expect(
        await identityProxyAsDelegateModule.supportsInterface(
          constants.INTERFACE_ID_ERC721_RECEIVER
        )
      ).to.be.true;
      expect(
        await identityProxyAsDelegateModule.supportsInterface(
          constants.INTERFACE_ID_ERC1155_RECEIVER
        )
      ).to.be.true;
      expect(
        await identityProxyAsDelegateModule.supportsInterface(
          constants.INTERFACE_ID_ERC1271
        )
      ).to.be.true;
      expect(
        await identityProxyAsDelegateModule.supportsInterface(
          constants.INTERFACE_ID_ZERO
        )
      ).to.be.false;
    });
  });

  describe("onERC721Received", () => {
    it("success", async () => {
      expect(
        await identityProxyAsDelegateModule.onERC721Received(
          ethers.ZeroAddress,
          ethers.ZeroAddress,
          0,
          new Uint8Array()
        )
      ).to.equal(constants.METHOD_ID_ERC721_ON_ERC721_RECEIVED);
    });
  });

  describe("onERC1155Received", () => {
    it("success", async () => {
      expect(
        await identityProxyAsDelegateModule.onERC1155Received(
          ethers.ZeroAddress,
          ethers.ZeroAddress,
          0,
          0,
          new Uint8Array()
        )
      ).to.equal(constants.METHOD_ID_ERC1155_ON_ERC1155_RECEIVED);
    });
  });

  describe("onERC1155BatchReceived", () => {
    it("success", async () => {
      expect(
        await identityProxyAsDelegateModule.onERC1155BatchReceived(
          ethers.ZeroAddress,
          ethers.ZeroAddress,
          [],
          [],
          new Uint8Array()
        )
      ).to.equal(constants.METHOD_ID_ERC1155_ON_ERC1155_BATCH_RECEIVED);
    });
  });

  describe("isValidSignature", () => {
    let message: string;
    let digest: string;

    before(() => {
      message = utils.randomString();
      digest = ethers.hashMessage(message);
    });

    it("failure: invalid signature length", async () => {
      await expect(
        identityProxyAsDelegateModule.isValidSignature(
          digest,
          ethers.randomBytes(64)
        )
      ).to.be.revertedWith("DM: invalid signature length");
    });

    it("failure: invalid signer", async () => {
      await expect(
        identityProxyAsDelegateModule.isValidSignature(
          digest,
          await other.signMessage(message)
        )
      ).to.be.revertedWith("DM: invalid signer");
    });

    it("success", async () => {
      expect(
        await identityProxyAsDelegateModule.isValidSignature(
          digest,
          await identityProxyOwner.signMessage(message)
        )
      ).to.equal(constants.METHOD_ID_ERC1271_IS_VALID_SIGNATURE);
    });
  });
});
