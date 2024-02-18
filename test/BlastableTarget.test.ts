/* global describe it before ethers */

import hre from "hardhat";
const { ethers } = hre;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
const { expect, assert } = chai;
import fs from "fs";

import { BoomBots, BoomBotAccount, ERC2535Module, ERC6551AccountModule, MulticallModule, ERC20HolderModule, ERC721HolderModule, FallbackModule, RevertModule, Test1Module, Test2Module, Test3Module, ModulePack100, BoomBotsFactory01, MockERC20, MockERC721, MockERC1155, DataStore, RevertAccount, IBlast, MockBlast, MockBlastableAccount } from "./../typechain-types";

import { isDeployed, expectDeployed } from "./../scripts/utils/expectDeployed";
import { toBytes32 } from "./../scripts/utils/setStorage";
import { getNetworkSettings } from "../scripts/utils/getNetworkSettings";
import { decimalsToAmount } from "../scripts/utils/price";
import { leftPad } from "../scripts/utils/strings";
import { deployContract } from "../scripts/utils/deployContract";
import L1DataFeeAnalyzer from "../scripts/utils/L1DataFeeAnalyzer";
import { getSelectors, FacetCutAction, calcSighash, calcSighashes, getCombinedAbi } from "./../scripts/utils/diamond"

const { AddressZero, WeiPerEther, MaxUint256, Zero } = ethers.constants;
const WeiPerUsdc = BN.from(1_000_000); // 6 decimals

const ERC6551_REGISTRY_ADDRESS = "0x000000006551c19487814612e58FE06813775758";
const BLAST_ADDRESS            = "0x4300000000000000000000000000000000000002";

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

describe("BlastableTarget", function () {
  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let user4: SignerWithAddress;
  let user5: SignerWithAddress;

  let boomBotsNft: BoomBots;
  let boomBotAccountImplementation: BoomBotAccount; // the base implementation for boom bot accounts
  let mockAccountImplementation: MockBlastableAccount;
  let dataStore: DataStore;
  let tbaccount1: BoomBotAccount; // an account bound to a token
  let tbaccount2: BoomBotAccount; // an account bound to a token
  let tbaccount3: MockBlastableAccount; // an account bound to a token
  let bbaccount1: any; // an account bound to a token
  let accountProxy: any;
  // modules
  let modulePack100: ModulePack100;
  let erc2535Module: ERC2535Module;
  let erc6551AccountModule: ERC6551AccountModule;
  let multicallModule: MulticallModule;
  let erc20HolderModule: ERC20HolderModule;
  let erc721HolderModule: ERC721HolderModule;
  let fallbackModule: FallbackModule;
  let revertModule: RevertModule;
  let test1Module: Test1Module;
  let test2Module: Test2Module;
  let test3Module: Test3Module;
  let revertAccount: RevertAccount;
  // diamond cuts
  let diamondCutInit: any[] = [];
  let botInitializationCode1: any;
  let botInitializationCode2: any;
  // factory
  let factory: BoomBotsFactory01;
  let iblast: any;
  let mockblast: MockBlast;

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

  let abi:any[] = []

  let l1DataFeeAnalyzer = new L1DataFeeAnalyzer();

  before(async function () {
    [deployer, owner, user1, user2, user3, user4, user5] = await ethers.getSigners();
    chainID = (await provider.getNetwork()).chainId;
    networkSettings = getNetworkSettings(chainID);
    if(!networkSettings.isTestnet) throw new Error("Do not run tests on production networks");
    snapshot = await provider.send("evm_snapshot", []);
    await deployer.sendTransaction({to:deployer.address}); // for some reason this helps solidity-coverage

    //while(tokens.length < 21) {
      //let token = await deployContract(deployer, "MockERC20", [`Token${tokens.length+1}`, `TKN${tokens.length+1}`, 18]) as MockERC20;
      //tokens.push(token);
    //}
    //[token1, token2, token3] = tokens;
    erc20a = await deployContract(deployer, "MockERC20", [`Token A`, `TKNA`, 18]) as MockERC20;
    erc20b = await deployContract(deployer, "MockERC20", [`Token B`, `TKNB`, 18]) as MockERC20;
    erc20c = await deployContract(deployer, "MockERC20", [`Token C`, `TKNC`, 18]) as MockERC20;

    //nonstandardToken1 = await deployContract(deployer, "MockERC20NoReturnsSuccess", [`NonstandardToken1`, `NSTKN1`, 18]) as MockERC20NoReturnsSuccess;
    //nonstandardToken2 = await deployContract(deployer, "MockERC20NoReturnsRevert", [`NonstandardToken2`, `NSTKN2`, 18]) as MockERC20NoReturnsRevert;
    //nonstandardToken3 = await deployContract(deployer, "MockERC20NoReturnsRevertWithError", [`NonstandardToken3`, `NSTKN3`, 18]) as MockERC20NoReturnsRevertWithError;
    //nonstandardToken4 = await deployContract(deployer, "MockERC20SuccessFalse", [`NonstandardToken4`, `NSTKN4`, 18]) as MockERC20SuccessFalse;

    await expectDeployed(ERC6551_REGISTRY_ADDRESS); // expect to be run on a fork of a testnet with registry deployed

    iblast = await ethers.getContractAt("IBlast", BLAST_ADDRESS, owner) as IBlast;
  });

  after(async function () {
    await provider.send("evm_revert", [snapshot]);
  });

  describe("setup", function () {
    it("can deploy BoomBots ERC721", async function () {
      // to deployer
      boomBotsNft = await deployContract(deployer, "BoomBots", [ERC6551_REGISTRY_ADDRESS, deployer.address]) as BoomBots;
      await expectDeployed(boomBotsNft.address);
      expect(await boomBotsNft.owner()).eq(deployer.address);
      l1DataFeeAnalyzer.register("deploy Boombots", boomBotsNft.deployTransaction);
      // to owner
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
      //boomBotAccountImplementation = await deployContract(deployer, "BoomBotAccount", []) as BoomBotAccount;
      boomBotAccountImplementation = await deployContract(deployer, "BoomBotAccount", [owner.address]) as BoomBotAccount;
      await expectDeployed(boomBotAccountImplementation.address);
      l1DataFeeAnalyzer.register("deploy BoomBotAccount impl", boomBotsNft.deployTransaction);
    });
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
    it("can deploy BoomBotsFactory01", async function () {
      // to deployer
      factory = await deployContract(deployer, "BoomBotsFactory01", [deployer.address, boomBotsNft.address]) as BoomBotsFactory01;
      await expectDeployed(factory.address);
      expect(await factory.owner()).eq(deployer.address);
      l1DataFeeAnalyzer.register("deploy BoomBotsFactory01", factory.deployTransaction);
      // to owner
      factory = await deployContract(deployer, "BoomBotsFactory01", [owner.address, boomBotsNft.address]) as BoomBotsFactory01;
      await expectDeployed(factory.address);
      expect(await factory.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy BoomBotsFactory01", factory.deployTransaction);
    });
  });

  describe("bot creation via factory", function () {
    it("can get factory sighashes", async function () {
      let sighashes = calcSighashes(factory, 'BoomBotsFactory01')
    })
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
      let sighashes = calcSighashes(modulePack100, 'ModulePack100')
      sighashes.push(inscribeSighash)
      let diamondCut = [
        {
          facetAddress: modulePack100.address,
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
      botInitializationCode1 = boomBotAccountImplementation.interface.encodeFunctionData("initialize", [diamondCut, dataStore.address]);
      botInitializationCode2 = modulePack100.interface.encodeFunctionData("updateSupportedInterfaces", [interfaceIDs, support]);
      let params = {
        botImplementation: boomBotAccountImplementation.address,
        initializationCalls: [
          botInitializationCode1,
          botInitializationCode2,
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
          module: modulePack100.address,
          shouldWhitelist: true,
        },
        {
          module: revertModule.address,
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
      let botRes = await factory.connect(user1).callStatic['createBot(uint256)'](1, {gasLimit: 10_000_000});
      expect(botRes.botID).eq(botID);
      expect(await boomBotsNft.exists(botID)).eq(false);
      let isDeployed1 = await isDeployed(botRes.botAddress)
      expect(isDeployed1).to.be.false;
      let tx = await factory.connect(user1)['createBot(uint256)'](1, {gasLimit: 10_000_000});
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
      //console.log(botInfo)
      //console.log(botInfo.botAddress)
      await expectDeployed(botInfo.botAddress)
      //console.log(await provider.getCode(botInfo.botAddress))
      //console.log(botInfo.implementationAddress)
      await expectDeployed(botInfo.implementationAddress)
      //console.log(await provider.getCode(botInfo.implementationAddress))
    });
    it("can get combined abi", async function () {
      abi = getCombinedAbi([
        "artifacts/contracts/accounts/BoomBotAccount.sol/BoomBotAccount.json",
        "artifacts/contracts/modules/ModulePack100.sol/ModulePack100.json",
        "artifacts/contracts/mocks/modules/FallbackModule.sol/FallbackModule.json",
        "artifacts/contracts/mocks/modules/RevertModule.sol/RevertModule.json",
        "artifacts/contracts/mocks/modules/Test1Module.sol/Test1Module.json",
        "artifacts/contracts/mocks/modules/Test2Module.sol/Test2Module.json",
        "artifacts/contracts/mocks/modules/Test3Module.sol/Test3Module.json",
        "artifacts/contracts/libraries/Calls.sol/Calls.json",
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
  })

  describe("implementation", async function () {
    it("returns correct implementation address", async function () {
      expect(await boomBotAccountImplementation.implementation()).eq(boomBotAccountImplementation.address)
      expect(await accountProxy.implementation()).eq(boomBotAccountImplementation.address)
    })
    it("returns correct gas collector", async function () {
      expect(await boomBotAccountImplementation.zzz_implGasCollector()).eq(owner.address)
      expect(await accountProxy.zzz_implGasCollector()).eq(owner.address)
    })
    it("cannot call implementation functions on proxies", async function () {
      await expect(accountProxy.zzz_implCallBlast("0x")).to.be.revertedWithCustomError(accountProxy, "NoDelegateCall")
      await expect(accountProxy.zzz_implClaimAllGas(user1.address)).to.be.revertedWithCustomError(accountProxy, "NoDelegateCall")
      await expect(accountProxy.zzz_implClaimMaxGas(user1.address)).to.be.revertedWithCustomError(accountProxy, "NoDelegateCall")
      await expect(accountProxy.zzz_implSweep(user1.address,[])).to.be.revertedWithCustomError(accountProxy, "NoDelegateCall")
    })
    it("cannot call by non gas collector", async function () {
      await expect(boomBotAccountImplementation.connect(user1).zzz_implCallBlast("0x")).to.be.revertedWithCustomError(boomBotAccountImplementation, "NotGasCollector")
      await expect(boomBotAccountImplementation.connect(user1).zzz_implClaimAllGas(user1.address)).to.be.revertedWithCustomError(boomBotAccountImplementation, "NotGasCollector")
      await expect(boomBotAccountImplementation.connect(user1).zzz_implClaimMaxGas(user1.address)).to.be.revertedWithCustomError(boomBotAccountImplementation, "NotGasCollector")
      await expect(boomBotAccountImplementation.connect(user1).zzz_implSweep(user1.address,[])).to.be.revertedWithCustomError(boomBotAccountImplementation, "NotGasCollector")
    })
    it("zzz_implCallBlast 0", async function () {
      try {
        let calldata = "0x"
        let res = await boomBotAccountImplementation.connect(owner).callStatic.zzz_implCallBlast(calldata);
        console.log({res})
        let tx = await boomBotAccountImplementation.connect(owner).zzz_implCallBlast(calldata);
      } catch(e) {}
    })
    it("zzz_implCallBlast 1", async function () {
      try {
        let calldata = iblast.interface.encodeFunctionData("configureAutomaticYield")
        let res = await boomBotAccountImplementation.connect(owner).callStatic.zzz_implCallBlast(calldata);
        console.log({res})
        let tx = await boomBotAccountImplementation.connect(owner).zzz_implCallBlast(calldata);
      } catch(e) {}
    })
    it("zzz_implCallBlast 2", async function () {
      let calldata = iblast.interface.encodeFunctionData("configureClaimableGas")
      let res = await boomBotAccountImplementation.connect(owner).callStatic.zzz_implCallBlast(calldata);
      console.log({res})
      let tx = await boomBotAccountImplementation.connect(owner).zzz_implCallBlast(calldata);
    })
    it("zzz_implClaimMaxGas", async function () {
      try {
        let res = await boomBotAccountImplementation.connect(owner).callStatic.zzz_implClaimMaxGas(owner.address)
        console.log({res})
        let tx = await boomBotAccountImplementation.connect(owner).zzz_implClaimMaxGas(owner.address)
      } catch(e) {}
    })
    it("zzz_implClaimAllGas", async function () {
      try {
        let res = await boomBotAccountImplementation.connect(owner).callStatic.zzz_implClaimAllGas(owner.address)
        console.log({res})
        let tx = await boomBotAccountImplementation.connect(owner).zzz_implClaimAllGas(owner.address)
      } catch(e) {}
    })
    it("zzz_implSweep", async function () {
      await user1.sendTransaction({
        to: boomBotAccountImplementation.address,
        value: WeiPerEther
      })
      await erc20a.mint(boomBotAccountImplementation.address, WeiPerEther.mul(3))
      let bal11eth = await provider.getBalance(boomBotAccountImplementation.address)
      let bal11erc20 = await erc20a.balanceOf(boomBotAccountImplementation.address)
      let bal12eth = await provider.getBalance(owner.address)
      let bal12erc20 = await erc20a.balanceOf(owner.address)
      let bal13eth = await provider.getBalance(user3.address)
      let bal13erc20 = await erc20a.balanceOf(user3.address)
      expect(bal11eth).gt(0)
      expect(bal11erc20).gt(0)
      let tx = await boomBotAccountImplementation.connect(owner).zzz_implSweep(user3.address, [AddressZero, erc20a.address])
      let bal21eth = await provider.getBalance(boomBotAccountImplementation.address)
      let bal21erc20 = await erc20a.balanceOf(boomBotAccountImplementation.address)
      let bal22eth = await provider.getBalance(owner.address)
      let bal22erc20 = await erc20a.balanceOf(owner.address)
      let bal23eth = await provider.getBalance(user3.address)
      let bal23erc20 = await erc20a.balanceOf(user3.address)
      expect(bal21eth).eq(0)
      expect(bal21erc20).eq(0)
      expect(bal22eth).lt(bal12eth) // gas fees
      expect(bal22erc20).eq(bal12erc20)
      expect(bal23eth).eq(bal13eth.add(bal11eth))
      expect(bal23erc20).eq(bal13erc20.add(bal11erc20))
    })
  })

  // these will fail - iblast
  describe("gas quoter impl pt 1", function () {
    it("quoteClaimAllGas", async function () {
      try {
        amount = await boomBotAccountImplementation.callStatic.quoteClaimAllGas()
        let tx = await boomBotAccountImplementation.quoteClaimAllGas()
      } catch(e) {}
    })
    it("quoteClaimAllGasWithRevert", async function () {
      try {
        amount = await boomBotAccountImplementation.callStatic.quoteClaimAllGasWithRevert()
        let tx = await boomBotAccountImplementation.quoteClaimAllGasWithRevert()
      } catch(e) {}
    })
    it("quoteClaimMaxGas", async function () {
      try {
        amount = await boomBotAccountImplementation.callStatic.quoteClaimMaxGas()
        let tx = await boomBotAccountImplementation.quoteClaimMaxGas()
      } catch(e) {}
    })
    it("quoteClaimMaxGasWithRevert", async function () {
      try {
        amount = await boomBotAccountImplementation.callStatic.quoteClaimMaxGasWithRevert()
        let tx = await boomBotAccountImplementation.quoteClaimMaxGasWithRevert()
      } catch(e) {}
    })
  });

  // these will succeed - mock blast
  describe("gas quoter impl pt 2", function () {
    it("can deploy mockblast", async function () {
      mockblast = await deployContract(deployer, "MockBlast", []);
      await expectDeployed(mockblast.address);
      l1DataFeeAnalyzer.register("deploy MockBlast", mockblast.deployTransaction);
      await user1.sendTransaction({
        to: mockblast.address,
        value: WeiPerEther
      })
    })
    it("can deploy account implementations", async function () {
      // MockBlastableAccount
      mockAccountImplementation = await deployContract(deployer, "MockBlastableAccount", [owner.address, mockblast.address]) as MockBlastableAccount;
      await expectDeployed(mockAccountImplementation.address);
      l1DataFeeAnalyzer.register("deploy MockBlastableAccount impl", mockAccountImplementation.deployTransaction);
      expect(await mockAccountImplementation.blast()).eq(mockblast.address)
    });
    it("quoteClaimAllGas", async function () {
      let amount = await mockAccountImplementation.callStatic.quoteClaimAllGas()
      //expect(amount).eq(2255)
      let tx = await mockAccountImplementation.quoteClaimAllGas()
    })
    it("quoteClaimAllGasWithRevert", async function () {
      try {
        amount = await mockAccountImplementation.callStatic.quoteClaimAllGasWithRevert()
        let tx = await mockAccountImplementation.quoteClaimAllGasWithRevert()
      } catch(e) {}
    })
    it("quoteClaimMaxGas", async function () {
      let amount = await mockAccountImplementation.callStatic.quoteClaimMaxGas()
      //expect(amount).eq(1500)
      let tx = await mockAccountImplementation.quoteClaimMaxGas()
    })
    it("quoteClaimMaxGasWithRevert", async function () {
      try {
        amount = await mockAccountImplementation.callStatic.quoteClaimMaxGasWithRevert()
        let tx = await mockAccountImplementation.quoteClaimMaxGasWithRevert()
      } catch(e) {}
    })
  });

  // these will fail - iblast
  describe("gas quoter proxy pt 1", function () {
    it("quoteClaimAllGas", async function () {
      try {
        amount = await accountProxy.callStatic.quoteClaimAllGas()
        let tx = await accountProxy.quoteClaimAllGas()
      } catch(e) {}
    })
    it("quoteClaimAllGasWithRevert", async function () {
      try {
        amount = await accountProxy.callStatic.quoteClaimAllGasWithRevert()
        let tx = await accountProxy.quoteClaimAllGasWithRevert()
      } catch(e) {}
    })
    it("quoteClaimMaxGas", async function () {
      try {
        amount = await accountProxy.callStatic.quoteClaimMaxGas()
        let tx = await accountProxy.quoteClaimMaxGas()
      } catch(e) {}
    })
    it("quoteClaimMaxGasWithRevert", async function () {
      try {
        amount = await accountProxy.callStatic.quoteClaimMaxGasWithRevert()
        let tx = await accountProxy.quoteClaimMaxGasWithRevert()
      } catch(e) {}
    })
  })

  // these will succeed - mock blast
  describe("gas quoter proxy pt 2", function () {
    let mockAccountProxy: MockBlastableAccount;
    it("owner can postBotCreationSettings", async function () {
      let sighashes = calcSighashes(modulePack100, 'ModulePack100')
      sighashes.push(inscribeSighash)
      let diamondCut = [
        {
          facetAddress: modulePack100.address,
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
      botInitializationCode1 = mockAccountImplementation.interface.encodeFunctionData("initialize", [diamondCut, dataStore.address]);
      botInitializationCode2 = modulePack100.interface.encodeFunctionData("updateSupportedInterfaces", [interfaceIDs, support]);
      let params = {
        botImplementation: mockAccountImplementation.address,
        initializationCalls: [
          botInitializationCode1,
          botInitializationCode2,
        ],
        isPaused: false
      }
      let tx = await factory.connect(owner).postBotCreationSettings(params)
      expect(await factory.getBotCreationSettingsCount()).eq(2)
      let res = await factory.getBotCreationSettings(2)
      expect(res.botImplementation).eq(params.botImplementation)
      expect(res.initializationCalls.length).eq(params.initializationCalls.length)
      expect(res.isPaused).eq(params.isPaused)
      await expect(tx).to.emit(factory, "BotCreationSettingsPosted").withArgs(2)
      await expect(tx).to.emit(factory, "BotCreationSettingsPaused").withArgs(2, params.isPaused)
    })
    it("can create bot pt 2", async function () {
      let ts = await boomBotsNft.totalSupply();
      let bal = await boomBotsNft.balanceOf(user1.address);
      let botID = ts.add(1);
      let botRes = await factory.connect(user1).callStatic['createBot(uint256)'](2, {gasLimit: 10_000_000});
      expect(botRes.botID).eq(botID);
      expect(await boomBotsNft.exists(botID)).eq(false);
      let isDeployed1 = await isDeployed(botRes.botAddress)
      expect(isDeployed1).to.be.false;
      let tx = await factory.connect(user1)['createBot(uint256)'](2, {gasLimit: 10_000_000});
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
      expect(botInfo.implementationAddress).eq(mockAccountImplementation.address);
      tbaccount2 = await ethers.getContractAt("BoomBotAccount", botInfo.botAddress) as BoomBotAccount;
      tbaccount3 = await ethers.getContractAt("MockBlastableAccount", botInfo.botAddress) as MockBlastableAccount
      let tbaccount4 = await ethers.getContractAt(abi, botInfo.botAddress)
      l1DataFeeAnalyzer.register("createBot", tx);
      expect(await mockAccountImplementation.blast()).eq(mockblast.address)

      expect(await tbaccount2.blast()).eq(AddressZero)
      expect(await tbaccount3.blast()).eq(AddressZero)
      await tbaccount3.setBlast(mockblast.address)
      let calldata = iblast.interface.encodeFunctionData("configureClaimableGas")
      let tx2 = await tbaccount4.connect(user1).execute(mockblast.address, 0, calldata, 0);
      expect(await tbaccount2.blast()).eq(mockblast.address)
      expect(await tbaccount3.blast()).eq(mockblast.address)
    });

    it("quoteClaimAllGas", async function () {
      let amount = await tbaccount3.callStatic.quoteClaimAllGas()
      expect(amount).eq(2255)
      let tx = await tbaccount3.quoteClaimAllGas()
    })
    it("quoteClaimAllGasWithRevert", async function () {
      try {
        amount = await tbaccount3.callStatic.quoteClaimAllGasWithRevert()
        let tx = await tbaccount3.quoteClaimAllGasWithRevert()
      } catch(e) {}
    })
    it("quoteClaimMaxGas", async function () {
      let amount = await tbaccount3.callStatic.quoteClaimMaxGas()
      expect(amount).eq(1500)
      let tx = await tbaccount3.quoteClaimMaxGas()
    })
    it("quoteClaimMaxGasWithRevert", async function () {
      try {
        amount = await tbaccount3.callStatic.quoteClaimMaxGasWithRevert()
        let tx = await tbaccount3.quoteClaimMaxGasWithRevert()
      } catch(e) {}
    })
  })

  describe("L1 gas fees", function () {
    it("calculate", async function () {
      l1DataFeeAnalyzer.analyze()
    });
  });
});

function getSignature(abiElement: any) {
  function encodeInput(x:any) {
    if(!x.components || x.components.length == 0) return x.type;
    let tupleType = x.components.map((y:any)=>encodeInput(y));
    tupleType = `(${tupleType.join(",")})`;
    tupleType = `${tupleType}${x.type.replace("tuple","")}`
    return tupleType;
  }
  let signature = `${abiElement.name}(${abiElement.inputs.map((x:any)=>encodeInput(x)).join(",")})`;
  return signature;
}
