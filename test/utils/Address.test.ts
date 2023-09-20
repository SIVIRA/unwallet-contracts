import { expect } from "chai";
import { ethers } from "hardhat";

import { TestLib } from "../../typechain-types";

import * as utils from "../utils";

describe("Address", () => {
  let deployer: utils.Deployer;

  let testLib: TestLib;

  before(async () => {
    const [runner] = await ethers.getSigners();

    deployer = new utils.Deployer(runner);
  });

  beforeEach(async () => {
    testLib = await deployer.deploy("TestLib");
  });

  describe("isContract", () => {
    it("success", async () => {
      expect(await testLib.isContract(utils.randomAddress())).to.be.false;
      expect(await testLib.isContract(await testLib.getAddress())).to.be.true;
    });
  });
});
