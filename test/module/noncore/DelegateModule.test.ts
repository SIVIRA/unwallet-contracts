import { expect } from "chai";
import { ethers } from "hardhat";

import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import * as constants from "../../constants";
import * as utils from "../../utils";

describe("DelegateModule", () => {
  const deployer = new utils.Deployer();

  let owner: SignerWithAddress;
  let other: SignerWithAddress;

  let identityProxyFactory: Contract;
  let moduleRegistry: Contract;
  let moduleManager: Contract;

  let module: Contract;
  let testModule: Contract;

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

    module = await moduleDeployer.deployModule("DelegateModule", [], true);
    testModule = await moduleDeployer.deployModule("TestModule", [], true);

    const identityProxyDeployer = new utils.IdentityProxyDeployer(
      identityProxyFactory
    );

    identityProxy = await identityProxyDeployer.deployProxy(
      owner.address,
      moduleManager.address,
      [module.address, testModule.address],
      [
        module.address,
        module.address,
        module.address,
        module.address,
        module.address,
      ],
      [
        constants.METHOD_ID_ERC165_SUPPORTS_INTERFACE,
        constants.METHOD_ID_ERC721_ON_ERC721_RECEIVED,
        constants.METHOD_ID_ERC1155_ON_ERC1155_RECEIVED,
        constants.METHOD_ID_ERC1155_ON_ERC1155_BATCH_RECEIVED,
        constants.METHOD_ID_ERC1271_IS_VALID_SIGNATURE,
      ],
      ethers.utils.randomBytes(32),
      "Identity"
    );
    moduleManagerProxy = await ethers.getContractAt(
      "ModuleManager",
      await identityProxy.moduleManager()
    );

    identityProxy = await ethers.getContractAt(
      "DelegateModule",
      identityProxy.address
    );
  });

  describe("supportsInterface", () => {
    it("success", async () => {
      expect(
        await identityProxy.supportsInterface(constants.INTERFACE_ID_ERC165)
      ).to.be.true;
      expect(
        await identityProxy.supportsInterface(
          constants.INTERFACE_ID_ERC721_RECEIVER
        )
      ).to.be.true;
      expect(
        await identityProxy.supportsInterface(
          constants.INTERFACE_ID_ERC1155_RECEIVER
        )
      ).to.be.true;
      expect(
        await identityProxy.supportsInterface(constants.INTERFACE_ID_ERC1271)
      ).to.be.true;
      expect(await identityProxy.supportsInterface(constants.INTERFACE_ID_ZERO))
        .to.be.false;
    });
  });

  describe("onERC721Received", () => {
    it("success", async () => {
      expect(
        await identityProxy.onERC721Received(
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          0,
          []
        )
      ).to.equal(constants.METHOD_ID_ERC721_ON_ERC721_RECEIVED);
    });
  });

  describe("onERC1155Received", () => {
    it("success", async () => {
      expect(
        await identityProxy.onERC1155Received(
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          0,
          0,
          []
        )
      ).to.equal(constants.METHOD_ID_ERC1155_ON_ERC1155_RECEIVED);
    });
  });

  describe("onERC1155BatchReceived", () => {
    it("success", async () => {
      expect(
        await identityProxy.onERC1155BatchReceived(
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          [],
          [],
          []
        )
      ).to.equal(constants.METHOD_ID_ERC1155_ON_ERC1155_BATCH_RECEIVED);
    });
  });

  describe("isValidSignature", () => {
    let message: string;
    let digest: string;

    beforeEach(() => {
      message = utils.randomString();
      digest = ethers.utils.hashMessage(message);
    });

    it("failure: invalid signature length", async () => {
      await expect(
        identityProxy.isValidSignature(digest, ethers.utils.randomBytes(64))
      ).to.be.revertedWith("DM: invalid signature length");
    });

    it("failure: invalid signer", async () => {
      await expect(
        identityProxy.isValidSignature(digest, other.signMessage(message))
      ).to.be.revertedWith("DM: invalid signer");
    });

    it("success", async () => {
      expect(
        await identityProxy.isValidSignature(digest, owner.signMessage(message))
      ).to.equal(constants.METHOD_ID_ERC1271_IS_VALID_SIGNATURE);
    });
  });
});
