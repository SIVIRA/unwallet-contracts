import { expect } from "chai";
import { ethers } from "hardhat";

import { TestLib } from "../../typechain-types";

import * as utils from "../utils";

describe("Math", () => {
  let deployer: utils.Deployer;

  let testLib: TestLib;

  before(async () => {
    const [runner] = await ethers.getSigners();

    deployer = new utils.Deployer(runner);
  });

  beforeEach(async () => {
    testLib = await deployer.deploy("TestLib");
  });

  describe("min", () => {
    it("success", async () => {
      expect(await testLib.min(1, 2)).to.equal(1);
      expect(await testLib.min(2, 1)).to.equal(1);
      expect(await testLib.min(1, 1)).to.equal(1);
    });
  });

  describe("max", () => {
    it("success", async () => {
      expect(await testLib.max(1, 2)).to.equal(2);
      expect(await testLib.max(2, 1)).to.equal(2);
      expect(await testLib.max(1, 1)).to.equal(1);
    });
  });

  describe("ceilDiv", () => {
    it("success", async () => {
      expect(await testLib.ceilDiv(4, 2)).to.equal(2);
      expect(await testLib.ceilDiv(5, 2)).to.equal(3);
    });
  });
});
