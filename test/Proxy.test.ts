import { expect } from "chai";

import * as utils from "./utils";

describe("Proxy", () => {
  const deployer = new utils.Deployer();

  describe("constructor", () => {
    it("failure: implementation: must be an existing contract address", async () => {
      await expect(
        deployer.deployContract("Proxy", [utils.randomAddress()])
      ).to.be.revertedWith(
        "P: implementation must be an existing contract address"
      );
    });

    it("success", async () => {
      const dummy = await deployer.deployContract("TestDummy");
      const proxy = await deployer.deployContract("Proxy", [dummy.address]);

      expect(await proxy.implementation()).to.equal(dummy.address);
    });
  });
});
