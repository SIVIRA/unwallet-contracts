import { expect } from "chai";
import { ethers } from "hardhat";

import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import * as utils from "../utils";

describe("ECDSA", () => {
  let message: string;
  let digest: string;

  let signer1: SignerWithAddress;
  let signer2: SignerWithAddress;

  let testLib: Contract;

  before(async () => {
    message = "message to be signed";
    digest = ethers.utils.hashMessage(message);

    [signer1, signer2] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const deployer = new utils.Deployer();

    testLib = await deployer.deployContract("TestLib");
  });

  describe("recover(hash, v, r, s)", () => {
    it("success", async () => {
      const sig = ethers.utils.splitSignature(
        await signer1.signMessage(message)
      );

      expect(
        await testLib["recover(bytes32,uint8,bytes32,bytes32)"](
          digest,
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
          digest,
          signer1.signMessage(message)
        )
      ).to.equal(signer1.address);
    });
  });

  describe("recover(hash, sig, index)", () => {
    it("success", async () => {
      const sig = ethers.utils.concat([
        await signer1.signMessage(message),
        await signer2.signMessage(message),
      ]);

      expect(
        await testLib["recover(bytes32,bytes,uint256)"](digest, sig, 0)
      ).to.equal(signer1.address);
      expect(
        await testLib["recover(bytes32,bytes,uint256)"](digest, sig, 1)
      ).to.equal(signer2.address);
    });
  });

  describe("toEthSignedMessageHash", () => {
    it("success", async () => {
      const hash = ethers.utils.randomBytes(32);

      expect(await testLib.toEthSignedMessageHash(hash)).to.equal(
        ethers.utils.hashMessage(hash)
      );
    });
  });
});
