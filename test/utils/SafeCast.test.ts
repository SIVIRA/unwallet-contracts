import { expect } from "chai";
import { ethers } from "hardhat";

import { TestLib } from "../../typechain-types";

import * as constants from "../constants";
import * as utils from "../utils";

describe("SafeCast", () => {
  let deployer: utils.Deployer;

  let testLib: TestLib;

  before(async () => {
    const [runner] = await ethers.getSigners();

    deployer = new utils.Deployer(runner);
  });

  beforeEach(async () => {
    testLib = await deployer.deploy("TestLib");
  });

  describe("toUint128", () => {
    it("failure: v must fit in 128 bits", async () => {
      await expect(
        testLib.toUint128(constants.UINT128_MAX + BigInt(1))
      ).to.be.revertedWith("SC: v must fit in 128 bits");
    });

    it("success", async () => {
      expect(await testLib.toUint128(constants.UINT128_MAX)).to.equal(
        constants.UINT128_MAX
      );
    });
  });

  describe("toUint64", () => {
    it("failure: v must fit in 64 bits", async () => {
      await expect(
        testLib.toUint64(constants.UINT64_MAX + BigInt(1))
      ).to.be.revertedWith("SC: v must fit in 64 bits");
    });

    it("success", async () => {
      expect(await testLib.toUint64(constants.UINT64_MAX)).to.equal(
        constants.UINT64_MAX
      );
    });
  });
});
