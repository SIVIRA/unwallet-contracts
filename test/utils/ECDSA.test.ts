import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { TestLib } from "../../typechain-types";

import * as utils from "../utils";

describe("ECDSA", () => {
  let deployer: utils.Deployer;

  let signer1: HardhatEthersSigner;
  let signer2: HardhatEthersSigner;

  let testLib: TestLib;

  let message: string;
  let digest: string;

  before(async () => {
    let runner;
    [runner, signer1, signer2] = await ethers.getSigners();

    deployer = new utils.Deployer(runner);
  });

  beforeEach(async () => {
    testLib = await deployer.deploy("TestLib");

    message = utils.randomString();
    digest = ethers.hashMessage(message);
  });

  describe("recover(hash, v, r, s)", () => {
    it("success", async () => {
      const sig = ethers.Signature.from(await signer1.signMessage(message));

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
    it("failure: invalid signature length", async () => {
      const sig = (await signer1.signMessage(message)).slice(0, -2);

      await expect(
        testLib["recover(bytes32,bytes)"](digest, sig)
      ).to.be.revertedWith("ECDSA: invalid signature length");
    });

    it("success", async () => {
      const sig = await signer1.signMessage(message);

      expect(await testLib["recover(bytes32,bytes)"](digest, sig)).to.equal(
        signer1.address
      );
    });
  });

  describe("recover(hash, sig, index)", () => {
    it("failure: invalid singature length", async () => {
      const sig = ethers
        .concat([
          await signer1.signMessage(message),
          await signer2.signMessage(message),
        ])
        .slice(0, -2);

      await expect(
        testLib["recover(bytes32,bytes,uint256)"](digest, sig, 0)
      ).to.be.revertedWith("ECDSA: invalid signature length");
    });

    it("failure: invalid signature index", async () => {
      const sig = ethers.concat([
        await signer1.signMessage(message),
        await signer2.signMessage(message),
      ]);

      await expect(
        testLib["recover(bytes32,bytes,uint256)"](digest, sig, 2)
      ).to.be.revertedWith("ECDSA: invalid signature index");
    });

    it("success", async () => {
      const sig = ethers.concat([
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
      const hash = ethers.randomBytes(32);

      expect(await testLib.toEthSignedMessageHash(hash)).to.equal(
        ethers.hashMessage(hash)
      );
    });
  });
});
