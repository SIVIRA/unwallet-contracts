import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  BigNumberish,
  Block,
  BytesLike,
  TransactionReceipt,
  TransactionResponse,
} from "ethers";
import {
  ArbRelayerModule,
  IdentityProxyFactory,
  ModuleRegistry,
  RelayerModule,
} from "../typechain-types";

class Deployer {
  private runner: HardhatEthersSigner;
  private moduleRegistry: ModuleRegistry | null = null;
  private identityProxyFactory: IdentityProxyFactory | null = null;

  constructor(runner: HardhatEthersSigner) {
    this.runner = runner;
  }

  public setModuleRegistry(moduleRegistry: ModuleRegistry): void {
    this.moduleRegistry = moduleRegistry.connect(this.runner);
  }

  public setIdentityProxyFactory(identityProxyFactory: IdentityProxyFactory) {
    this.identityProxyFactory = identityProxyFactory.connect(this.runner);
  }

  public async deploy(
    name: string,
    args: any[] = [],
    as?: string
  ): Promise<any> {
    const factory = await ethers.getContractFactory(name);
    const contract = await factory.connect(this.runner).deploy(...args);
    await contract.waitForDeployment();

    return ethers.getContractAt(as ?? name, await contract.getAddress());
  }

  public async deployModule(
    name: string,
    args: any[] = [],
    withRegistration: boolean = false
  ): Promise<any> {
    const module = await this.deploy(name, args);

    if (withRegistration) {
      if (this.moduleRegistry === null) {
        throw new Error("module registry not set");
      }

      await waitTx(
        this.moduleRegistry.registerModule(await module.getAddress())
      );
    }

    return module;
  }

  public async deployIdentityProxy(
    identityImplAddress: string,
    salt: BigNumberish,
    initData: BytesLike,
    as: string = "Proxy"
  ): Promise<any> {
    if (this.identityProxyFactory === null) {
      throw new Error("identity proxy factory not set");
    }

    await waitTx(
      this.identityProxyFactory.createProxy(
        identityImplAddress,
        ethers.toBeHex(salt, 32),
        initData
      )
    );

    return ethers.getContractAt(
      as,
      await getProxyCreate2Address(
        await this.identityProxyFactory.getAddress(),
        salt,
        identityImplAddress
      )
    );
  }
}

interface IdentityOpConfig {
  gasPrice: bigint;
  gasLimit: bigint;
  refundToAddress?: string;
}

interface IdentityOpResult {
  types: string[];
  values: any[];
}

class IdentityOpManager {
  private identityAddress: string;
  private owner: HardhatEthersSigner;
  private relayer: HardhatEthersSigner;
  private signers: HardhatEthersSigner[] = [];
  private relayerModule: RelayerModule | ArbRelayerModule;

  constructor(
    identityAddress: string,
    owner: HardhatEthersSigner,
    relayer: HardhatEthersSigner,
    relayerModule: RelayerModule | ArbRelayerModule
  ) {
    this.identityAddress = identityAddress;
    this.owner = owner;
    this.relayer = relayer;
    this.relayerModule = relayerModule.connect(relayer);
  }

  public setOwner(owner: HardhatEthersSigner): void {
    this.owner = owner;
  }

  public setRelayer(relayer: HardhatEthersSigner): void {
    this.relayer = relayer;
    this.relayerModule = this.relayerModule.connect(relayer);
  }

  public setSigners(signers: HardhatEthersSigner[]): void {
    this.signers = signers.sort((a, b) => {
      const diff = ethers.toBigInt(a.address) - ethers.toBigInt(b.address);

      return diff < 0 ? -1 : diff === BigInt(0) ? 0 : 1;
    });
  }

  public async sign(hash: BytesLike): Promise<string> {
    const message = ethers.getBytes(hash);

    let sig = await this.owner.signMessage(message);
    for (const signer of this.signers) {
      sig = ethers.concat([sig, await signer.signMessage(message)]);
    }

    return sig;
  }

  public async prepareTx(
    data: BytesLike,
    config?: IdentityOpConfig
  ): Promise<{
    identityOpHash: string;
    transact: Promise<TransactionResponse>;
  }> {
    config ??= {
      gasPrice: BigInt(0),
      gasLimit: BigInt(0),
      refundToAddress: ethers.ZeroAddress,
    };

    const hash = await this._getIdentityOpHash(data, config);
    const sig = await this.sign(hash);

    return {
      identityOpHash: hash,
      transact: this.relayerModule.execute(
        this.identityAddress,
        data,
        config.gasPrice,
        config.gasLimit,
        config.refundToAddress ?? (await this.relayer.getAddress()),
        sig
      ),
    };
  }

  public async prepareTxToPing(config?: IdentityOpConfig): Promise<{
    identityOpHash: string;
    transact: Promise<TransactionResponse>;
  }> {
    const data = this.relayerModule.interface.encodeFunctionData("ping");

    return this.prepareTx(data, config);
  }

  public async prepareTxToExecuteThroughIdentity(
    args: [string, string, BigNumberish, BytesLike],
    config?: IdentityOpConfig
  ): Promise<{
    identityOpHash: string;
    transact: Promise<TransactionResponse>;
  }> {
    const data = this.relayerModule.interface.encodeFunctionData(
      "executeThroughIdentity",
      args
    );

    return this.prepareTx(data, config);
  }

  public async ping(config?: IdentityOpConfig): Promise<{
    identityOpHash: string;
    txReceipt: TransactionReceipt;
  }> {
    const { identityOpHash, transact } = await this.prepareTxToPing(config);

    return {
      identityOpHash: identityOpHash,
      txReceipt: await waitTx(transact),
    };
  }

  public async executeThroughIdentity(
    args: [string, string, BigNumberish, BytesLike],
    config?: IdentityOpConfig
  ): Promise<{
    identityOpHash: string;
    txReceipt: TransactionReceipt;
  }> {
    const { identityOpHash, transact } =
      await this.prepareTxToExecuteThroughIdentity(args, config);

    return {
      identityOpHash: identityOpHash,
      txReceipt: await waitTx(transact),
    };
  }

  public async expectIdentityOpSuccess(
    identityOpHash: string,
    txReceipt: TransactionReceipt,
    result?: IdentityOpResult
  ): Promise<void> {
    await expect(txReceipt.hash)
      .to.emit(this.relayerModule, "Executed")
      .withArgs(
        this.identityAddress,
        true,
        this._getIdentityOpResultBytes(result ?? { types: [], values: [] }),
        identityOpHash
      );
  }

  public async expectIdentityOpFailure(
    identityOpHash: BytesLike,
    txReceipt: TransactionReceipt,
    message: string
  ): Promise<void> {
    await expect(txReceipt.hash)
      .to.emit(this.relayerModule, "Executed")
      .withArgs(
        this.identityAddress,
        false,
        this._getErrorResultBytes(message),
        identityOpHash
      );
  }

  private async _getIdentityOpHash(
    data: BytesLike,
    config: IdentityOpConfig
  ): Promise<string> {
    const relayerModuleAddress = await this.relayerModule.getAddress();

    const network = await ethers.provider.getNetwork();
    const nonce = await this.relayerModule.getNonce(this.identityAddress);

    return ethers.solidityPackedKeccak256(
      [
        "bytes1",
        "bytes1",
        "uint256",
        "address",
        "address",
        "uint256",
        "bytes",
        "uint256",
        "uint256",
        "address",
        "address",
      ],
      [
        "0x19",
        "0x00",
        network.chainId,
        relayerModuleAddress,
        this.identityAddress,
        nonce,
        data,
        config.gasPrice,
        config.gasLimit,
        ethers.ZeroAddress,
        config.refundToAddress ?? (await this.relayer.getAddress()),
      ]
    );
  }

  private _getIdentityOpResultBytes(result: IdentityOpResult): BytesLike {
    if (result.types.length === 0) {
      return new Uint8Array();
    }

    return ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes"],
      [ethers.AbiCoder.defaultAbiCoder().encode(result.types, result.values)]
    );
  }

  private _getErrorResultBytes(message: string): BytesLike {
    return ethers.concat([
      "0x08c379a0",
      ethers.AbiCoder.defaultAbiCoder().encode(["string"], [message]),
    ]);
  }
}

function bigintMin(...values: bigint[]): bigint {
  if (values.length === 0) {
    throw new Error("no values");
  }
  if (values.length === 1) {
    return values[0];
  }

  let min = values.shift()!;
  for (const value of values) {
    if (value < min) {
      min = value;
    }
  }

  return min;
}

function randomString(length: number = 8): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  let s = "";
  for (let i = 0; i < length; i++) {
    s += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return s;
}

function randomUint256(): bigint {
  return ethers.toBigInt(ethers.randomBytes(32));
}

function randomAddress(): string {
  return ethers.getAddress(ethers.hexlify(ethers.randomBytes(20)));
}

function randomMethodID(): string {
  return ethers.hexlify(ethers.randomBytes(4));
}

async function now(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    ethers.provider
      .getBlockNumber()
      .then((blockNumber: number) => {
        ethers.provider
          .getBlock(blockNumber)
          .then((block: Block | null) => {
            if (block === null) {
              reject(new Error("block not found"));
              return;
            }

            resolve(block.timestamp);
          })
          .catch((e) => reject(e));
      })
      .catch((e) => reject(e));
  });
}

async function getProxyCreate2Address(
  fromAddress: string,
  salt: BigNumberish,
  implAddress: string
): Promise<string> {
  return ethers.getCreate2Address(
    fromAddress,
    ethers.toBeHex(salt, 32),
    ethers.keccak256(
      ethers.concat([
        (await ethers.getContractFactory("Proxy")).bytecode,
        ethers.AbiCoder.defaultAbiCoder().encode(["address"], [implAddress]),
      ])
    )
  );
}

async function waitTx(
  transact: Promise<TransactionResponse>
): Promise<TransactionReceipt> {
  const tx = await transact;
  const txReceipt = await tx.wait();

  return txReceipt!;
}

export {
  Deployer,
  IdentityOpConfig,
  IdentityOpResult,
  IdentityOpManager,
  bigintMin,
  randomString,
  randomUint256,
  randomAddress,
  randomMethodID,
  now,
  getProxyCreate2Address,
  waitTx,
};
