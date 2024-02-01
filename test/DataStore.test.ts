/* global describe it before ethers */

import hre from "hardhat";
const { ethers } = hre;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
const { expect, assert } = chai;
import fs from "fs";

import { BoomBots, BoomBotAccount, ERC2535Module, ERC6551AccountModule, MulticallModule, ERC721ReceiverModule, FallbackModule, RevertModule, Test1Module, Test2Module, Test3Module, ModulePack100, BoomBotsFactory, MockERC20, MockERC721, MockERC1155, DataStore } from "./../typechain-types";

import { isDeployed, expectDeployed } from "./../scripts/utils/expectDeployed";
import { toBytes32 } from "./../scripts/utils/setStorage";
import { getNetworkSettings } from "../scripts/utils/getNetworkSettings";
import { decimalsToAmount } from "../scripts/utils/price";
import { leftPad, rightPad } from "../scripts/utils/strings";
import { deployContract } from "../scripts/utils/deployContract";
import L1DataFeeAnalyzer from "../scripts/utils/L1DataFeeAnalyzer";
import { getSelectors, FacetCutAction, calcSighash, calcSighashes, getCombinedAbi } from "./../scripts/utils/diamond"

const { AddressZero, WeiPerEther, MaxUint256, Zero } = ethers.constants;
const WeiPerUsdc = BN.from(1_000_000); // 6 decimals

const ERC6551_REGISTRY_ADDRESS = "0x000000006551c19487814612e58FE06813775758";

const MAGIC_VALUE_0 = "0x00000000";
const MAGIC_VALUE_IS_VALID_SIGNER = "0x523e3260";

const multicallSighash                 = "0xac9650d8";
const diamondCutSighash                = "0x1f931c1c";
const updateSupportedInterfacesSighash = "0xf71a8a0f";
const dummy1Sighash                    = "0x11111111";
const dummy2Sighash                    = "0x22222222";
const dummy3Sighash                    = "0x33333333";
const dummy4Sighash                    = "0x44444444";
const testFunc1Sighash                 = "0x561f5f89";
const testFunc2Sighash                 = "0x08752360";
const testFunc3Sighash                 = "0x9a5fb5a8";
const inscribeSighash                  = "0xde52f07d";

describe("DataStore", function () {
  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let user4: SignerWithAddress;
  let user5: SignerWithAddress;

  let boomBotsNft: BoomBots;
  let boomBotAccountImplementation: BoomBotAccount; // the base implementation for boom bot accounts
  let dataStore: DataStore;
  let tbaccount1: BoomBotAccount; // an account bound to a token
  let tbaccount2: BoomBotAccount; // an account bound to a token
  let bbaccount1: any; // an account bound to a token
  let accountProxy: any;
  // modules
  let modulePack100: ModulePack100;
  let erc2535Module: ERC2535Module;
  let erc6551AccountModule: ERC6551AccountModule;
  let multicallModule: MulticallModule;
  //let erc20HolderModule: ERC20HolderModule;
  let erc721ReceiverModule: ERC721ReceiverModule;
  let fallbackModule: FallbackModule;
  let revertModule: RevertModule;
  let test1Module: Test1Module;
  let test2Module: Test2Module;
  let test3Module: Test3Module;
  // diamond cuts
  let diamondCutInit: any[] = [];
  let botInitializationCode1: any;
  let botInitializationCode2: any;
  // factory
  let factory: BoomBotsFactory;

  let erc20a: MockERC20;
  let erc20b: MockERC20;
  let erc20c: MockERC20;
  let erc721Asset: MockERC721; // an erc721 that token bound accounts may hold
  let erc1155: MockERC1155;

  //let token1: MockERC20;
  //let token2: MockERC20;
  //let token3: MockERC20;
  //let tokens:any[] = [];
  //let nonstandardToken1: MockERC20NoReturnsSuccess;
  //let nonstandardToken2: MockERC20NoReturnsRevert;
  //let nonstandardToken3: MockERC20NoReturnsRevertWithError;
  //let nonstandardToken4: MockERC20SuccessFalse;

  let chainID: number;
  let networkSettings: any;
  let snapshot: BN;

  let l1DataFeeAnalyzer = new L1DataFeeAnalyzer();

  before(async function () {
    [deployer, owner, user1, user2, user3, user4, user5] = await ethers.getSigners();
    chainID = (await provider.getNetwork()).chainId;
    networkSettings = getNetworkSettings(chainID);
    if(!networkSettings.isTestnet) throw new Error("Do not run tests on production networks");
    snapshot = await provider.send("evm_snapshot", []);
    await deployer.sendTransaction({to:deployer.address}); // for some reason this helps solidity-coverage

    erc20a = await deployContract(deployer, "MockERC20", [`Token A`, `TKNA`, 18]) as MockERC20;
    erc20b = await deployContract(deployer, "MockERC20", [`Token B`, `TKNB`, 18]) as MockERC20;
    erc20c = await deployContract(deployer, "MockERC20", [`Token C`, `TKNC`, 18]) as MockERC20;

  });

  after(async function () {
    await provider.send("evm_revert", [snapshot]);
  });

  describe("setup", function () {
    it("can deploy data store", async function () {
      // to deployer
      dataStore = await deployContract(deployer, "DataStore", [deployer.address]);
      await expectDeployed(dataStore.address);
      expect(await dataStore.owner()).eq(deployer.address);
      l1DataFeeAnalyzer.register("deploy DataStore", dataStore.deployTransaction);
      // to owner
      dataStore = await deployContract(deployer, "DataStore", [owner.address]);
      await expectDeployed(dataStore.address);
      expect(await dataStore.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy DataStore", dataStore.deployTransaction);
    })
    it("can deploy modules", async function () {
      // ModulePack100
      modulePack100 = await deployContract(deployer, "ModulePack100", []) as ERC2535Module;
      await expectDeployed(modulePack100.address);
      l1DataFeeAnalyzer.register("deploy ModulePack100 impl", modulePack100.deployTransaction);
      // ERC2535Module
      erc2535Module = await deployContract(deployer, "ERC2535Module", []) as ERC2535Module;
      await expectDeployed(erc2535Module.address);
      l1DataFeeAnalyzer.register("deploy ERC2535Module impl", erc2535Module.deployTransaction);
      // ERC6551AccountModule
      erc6551AccountModule = await deployContract(deployer, "ERC6551AccountModule", []) as ERC6551AccountModule;
      await expectDeployed(erc6551AccountModule.address);
      l1DataFeeAnalyzer.register("deploy ERC6551AccountModule impl", erc6551AccountModule.deployTransaction);
      // MulticallModule
      multicallModule = await deployContract(deployer, "MulticallModule", []) as MulticallModule;
      await expectDeployed(multicallModule.address);
      l1DataFeeAnalyzer.register("deploy MulticallModule impl", multicallModule.deployTransaction);
      // ERC20HolderModule
      //erc20HolderModule = await deployContract(deployer, "ERC20HolderModule", []) as ERC20HolderModule;
      //await expectDeployed(erc20HolderModule.address);
      //l1DataFeeAnalyzer.register("deploy ERC20HolderModule impl", erc20HolderModule.deployTransaction);
      // ERC721ReceiverModule
      erc721ReceiverModule = await deployContract(deployer, "ERC721ReceiverModule", []) as ERC721ReceiverModule;
      await expectDeployed(erc721ReceiverModule.address);
      l1DataFeeAnalyzer.register("deploy ERC721ReceiverModule impl", erc721ReceiverModule.deployTransaction);
      // FallbackModule
      fallbackModule = await deployContract(deployer, "FallbackModule", []) as FallbackModule;
      await expectDeployed(fallbackModule.address);
      l1DataFeeAnalyzer.register("deploy FallbackModule impl", fallbackModule.deployTransaction);
      // RevertModule
      revertModule = await deployContract(deployer, "RevertModule", []) as RevertModule;
      await expectDeployed(revertModule.address);
      l1DataFeeAnalyzer.register("deploy RevertModule impl", revertModule.deployTransaction);
      // Test1Module
      test1Module = await deployContract(deployer, "Test1Module", []) as Test1Module;
      await expectDeployed(test1Module.address);
      l1DataFeeAnalyzer.register("deploy Test1Module impl", test1Module.deployTransaction);
      // Test2Module
      test2Module = await deployContract(deployer, "Test2Module", []) as Test2Module;
      await expectDeployed(test2Module.address);
      l1DataFeeAnalyzer.register("deploy Test2Module impl", test2Module.deployTransaction);
      // Test3Module
      test3Module = await deployContract(deployer, "Test3Module", []) as Test3Module;
      await expectDeployed(test3Module.address);
      l1DataFeeAnalyzer.register("deploy Test3Module impl", test3Module.deployTransaction);
    });
  });

  describe("named addresses", function () {
    it("get before set", async function () {
      expect(await dataStore.lengthNamedAddresses()).eq(0)
      await expect(dataStore.getNamedAddress('')).to.be.revertedWithCustomError(dataStore, "UnknownName")
      await expect(dataStore.getNamedAddress('weth')).to.be.revertedWithCustomError(dataStore, "UnknownName")
      var { success, addr } = await dataStore.tryGetNamedAddress('')
      expect(success).eq(false);
      expect(addr).eq(AddressZero);
      var { success, addr } = await dataStore.tryGetNamedAddress('weth')
      expect(success).eq(false);
      expect(addr).eq(AddressZero);
      await expect(dataStore.getNamedAddressByIndex(0)).to.be.revertedWithCustomError(dataStore, "OutOfRange")
      await expect(dataStore.getNamedAddressByIndex(1)).to.be.revertedWithCustomError(dataStore, "OutOfRange")
    });
    it("cannot be set by non owner", async function () {
      await expect(dataStore.connect(user1).setNamedAddresses([])).to.be.revertedWithCustomError(dataStore, "NotContractOwner")
    });
    it("cannot set address zero", async function () {
      await expect(dataStore.connect(owner).setNamedAddresses([{
        name: "zero",
        addr: AddressZero
      }])).to.be.revertedWithCustomError(dataStore, "AddressZero")
    });
    it("owner can set", async function () {
      let namedAddresses = [
        {
          name: "weth",
          addr: erc20a.address,
        },
        {
          name: "usdc",
          addr: erc20b.address,
        },
      ]
      let tx = await dataStore.connect(owner).setNamedAddresses(namedAddresses)
      //for(let namedAddress of namedAddresses) {
      for(let i = 0; i < namedAddresses.length; i++) {
        let namedAddress = namedAddresses[i]
        expect(await dataStore.getNamedAddress(namedAddress.name)).eq(namedAddress.addr)
        var { success, addr } = await dataStore.tryGetNamedAddress(namedAddress.name)
        expect(success).eq(true);
        expect(addr).eq(namedAddress.addr);
        var { name, addr } = await dataStore.getNamedAddressByIndex(i+1)
        expect(name).eq(namedAddress.name)
        expect(addr).eq(namedAddress.addr)
        await expect(tx).to.emit(dataStore, "NamedAddressSet").withArgs(namedAddress.name, namedAddress.addr)
      }
      expect(await dataStore.lengthNamedAddresses()).eq(namedAddresses.length)
      await expect(dataStore.getNamedAddressByIndex(0)).to.be.revertedWithCustomError(dataStore, "OutOfRange")
      await expect(dataStore.getNamedAddressByIndex(namedAddresses.length+1)).to.be.revertedWithCustomError(dataStore, "OutOfRange")
    });
    it("owner can reset", async function () {
      let namedAddresses = [
        {
          name: "weth",
          addr: erc20a.address,
        },
        {
          name: "usdc",
          addr: erc20b.address,
        },
      ]
      let tx = await dataStore.connect(owner).setNamedAddresses(namedAddresses)
      //for(let namedAddress of namedAddresses) {
      for(let i = 0; i < namedAddresses.length; i++) {
        let namedAddress = namedAddresses[i]
        expect(await dataStore.getNamedAddress(namedAddress.name)).eq(namedAddress.addr)
        var { success, addr } = await dataStore.tryGetNamedAddress(namedAddress.name)
        expect(success).eq(true);
        expect(addr).eq(namedAddress.addr);
        var { name, addr } = await dataStore.getNamedAddressByIndex(i+1)
        expect(name).eq(namedAddress.name)
        expect(addr).eq(namedAddress.addr)
        await expect(tx).to.emit(dataStore, "NamedAddressSet").withArgs(namedAddress.name, namedAddress.addr)
      }
      expect(await dataStore.lengthNamedAddresses()).eq(namedAddresses.length)
      await expect(dataStore.getNamedAddressByIndex(0)).to.be.revertedWithCustomError(dataStore, "OutOfRange")
      await expect(dataStore.getNamedAddressByIndex(namedAddresses.length+1)).to.be.revertedWithCustomError(dataStore, "OutOfRange")
    });
  })

  describe("modules whitelist", function () {
    it("starts with nothing whitelisted", async function () {
      expect(await dataStore.moduleIsWhitelisted(AddressZero)).eq(false);
      expect(await dataStore.moduleCanBeInstalled(AddressZero)).eq(false);
      expect(await dataStore.moduleIsWhitelisted(user1.address)).eq(false);
      expect(await dataStore.moduleCanBeInstalled(user1.address)).eq(false);
      expect(await dataStore.moduleIsWhitelisted(modulePack100.address)).eq(false);
      expect(await dataStore.moduleCanBeInstalled(modulePack100.address)).eq(false);
    });
    it("non owner cannot whitelist modules", async function () {
      await expect(dataStore.connect(user1).setModuleWhitelist([])).to.be.revertedWithCustomError(dataStore, "NotContractOwner");
    });
    it("owner can whitelist modules", async function () {
      let modules = [
        {
          module: modulePack100.address,
          shouldWhitelist: true,
        },
        {
          module: erc2535Module.address,
          shouldWhitelist: true,
        },
        {
          module: erc6551AccountModule.address,
          shouldWhitelist: true,
        },
        {
          module: multicallModule.address,
          shouldWhitelist: true,
        },
        {
          module: erc721ReceiverModule.address,
          shouldWhitelist: true,
        },
        {
          module: revertModule.address,
          shouldWhitelist: true,
        },
        {
          module: user1.address,
          shouldWhitelist: false,
        },

      ]
      let tx = await dataStore.connect(owner).setModuleWhitelist(modules)
      for(let m of modules) {
        expect(await dataStore.moduleIsWhitelisted(m.module)).to.eq(m.shouldWhitelist)
        expect(await dataStore.moduleCanBeInstalled(m.module)).to.eq(m.shouldWhitelist)
        await expect(tx).to.emit(dataStore, "ModuleWhitelisted").withArgs(m.module, m.shouldWhitelist)
      }
    });
    it("all modules can be installed if address zero whitelisted", async function () {
      let modules = [
        {
          module: AddressZero,
          shouldWhitelist: true,
        },
      ]
      let tx = await dataStore.connect(owner).setModuleWhitelist(modules)
      for(let m of modules) {
        expect(await dataStore.moduleIsWhitelisted(m.module)).to.eq(m.shouldWhitelist)
        expect(await dataStore.moduleCanBeInstalled(m.module)).to.eq(m.shouldWhitelist)
        await expect(tx).to.emit(dataStore, "ModuleWhitelisted").withArgs(m.module, m.shouldWhitelist)
      }
      expect(await dataStore.moduleIsWhitelisted(AddressZero)).eq(true);
      expect(await dataStore.moduleCanBeInstalled(AddressZero)).eq(true);
      expect(await dataStore.moduleIsWhitelisted(user1.address)).eq(false);
      expect(await dataStore.moduleCanBeInstalled(user1.address)).eq(true);
      expect(await dataStore.moduleIsWhitelisted(modulePack100.address)).eq(true);
      expect(await dataStore.moduleCanBeInstalled(modulePack100.address)).eq(true);
    });
  })

  describe("fees - swap limit orders", function () {
    let swapType = 0;
    it("starts as zero", async function () {
      var feeRes = await dataStore.getSwapFee(swapType, AddressZero, AddressZero)
      expect(feeRes.feePercent).eq(0)
      expect(feeRes.feeReceiver).eq(dataStore.address)
      var feeRes = await dataStore.getStoredSwapFee(swapType, AddressZero, AddressZero)
      expect(feeRes.feePercent).eq(0)
      expect(feeRes.feeReceiver).eq(AddressZero)
      var feeRes = await dataStore.getSwapFee(swapType, erc20a.address, erc20b.address)
      expect(feeRes.feePercent).eq(0)
      expect(feeRes.feeReceiver).eq(dataStore.address)
      var feeRes = await dataStore.getStoredSwapFee(swapType, erc20a.address, erc20b.address)
      expect(feeRes.feePercent).eq(0)
      expect(feeRes.feeReceiver).eq(AddressZero)
    });
    it("non owner cannot set", async function () {
      await expect(dataStore.connect(user1).setSwapFees([])).to.be.revertedWithCustomError(dataStore, "NotContractOwner")
    });
    it("can set for pair", async function () {
      let fees = [
        {
          swapType: swapType,
          tokenIn: erc20a.address,
          tokenOut: erc20b.address,
          feePercent: WeiPerEther.div(100),
          feeReceiver: user1.address
        },
        {
          swapType: swapType,
          tokenIn: erc20a.address,
          tokenOut: erc20c.address,
          feePercent: WeiPerEther.mul(2).div(100),
          feeReceiver: user2.address
        },
      ]
      let tx = await dataStore.connect(owner).setSwapFees(fees)
      for(const fee of fees) {
        var feeRes = await dataStore.getSwapFee(swapType, fee.tokenIn, fee.tokenOut)
        expect(feeRes.feePercent).eq(fee.feePercent)
        expect(feeRes.feeReceiver).eq(fee.feeReceiver)
        var feeRes = await dataStore.getStoredSwapFee(swapType, fee.tokenIn, fee.tokenOut)
        expect(feeRes.feePercent).eq(fee.feePercent)
        expect(feeRes.feeReceiver).eq(fee.feeReceiver)
      }
    });
    it("can set default", async function () {
      let fees = [
        {
          swapType: swapType,
          tokenIn: AddressZero,
          tokenOut: AddressZero,
          feePercent: WeiPerEther.mul(3).div(100),
          feeReceiver: user3.address
        },
      ]
      let tx = await dataStore.connect(owner).setSwapFees(fees)
      for(const fee of fees) {
        var feeRes = await dataStore.getSwapFee(swapType, fee.tokenIn, fee.tokenOut)
        expect(feeRes.feePercent).eq(fee.feePercent)
        expect(feeRes.feeReceiver).eq(fee.feeReceiver)
        var feeRes = await dataStore.getStoredSwapFee(swapType, fee.tokenIn, fee.tokenOut)
        expect(feeRes.feePercent).eq(fee.feePercent)
        expect(feeRes.feeReceiver).eq(fee.feeReceiver)
      }
      // overwritten
      var feeRes = await dataStore.getSwapFee(swapType, erc20a.address, erc20b.address)
      expect(feeRes.feePercent).eq(WeiPerEther.div(100))
      expect(feeRes.feeReceiver).eq(user1.address)
      var feeRes = await dataStore.getStoredSwapFee(swapType, erc20a.address, erc20b.address)
      expect(feeRes.feePercent).eq(WeiPerEther.div(100))
      expect(feeRes.feeReceiver).eq(user1.address)
      // uses default
      var feeRes = await dataStore.getSwapFee(swapType, erc20c.address, erc20b.address)
      expect(feeRes.feePercent).eq(WeiPerEther.mul(3).div(100))
      expect(feeRes.feeReceiver).eq(user3.address)
      var feeRes = await dataStore.getStoredSwapFee(swapType, erc20c.address, erc20b.address)
      expect(feeRes.feePercent).eq(0)
      expect(feeRes.feeReceiver).eq(AddressZero)
    });
    it("can set explicit zero fee", async function () {
      let fees = [
        {
          swapType: swapType,
          tokenIn: erc20c.address,
          tokenOut: erc20b.address,
          feePercent: WeiPerEther,
          feeReceiver: user3.address
        },
      ]
      let tx = await dataStore.connect(owner).setSwapFees(fees)
      for(const fee of fees) {
        var feeRes = await dataStore.getSwapFee(swapType, fee.tokenIn, fee.tokenOut)
        //expect(feeRes.feePercent).eq(fee.feePercent)
        expect(feeRes.feePercent).eq(0)
        expect(feeRes.feeReceiver).eq(fee.feeReceiver)
        var feeRes = await dataStore.getStoredSwapFee(swapType, fee.tokenIn, fee.tokenOut)
        expect(feeRes.feePercent).eq(fee.feePercent)
        expect(feeRes.feeReceiver).eq(fee.feeReceiver)
      }
      for(const fee of fees) {
        var feeRes = await dataStore.getSwapFee(swapType, fee.tokenIn, fee.tokenOut)
        expect(feeRes.feePercent).eq(0)
        expect(feeRes.feeReceiver).eq(fee.feeReceiver)
        var feeRes = await dataStore.getStoredSwapFee(swapType, fee.tokenIn, fee.tokenOut)
        expect(feeRes.feePercent).eq(fee.feePercent)
        expect(feeRes.feeReceiver).eq(fee.feeReceiver)
      }
      // overwritten
      var feeRes = await dataStore.getSwapFee(swapType, erc20a.address, erc20b.address)
      expect(feeRes.feePercent).eq(WeiPerEther.div(100))
      expect(feeRes.feeReceiver).eq(user1.address)
      var feeRes = await dataStore.getStoredSwapFee(swapType, erc20a.address, erc20b.address)
      expect(feeRes.feePercent).eq(WeiPerEther.div(100))
      expect(feeRes.feeReceiver).eq(user1.address)
      // overwritten
      var feeRes = await dataStore.getSwapFee(swapType, erc20c.address, erc20b.address)
      expect(feeRes.feePercent).eq(0)
      expect(feeRes.feeReceiver).eq(user3.address)
      var feeRes = await dataStore.getStoredSwapFee(swapType, erc20c.address, erc20b.address)
      expect(feeRes.feePercent).eq(WeiPerEther)
      expect(feeRes.feeReceiver).eq(user3.address)
    });
    it("can set zero address receiver", async function () {
      let fees = [
        {
          swapType: swapType,
          tokenIn: erc20a.address,
          tokenOut: erc20b.address,
          feePercent: WeiPerEther.mul(9).div(1000),
          feeReceiver: AddressZero
        }
      ]
      let tx = await dataStore.connect(owner).setSwapFees(fees)
      // overwritten
      var feeRes = await dataStore.getSwapFee(swapType, erc20a.address, erc20b.address)
      expect(feeRes.feePercent).eq(WeiPerEther.mul(9).div(1000))
      expect(feeRes.feeReceiver).eq(user3.address)
      var feeRes = await dataStore.getStoredSwapFee(swapType, erc20a.address, erc20b.address)
      expect(feeRes.feePercent).eq(WeiPerEther.mul(9).div(1000))
      expect(feeRes.feeReceiver).eq(AddressZero)
    });
  });

  describe("fees - swap liquidity pools", function () {
    let swapType = 1;
    it("starts as zero", async function () {
      var feeRes = await dataStore.getSwapFee(swapType, AddressZero, AddressZero)
      expect(feeRes.feePercent).eq(0)
      expect(feeRes.feeReceiver).eq(dataStore.address)
      var feeRes = await dataStore.getStoredSwapFee(swapType, AddressZero, AddressZero)
      expect(feeRes.feePercent).eq(0)
      expect(feeRes.feeReceiver).eq(AddressZero)
      var feeRes = await dataStore.getSwapFee(swapType, erc20a.address, erc20b.address)
      expect(feeRes.feePercent).eq(0)
      expect(feeRes.feeReceiver).eq(dataStore.address)
      var feeRes = await dataStore.getStoredSwapFee(swapType, erc20a.address, erc20b.address)
      expect(feeRes.feePercent).eq(0)
      expect(feeRes.feeReceiver).eq(AddressZero)
    });
    it("non owner cannot set", async function () {
      await expect(dataStore.connect(user1).setSwapFees([])).to.be.revertedWithCustomError(dataStore, "NotContractOwner")
    });
    it("can set for pair", async function () {
      let fees = [
        {
          swapType: swapType,
          tokenIn: erc20a.address,
          tokenOut: erc20b.address,
          feePercent: WeiPerEther.div(100),
          feeReceiver: user1.address
        },
        {
          swapType: swapType,
          tokenIn: erc20a.address,
          tokenOut: erc20c.address,
          feePercent: WeiPerEther.mul(2).div(100),
          feeReceiver: user2.address
        },
      ]
      let tx = await dataStore.connect(owner).setSwapFees(fees)
      for(const fee of fees) {
        var feeRes = await dataStore.getSwapFee(swapType, fee.tokenIn, fee.tokenOut)
        expect(feeRes.feePercent).eq(fee.feePercent)
        expect(feeRes.feeReceiver).eq(fee.feeReceiver)
        var feeRes = await dataStore.getStoredSwapFee(swapType, fee.tokenIn, fee.tokenOut)
        expect(feeRes.feePercent).eq(fee.feePercent)
        expect(feeRes.feeReceiver).eq(fee.feeReceiver)
      }
    });
    it("can set default", async function () {
      let fees = [
        {
          swapType: swapType,
          tokenIn: AddressZero,
          tokenOut: AddressZero,
          feePercent: WeiPerEther.mul(3).div(100),
          feeReceiver: user3.address
        },
      ]
      let tx = await dataStore.connect(owner).setSwapFees(fees)
      for(const fee of fees) {
        var feeRes = await dataStore.getSwapFee(swapType, fee.tokenIn, fee.tokenOut)
        expect(feeRes.feePercent).eq(fee.feePercent)
        expect(feeRes.feeReceiver).eq(fee.feeReceiver)
        var feeRes = await dataStore.getStoredSwapFee(swapType, fee.tokenIn, fee.tokenOut)
        expect(feeRes.feePercent).eq(fee.feePercent)
        expect(feeRes.feeReceiver).eq(fee.feeReceiver)
      }
      // overwritten
      var feeRes = await dataStore.getSwapFee(swapType, erc20a.address, erc20b.address)
      expect(feeRes.feePercent).eq(WeiPerEther.div(100))
      expect(feeRes.feeReceiver).eq(user1.address)
      var feeRes = await dataStore.getStoredSwapFee(swapType, erc20a.address, erc20b.address)
      expect(feeRes.feePercent).eq(WeiPerEther.div(100))
      expect(feeRes.feeReceiver).eq(user1.address)
      // uses default
      var feeRes = await dataStore.getSwapFee(swapType, erc20c.address, erc20b.address)
      expect(feeRes.feePercent).eq(WeiPerEther.mul(3).div(100))
      expect(feeRes.feeReceiver).eq(user3.address)
      var feeRes = await dataStore.getStoredSwapFee(swapType, erc20c.address, erc20b.address)
      expect(feeRes.feePercent).eq(0)
      expect(feeRes.feeReceiver).eq(AddressZero)
    });
    it("can set explicit zero", async function () {
      let fees = [
        {
          swapType: swapType,
          tokenIn: erc20c.address,
          tokenOut: erc20b.address,
          feePercent: WeiPerEther,
          feeReceiver: user3.address
        },
      ]
      let tx = await dataStore.connect(owner).setSwapFees(fees)
      for(const fee of fees) {
        var feeRes = await dataStore.getSwapFee(swapType, fee.tokenIn, fee.tokenOut)
        //expect(feeRes.feePercent).eq(fee.feePercent)
        expect(feeRes.feePercent).eq(0)
        expect(feeRes.feeReceiver).eq(fee.feeReceiver)
        var feeRes = await dataStore.getStoredSwapFee(swapType, fee.tokenIn, fee.tokenOut)
        expect(feeRes.feePercent).eq(fee.feePercent)
        expect(feeRes.feeReceiver).eq(fee.feeReceiver)
      }
    });
    it("can set zero address receiver", async function () {
      let fees = [
        {
          swapType: swapType,
          tokenIn: erc20a.address,
          tokenOut: erc20b.address,
          feePercent: WeiPerEther.div(100),
          feeReceiver: AddressZero
        },
      ]
      let tx = await dataStore.connect(owner).setSwapFees(fees)
      // overwritten
      var feeRes = await dataStore.getSwapFee(swapType, erc20a.address, erc20b.address)
      expect(feeRes.feePercent).eq(WeiPerEther.div(100))
      expect(feeRes.feeReceiver).eq(user3.address)
      var feeRes = await dataStore.getStoredSwapFee(swapType, erc20a.address, erc20b.address)
      expect(feeRes.feePercent).eq(WeiPerEther.div(100))
      expect(feeRes.feeReceiver).eq(AddressZero)
    });
  });

  describe("fees - flash loans", function () {
    it("starts as zero", async function () {
      var feeRes = await dataStore.getFlashLoanFee(AddressZero)
      expect(feeRes.feePercent).eq(0)
      expect(feeRes.feeReceiver).eq(dataStore.address)
      var feeRes = await dataStore.getStoredFlashLoanFee(AddressZero)
      expect(feeRes.feePercent).eq(0)
      expect(feeRes.feeReceiver).eq(AddressZero)
      var feeRes = await dataStore.getFlashLoanFee(erc20a.address)
      expect(feeRes.feePercent).eq(0)
      expect(feeRes.feeReceiver).eq(dataStore.address)
      var feeRes = await dataStore.getStoredFlashLoanFee(erc20a.address)
      expect(feeRes.feePercent).eq(0)
      expect(feeRes.feeReceiver).eq(AddressZero)
    });
    it("non owner cannot set", async function () {
      await expect(dataStore.connect(user1).setFlashLoanFees([])).to.be.revertedWithCustomError(dataStore, "NotContractOwner")
    });
    it("can set for token", async function () {
      let fees = [
        {
          token: erc20a.address,
          feePercent: WeiPerEther.div(100),
          feeReceiver: user1.address
        },
        {
          token: erc20b.address,
          feePercent: WeiPerEther.mul(2).div(100),
          feeReceiver: user2.address
        },
      ]
      let tx = await dataStore.connect(owner).setFlashLoanFees(fees)
      for(const fee of fees) {
        var feeRes = await dataStore.getFlashLoanFee(fee.token)
        expect(feeRes.feePercent).eq(fee.feePercent)
        expect(feeRes.feeReceiver).eq(fee.feeReceiver)
        var feeRes = await dataStore.getStoredFlashLoanFee(fee.token)
        expect(feeRes.feePercent).eq(fee.feePercent)
        expect(feeRes.feeReceiver).eq(fee.feeReceiver)
      }
    });
    it("can set default", async function () {
      let fees = [
        {
          token: AddressZero,
          feePercent: WeiPerEther.mul(3).div(100),
          feeReceiver: user3.address
        },
      ]
      let tx = await dataStore.connect(owner).setFlashLoanFees(fees)
      for(const fee of fees) {
        var feeRes = await dataStore.getFlashLoanFee(fee.token)
        expect(feeRes.feePercent).eq(fee.feePercent)
        expect(feeRes.feeReceiver).eq(fee.feeReceiver)
        var feeRes = await dataStore.getStoredFlashLoanFee(fee.token)
        expect(feeRes.feePercent).eq(fee.feePercent)
        expect(feeRes.feeReceiver).eq(fee.feeReceiver)
      }
      // overwritten
      var feeRes = await dataStore.getFlashLoanFee(erc20a.address)
      expect(feeRes.feePercent).eq(WeiPerEther.div(100))
      expect(feeRes.feeReceiver).eq(user1.address)
      var feeRes = await dataStore.getStoredFlashLoanFee(erc20a.address)
      expect(feeRes.feePercent).eq(WeiPerEther.div(100))
      expect(feeRes.feeReceiver).eq(user1.address)
      // uses default
      var feeRes = await dataStore.getFlashLoanFee(erc20c.address)
      expect(feeRes.feePercent).eq(WeiPerEther.mul(3).div(100))
      expect(feeRes.feeReceiver).eq(user3.address)
      var feeRes = await dataStore.getStoredFlashLoanFee(erc20c.address)
      expect(feeRes.feePercent).eq(0)
      expect(feeRes.feeReceiver).eq(AddressZero)
    });
    it("can set explicit zero", async function () {
      let fees = [
        {
          token: erc20c.address,
          feePercent: WeiPerEther,
          feeReceiver: user3.address
        },
      ]
      let tx = await dataStore.connect(owner).setFlashLoanFees(fees)
      for(const fee of fees) {
        var feeRes = await dataStore.getFlashLoanFee(fee.token)
        //expect(feeRes.feePercent).eq(fee.feePercent)
        expect(feeRes.feePercent).eq(0)
        expect(feeRes.feeReceiver).eq(fee.feeReceiver)
        var feeRes = await dataStore.getStoredFlashLoanFee(fee.token)
        expect(feeRes.feePercent).eq(fee.feePercent)
        expect(feeRes.feeReceiver).eq(fee.feeReceiver)
      }
    });
    it("can set zero address receiver", async function () {
      let fees = [
        {
          token: erc20a.address,
          feePercent: WeiPerEther.div(100),
          feeReceiver: AddressZero
        },
      ]
      let tx = await dataStore.connect(owner).setFlashLoanFees(fees)
      // overwritten
      var feeRes = await dataStore.getFlashLoanFee(erc20a.address)
      expect(feeRes.feePercent).eq(WeiPerEther.div(100))
      expect(feeRes.feeReceiver).eq(user3.address)
      var feeRes = await dataStore.getStoredFlashLoanFee(erc20a.address)
      expect(feeRes.feePercent).eq(WeiPerEther.div(100))
      expect(feeRes.feeReceiver).eq(AddressZero)
    });
  });

  describe("sweep", function () {
    it("cannot be swept by non owner", async function () {
      await expect(dataStore.connect(user1).sweep([])).to.be.revertedWithCustomError(dataStore, "NotContractOwner")
    })
    it("owner can sweep tokens", async function () {
      await user1.sendTransaction({
        to: dataStore.address,
        value: WeiPerEther
      })
      await erc20a.mint(dataStore.address, WeiPerEther.mul(3))
      let bal11eth = await provider.getBalance(dataStore.address)
      let bal11erc20 = await erc20a.balanceOf(dataStore.address)
      let bal12eth = await provider.getBalance(owner.address)
      let bal12erc20 = await erc20a.balanceOf(owner.address)
      expect(bal11eth).gt(0)
      expect(bal11erc20).gt(0)
      let tx = await dataStore.connect(owner).sweep([AddressZero, erc20a.address])
      let bal21eth = await provider.getBalance(dataStore.address)
      let bal21erc20 = await erc20a.balanceOf(dataStore.address)
      let bal22eth = await provider.getBalance(owner.address)
      let bal22erc20 = await erc20a.balanceOf(owner.address)
      expect(bal21eth).eq(0)
      expect(bal21erc20).eq(0)
      expect(bal22eth).gt(bal12eth)
      expect(bal22erc20).eq(bal12erc20.add(bal11erc20))
    })
  })

  describe("ownable", function () {
    it("should initialize correctly", async function () {
      expect(await dataStore.owner()).eq(owner.address);
      expect(await dataStore.pendingOwner()).eq(AddressZero);
    });
    it("non owner cannot transfer ownership", async function () {
      await expect(dataStore.connect(user1).transferOwnership(user1.address)).to.be.revertedWithCustomError(dataStore, "NotContractOwner");
    });
    it("owner can start ownership transfer", async function () {
      let tx = await dataStore.connect(owner).transferOwnership(user2.address);
      expect(await dataStore.owner()).eq(owner.address);
      expect(await dataStore.pendingOwner()).eq(user2.address);
      await expect(tx).to.emit(dataStore, "OwnershipTransferStarted").withArgs(owner.address, user2.address);
    });
    it("non pending owner cannot accept ownership", async function () {
      await expect(dataStore.connect(user1).acceptOwnership()).to.be.revertedWithCustomError(dataStore, "NotPendingContractOwner");
    });
    it("new owner can accept ownership", async function () {
      let tx = await dataStore.connect(user2).acceptOwnership();
      expect(await dataStore.owner()).eq(user2.address);
      expect(await dataStore.pendingOwner()).eq(AddressZero);
      await expect(tx).to.emit(dataStore, "OwnershipTransferred").withArgs(owner.address, user2.address);
    });
    it("old owner does not have ownership rights", async function () {
      await expect(dataStore.connect(owner).setNamedAddresses([])).to.be.revertedWithCustomError(dataStore, "NotContractOwner")
      await expect(dataStore.connect(owner).setModuleWhitelist([])).to.be.revertedWithCustomError(dataStore, "NotContractOwner");
      await expect(dataStore.connect(owner).setSwapFees([])).to.be.revertedWithCustomError(dataStore, "NotContractOwner")
      await expect(dataStore.connect(owner).setFlashLoanFees([])).to.be.revertedWithCustomError(dataStore, "NotContractOwner")
      await expect(dataStore.connect(owner).sweep([])).to.be.revertedWithCustomError(dataStore, "NotContractOwner")
    });
    it("new owner has ownership rights - named addresses", async function () {
      let namedAddresses = [
        {
          name: "DataStore",
          addr: dataStore.address,
        },
      ]
      let tx = await dataStore.connect(user2).setNamedAddresses(namedAddresses)
      //for(let namedAddress of namedAddresses) {
      for(let i = 0; i < namedAddresses.length; i++) {
        let namedAddress = namedAddresses[i]
        expect(await dataStore.getNamedAddress(namedAddress.name)).eq(namedAddress.addr)
        var { success, addr } = await dataStore.tryGetNamedAddress(namedAddress.name)
        expect(success).eq(true);
        expect(addr).eq(namedAddress.addr);
        await expect(tx).to.emit(dataStore, "NamedAddressSet").withArgs(namedAddress.name, namedAddress.addr)
      }
    });
    it("new owner has ownership rights - whitelisted modules", async function () {
      let modules = [
        {
          module: erc20c.address,
          shouldWhitelist: true,
        },
      ]
      let tx = await dataStore.connect(user2).setModuleWhitelist(modules)
      for(let m of modules) {
        expect(await dataStore.moduleIsWhitelisted(m.module)).to.eq(m.shouldWhitelist)
        expect(await dataStore.moduleCanBeInstalled(m.module)).to.eq(m.shouldWhitelist)
        await expect(tx).to.emit(dataStore, "ModuleWhitelisted").withArgs(m.module, m.shouldWhitelist)
      }
    });
    it("new owner has ownership rights - fees 1", async function () {
      var swapType = 0;
      let fees = [
        {
          swapType: swapType,
          tokenIn: erc20a.address,
          tokenOut: erc20b.address,
          feePercent: WeiPerEther.div(10),
          feeReceiver: user3.address
        },
      ]
      let tx = await dataStore.connect(user2).setSwapFees(fees)
      for(const fee of fees) {
        var feeRes = await dataStore.getSwapFee(swapType, fee.tokenIn, fee.tokenOut)
        expect(feeRes.feePercent).eq(fee.feePercent)
        expect(feeRes.feeReceiver).eq(fee.feeReceiver)
        var feeRes = await dataStore.getStoredSwapFee(swapType, fee.tokenIn, fee.tokenOut)
        expect(feeRes.feePercent).eq(fee.feePercent)
        expect(feeRes.feeReceiver).eq(fee.feeReceiver)
      }
    });
    it("new owner has ownership rights - fees 2", async function () {
      var swapType = 0;
      let fees = [
        {
          swapType: swapType,
          tokenIn: erc20a.address,
          tokenOut: erc20b.address,
          feePercent: WeiPerEther.div(5),
          feeReceiver: user2.address
        },
      ]
      let tx = await dataStore.connect(user2).setSwapFees(fees)
      for(const fee of fees) {
        var feeRes = await dataStore.getSwapFee(swapType, fee.tokenIn, fee.tokenOut)
        expect(feeRes.feePercent).eq(fee.feePercent)
        expect(feeRes.feeReceiver).eq(fee.feeReceiver)
        var feeRes = await dataStore.getStoredSwapFee(swapType, fee.tokenIn, fee.tokenOut)
        expect(feeRes.feePercent).eq(fee.feePercent)
        expect(feeRes.feeReceiver).eq(fee.feeReceiver)
      }
    });
    it("new owner has ownership rights - fees 3", async function () {
      let fees = [
        {
          token: erc20a.address,
          feePercent: WeiPerEther.div(100),
          feeReceiver: user1.address
        },
        {
          token: erc20b.address,
          feePercent: WeiPerEther.mul(2).div(100),
          feeReceiver: user2.address
        },
      ]
      let tx = await dataStore.connect(user2).setFlashLoanFees(fees)
      for(const fee of fees) {
        var feeRes = await dataStore.getFlashLoanFee(fee.token)
        expect(feeRes.feePercent).eq(fee.feePercent)
        expect(feeRes.feeReceiver).eq(fee.feeReceiver)
        var feeRes = await dataStore.getStoredFlashLoanFee(fee.token)
        expect(feeRes.feePercent).eq(fee.feePercent)
        expect(feeRes.feeReceiver).eq(fee.feeReceiver)
      }
    });
    it("new owner has ownership rights - sweep", async function () {
      await dataStore.connect(user2).sweep([AddressZero, erc20a.address])
    });
    it("non owner cannot renounce ownership", async function () {
      await expect(dataStore.connect(user1).renounceOwnership()).to.be.revertedWithCustomError(dataStore, "NotContractOwner");
    });
    it("owner can renounce ownership", async function () {
      let tx = await dataStore.connect(user2).renounceOwnership();
      expect(await dataStore.owner()).eq(AddressZero);
      expect(await dataStore.pendingOwner()).eq(AddressZero);
      await expect(tx).to.emit(dataStore, "OwnershipTransferred").withArgs(user2.address, AddressZero);
    });
    it("can init to address zero", async function () {
      // role begins revoked
      dataStore = await deployContract(deployer, "DataStore", [AddressZero]);
      await expectDeployed(dataStore.address);
      expect(await dataStore.owner()).eq(AddressZero);
      expect(await dataStore.pendingOwner()).eq(AddressZero);
      await expect(dataStore.connect(user1).setSwapFees([])).to.be.revertedWithCustomError(dataStore, "NotContractOwner");
      await expect(dataStore.connect(user1).setFlashLoanFees([])).to.be.revertedWithCustomError(dataStore, "NotContractOwner");
      await expect(dataStore.connect(user1).transferOwnership(user1.address)).to.be.revertedWithCustomError(dataStore, "NotContractOwner");
      await expect(dataStore.connect(user1).renounceOwnership()).to.be.revertedWithCustomError(dataStore, "NotContractOwner");
    })
  });

  describe("L1 gas fees", function () {
    it("calculate", async function () {
      l1DataFeeAnalyzer.analyze()
    });
  });
});
