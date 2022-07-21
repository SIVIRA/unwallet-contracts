import { expect } from "chai";
import { ethers } from "hardhat";

import {
  BigNumberish,
  BytesLike,
  Contract,
  ContractReceipt,
  ContractTransaction,
  Wallet,
} from "ethers";
import { Block } from "@ethersproject/abstract-provider";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import * as constants from "./constants";

interface ExecutionGasConfig {
  price: BigNumberish;
  limit: BigNumberish;
  token: string;
  refundTo: string;
}

interface ExecutionResult {
  types: string[];
  values: any[];
}

class DeployerBase {
  public async deployContract(
    name: string,
    args: any[] = []
  ): Promise<Contract> {
    const factory = await ethers.getContractFactory(name);
    const contract = await factory.deploy(...args);

    return contract.deployed();
  }
}

class Deployer extends DeployerBase {
  public deployFactory(): Promise<Contract> {
    return this.deployContract("Factory");
  }

  public deployIdentityProxyFactory(identityAddr: string): Promise<Contract> {
    return this.deployContract("IdentityProxyFactory", [identityAddr]);
  }

  public deployModuleRegistry(): Promise<Contract> {
    return this.deployContract("ModuleRegistry");
  }

  public deployModuleManager(registryAddr: string): Promise<Contract> {
    return this.deployContract("ModuleManager", [registryAddr]);
  }

  public deployLockManager(): Promise<Contract> {
    return this.deployContract("LockManager", [constants.LOCK_PERIOD]);
  }

  public deployIdentity(moduleManagerAddr: string): Promise<Contract> {
    return this.deployContract("Identity", [moduleManagerAddr]);
  }
}

class ModuleDeployer extends DeployerBase {
  public registry: Contract;
  public manager: Contract;

  constructor(registry: Contract, manager: Contract) {
    super();

    this.registry = registry;
    this.manager = manager;
  }

  public async deployModule(
    name: string,
    args: any[] = [],
    isRegistered: boolean = false,
    isEnabeld: boolean = false
  ): Promise<Contract> {
    const contract = await this.deployContract(name, args);

    if (isRegistered) {
      await executeContract(this.registry.registerModule(contract.address));
    }

    if (isEnabeld) {
      await executeContract(this.manager.enableModule(contract.address));
    }

    return contract;
  }
}

class IdentityProxyDeployer extends DeployerBase {
  public factory: Contract;

  constructor(factory: Contract) {
    super();

    this.factory = factory;
  }

  public async deployProxy(
    ownerAddr: string,
    salt: BytesLike,
    as: string = "contracts/Proxy.sol:Proxy"
  ): Promise<Contract> {
    await executeContract(this.factory.createProxy(ownerAddr, salt));

    return ethers.getContractAt(
      as,
      await getProxyAddress(
        this.factory.address,
        salt,
        await this.factory.identityImplementation()
      )
    );
  }
}

class MetaTxManager {
  public signers: SignerWithAddress[] = [];
  public identity: Contract;
  public relayerModule: Contract;

  constructor(
    signers: SignerWithAddress[],
    identity: Contract,
    relayerModule: Contract
  ) {
    this.setSigners(signers);
    this.identity = identity;
    this.relayerModule = relayerModule;
  }

  public setSigners(
    signers: SignerWithAddress[],
    isOwnerIncluded: boolean = true
  ): void {
    if (signers.length == 0) {
      this.signers = signers;
      return;
    }

    let orderedSigners: SignerWithAddress[] = [];

    if (isOwnerIncluded) {
      orderedSigners.push(signers.shift()!);
    }

    signers.sort((a, b) => {
      const diff = ethers.BigNumber.from(a.address).sub(
        ethers.BigNumber.from(b.address)
      );

      return diff.isNegative() ? -1 : diff.isZero() ? 0 : 1;
    });

    orderedSigners = orderedSigners.concat(signers);

    this.signers = orderedSigners;
  }

  public async sign(hash: Uint8Array): Promise<Uint8Array> {
    let sig = new Uint8Array();
    for (const signer of this.signers) {
      sig = ethers.utils.concat([sig, await signer.signMessage(hash)]);
    }

    return sig;
  }

  public async prepareMetaTx(
    functionFragment: string,
    args: any[],
    gasConfig: ExecutionGasConfig
  ): Promise<{ txHash: Uint8Array; executor: Promise<ContractTransaction> }> {
    const data = this.relayerModule.interface.encodeFunctionData(
      functionFragment,
      args
    );
    const txHash = await this.getTxHash(data, gasConfig);
    const sig = await this.sign(txHash);

    return {
      txHash: txHash,
      executor: this.relayerModule.execute(
        this.identity.address,
        data,
        gasConfig.price,
        gasConfig.limit,
        gasConfig.refundTo,
        sig
      ),
    };
  }

  public prepareMetaTxWithoutRefund(
    functionFragment: string,
    args: any[]
  ): Promise<{ txHash: Uint8Array; executor: Promise<ContractTransaction> }> {
    return this.prepareMetaTx(
      functionFragment,
      args,
      constants.EMPTY_EXECUTION_GAS_CONFIG
    );
  }

  public async executeMetaTx(
    functionFragment: string,
    args: any[],
    gasConfig: ExecutionGasConfig
  ): Promise<ContractTransaction> {
    const { executor } = await this.prepareMetaTx(
      functionFragment,
      args,
      gasConfig
    );

    return executor;
  }

  public executeMetaTxWithoutRefund(
    functionFragment: string,
    args: any[]
  ): Promise<ContractTransaction> {
    return this.executeMetaTx(
      functionFragment,
      args,
      constants.EMPTY_EXECUTION_GAS_CONFIG
    );
  }

  public async expectMetaTxSuccess(
    functionFragment: string,
    args: any[],
    gasConfig: ExecutionGasConfig,
    result: ExecutionResult
  ): Promise<ContractReceipt> {
    const { txHash, executor } = await this.prepareMetaTx(
      functionFragment,
      args,
      gasConfig
    );

    const tx = await executor;
    const receipt = await tx.wait();

    const assertion = expect(receipt.transactionHash);
    await assertion.to
      .emit(this.relayerModule, "Executed")
      .withArgs(
        this.identity.address,
        true,
        ethers.utils.hexlify(this._getExecutionResultBytes(result)),
        ethers.utils.hexlify(txHash)
      );

    if (ethers.BigNumber.from(gasConfig.price).gt(0)) {
      await assertion.to.emit(this.relayerModule, "Refunded");
    }

    return receipt;
  }

  public expectMetaTxSuccessWithoutRefund(
    functionFragment: string,
    args: any[],
    result: ExecutionResult
  ): Promise<ContractReceipt> {
    return this.expectMetaTxSuccess(
      functionFragment,
      args,
      constants.EMPTY_EXECUTION_GAS_CONFIG,
      result
    );
  }

  public async expectMetaTxFailure(
    functionFragment: string,
    args: any[],
    gasConfig: ExecutionGasConfig,
    message: string
  ): Promise<ContractReceipt> {
    const { txHash, executor } = await this.prepareMetaTx(
      functionFragment,
      args,
      gasConfig
    );

    const tx = await executor;
    const receipt = await tx.wait();

    const assertion = expect(tx.hash);
    await assertion.to
      .emit(this.relayerModule, "Executed")
      .withArgs(
        this.identity.address,
        false,
        ethers.utils.hexlify(this._getErrorResultBytes(message)),
        ethers.utils.hexlify(txHash)
      );

    if (ethers.BigNumber.from(gasConfig.price).gt(0)) {
      await assertion.to.emit(this.relayerModule, "Refunded");
    }

    return receipt;
  }

  public expectMetaTxFailureWithoutRefund(
    functionFragment: string,
    args: any[],
    message: string
  ): Promise<ContractReceipt> {
    return this.expectMetaTxFailure(
      functionFragment,
      args,
      constants.EMPTY_EXECUTION_GAS_CONFIG,
      message
    );
  }

  public async getTxHash(
    data: BytesLike,
    gasConfig: ExecutionGasConfig
  ): Promise<Uint8Array> {
    const network = await ethers.provider.getNetwork();
    const nonce = await this.relayerModule.getNonce(this.identity.address);

    return ethers.utils.arrayify(
      ethers.utils.solidityKeccak256(
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
          0x19,
          0x00,
          network.chainId,
          this.relayerModule.address,
          this.identity.address,
          nonce,
          data,
          gasConfig.price,
          gasConfig.limit,
          gasConfig.token,
          gasConfig.refundTo,
        ]
      )
    );
  }

  public getTxHashWithoutRefund(data: BytesLike): Promise<Uint8Array> {
    return this.getTxHash(data, constants.EMPTY_EXECUTION_GAS_CONFIG);
  }

  private _getExecutionResultBytes(result: ExecutionResult): Uint8Array {
    if (result.types.length === 0) {
      return new Uint8Array();
    }

    return ethers.utils.arrayify(
      ethers.utils.defaultAbiCoder.encode(
        ["bytes"],
        [ethers.utils.defaultAbiCoder.encode(result.types, result.values)]
      )
    );
  }

  private _getErrorResultBytes(message: string): Uint8Array {
    return ethers.utils.concat([
      "0x08c379a0",
      ethers.utils.defaultAbiCoder.encode(["string"], [message]),
    ]);
  }
}

const randomAddress = (): string => {
  return ethers.utils.getAddress(
    ethers.utils.hexlify(ethers.utils.randomBytes(20))
  );
};

const randomMethodID = (): string => {
  return ethers.utils.hexlify(ethers.utils.randomBytes(4));
};

const randomWallet = (): Wallet => {
  return ethers.Wallet.createRandom().connect(ethers.provider);
};

const getLatestBlock = async (): Promise<Block> => {
  return ethers.provider.getBlock(await ethers.provider.getBlockNumber());
};

const now = async (): Promise<number> => {
  return (await getLatestBlock()).timestamp;
};

const getProxyAddress = async (
  fromAddr: string,
  salt: BytesLike,
  implAddr: string
): Promise<string> => {
  return ethers.utils.getCreate2Address(
    fromAddr,
    salt,
    ethers.utils.keccak256(
      ethers.utils.concat([
        (await ethers.getContractFactory("contracts/Proxy.sol:Proxy")).bytecode,
        ethers.utils.defaultAbiCoder.encode(["address"], [implAddr]),
      ])
    )
  );
};

const executeContract = async (
  f: Promise<ContractTransaction>
): Promise<void> => {
  (await f).wait();
};

export {
  ExecutionGasConfig,
  Deployer,
  ModuleDeployer,
  IdentityProxyDeployer,
  MetaTxManager,
  randomAddress,
  randomMethodID,
  randomWallet,
  getLatestBlock,
  now,
  getProxyAddress,
  executeContract,
};
