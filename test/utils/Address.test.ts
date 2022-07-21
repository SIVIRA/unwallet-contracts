import { expect } from "chai";

import { Contract } from "ethers";

import * as utils from "../utils";

describe("Address", () => {
  let testLib: Contract;

  beforeEach(async () => {
    const deployer = new utils.Deployer();

    testLib = await deployer.deployContract("TestLib");
  });

  describe("isContract", () => {
    it("success", async () => {
      expect(await testLib.isContract(utils.randomAddress())).to.be.false;
      expect(await testLib.isContract(testLib.address)).to.be.true;
    });
  });
});
