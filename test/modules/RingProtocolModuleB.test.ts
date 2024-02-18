/* global describe it before ethers */

import hre from "hardhat";
const { ethers } = hre;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
const { expect, assert } = chai;
import fs from "fs";

import { BoomBots, BoomBotAccount, ERC2535Module, ERC6551AccountModule, MulticallModule, ERC20HolderModule, ERC721HolderModule, FallbackModule, RevertModule, Test1Module, Test2Module, Test3Module, ModulePack100, ModulePack101, RingProtocolModuleB, BoomBotsFactory01, MockERC20, MockERC721, MockERC1155, DataStore } from "./../../typechain-types";

import { isDeployed, expectDeployed } from "./../../scripts/utils/expectDeployed";
import { toBytes32 } from "./../../scripts/utils/setStorage";
import { getNetworkSettings } from "./../../scripts/utils/getNetworkSettings";
import { decimalsToAmount } from "./../../scripts/utils/price";
import { leftPad } from "./../../scripts/utils/strings";
import { deployContract } from "./../../scripts/utils/deployContract";
import L1DataFeeAnalyzer from "./../../scripts/utils/L1DataFeeAnalyzer";
import { getSelectors, FacetCutAction, calcSighash, calcSighashes, getCombinedAbi } from "./../../scripts/utils/diamond"

const { AddressZero, WeiPerEther, MaxUint256, Zero } = ethers.constants;
const WeiPerUsdc = BN.from(1_000_000); // 6 decimals

const ERC6551_REGISTRY_ADDRESS = "0x000000006551c19487814612e58FE06813775758";

const WETH_ADDRESS             = "0x4200000000000000000000000000000000000023";
const USDC_ADDRESS             = "0xF19A5b56b419170Aa2ee49E5c9195F5902D39BF1";
const USDT_ADDRESS             = "0xD8F542D710346DF26F28D6502A48F49fB2cFD19B";
const DAI_ADDRESS              = "0x9C6Fc5bF860A4a012C9De812002dB304AD04F581";
const BOLT_ADDRESS             = "0x1B0cC80F4E2A7d205518A1Bf36de5bED686662FE";
const RGB_ADDRESS              = "0x7647a41596c1Ca0127BaCaa25205b310A0436B4C";

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

describe("modules/RingProtocolModuleB", function () {
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
  let modulePack101: ModulePack101;
  let ringProtocolModuleA: RingProtocolModuleB;
  // diamond cuts
  let diamondCutInit: any[] = [];
  let botInitializationCode1: any;
  let botInitializationCode2: any;
  // factory
  let factory: BoomBotsFactory01;

  let weth: MockERC20;
  let usdc: MockERC20;
  let usdt: MockERC20;
  let dai: MockERC20;
  let bolt: MockERC20;
  let rgb: MockERC20;

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

    function isChain(chainid: number, chainName: string) {
      //return ((chainID === chainid) || ((chainID === 31337) && (process.env.FORK_NETWORK === chainName)));
      return (process.env.FORK_NETWORK === chainName);
    }
    if(isChain(168587773, "blastsepolia")) {}
    else throw new Error(`chain '${process.env.FORK_NETWORK}' cannot be used in this test`);

    weth = await ethers.getContractAt("MockERC20", WETH_ADDRESS) as MockERC20;
    usdc = await ethers.getContractAt("MockERC20", USDC_ADDRESS) as MockERC20;
    usdt = await ethers.getContractAt("MockERC20", USDT_ADDRESS) as MockERC20;
    dai = await ethers.getContractAt("MockERC20", DAI_ADDRESS) as MockERC20;
    bolt = await ethers.getContractAt("MockERC20", BOLT_ADDRESS) as MockERC20;
    rgb = await ethers.getContractAt("MockERC20", RGB_ADDRESS) as MockERC20;

    await expectDeployed(ERC6551_REGISTRY_ADDRESS); // expect to be run on a fork of a testnet with registry deployed
  });

  after(async function () {
    await provider.send("evm_revert", [snapshot]);
  });

  describe("setup", function () {
    it("can deploy BoomBots ERC721", async function () {
      boomBotsNft = await deployContract(deployer, "BoomBots", [ERC6551_REGISTRY_ADDRESS, owner.address]) as BoomBots;
      await expectDeployed(boomBotsNft.address);
      expect(await boomBotsNft.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy Boombots", boomBotsNft.deployTransaction);
    });
    it("initializes properly", async function () {
      expect(await boomBotsNft.totalSupply()).eq(0);
      expect(await boomBotsNft.balanceOf(user1.address)).eq(0);
      expect(await boomBotsNft.getERC6551Registry()).eq(ERC6551_REGISTRY_ADDRESS);
    });
    it("can deploy account implementations", async function () {
      boomBotAccountImplementation = await deployContract(deployer, "BoomBotAccount", [deployer.address]) as BoomBotAccount;
      await expectDeployed(boomBotAccountImplementation.address);
      l1DataFeeAnalyzer.register("deploy BoomBotAccount impl", boomBotsNft.deployTransaction);
    });
    it("can deploy data store", async function () {
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
      // ModulePack101
      modulePack101 = await deployContract(deployer, "ModulePack101", [owner.address]) as ERC2535Module;
      await expectDeployed(modulePack101.address);
      l1DataFeeAnalyzer.register("deploy ModulePack101 impl", modulePack101.deployTransaction);
      // RingProtocolModuleB
      ringProtocolModuleA = await deployContract(deployer, "RingProtocolModuleB", [owner.address]) as RingProtocolModuleB;
      await expectDeployed(ringProtocolModuleA.address);
      l1DataFeeAnalyzer.register("deploy RingProtocolModuleB impl", ringProtocolModuleA.deployTransaction);
    });
    it("can deploy BoomBotsFactory01", async function () {
      factory = await deployContract(deployer, "BoomBotsFactory01", [owner.address, boomBotsNft.address]) as BoomBotsFactory01;
      await expectDeployed(factory.address);
      expect(await factory.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy BoomBotsFactory01", factory.deployTransaction);
    });
  });

  describe("bot creation via factory", function () {
    it("owner can whitelist", async function () {
      let whitelist = [
        {
          factory: factory.address,
          shouldWhitelist: true
        }
      ];
      let tx = await boomBotsNft.connect(owner).setWhitelist(whitelist);
      for(let i = 0; i < whitelist.length; i++) {
        let whitelistItem = whitelist[i]
        await expect(tx).to.emit(boomBotsNft, "FactoryWhitelisted").withArgs(whitelistItem.factory, whitelistItem.shouldWhitelist);
        expect(await boomBotsNft.factoryIsWhitelisted(whitelistItem.factory)).eq(whitelistItem.shouldWhitelist);
      }
    });
    it("owner can postBotCreationSettings", async function () {
      //let sighashes = calcSighashes(modulePack100, 'ModulePack100')
      //sighashes.push(inscribeSighash)
      let sighashes = [
        '0x660d0d67', // dataStore()
        '0x1f931c1c', // diamondCut((address,uint8,bytes4[])[],address,bytes)
        '0x51945447', // execute(address,uint256,bytes,uint8)
        '0xcdffacc6', // facetAddress(bytes4)
        '0x52ef6b2c', // facetAddresses()
        '0xadfca15e', // facetFunctionSelectors(address)
        '0x7a0ed627', // facets()
        '0x1626ba7e', // isValidSignature(bytes32,bytes)
        '0x523e3260', // isValidSigner(address,bytes)
        '0xd5f50582', // isValidSigner(address)
        '0xac9650d8', // multicall(bytes[])
        '0xbc197c81', // onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)
        '0xf23a6e61', // onERC1155Received(address,address,uint256,uint256,bytes)
        '0x150b7a02', // onERC721Received(address,address,uint256,bytes)
        '0x8da5cb5b', // owner()
        '0xa2d2dd3c', // reentrancyGuardState()
        '0xc19d93fb', // state()
        '0x01ffc9a7', // supportsInterface(bytes4)
        '0xfc0c546a', // token()
        '0xf71a8a0f', // updateSupportedInterfaces(bytes4[],bool[])
        '0xde52f07d', // inscribe()
      ]
      let diamondCut = [
        {
          facetAddress: modulePack101.address,
          action: FacetCutAction.Add,
          functionSelectors: sighashes,
        },
      ]
      diamondCutInit = diamondCut
      let interfaceIDs = [
        "0x01ffc9a7", // ERC165
        "0x1f931c1c", // DiamondCut
        "0x48e2b093", // DiamondLoupe
        "0x6faff5f1", // ERC6551Account
        "0x51945447", // ERC6551Executable
      ]
      let support = interfaceIDs.map(id=>true)
      let params = {
        botImplementation: boomBotAccountImplementation.address,
        initializationCalls: [
          boomBotAccountImplementation.interface.encodeFunctionData("initialize", [diamondCut, dataStore.address]),
          modulePack101.interface.encodeFunctionData("updateSupportedInterfaces", [interfaceIDs, support]),
        ],
        isPaused: false
      }
      let tx = await factory.connect(owner).postBotCreationSettings(params)
      expect(await factory.getBotCreationSettingsCount()).eq(1)
      let res = await factory.getBotCreationSettings(1)
      expect(res.botImplementation).eq(params.botImplementation)
      expect(res.initializationCalls.length).eq(params.initializationCalls.length)
      expect(res.isPaused).eq(params.isPaused)
      await expect(tx).to.emit(factory, "BotCreationSettingsPosted").withArgs(1)
      await expect(tx).to.emit(factory, "BotCreationSettingsPaused").withArgs(1, params.isPaused)
    })
    it("owner can whitelist modules", async function () {
      let modules = [
        {
          module: modulePack101.address,
          shouldWhitelist: true,
        },
        {
          module: ringProtocolModuleA.address,
          shouldWhitelist: true,
        },
      ]
      let tx = await dataStore.connect(owner).setModuleWhitelist(modules)
      for(let m of modules) {
        expect(await dataStore.moduleIsWhitelisted(m.module)).to.eq(m.shouldWhitelist)
        expect(await dataStore.moduleCanBeInstalled(m.module)).to.eq(m.shouldWhitelist)
        await expect(tx).to.emit(dataStore, "ModuleWhitelisted").withArgs(m.module, m.shouldWhitelist)
      }
    });
    it("can create bot pt 1", async function () {
      let ts = await boomBotsNft.totalSupply();
      let bal = await boomBotsNft.balanceOf(user1.address);
      let botID = ts.add(1);
      let botRes = await factory.connect(user1).callStatic['createBot(uint256)'](1);
      expect(botRes.botID).eq(botID);
      expect(await boomBotsNft.exists(botID)).eq(false);
      let isDeployed1 = await isDeployed(botRes.botAddress)
      expect(isDeployed1).to.be.false;
      let tx = await factory.connect(user1)['createBot(uint256)'](1);
      await expect(tx).to.emit(boomBotsNft, "Transfer").withArgs(AddressZero, factory.address, botRes.botID);
      await expect(tx).to.emit(boomBotsNft, "Transfer").withArgs(factory.address, user1.address, botRes.botID);
      expect(await boomBotsNft.totalSupply()).eq(ts.add(1));
      expect(await boomBotsNft.balanceOf(user1.address)).eq(bal.add(1));
      expect(await boomBotsNft.exists(botID)).eq(true);
      expect(await boomBotsNft.ownerOf(botRes.botID)).eq(user1.address);
      let botInfo = await boomBotsNft.getBotInfo(botID);
      //expect(botInfo.botAddress).eq(botRes.botAddress); // may change
      let isDeployed2 = await isDeployed(botInfo.botAddress)
      expect(isDeployed2).to.be.true;
      expect(botInfo.implementationAddress).eq(boomBotAccountImplementation.address);
      tbaccount2 = await ethers.getContractAt("BoomBotAccount", botInfo.botAddress) as BoomBotAccount;
      l1DataFeeAnalyzer.register("createBot", tx);
    });
  });

  describe("bot initial state", function () {
    let botID = 1;
    let botOwner: any;
    let botInfo: any;

    it("can get basic info", async function () {
      // get info
      expect(await boomBotsNft.exists(botID)).eq(true);
      botInfo = await boomBotsNft.getBotInfo(botID);
      tbaccount1 = await ethers.getContractAt("BoomBotAccount", botInfo.botAddress) as BoomBotAccount;
      bbaccount1 = await ethers.getContractAt("ERC6551Account", botInfo.botAddress) as ERC6551Account;
      botOwner = user1;
    });
    it("account begins with correct state", async function () {
      // get owner
      expect(await bbaccount1.owner()).eq(botOwner.address);
      // get token
      let tokenRes = await bbaccount1.token();
      expect(tokenRes.chainId).eq(chainID);
      expect(tokenRes.tokenContract).eq(boomBotsNft.address);
      expect(tokenRes.tokenId).eq(botID);
      // other info
      expect(await bbaccount1.state()).eq(0);
      expect(await bbaccount1.isValidSigner(botOwner.address, "0x")).eq(MAGIC_VALUE_IS_VALID_SIGNER);
      expect(await bbaccount1.isValidSigner(botOwner.address, "0x00abcd")).eq(MAGIC_VALUE_IS_VALID_SIGNER);
      expect(await bbaccount1.isValidSigner(deployer.address, "0x")).eq(MAGIC_VALUE_0);
      expect(await bbaccount1.isValidSigner(AddressZero, "0x")).eq(MAGIC_VALUE_0);
      expect(await bbaccount1.isValidSignature(toBytes32(0), "0x")).eq(MAGIC_VALUE_0);
      expect(await bbaccount1.supportsInterface("0x01ffc9a7")).eq(true); // ERC165
      expect(await bbaccount1.supportsInterface("0x1f931c1c")).eq(true); // DiamondCut
      expect(await bbaccount1.supportsInterface("0x48e2b093")).eq(true); // DiamondLoupe
      expect(await bbaccount1.supportsInterface("0x6faff5f1")).eq(true); // ERC6551Account
      expect(await bbaccount1.supportsInterface("0x51945447")).eq(true); // ERC6551Executable
      expect(await bbaccount1.supportsInterface("0xffffffff")).eq(false);
      expect(await bbaccount1.supportsInterface("0x00000000")).eq(false);
    });
    it("has the correct modules", async function () {
      let diamondAccount = await ethers.getContractAt("ModulePack101", bbaccount1.address) as ModulePack101;
      // facets(), facetAddresses()
      let facets = await diamondAccount.facets();
      let facetAddresses = await diamondAccount.facetAddresses();
      let sighashes = calcSighashes(boomBotAccountImplementation, 'BoomBotAccount')
      diamondCutInit = [
        {
          facetAddress: diamondAccount.address,
          action: FacetCutAction.Add,
          functionSelectors: sighashes,
        },
        ...diamondCutInit
      ]
      //console.log(facets)
      //console.log(facetAddresses)
      expect(facets.length).eq(diamondCutInit.length);
      for(let i = 0; i < diamondCutInit.length; i++) {
        expect(facets[i].facetAddress).eq(diamondCutInit[i].facetAddress);
        expect(facetAddresses[i]).eq(diamondCutInit[i].facetAddress);
        assert.sameMembers(facets[i].functionSelectors, diamondCutInit[i].functionSelectors);
        // facetFunctionSelectors()
        let selectors = await diamondAccount.facetFunctionSelectors(facetAddresses[i]);
        assert.sameMembers(selectors, diamondCutInit[i].functionSelectors);
        // facetAddress()
        for(let j = 0; j < diamondCutInit[i].functionSelectors.length; j++) {
          let selector = diamondCutInit[i].functionSelectors[j];
          let facetAddress = await diamondAccount.facetAddress(selector);
          expect(facetAddress).eq(diamondCutInit[i].facetAddress);
        }
      }
    });
  });

  describe("install module", function () {
    it("can get combined abi", async function () {
      let abi = getCombinedAbi([
        "artifacts/contracts/accounts/BoomBotAccount.sol/BoomBotAccount.json",
        "artifacts/contracts/modules/ModulePack101.sol/ModulePack101.json",
        "artifacts/contracts/modules/RingProtocolModuleB.sol/RingProtocolModuleB.json",
        "artifacts/contracts/libraries/Errors.sol/Errors.json",
        "artifacts/contracts/libraries/modules/ERC2535Library.sol/ERC2535Library.json",
        "artifacts/contracts/libraries/modules/ERC165Library.sol/ERC165Library.json",
      ])
      //console.log('abi');
      //console.log(abi);
      accountProxy = await ethers.getContractAt(abi, bbaccount1.address);
      //console.log('accountProxy')
      //console.log(accountProxy)
    });
    it("can install and execute module", async function () {
      let amounts0 = await Promise.all([
        accountProxy.state(),
        provider.getBalance(accountProxy.address),
        weth.balanceOf(accountProxy.address),
        usdc.balanceOf(accountProxy.address),
        usdt.balanceOf(accountProxy.address),
        dai.balanceOf(accountProxy.address),
        bolt.balanceOf(accountProxy.address),
        rgb.balanceOf(accountProxy.address),
      ])
      let ethAmount1 = WeiPerEther.div(100)
      let ethAmount2 = ethAmount1.mul(9).div(10)
      //let sighashes = calcSighashes(ringProtocolModuleA, 'RingProtocolModuleB', true)
      let sighashes = ['0x25d315e0'] // executeRingProtocolModuleB(uint256)
      let delegatecalldata = accountProxy.interface.encodeFunctionData("executeRingProtocolModuleB", [ethAmount2])
      expect(delegatecalldata.substring(0,10)).eq(sighashes[0])
      let tx = await accountProxy.connect(user1).diamondCut([{
        facetAddress: ringProtocolModuleA.address,
        action: FacetCutAction.Add,
        functionSelectors: sighashes
      }], ringProtocolModuleA.address, delegatecalldata, {value: ethAmount1}); // and delegatecall
      //console.log('tx')
      //console.log(tx)
      let receipt = await tx.wait()
      //console.log('receipt')
      //console.log(receipt)
      await expect(tx).to.emit(accountProxy, "DiamondCut");
      let amounts1 = await Promise.all([
        accountProxy.state(),
        provider.getBalance(accountProxy.address),
        weth.balanceOf(accountProxy.address),
        usdc.balanceOf(accountProxy.address),
        usdt.balanceOf(accountProxy.address),
        dai.balanceOf(accountProxy.address),
        bolt.balanceOf(accountProxy.address),
        rgb.balanceOf(accountProxy.address),
      ])
      //console.log(amounts0)
      //console.log(amounts1)
      expect(amounts1[0]).eq(amounts0[0].add(1))
      expect(amounts1[1]).gt(amounts0[1])
      expect(amounts1[2]).gt(amounts0[2])
      expect(amounts1[3]).gt(amounts0[3])
      expect(amounts1[4]).gt(amounts0[4])
      expect(amounts1[5]).gt(amounts0[5])
      expect(amounts1[6]).gt(amounts0[6])
      l1DataFeeAnalyzer.register("inst&exec RingProtocolModuleB", tx);
      // cumulativeGasUsed: 1_206_617
    });
    it("can just execute module", async function () {
      let amounts0 = await Promise.all([
        accountProxy.state(),
        provider.getBalance(accountProxy.address),
        weth.balanceOf(accountProxy.address),
        usdc.balanceOf(accountProxy.address),
        usdt.balanceOf(accountProxy.address),
        dai.balanceOf(accountProxy.address),
        bolt.balanceOf(accountProxy.address),
        rgb.balanceOf(accountProxy.address),
      ])
      let ethAmount1 = WeiPerEther.div(100)
      let ethAmount2 = ethAmount1.mul(9).div(10)
      let delegatecalldata = accountProxy.interface.encodeFunctionData("executeRingProtocolModuleB", [ethAmount2])
      let tx = await accountProxy.connect(user1).executeRingProtocolModuleB(ethAmount2, {value: ethAmount1}); // and delegatecall
      //console.log('tx')
      //console.log(tx)
      let receipt = await tx.wait()
      //console.log('receipt')
      //console.log(receipt)
      await expect(tx).to.not.emit(accountProxy, "DiamondCut");
      let amounts1 = await Promise.all([
        accountProxy.state(),
        provider.getBalance(accountProxy.address),
        weth.balanceOf(accountProxy.address),
        usdc.balanceOf(accountProxy.address),
        usdt.balanceOf(accountProxy.address),
        dai.balanceOf(accountProxy.address),
        bolt.balanceOf(accountProxy.address),
        rgb.balanceOf(accountProxy.address),
      ])
      //console.log(amounts0)
      //console.log(amounts1)
      expect(amounts1[0]).eq(amounts0[0].add(1))
      expect(amounts1[1]).gt(amounts0[1])
      expect(amounts1[2]).gt(amounts0[2])
      expect(amounts1[3]).gt(amounts0[3])
      expect(amounts1[4]).gt(amounts0[4])
      expect(amounts1[5]).gt(amounts0[5])
      expect(amounts1[6]).gt(amounts0[6])
      l1DataFeeAnalyzer.register("exec RingProtocolModuleB", tx);
      // cumulativeGasUsed: 1_000_520
    });
    it("cannot execute with zero eth", async function () {
      await expect(accountProxy.connect(user1).executeRingProtocolModuleB(0, {value: 100})).to.be.revertedWithCustomError(accountProxy, "AmountZero");
    });
    it("non owner cannot execute", async function () {
      await expect(accountProxy.connect(user2).executeRingProtocolModuleB(100, {value: 100})).to.be.revertedWithCustomError(accountProxy, "ERC6551InvalidSigner");
    });
  });

  describe("L1 gas fees", function () {
    it("calculate", async function () {
      l1DataFeeAnalyzer.analyze()
    });
  });
});
