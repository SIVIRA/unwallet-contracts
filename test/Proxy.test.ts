import { expect } from "chai";
import { ethers } from "hardhat";

import { Proxy, TestDummy } from "../typechain-types";

import * as utils from "./utils";

describe("Proxy", () => {
  let deployer: utils.Deployer;

  let dummy: TestDummy;
  let proxy: Proxy;

  before(async () => {
    const [runner] = await ethers.getSigners();

    deployer = new utils.Deployer(runner);
  });

  beforeEach(async () => {
    dummy = await deployer.deploy("TestDummy");
    proxy = await deployer.deploy("Proxy", [await dummy.getAddress()]);
  });

  describe("initial state", () => {
    it("success", async () => {
      expect(await proxy.implementation()).to.equal(await dummy.getAddress());
    });
  });

  describe("constructor", () => {
    it("failure: implementation: must be an existing contract address", async () => {
      await expect(
        deployer.deploy("Proxy", [utils.randomAddress()])
      ).to.be.revertedWith(
        "P: implementation must be an existing contract address"
      );
    });
  });
});
