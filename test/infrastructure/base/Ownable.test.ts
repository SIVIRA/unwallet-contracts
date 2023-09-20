import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Ownable } from "../../../typechain-types";

import * as utils from "../../utils";

describe("Ownable", () => {
  let deployer: utils.Deployer;

  let ownable: Ownable;

  let owner: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  before(async () => {
    [owner, other] = await ethers.getSigners();

    deployer = new utils.Deployer(owner);
  });

  beforeEach(async () => {
    ownable = await deployer.deploy("Ownable");
  });

  describe("initial state", () => {
    it("success", async () => {
      expect(await ownable.owner()).to.equal(owner.address);
    });
  });

  describe("renounceOwnership", () => {
    it("failure: caller must be the owner", async () => {
      await expect(
        ownable.connect(other).renounceOwnership()
      ).to.be.revertedWith("O: caller must be the owner");
    });

    it("success", async () => {
      await expect(ownable.renounceOwnership())
        .to.emit(ownable, "OwnershipTransferred")
        .withArgs(owner.address, ethers.ZeroAddress);

      expect(await ownable.owner()).to.equal(ethers.ZeroAddress);
    });
  });

  describe("transferOwnership", () => {
    it("failure: caller must be the owner", async () => {
      await expect(
        ownable.connect(other).transferOwnership(other.address)
      ).to.be.revertedWith("O: caller must be the owner");
    });

    it("failure: new owner must not be the zero address", async () => {
      await expect(
        ownable.transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWith("O: new owner must not be the zero address");
    });

    it("success", async () => {
      await expect(ownable.transferOwnership(other.address))
        .to.emit(ownable, "OwnershipTransferred")
        .withArgs(owner.address, other.address);

      expect(await ownable.owner()).to.equal(other.address);
    });
  });
});
