import { ethers } from "hardhat";

import {
  ArbRelayerModule,
  DelegateModule,
  Identity,
  IdentityProxyFactory,
  LockManager,
  ModuleManager,
  ModuleRegistry,
  RelayerModule,
} from "../typechain-types";

import { initDeployer, isContractDeployed } from "./utils";

const SALT = ethers.ZeroHash;

const LOCK_PERIOD = 60 * 60 * 24 * 7; // 1 week

// should be adjusted according to the network
const RELAY_MIN_GAS = 21_000;
const RELAY_REFUND_GAS = 22_000;

(async () => {
  const network = await ethers.provider.getNetwork();

  const [runner] = await ethers.getSigners();
  const deployer = await initDeployer(runner);
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();

  let identityProxyFactory: IdentityProxyFactory;
  {
    const name = "IdentityProxyFactory";

    const factory = await ethers.getContractFactory(name);

    const code = factory.bytecode;
    const address = await deployer.getCreate2Address(code, SALT);

    if (await isContractDeployed(address)) {
      console.log(`[${name}] skip (already deployed at ${address})`);
    } else {
      console.log(`[${name}] deploying...`);
      await deployer.deployOwnable(code, SALT);
      console.log(`[${name}] deployed at ${address}`);
    }

    identityProxyFactory = await ethers.getContractAt(name, address);

    console.log(`[${name}] owner: ${await identityProxyFactory.owner()}`);
  }

  let moduleRegistry: ModuleRegistry;
  {
    const name = "ModuleRegistry";

    const factory = await ethers.getContractFactory(name);

    const code = factory.bytecode;
    const address = await deployer.getCreate2Address(code, SALT);

    if (await isContractDeployed(address)) {
      console.log(`[${name}] skip (already deployed at ${address})`);
    } else {
      console.log(`[${name}] deploying...`);
      await deployer.deployOwnable(code, SALT);
      console.log(`[${name}] deployed at ${address}`);
    }

    moduleRegistry = await ethers.getContractAt(name, address);

    console.log(`[${name}] owner: ${await moduleRegistry.owner()}`);
  }

  let moduleManager: ModuleManager;
  {
    const name = "ModuleManager";

    const factory = await ethers.getContractFactory(name);

    const code = ethers.concat([
      factory.bytecode,
      abiCoder.encode(["address"], [await moduleRegistry.getAddress()]),
    ]);
    const address = await deployer.getCreate2Address(code, SALT);

    if (await isContractDeployed(address)) {
      console.log(`[${name}] skip (already deployed at ${address})`);
    } else {
      console.log(`[${name}] deploying...`);
      await deployer.deployOwnable(code, SALT);
      console.log(`[${name}] deployed at ${address}`);
    }

    moduleManager = await ethers.getContractAt(name, address);

    console.log(`[${name}] owner: ${await moduleManager.owner()}`);
  }

  let lockManager: LockManager;
  {
    const name = "LockManager";

    const factory = await ethers.getContractFactory(name);

    const code = ethers.concat([
      factory.bytecode,
      abiCoder.encode(["uint256"], [LOCK_PERIOD]),
    ]);
    const address = await deployer.getCreate2Address(code, SALT);

    if (await isContractDeployed(address)) {
      console.log(`[${name}] skip (already deployed at ${address})`);
    } else {
      console.log(`[${name}] deploying...`);
      await deployer.deploy(code, SALT);
      console.log(`[${name}] deployed at ${address}`);
    }

    lockManager = await ethers.getContractAt(name, address);
  }

  let identity: Identity;
  {
    const name = "Identity";

    const factory = await ethers.getContractFactory(name);

    const code = factory.bytecode;
    const address = await deployer.getCreate2Address(code, SALT);

    if (await isContractDeployed(address)) {
      console.log(`[${name}] skip (already deployed at ${address})`);
    } else {
      console.log(`[${name}] deploying...`);
      await deployer.deploy(
        code,
        SALT,
        factory.interface.encodeFunctionData("initialize", [
          runner.address,
          await moduleManager.getAddress(),
          [],
          [],
          [],
        ])
      );
      console.log(`[${name}] deployed at ${address}`);
    }

    identity = await ethers.getContractAt(name, address);

    console.log(`[${name}] owner: ${await identity.owner()}`);
    console.log(`[${name}] moduleManager: ${await identity.moduleManager()}`);
  }

  let relayerModule: RelayerModule | ArbRelayerModule;
  switch (network.chainId) {
    case BigInt(42161):
    case BigInt(421613): {
      const name = "ArbRelayerModule";

      const factory = await ethers.getContractFactory(name);

      const code = ethers.concat([
        factory.bytecode,
        abiCoder.encode(["address"], [await lockManager.getAddress()]),
      ]);
      const address = await deployer.getCreate2Address(code, SALT);

      if (await isContractDeployed(address)) {
        console.log(`[${name}] skip (already deployed at ${address})`);
      } else {
        console.log(`[${name}] deploying...`);
        await deployer.deploy(code, SALT);
        console.log(`[${name}] deployed at ${address}`);
      }

      relayerModule = await ethers.getContractAt(name, address);

      break;
    }

    default: {
      const name = "RelayerModule";

      const factory = await ethers.getContractFactory(name);

      const code = ethers.concat([
        factory.bytecode,
        abiCoder.encode(
          ["address", "uint256", "uint256"],
          [await lockManager.getAddress(), RELAY_MIN_GAS, RELAY_REFUND_GAS]
        ),
      ]);
      const address = await deployer.getCreate2Address(code, SALT);

      if (await isContractDeployed(address)) {
        console.log(`[${name}] skip (already deployed at ${address})`);
      } else {
        console.log(`[${name}] deploying...`);
        await deployer.deploy(code, SALT);
        console.log(`[${name}] deployed at ${address}`);
      }

      relayerModule = await ethers.getContractAt(name, address);
    }
  }

  let delegateModule: DelegateModule;
  {
    const name = "DelegateModule";

    const factory = await ethers.getContractFactory(name);

    const code = factory.bytecode;
    const address = await deployer.getCreate2Address(code, SALT);

    if (await isContractDeployed(address)) {
      console.log(`[${name}] skip (already deployed at ${address})`);
    } else {
      console.log(`[${name}] deploying...`);
      await deployer.deploy(code, SALT);
      console.log(`[${name}] deployed at ${address}`);
    }

    delegateModule = await ethers.getContractAt(name, address);
  }
})()
  .then(() => process.exit(0))
  .catch((e) => {
    console.log(e);
    process.exit(1);
  });
