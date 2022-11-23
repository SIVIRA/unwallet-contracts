import { expect } from "chai";
import { ethers } from "hardhat";

import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import * as utils from "../../utils";

describe("Ownable", () => {
  let ownable: Contract;

  let owner: SignerWithAddress;
  let other: SignerWithAddress;

  before(async () => {
    [owner, other] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const deployer = new utils.Deployer();

    ownable = await deployer.deployContract("Ownable");
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
      expect(await ownable.owner()).to.equal(owner.address);

      await expect(ownable.renounceOwnership())
        .to.emit(ownable, "OwnershipTransferred")
        .withArgs(owner.address, ethers.constants.AddressZero);

      expect(await ownable.owner()).to.equal(ethers.constants.AddressZero);
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
        ownable.transferOwnership(ethers.constants.AddressZero)
      ).to.be.revertedWith("O: new owner must not be the zero address");
    });

    it("success", async () => {
      expect(await ownable.owner()).to.equal(owner.address);

      await expect(ownable.transferOwnership(other.address))
        .to.emit(ownable, "OwnershipTransferred")
        .withArgs(owner.address, other.address);

      expect(await ownable.owner()).to.equal(other.address);
    });
  });
});
