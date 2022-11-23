import { ethers } from "hardhat";

import { Contract } from "ethers";

import * as utils from "./utils";

const FACTORY_ADDRESS = "0x0419677ca62aD4818Ceb005171376AE68d0B2f1F";
const SALT =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

const LOCK_PERIOD = 60 * 60 * 24 * 7;

// should be adjusted according to the network
const MIN_GAS = 21_000;
const REFUND_GAS = 31_000;

(async () => {
  const [owner] = await ethers.getSigners();

  const deployer = await (async (): Promise<utils.Deployer> => {
    switch ((await ethers.provider.getNetwork()).chainId) {
      case 31337:
        const factoryFactory = await ethers.getContractFactory("Factory");
        const factory = await factoryFactory.deploy();
        await factory.deployed();
        return new utils.Deployer(factory);

      default:
        return new utils.Deployer(
          await ethers.getContractAt("Factory", FACTORY_ADDRESS)
        );
    }
  })();

  let identityProxyFactory: Contract;
  {
    const name = "IdentityProxyFactory";

    console.log(`[${name}]`);

    const factory = await ethers.getContractFactory(name);

    const code = factory.bytecode;
    const expectedAddress = deployer.expectAddress(code, SALT);

    if (await utils.isContractDeployed(expectedAddress)) {
      console.log(`skip (already deployed at ${expectedAddress})`);
    } else {
      console.log(`deploying...`);
      await deployer.deployAndInitializeOwnership(code, SALT, owner.address);
      console.log(`deployed to ${expectedAddress}`);
    }

    identityProxyFactory = factory.attach(expectedAddress);

    console.log(`owner: ${await identityProxyFactory.owner()}`);
  }

  console.log();

  let moduleRegistry: Contract;
  {
    const name = "ModuleRegistry";

    console.log(`[${name}]`);

    const factory = await ethers.getContractFactory(name);

    const code = factory.bytecode;
    const expectedAddress = deployer.expectAddress(code, SALT);

    if (await utils.isContractDeployed(expectedAddress)) {
      console.log(`skip (already deployed at ${expectedAddress})`);
    } else {
      console.log(`deploying...`);
      await deployer.deployAndInitializeOwnership(code, SALT, owner.address);
      console.log(`deployed to ${expectedAddress}`);
    }

    moduleRegistry = factory.attach(expectedAddress);

    console.log(`owner: ${await moduleRegistry.owner()}`);
  }

  console.log();

  let moduleManager: Contract;
  {
    const name = "ModuleManager";

    console.log(`[${name}]`);

    const factory = await ethers.getContractFactory(name);

    const code = ethers.utils.concat([
      factory.bytecode,
      ethers.utils.defaultAbiCoder.encode(
        ["address"],
        [moduleRegistry.address]
      ),
    ]);
    const expectedAddress = deployer.expectAddress(code, SALT);

    if (await utils.isContractDeployed(expectedAddress)) {
      console.log(`skip (already deployed at ${expectedAddress})`);
    } else {
      console.log(`deploying...`);
      await deployer.deployAndInitializeOwnership(code, SALT, owner.address);
      console.log(`deployed to ${expectedAddress}`);
    }

    moduleManager = factory.attach(expectedAddress);

    console.log(`owner: ${await moduleManager.owner()}`);
  }

  console.log();

  let lockManager: Contract;
  {
    const name = "LockManager";

    console.log(`[${name}]`);

    const factory = await ethers.getContractFactory(name);

    const code = ethers.utils.concat([
      factory.bytecode,
      ethers.utils.defaultAbiCoder.encode(["uint256"], [LOCK_PERIOD]),
    ]);
    const expectedAddress = deployer.expectAddress(code, SALT);

    if (await utils.isContractDeployed(expectedAddress)) {
      console.log(`skip (already deployed at ${expectedAddress})`);
    } else {
      console.log(`deploying...`);
      await deployer.deploy(code, SALT);
      console.log(`deployed to ${expectedAddress}`);
    }

    lockManager = factory.attach(expectedAddress);
  }

  console.log();

  let identity: Contract;
  {
    const name = "Identity";

    console.log(`[${name}]`);

    const factory = await ethers.getContractFactory(name);

    const code = factory.bytecode;
    const expectedAddress = deployer.expectAddress(code, SALT);

    if (await utils.isContractDeployed(expectedAddress)) {
      console.log(`skip (already deployed at ${expectedAddress})`);
    } else {
      console.log(`deploying...`);
      await deployer.deploy(
        code,
        SALT,
        factory.interface.encodeFunctionData("initialize", [
          owner.address,
          moduleManager.address,
          [],
          [],
          [],
        ])
      );
      console.log(`deployed to ${expectedAddress}`);
    }

    identity = factory.attach(expectedAddress);

    console.log(`owner: ${await identity.owner()}`);
    console.log(`moduleManager: ${await identity.moduleManager()}`);
  }

  console.log();

  let relayerModule: Contract;
  {
    const name = "RelayerModule";

    console.log(`[${name}]`);

    const factory = await ethers.getContractFactory(name);

    const code = ethers.utils.concat([
      factory.bytecode,
      ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "uint256"],
        [lockManager.address, MIN_GAS, REFUND_GAS]
      ),
    ]);
    const expectedAddress = deployer.expectAddress(code, SALT);

    if (await utils.isContractDeployed(expectedAddress)) {
      console.log(`skip (already deployed at ${expectedAddress})`);
    } else {
      console.log(`deploying...`);
      await deployer.deploy(code, SALT);
      console.log(`deployed to ${expectedAddress}`);
    }

    relayerModule = factory.attach(expectedAddress);
  }

  console.log();

  let delegateModule: Contract;
  {
    const name = "DelegateModule";

    console.log(`[${name}]`);

    const factory = await ethers.getContractFactory(name);

    const code = factory.bytecode;
    const expectedAddress = deployer.expectAddress(code, SALT);

    if (await utils.isContractDeployed(expectedAddress)) {
      console.log(`skip (already deployed at ${expectedAddress})`);
    } else {
      console.log(`deploying...`);
      await deployer.deploy(code, SALT);
      console.log(`deployed to ${expectedAddress}`);
    }

    delegateModule = factory.attach(expectedAddress);
  }
})()
  .then(() => process.exit(0))
  .catch((e) => {
    console.log(e);
    process.exit(1);
  });
