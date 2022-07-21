import { expect } from "chai";
import { ethers } from "hardhat";

import { Contract, Wallet } from "ethers";

import * as utils from "../utils";

describe("ECDSA", () => {
  let hash: Uint8Array;

  let signer1: Wallet;
  let signer2: Wallet;

  let testLib: Contract;

  before(async () => {
    hash = ethers.utils.randomBytes(32);

    signer1 = utils.randomWallet();
    signer2 = utils.randomWallet();
  });

  beforeEach(async () => {
    const deployer = new utils.Deployer();

    testLib = await deployer.deployContract("TestLib");
  });

  describe("recover(hash, v, r, s)", () => {
    it("success", async () => {
      const sig = signer1._signingKey().signDigest(hash);

      expect(
        await testLib["recover(bytes32,uint8,bytes32,bytes32)"](
          hash,
          sig.v,
          sig.r,
          sig.s
        )
      ).to.equal(signer1.address);
    });
  });

  describe("recover(hash, sig)", () => {
    it("success", async () => {
      expect(
        await testLib["recover(bytes32,bytes)"](
          hash,
          ethers.utils.joinSignature(signer1._signingKey().signDigest(hash))
        )
      ).to.equal(signer1.address);
    });
  });

  describe("recover(hash, sig, index)", () => {
    it("success", async () => {
      const sig = ethers.utils.concat([
        ethers.utils.joinSignature(signer1._signingKey().signDigest(hash)),
        ethers.utils.joinSignature(signer2._signingKey().signDigest(hash)),
      ]);

      expect(
        await testLib["recover(bytes32,bytes,uint256)"](hash, sig, 0)
      ).to.equal(signer1.address);
      expect(
        await testLib["recover(bytes32,bytes,uint256)"](hash, sig, 1)
      ).to.equal(signer2.address);
    });
  });

  describe("toEthSignedMessageHash", () => {
    it("success", async () => {
      expect(await testLib.toEthSignedMessageHash(hash)).to.equal(
        ethers.utils.hashMessage(hash)
      );
    });
  });
});
