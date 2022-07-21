import { expect } from "chai";
import { ethers } from "hardhat";

import { Contract, Wallet } from "ethers";

import * as constants from "../../constants";
import * as utils from "../../utils";

describe("DelegateModule", () => {
  let owner: Wallet;
  let other: Wallet;

  let identityProxyFactory: Contract;
  let moduleRegistry: Contract;
  let moduleManager: Contract;

  let module: Contract;

  let identity: Contract;
  let proxy: Contract;

  before(async () => {
    owner = utils.randomWallet();
    other = utils.randomWallet();
  });

  beforeEach(async () => {
    const deployer = new utils.Deployer();

    moduleRegistry = await deployer.deployModuleRegistry();
    moduleManager = await deployer.deployModuleManager(moduleRegistry.address);
    identity = await deployer.deployIdentity(moduleManager.address);
    identityProxyFactory = await deployer.deployIdentityProxyFactory(
      identity.address
    );

    const moduleDeployer = new utils.ModuleDeployer(
      moduleRegistry,
      moduleManager
    );

    module = await moduleDeployer.deployModule(
      "DelegateModule",
      [],
      true,
      true
    );

    for (const methodID of [
      constants.METHOD_ID_ERC165_SUPPORTS_INTERFACE,
      constants.METHOD_ID_ERC721_ON_ERC721_RECEIVED,
      constants.METHOD_ID_ERC1155_ON_ERC1155_RECEIVED,
      constants.METHOD_ID_ERC1155_ON_ERC1155_BATCH_RECEIVED,
      constants.METHOD_ID_ERC1271_IS_VALID_SIGNATURE,
    ]) {
      await utils.executeContract(
        moduleManager.enableDelegation(methodID, module.address)
      );
    }

    const identityProxyDeployer = new utils.IdentityProxyDeployer(
      identityProxyFactory
    );

    proxy = await identityProxyDeployer.deployProxy(
      owner.address,
      ethers.utils.randomBytes(32),
      "DelegateModule"
    );
  });

  describe("supportsInterface", () => {
    it("success", async () => {
      expect(await proxy.supportsInterface(constants.INTERFACE_ID_ERC165)).to.be
        .true;
      expect(
        await proxy.supportsInterface(constants.INTERFACE_ID_ERC721_RECEIVER)
      ).to.be.true;
      expect(
        await proxy.supportsInterface(constants.INTERFACE_ID_ERC1155_RECEIVER)
      ).to.be.true;
      expect(await proxy.supportsInterface(constants.INTERFACE_ID_ERC1271)).to
        .be.true;
      expect(await proxy.supportsInterface(constants.INTERFACE_ID_ZERO)).to.be
        .false;
    });
  });

  describe("onERC721Received", () => {
    it("success", async () => {
      expect(
        await proxy.onERC721Received(
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
        await proxy.onERC1155Received(
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
        await proxy.onERC1155BatchReceived(
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
    let hash: Uint8Array;

    before(() => {
      hash = ethers.utils.randomBytes(32);
    });

    it("failure: invalid signature length", async () => {
      await expect(
        proxy.isValidSignature(hash, ethers.utils.randomBytes(64))
      ).to.be.revertedWith("DM: invalid signature length");
    });

    it("failure: invalid signer", async () => {
      await expect(
        proxy.isValidSignature(
          hash,
          ethers.utils.joinSignature(other._signingKey().signDigest(hash))
        )
      ).to.be.revertedWith("DM: invalid signer");
    });

    it("success", async () => {
      expect(
        await proxy.isValidSignature(
          hash,
          ethers.utils.joinSignature(owner._signingKey().signDigest(hash))
        )
      ).to.equal(constants.METHOD_ID_ERC1271_IS_VALID_SIGNATURE);
    });
  });
});
