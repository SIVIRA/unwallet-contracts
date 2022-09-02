import { expect } from "chai";

import { Contract } from "ethers";

import * as constants from "../constants";
import * as utils from "../utils";

describe("SafeCast", () => {
  const deployer = new utils.Deployer();

  let testLib: Contract;

  beforeEach(async () => {
    testLib = await deployer.deployContract("TestLib");
  });

  describe("toUint128", () => {
    it("failure: v must fit in 128 bits", async () => {
      await expect(
        testLib.toUint128(constants.UINT128_MAX.add(1))
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
        testLib.toUint64(constants.UINT64_MAX.add(1))
      ).to.be.revertedWith("SC: v must fit in 64 bits");
    });

    it("success", async () => {
      expect(await testLib.toUint64(constants.UINT64_MAX)).to.equal(
        constants.UINT64_MAX
      );
    });
  });
});
