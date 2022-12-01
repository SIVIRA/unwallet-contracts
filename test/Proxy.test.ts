import { expect } from "chai";

import { Contract } from "ethers";

import * as utils from "./utils";

describe("Proxy", () => {
  const deployer = new utils.Deployer();

  let dummy: Contract;
  let proxy: Contract;

  beforeEach(async () => {
    dummy = await deployer.deployContract("TestDummy");
    proxy = await deployer.deployContract("Proxy", [dummy.address]);
  });

  describe("initial state", () => {
    it("success", async () => {
      expect(await proxy.implementation()).to.equal(dummy.address);
    });
  });

  describe("constructor", () => {
    it("failure: implementation: must be an existing contract address", async () => {
      await expect(
        deployer.deployContract("Proxy", [utils.randomAddress()])
      ).to.be.revertedWith(
        "P: implementation must be an existing contract address"
      );
    });
  });
});
