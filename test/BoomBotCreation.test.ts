/* global describe it before ethers */

import hre from "hardhat";
const { ethers } = hre;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
const { expect, assert } = chai;

import { IERC6551Registry, ERC6551Account, BoomBots, BoomBotAccount, ERC2535Module, ERC6551AccountModule, MulticallModule, ERC165Module, FallbackModule, ModulePack100, BoomBotsFactory, MockERC20, MockERC721, DataStore, RevertAccount, MockERC1271 } from "./../typechain-types";

import { isDeployed, expectDeployed } from "./../scripts/utils/expectDeployed";
import { toBytes32 } from "./../scripts/utils/setStorage";
import { getNetworkSettings } from "../scripts/utils/getNetworkSettings";
import { decimalsToAmount } from "../scripts/utils/price";
import { deployContract } from "../scripts/utils/deployContract";
import L1DataFeeAnalyzer from "../scripts/utils/L1DataFeeAnalyzer";
import { getSelectors, FacetCutAction, calcSighash, calcSighashes, getCombinedAbi } from "./../scripts/utils/diamond"

const { AddressZero, WeiPerEther, MaxUint256, Zero } = ethers.constants;
const WeiPerUsdc = BN.from(1_000_000); // 6 decimals

const ERC6551_REGISTRY_ADDRESS = "0x000000006551c19487814612e58FE06813775758";

const MAGIC_VALUE_0 = "0x00000000";
const MAGIC_VALUE_IS_VALID_SIGNER = "0x523e3260";
const MAGIC_VALUE_IS_VALID_SIGNATURE = "0x1626ba7e";

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

describe("BoomBotCreation", function () {
  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let user4: SignerWithAddress;
  let user5: SignerWithAddress;

  let erc6551Registry: IERC6551Registry;

  let boomBotsNft: BoomBots;
  let erc6551AccountImplementation: ERC6551Account; // the base implementation for token bound accounts
  let boomBotAccountImplementation: BoomBotAccount; // the base implementation for token bound accounts
  let dataStore: DataStore;
  let tbaccount1: ERC6551; // an account bound to a token
  let tbaccount2: BoomBotAccount; // an account bound to a token
  // modules
  let modulePack100: ModulePack100;
  let erc2535Module: ERC2535Module;
  let erc6551AccountModule: ERC6551AccountModule;
  let multicallModule: MulticallModule;
  let erc165Module: ERC165Module;
  let fallbackModule: FallbackModule;
  // diamond cuts
  let diamondCutInit: any[] = [];
  let diamondCutInit2: any[] = [];
  let botInitializationCode1: any;
  let botInitializationCode2: any;
  // factory
  let factory: BoomBotsFactory;

  let erc20a: MockERC20;
  let erc20b: MockERC20;
  let erc20c: MockERC20;

  let mockERC1271: MockERC1271;

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

  let combinedAbi: any

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
    erc6551Registry = await ethers.getContractAt("IERC6551Registry", ERC6551_REGISTRY_ADDRESS) as IERC6551Registry;
    combinedAbi = getCombinedAbi([
      "artifacts/contracts/accounts/BoomBotAccount.sol/BoomBotAccount.json",
      "artifacts/contracts/modules/ModulePack100.sol/ModulePack100.json",
      /*
      "artifacts/contracts/modules/ERC2535Module.sol/ERC2535Module.json",
      "artifacts/contracts/modules/ERC6551AccountModule.sol/ERC6551AccountModule.json",
      "artifacts/contracts/modules/MulticallModule.sol/MulticallModule.json",
      "artifacts/contracts/modules/ERC721HolderModule.sol/ERC721HolderModule.json",
      */
      "artifacts/contracts/mocks/modules/FallbackModule.sol/FallbackModule.json",
      "artifacts/contracts/mocks/modules/RevertModule.sol/RevertModule.json",
      "artifacts/contracts/mocks/modules/Test1Module.sol/Test1Module.json",
      "artifacts/contracts/mocks/modules/Test2Module.sol/Test2Module.json",
      "artifacts/contracts/mocks/modules/Test3Module.sol/Test3Module.json",
      "artifacts/contracts/libraries/Errors.sol/Errors.json",
    ])
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
      erc6551AccountImplementation = await deployContract(deployer, "ERC6551Account") as ERC6551Account;
      await expectDeployed(erc6551AccountImplementation.address);
      l1DataFeeAnalyzer.register("deploy ERC6551Account impl", boomBotsNft.deployTransaction);
      boomBotAccountImplementation = await deployContract(deployer, "BoomBotAccount") as BoomBotAccount;
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
      // erc2535
      erc2535Module = await deployContract(deployer, "ERC2535Module", []) as ERC2535Module;
      await expectDeployed(erc2535Module.address);
      l1DataFeeAnalyzer.register("deploy ERC2535Module impl", erc2535Module.deployTransaction);
      // erc6551 account
      erc6551AccountModule = await deployContract(deployer, "ERC6551AccountModule", []) as ERC6551AccountModule;
      await expectDeployed(erc6551AccountModule.address);
      l1DataFeeAnalyzer.register("deploy ERC6551AccountModule impl", erc6551AccountModule.deployTransaction);
      // multicall
      multicallModule = await deployContract(deployer, "MulticallModule", []) as MulticallModule;
      await expectDeployed(multicallModule.address);
      l1DataFeeAnalyzer.register("deploy MulticallModule impl", multicallModule.deployTransaction);
      // erc165
      erc165Module = await deployContract(deployer, "ERC165Module", []) as ERC165Module;
      await expectDeployed(erc165Module.address);
      l1DataFeeAnalyzer.register("deploy ERC165Module impl", erc165Module.deployTransaction);
      // FallbackModule
      fallbackModule = await deployContract(deployer, "FallbackModule", []) as FallbackModule;
      await expectDeployed(fallbackModule.address);
      l1DataFeeAnalyzer.register("deploy FallbackModule impl", fallbackModule.deployTransaction);
    });
    it("can deploy BoomBotsFactory", async function () {
      // to deployer
      factory = await deployContract(deployer, "BoomBotsFactory", [deployer.address, boomBotsNft.address, boomBotAccountImplementation.address, "0x", "0x"]) as BoomBotsFactory;
      await expectDeployed(factory.address);
      expect(await factory.owner()).eq(deployer.address);
      l1DataFeeAnalyzer.register("deploy BoomBotsFactory", factory.deployTransaction);
      // to owner
      factory = await deployContract(deployer, "BoomBotsFactory", [owner.address, boomBotsNft.address, boomBotAccountImplementation.address, "0x", "0x"]) as BoomBotsFactory;
      await expectDeployed(factory.address);
      expect(await factory.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy BoomBotsFactory", factory.deployTransaction);
    });
    it("can deploy MockERC1271", async function () {
      mockERC1271 = await deployContract(deployer, "MockERC1271", []) as MockERC1271;
      await expectDeployed(mockERC1271.address);
      l1DataFeeAnalyzer.register("deploy MockERC1271", mockERC1271.deployTransaction);
    });
  });

  describe("bot creation via factory eoa", function () {
    it("cannot create bot with not whitelisted factory", async function () {
      await expect(boomBotsNft.connect(owner).createBot(AddressZero)).to.be.revertedWithCustomError(boomBotsNft, "FactoryNotWhitelisted");
      await expect(boomBotsNft.connect(user1).createBot(AddressZero)).to.be.revertedWithCustomError(boomBotsNft, "FactoryNotWhitelisted");
      await expect(boomBotsNft.connect(owner).createBot(erc6551AccountImplementation.address)).to.be.revertedWithCustomError(boomBotsNft, "FactoryNotWhitelisted");
      await expect(boomBotsNft.connect(user1).createBot(erc6551AccountImplementation.address)).to.be.revertedWithCustomError(boomBotsNft, "FactoryNotWhitelisted");
    });
    it("non owner cannot whitelist", async function () {
      await expect(boomBotsNft.connect(user1).setWhitelist([])).to.be.revertedWithCustomError(boomBotsNft, "NotContractOwner");
    });
    it("owner can whitelist", async function () {
      let whitelist = [
        {
          factory: user1.address,
          shouldWhitelist: true
        },
        {
          factory: user2.address,
          shouldWhitelist: false
        },
      ];
      let tx = await boomBotsNft.connect(owner).setWhitelist(whitelist);
      for(let i = 0; i < whitelist.length; i++) {
        let whitelistItem = whitelist[i]
        await expect(tx).to.emit(boomBotsNft, "FactoryWhitelisted").withArgs(whitelistItem.factory, whitelistItem.shouldWhitelist);
        expect(await boomBotsNft.factoryIsWhitelisted(whitelistItem.factory)).eq(whitelistItem.shouldWhitelist);
      }
    });
    it("can create bot pt 1", async function () {
      let ts = await boomBotsNft.totalSupply();
      let bal = await boomBotsNft.balanceOf(user1.address);
      let botID = ts.add(1);
      let botRes = await boomBotsNft.connect(user1).callStatic.createBot(erc6551AccountImplementation.address);
      expect(botRes.botID).eq(botID);
      expect(await boomBotsNft.exists(botID)).eq(false);
      //await expect(boomBotsNft.getBotID(botRes.botAddress)).to.be.revertedWithCustomError(boomBotsNft, "BotDoesNotExist");
      expect(await boomBotsNft.getBotID(botRes.botAddress)).eq(0);
      expect(await boomBotsNft.isAddressBot(botRes.botAddress)).eq(false);
      let isDeployed1 = await isDeployed(botRes.botAddress)
      expect(isDeployed1).to.be.false;
      let tx = await boomBotsNft.connect(user1).createBot(erc6551AccountImplementation.address);
      await expect(tx).to.emit(boomBotsNft, "Transfer").withArgs(AddressZero, user1.address, botRes.botID);
      expect(await boomBotsNft.totalSupply()).eq(ts.add(1));
      expect(await boomBotsNft.balanceOf(user1.address)).eq(bal.add(1));
      expect(await boomBotsNft.exists(botID)).eq(true);
      expect(await boomBotsNft.ownerOf(botRes.botID)).eq(user1.address);
      let botInfo = await boomBotsNft.getBotInfo(botID);
      //expect(botInfo.botAddress).eq(botRes.botAddress); // may change
      expect(await boomBotsNft.getBotID(botInfo.botAddress)).eq(botID);
      expect(await boomBotsNft.isAddressBot(botInfo.botAddress)).eq(true);
      let isDeployed2 = await isDeployed(botInfo.botAddress)
      expect(isDeployed2).to.be.true;
      expect(botInfo.implementationAddress).eq(erc6551AccountImplementation.address);
      tbaccount1 = await ethers.getContractAt("ERC6551Account", botInfo.botAddress) as ERC6551Account;
      l1DataFeeAnalyzer.register("createBot", tx);
    });
  });

  describe("bot creation via factory contract", function () {
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
    it("can create bot pt 2", async function () {
      let ts = await boomBotsNft.totalSupply();
      let bal = await boomBotsNft.balanceOf(user1.address);
      let botID = ts.add(1);
      let botRes = await factory.connect(user1).callStatic['createBot()']();
      expect(botRes.botID).eq(botID);
      expect(await boomBotsNft.exists(botID)).eq(false);
      //await expect(boomBotsNft.getBotID(botRes.botAddress)).to.be.revertedWithCustomError(boomBotsNft, "BotDoesNotExist");
      expect(await boomBotsNft.getBotID(botRes.botAddress)).eq(0);
      expect(await boomBotsNft.isAddressBot(botRes.botAddress)).eq(false);
      let isDeployed1 = await isDeployed(botRes.botAddress)
      expect(isDeployed1).to.be.false;
      let tx = await factory.connect(user1)['createBot()']();
      await expect(tx).to.emit(boomBotsNft, "Transfer").withArgs(AddressZero, factory.address, botRes.botID);
      await expect(tx).to.emit(boomBotsNft, "Transfer").withArgs(factory.address, user1.address, botRes.botID);
      expect(await boomBotsNft.totalSupply()).eq(ts.add(1));
      expect(await boomBotsNft.balanceOf(user1.address)).eq(bal.add(1));
      expect(await boomBotsNft.exists(botID)).eq(true);
      expect(await boomBotsNft.ownerOf(botRes.botID)).eq(user1.address);
      let botInfo = await boomBotsNft.getBotInfo(botID);
      //expect(botInfo.botAddress).eq(botRes.botAddress); // may change
      expect(await boomBotsNft.getBotID(botInfo.botAddress)).eq(botID);
      expect(await boomBotsNft.isAddressBot(botInfo.botAddress)).eq(true);
      let isDeployed2 = await isDeployed(botInfo.botAddress)
      expect(isDeployed2).to.be.true;
      expect(botInfo.implementationAddress).eq(boomBotAccountImplementation.address);
      tbaccount2 = await ethers.getContractAt("BoomBotAccount", botInfo.botAddress) as BoomBotAccount;
      l1DataFeeAnalyzer.register("createBot", tx);
    });
    it("non owner cannot setBotInitializationCode", async function () {
      await expect(factory.connect(user1).setBotInitializationCode("0x", "0x")).to.be.revertedWithCustomError(factory, "NotContractOwner");
    });
    it("owner can setBotInitializationCode", async function () {
      /*
      //console.log(erc6551AccountModule);
      //console.log(erc6551AccountModule.functions);
      //console.log(Object.keys(erc6551AccountModule.functions));
      let functions = Object.keys(erc6551AccountModule.functions).filter((x:string)=>x.includes('('))
      console.log('functions');
      console.log(functions);
      for(let i = 0; i < functions.length; i++) {
        let func = functions[i]
        let data = erc6551AccountModule.interface.encodeFunctionData(func, []);
        console.log('func', func)
        console.log('data', data)
        console.log('sighash real', data.substring(0,10))
        let sighash = calcSighash(func)
        console.log('sighash calc', sighash)
      }
      let sighashes = calcSighashes(erc6551AccountModule)
      console.log('sighashes');
      console.log(sighashes)
      */

      diamondCutInit = [
        {
          facetAddress: modulePack100.address,
          action: FacetCutAction.Add,
          functionSelectors: calcSighashes(modulePack100, 'ModulePack100'),
        },
        /*
        {
          facetAddress: erc2535Module.address,
          action: FacetCutAction.Add,
          functionSelectors: calcSighashes(erc2535Module, 'ERC2535Module'),
        },
        {
          facetAddress: erc6551AccountModule.address,
          action: FacetCutAction.Add,
          functionSelectors: calcSighashes(erc6551AccountModule, 'ERC6551AccountModule'),
        },
        {
          facetAddress: multicallModule.address,
          action: FacetCutAction.Add,
          functionSelectors: calcSighashes(multicallModule, 'MulticallModule'),
        },
        */
      ]
      console.log('')
      /*
      {
          address facetAddress;
          FacetCutAction action;
          bytes4[] functionSelectors;
      }
      */
      /*
      updateSupportedInterfaces(bytes4[] calldata interfaceIDs, bool[] calldata support)

      expect(await diamondLoupeFacetProxy.supportsInterface("0x01ffc9a7")).eq(true); // ERC165
      expect(await diamondLoupeFacetProxy.supportsInterface("0x7f5828d0")).eq(true); // ERC173
      expect(await diamondLoupeFacetProxy.supportsInterface("0x1f931c1c")).eq(true); // DiamondCut
      expect(await diamondLoupeFacetProxy.supportsInterface("0x48e2b093")).eq(true); // DiamondLoupe
      (interfaceId == 0x01ffc9a7) || // erc165
      (interfaceId == 0x6faff5f1) || // erc6551 account
      (interfaceId == 0x51945447)    // erc6551 executable
      expect(await botAccount.supportsInterface("0x01ffc9a7")).eq(true); // ERC165
      expect(await botAccount.supportsInterface("0x1f931c1c")).eq(true); // DiamondCut
      expect(await botAccount.supportsInterface("0x48e2b093")).eq(true); // DiamondLoupe
      expect(await botAccount.supportsInterface("0x6faff5f1")).eq(true); // ERC6551Account
      expect(await botAccount.supportsInterface("0x51945447")).eq(true); // ERC6551Executable
      */
      let interfaceIDs = [
        "0x01ffc9a7", // ERC165
        "0x1f931c1c", // DiamondCut
        "0x48e2b093", // DiamondLoupe
        "0x6faff5f1", // ERC6551Account
        "0x51945447", // ERC6551Executable
        //"",
      ]
      let support = [
        true,
        true,
        true,
        true,
        true,
      ]

      botInitializationCode1 = boomBotAccountImplementation.interface.encodeFunctionData("initialize", [diamondCutInit, dataStore.address]);
      botInitializationCode2 = erc165Module.interface.encodeFunctionData("updateSupportedInterfaces", [interfaceIDs, support]);
      let tx = await factory.connect(owner).setBotInitializationCode(botInitializationCode1, botInitializationCode2);
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
          module: erc165Module.address,
          shouldWhitelist: true,
        },
        /*
        {
          module: erc721ReceiverModule.address,
          shouldWhitelist: true,
        },
        {
          module: revertModule.address,
          shouldWhitelist: true,
        },
        */
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
    it("can create bot pt 3", async function () {
      let ts = await boomBotsNft.totalSupply();
      let bal = await boomBotsNft.balanceOf(user1.address);
      let botID = ts.add(1);
      let botRes = await factory.connect(user1).callStatic['createBot()']();
      expect(botRes.botID).eq(botID);
      expect(await boomBotsNft.exists(botID)).eq(false);
      //await expect(boomBotsNft.getBotID(botRes.botAddress)).to.be.revertedWithCustomError(boomBotsNft, "BotDoesNotExist");
      expect(await boomBotsNft.getBotID(botRes.botAddress)).eq(0);
      expect(await boomBotsNft.isAddressBot(botRes.botAddress)).eq(false);
      let isDeployed1 = await isDeployed(botRes.botAddress)
      expect(isDeployed1).to.be.false;
      let tx = await factory.connect(user1)['createBot()']();
      await expect(tx).to.emit(boomBotsNft, "Transfer").withArgs(AddressZero, factory.address, botRes.botID);
      await expect(tx).to.emit(boomBotsNft, "Transfer").withArgs(factory.address, user1.address, botRes.botID);
      expect(await boomBotsNft.totalSupply()).eq(ts.add(1));
      expect(await boomBotsNft.balanceOf(user1.address)).eq(bal.add(1));
      expect(await boomBotsNft.exists(botID)).eq(true);
      expect(await boomBotsNft.ownerOf(botRes.botID)).eq(user1.address);
      let botInfo = await boomBotsNft.getBotInfo(botID);
      //expect(botInfo.botAddress).eq(botRes.botAddress); // may change
      expect(await boomBotsNft.getBotID(botInfo.botAddress)).eq(botID);
      expect(await boomBotsNft.isAddressBot(botInfo.botAddress)).eq(true);
      let isDeployed2 = await isDeployed(botInfo.botAddress)
      expect(isDeployed2).to.be.true;
      expect(botInfo.implementationAddress).eq(boomBotAccountImplementation.address);
      tbaccount2 = await ethers.getContractAt("BoomBotAccount", botInfo.botAddress) as BoomBotAccount;
      l1DataFeeAnalyzer.register("createBot", tx);
    });
    it("owner can whitelist pt 2", async function () {
      let whitelist = [
        {
          factory: user1.address,
          shouldWhitelist: false
        },
        {
          factory: user2.address,
          shouldWhitelist: false
        },
        {
          factory: user3.address,
          shouldWhitelist: false
        },
        {
          factory: factory.address,
          shouldWhitelist: false
        },
        {
          factory: AddressZero, // whitelist all
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
    it("begins unpaused", async function () {
      expect(await factory.isPaused()).eq(false)
    })
    it("non owner cannot pause", async function () {
      await expect(factory.connect(user1).setPaused(true)).to.be.revertedWithCustomError(factory, "NotContractOwner")
    })
    it("owner can pause", async function () {
      expect(await factory.isPaused()).eq(false)
      let tx = await factory.connect(owner).setPaused(true)
      expect(await factory.isPaused()).eq(true)
      await expect(tx).to.emit(factory, "PauseSet").withArgs(true)
    })
    it("cannot create bot while paused", async function () {
      await expect(factory.connect(user1)['createBot()']()).to.be.revertedWithCustomError(factory, "ContractPaused")
      await expect(factory.connect(user1)['createBot(bytes)']("0x")).to.be.revertedWithCustomError(factory, "ContractPaused")
    })
    it("owner can unpause", async function () {
      expect(await factory.isPaused()).eq(true)
      let tx = await factory.connect(owner).setPaused(false)
      expect(await factory.isPaused()).eq(false)
      await expect(tx).to.emit(factory, "PauseSet").withArgs(false)
    })
    it("can create bot pt 4", async function () {
      let ts = await boomBotsNft.totalSupply();
      let bal = await boomBotsNft.balanceOf(user1.address);
      let botID = ts.add(1);
      let botRes = await factory.connect(user1).callStatic['createBot()']();
      expect(botRes.botID).eq(botID);
      expect(await boomBotsNft.exists(botID)).eq(false);
      //await expect(boomBotsNft.getBotID(botRes.botAddress)).to.be.revertedWithCustomError(boomBotsNft, "BotDoesNotExist");
      expect(await boomBotsNft.getBotID(botRes.botAddress)).eq(0);
      expect(await boomBotsNft.isAddressBot(botRes.botAddress)).eq(false);
      let isDeployed1 = await isDeployed(botRes.botAddress)
      expect(isDeployed1).to.be.false;
      let tx = await factory.connect(user1)['createBot()']();
      await expect(tx).to.emit(boomBotsNft, "Transfer").withArgs(AddressZero, factory.address, botRes.botID);
      await expect(tx).to.emit(boomBotsNft, "Transfer").withArgs(factory.address, user1.address, botRes.botID);
      expect(await boomBotsNft.totalSupply()).eq(ts.add(1));
      expect(await boomBotsNft.balanceOf(user1.address)).eq(bal.add(1));
      expect(await boomBotsNft.exists(botID)).eq(true);
      expect(await boomBotsNft.ownerOf(botRes.botID)).eq(user1.address);
      let botInfo = await boomBotsNft.getBotInfo(botID);
      //expect(botInfo.botAddress).eq(botRes.botAddress); // may change
      expect(await boomBotsNft.getBotID(botInfo.botAddress)).eq(botID);
      expect(await boomBotsNft.isAddressBot(botInfo.botAddress)).eq(true);
      let isDeployed2 = await isDeployed(botInfo.botAddress)
      expect(isDeployed2).to.be.true;
      expect(botInfo.implementationAddress).eq(boomBotAccountImplementation.address);
      tbaccount2 = await ethers.getContractAt("BoomBotAccount", botInfo.botAddress) as BoomBotAccount;
      l1DataFeeAnalyzer.register("createBot", tx);
    });
  });

  describe("bot creation via factory eoa pt 2", function () {
    it("can create bot pt 5", async function () {
      let ts = await boomBotsNft.totalSupply();
      let bal = await boomBotsNft.balanceOf(user1.address);
      let botID = ts.add(1);
      let botRes = await boomBotsNft.connect(user1).callStatic.createBot(boomBotAccountImplementation.address);
      expect(botRes.botID).eq(botID);
      expect(await boomBotsNft.exists(botID)).eq(false);
      //await expect(boomBotsNft.getBotID(botRes.botAddress)).to.be.revertedWithCustomError(boomBotsNft, "BotDoesNotExist");
      expect(await boomBotsNft.getBotID(botRes.botAddress)).eq(0);
      expect(await boomBotsNft.isAddressBot(botRes.botAddress)).eq(false);
      let isDeployed1 = await isDeployed(botRes.botAddress)
      expect(isDeployed1).to.be.false;
      let tx = await boomBotsNft.connect(user1).createBot(boomBotAccountImplementation.address);
      await expect(tx).to.emit(boomBotsNft, "Transfer").withArgs(AddressZero, user1.address, botRes.botID);
      expect(await boomBotsNft.totalSupply()).eq(ts.add(1));
      expect(await boomBotsNft.balanceOf(user1.address)).eq(bal.add(1));
      expect(await boomBotsNft.exists(botID)).eq(true);
      expect(await boomBotsNft.ownerOf(botRes.botID)).eq(user1.address);
      let botInfo = await boomBotsNft.getBotInfo(botID);
      //expect(botInfo.botAddress).eq(botRes.botAddress); // may change
      expect(await boomBotsNft.getBotID(botInfo.botAddress)).eq(botID);
      expect(await boomBotsNft.isAddressBot(botInfo.botAddress)).eq(true);
      let isDeployed2 = await isDeployed(botInfo.botAddress)
      expect(isDeployed2).to.be.true;
      expect(botInfo.implementationAddress).eq(boomBotAccountImplementation.address);
      tbaccount1 = await ethers.getContractAt("ERC6551Account", botInfo.botAddress) as ERC6551Account;
      l1DataFeeAnalyzer.register("createBot", tx);
    });
    it("can create bot pt 6", async function () {
      // create
      let ts = await boomBotsNft.totalSupply();
      let bal = await boomBotsNft.balanceOf(user1.address);
      let botID = ts.add(1);
      let botRes = await boomBotsNft.connect(user1).callStatic.createBot(boomBotAccountImplementation.address);
      expect(botRes.botID).eq(botID);
      expect(await boomBotsNft.exists(botID)).eq(false);
      //await expect(boomBotsNft.getBotID(botRes.botAddress)).to.be.revertedWithCustomError(boomBotsNft, "BotDoesNotExist");
      expect(await boomBotsNft.getBotID(botRes.botAddress)).eq(0);
      expect(await boomBotsNft.isAddressBot(botRes.botAddress)).eq(false);
      let isDeployed1 = await isDeployed(botRes.botAddress)
      expect(isDeployed1).to.be.false;
      let tx = await boomBotsNft.connect(user1).createBot(boomBotAccountImplementation.address);
      await expect(tx).to.emit(boomBotsNft, "Transfer").withArgs(AddressZero, user1.address, botRes.botID);
      expect(await boomBotsNft.totalSupply()).eq(ts.add(1));
      expect(await boomBotsNft.balanceOf(user1.address)).eq(bal.add(1));
      expect(await boomBotsNft.exists(botID)).eq(true);
      expect(await boomBotsNft.ownerOf(botRes.botID)).eq(user1.address);
      let botInfo = await boomBotsNft.getBotInfo(botID);
      //expect(botInfo.botAddress).eq(botRes.botAddress); // may change
      expect(await boomBotsNft.getBotID(botInfo.botAddress)).eq(botID);
      expect(await boomBotsNft.isAddressBot(botInfo.botAddress)).eq(true);
      let isDeployed2 = await isDeployed(botInfo.botAddress)
      expect(isDeployed2).to.be.true;
      expect(botInfo.implementationAddress).eq(boomBotAccountImplementation.address);
      tbaccount1 = await ethers.getContractAt("ERC6551Account", botInfo.botAddress) as ERC6551Account;
      tbaccount2 = await ethers.getContractAt("BoomBotAccount", botInfo.botAddress) as BoomBotAccount;
      l1DataFeeAnalyzer.register("createBot", tx);
      // diamond cut
      await user1.sendTransaction({
        to:tbaccount2.address,
        data: botInitializationCode1
      });
      await user1.sendTransaction({
        to:tbaccount2.address,
        data: botInitializationCode2
      });
    });
  });

  describe("bot creation via factory contract pt 2", function () {
    it("can getBotCreationSettings", async function () {
      var settings = await factory.getBotCreationSettings();
      var { botImplementation, botInitializationCode1, botInitializationCode2 } = settings
      //console.log(settings)
      expect(botImplementation).eq(boomBotAccountImplementation.address)
    });
    it("non owner cannot setBotImplementationAddress", async function () {
      await expect(factory.connect(user1).setBotImplementationAddress(user1.address)).to.be.revertedWithCustomError(factory, "NotContractOwner")
    });
    it("cannot setBotImplementationAddress to non contract", async function () {
      await expect(factory.connect(owner).setBotImplementationAddress(AddressZero)).to.be.revertedWithCustomError(factory, "NotAContract")
      await expect(factory.connect(owner).setBotImplementationAddress(user1.address)).to.be.revertedWithCustomError(factory, "NotAContract")
    });
    it("owner can setBotImplementationAddress", async function () {
      let revertAccount = await deployContract(deployer, "RevertAccount", []) as RevertAccount;
      await expect(user1.sendTransaction({to:revertAccount.address,data:"0x"})).to.be.reverted;
      await expect(user1.sendTransaction({to:revertAccount.address,data:"0xabcd"})).to.be.reverted;
      // set
      let tx1 = await factory.connect(owner).setBotImplementationAddress(revertAccount.address);
      var settings = await factory.getBotCreationSettings();
      var { botImplementation, botInitializationCode1, botInitializationCode2 } = settings
      //console.log(settings)
      expect(botImplementation).eq(revertAccount.address)
      await expect(tx1).to.emit(factory, "BotImplementationSet").withArgs(revertAccount.address)
    });
    it("cannot create bot with bad implementation", async function () {
      await expect(factory.connect(user1)['createBot()']()).to.be.revertedWithCustomError(factory, "CallFailed");
    });
    it("owner can setBotImplementationAddress 2", async function () {
      // set back
      let tx2 = await factory.connect(owner).setBotImplementationAddress(boomBotAccountImplementation.address);
      var settings = await factory.getBotCreationSettings();
      var { botImplementation, botInitializationCode1, botInitializationCode2 } = settings
      //console.log(settings)
      expect(botImplementation).eq(boomBotAccountImplementation.address)
      await expect(tx2).to.emit(factory, "BotImplementationSet").withArgs(boomBotAccountImplementation.address)
    });
    it("can create bot pt 7", async function () {
      let ts = await boomBotsNft.totalSupply();
      let bal = await boomBotsNft.balanceOf(user1.address);
      let botID = ts.add(1);
      let extraData = "0x"
      let botRes = await factory.connect(user1).callStatic['createBot(bytes)'](extraData);
      expect(botRes.botID).eq(botID);
      expect(await boomBotsNft.exists(botID)).eq(false);
      //await expect(boomBotsNft.getBotID(botRes.botAddress)).to.be.revertedWithCustomError(boomBotsNft, "BotDoesNotExist");
      expect(await boomBotsNft.getBotID(botRes.botAddress)).eq(0);
      expect(await boomBotsNft.isAddressBot(botRes.botAddress)).eq(false);
      let isDeployed1 = await isDeployed(botRes.botAddress)
      expect(isDeployed1).to.be.false;
      let tx = await factory.connect(user1)['createBot(bytes)'](extraData);
      await expect(tx).to.emit(boomBotsNft, "Transfer").withArgs(AddressZero, factory.address, botRes.botID);
      await expect(tx).to.emit(boomBotsNft, "Transfer").withArgs(factory.address, user1.address, botRes.botID);
      expect(await boomBotsNft.totalSupply()).eq(ts.add(1));
      expect(await boomBotsNft.balanceOf(user1.address)).eq(bal.add(1));
      expect(await boomBotsNft.exists(botID)).eq(true);
      expect(await boomBotsNft.ownerOf(botRes.botID)).eq(user1.address);
      let botInfo = await boomBotsNft.getBotInfo(botID);
      //expect(botInfo.botAddress).eq(botRes.botAddress); // may change
      expect(await boomBotsNft.getBotID(botInfo.botAddress)).eq(botID);
      expect(await boomBotsNft.isAddressBot(botInfo.botAddress)).eq(true);
      let isDeployed2 = await isDeployed(botInfo.botAddress)
      expect(isDeployed2).to.be.true;
      expect(botInfo.implementationAddress).eq(boomBotAccountImplementation.address);
      tbaccount2 = await ethers.getContractAt("BoomBotAccount", botInfo.botAddress) as BoomBotAccount;
      l1DataFeeAnalyzer.register("createBot", tx);
    });
    it("owner can whitelist pt 3", async function () {
      let modules = [
        {
          module: fallbackModule.address,
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
    it("can create bot pt 8", async function () {
      let ts = await boomBotsNft.totalSupply();
      let bal = await boomBotsNft.balanceOf(user1.address);
      let botID = ts.add(1);
      let diamondCut = [

        {
          facetAddress: fallbackModule.address,
          action: FacetCutAction.Add,
          functionSelectors: [dummy1Sighash],
        },

      ]
      diamondCutInit2 = JSON.parse(JSON.stringify(diamondCutInit)).concat(diamondCut)
      let extraData = erc2535Module.interface.encodeFunctionData("diamondCut", [diamondCut, AddressZero, "0x"])
      let botRes = await factory.connect(user1).callStatic['createBot(bytes)'](extraData);
      expect(botRes.botID).eq(botID);
      expect(await boomBotsNft.exists(botID)).eq(false);
      //await expect(boomBotsNft.getBotID(botRes.botAddress)).to.be.revertedWithCustomError(boomBotsNft, "BotDoesNotExist");
      expect(await boomBotsNft.getBotID(botRes.botAddress)).eq(0);
      expect(await boomBotsNft.isAddressBot(botRes.botAddress)).eq(false);
      let isDeployed1 = await isDeployed(botRes.botAddress)
      expect(isDeployed1).to.be.false;
      let tx = await factory.connect(user1)['createBot(bytes)'](extraData);
      await expect(tx).to.emit(boomBotsNft, "Transfer").withArgs(AddressZero, factory.address, botRes.botID);
      await expect(tx).to.emit(boomBotsNft, "Transfer").withArgs(factory.address, user1.address, botRes.botID);
      expect(await boomBotsNft.totalSupply()).eq(ts.add(1));
      expect(await boomBotsNft.balanceOf(user1.address)).eq(bal.add(1));
      expect(await boomBotsNft.exists(botID)).eq(true);
      expect(await boomBotsNft.ownerOf(botRes.botID)).eq(user1.address);
      let botInfo = await boomBotsNft.getBotInfo(botID);
      //expect(botInfo.botAddress).eq(botRes.botAddress); // may change
      expect(await boomBotsNft.getBotID(botInfo.botAddress)).eq(botID);
      expect(await boomBotsNft.isAddressBot(botInfo.botAddress)).eq(true);
      let isDeployed2 = await isDeployed(botInfo.botAddress)
      expect(isDeployed2).to.be.true;
      expect(botInfo.implementationAddress).eq(boomBotAccountImplementation.address);
      tbaccount2 = await ethers.getContractAt("BoomBotAccount", botInfo.botAddress) as BoomBotAccount;
      l1DataFeeAnalyzer.register("createBot", tx);
    });
    it("create fails if extra data is bad", async function () {
      await expect(factory.connect(user1)['createBot(bytes)']("0x1")).to.be.revertedWithCustomError;
      await expect(factory.connect(user1)['createBot(bytes)']("0x12")).to.be.revertedWithCustomError;
      await expect(factory.connect(user1)['createBot(bytes)']("0x12345678")).to.be.revertedWithCustomError;
      await expect(factory.connect(user1)['createBot(bytes)']("0x1234567800000000000")).to.be.revertedWithCustomError;
      await expect(factory.connect(user1)['createBot(bytes)'](multicallSighash+"a")).to.be.revertedWithCustomError;
      await expect(factory.connect(user1)['createBot(bytes)'](multicallSighash+"ab")).to.be.revertedWithCustomError;
    });
  })

  // bypasses the nft
  describe("bot creation via registry", function () {
    it("account with nft on other chain has no owner on this chain", async function () {
      // create bot
      let salt = toBytes32(0);
      let tokenId2 = 2;
      let chainId2 = 9999;
      let predictedAddress = await erc6551Registry.account(boomBotAccountImplementation.address, salt, chainId2, boomBotsNft.address, tokenId2);
      let tx = await erc6551Registry.createAccount(boomBotAccountImplementation.address, salt, chainId2, boomBotsNft.address, tokenId2);
      await expectDeployed(predictedAddress)
      let bbaccount2 = await ethers.getContractAt(combinedAbi, predictedAddress);
      // before init
      await expect(bbaccount2.owner()).to.be.reverted;
      await expect(bbaccount2.token()).to.be.reverted;
      // init
      await bbaccount2.initialize(diamondCutInit, dataStore.address)
      // after init
      expect(await bbaccount2.owner()).eq(AddressZero);
      let tokenRes = await bbaccount2.token();
      expect(tokenRes.chainId).eq(chainId2);
      expect(tokenRes.tokenContract).eq(boomBotsNft.address);
      expect(tokenRes.tokenId).eq(tokenId2);
      expect(await bbaccount2.state()).eq(0);
      expect(await bbaccount2['isValidSigner(address,bytes)'](AddressZero, "0x")).eq(MAGIC_VALUE_IS_VALID_SIGNER);
      expect(await bbaccount2['isValidSigner(address,bytes)'](user1.address, "0x")).eq(MAGIC_VALUE_0);
      expect(await bbaccount2['isValidSigner(address,bytes)'](user1.address, "0x00abcd")).eq(MAGIC_VALUE_0);
      expect(await bbaccount2['isValidSigner(address,bytes)'](user2.address, "0x")).eq(MAGIC_VALUE_0);
      expect(await bbaccount2.isValidSignature(toBytes32(0), "0x")).eq(MAGIC_VALUE_0);
      l1DataFeeAnalyzer.register("registry.createAccount", tx);
    });
  })

  const botMetadatas = [
    { // created by eoa, improperly setup
      botID: 1,
      accountType: "ERC6551Account",
      createdBy: "EOA",
      createdState: "correct",
    },{ // created by factory, improperly setup
      botID: 2,
      accountType: "BoomBotAccount",
      createdBy: "contract",
      createdState: "incorrect",
    },{ // created by factory, properly setup
      botID: 3,
      accountType: "BoomBotAccount",
      createdBy: "contract",
      createdState: "correct",
    },{ // created by factory, properly setup
      botID: 4,
      accountType: "BoomBotAccount",
      createdBy: "contract",
      createdState: "correct",
    },{ // created by eoa, improperly setup
      botID: 5,
      accountType: "BoomBotAccount",
      createdBy: "EOA",
      createdState: "incorrect",
    },{ // created by eoa, properly setup
      botID: 6,
      accountType: "BoomBotAccount",
      createdBy: "EOA",
      createdState: "correct",
    },{ // created by factory, properly setup,
      botID: 7,
      accountType: "BoomBotAccount",
      createdBy: "contract",
      createdState: "correct",
    },{ // created by factory, properly setup,
      botID: 8,
      accountType: "BoomBotAccount",
      createdBy: "contract",
      createdState: "correct",
      extraModules: "fallback",
    }
  ];

  describe("bots in prod", function () {
    for(const botMetadata of botMetadatas) {
      const { botID, accountType, createdBy, createdState } = botMetadata;
      const extraModules = botMetadata.extraModules || ""
      let botAccount:any;
      let botOwner: any;

      describe(`botID ${botID} created by ${createdBy} type ${accountType}`, function () {

        it("can get basic info", async function () {
          // get info
          expect(await boomBotsNft.exists(botID)).eq(true);
          let botInfo = await boomBotsNft.getBotInfo(botID);
          if(accountType == "ERC6551Account") botAccount = await ethers.getContractAt("ERC6551Account", botInfo.botAddress) as ERC6551Account;
          //else if(accountType == "BoomBotAccount") botAccount = await ethers.getContractAt("BoomBotAccount", botInfo.botAddress) as BoomBotAccount;
          //else if(accountType == "BoomBotAccount") botAccount = await ethers.getContractAt("ERC6551Account", botInfo.botAddress) as ERC6551Account;
          else if(accountType == "BoomBotAccount") {
            botAccount = await ethers.getContractAt(combinedAbi, botInfo.botAddress);
          }
          else throw new Error("unknown bot type");

          expect(await boomBotsNft.getBotID(botInfo.botAddress)).eq(botID);
          expect(await boomBotsNft.isAddressBot(botInfo.botAddress)).eq(true);
        })
        if(createdState == "correct") {
          it("account begins with correct state", async function () {
            // get owner
            let ownerAddress = await botAccount.owner();
            if(ownerAddress == user1.address) botOwner = user1;
            else if(ownerAddress == user2.address) botOwner = user2;
            else if(ownerAddress == user3.address) botOwner = user3;
            else throw new Error("unknown owner");
            // get token
            let tokenRes = await botAccount.token();
            expect(tokenRes.chainId).eq(chainID);
            expect(tokenRes.tokenContract).eq(boomBotsNft.address);
            expect(tokenRes.tokenId).eq(botID);
            // other info
            expect(await botAccount.state()).eq(0);
            /*
            expect(await botAccount.isValidSigner(botOwner.address)).eq(true);
            expect(await botAccount.isValidSigner(deployer.address)).eq(false);
            expect(await botAccount.isValidSigner(AddressZero)).eq(false);
            expect(await botAccount.isValidSigner(botOwner.address, "0x")).eq(MAGIC_VALUE_IS_VALID_SIGNER);
            expect(await botAccount.isValidSigner(botOwner.address, "0x00abcd")).eq(MAGIC_VALUE_IS_VALID_SIGNER);
            expect(await botAccount.isValidSigner(deployer.address, "0x")).eq(MAGIC_VALUE_0);
            expect(await botAccount.isValidSigner(AddressZero, "0x")).eq(MAGIC_VALUE_0);
            */
            expect(await botAccount['isValidSigner(address,bytes)'](botOwner.address, "0x")).eq(MAGIC_VALUE_IS_VALID_SIGNER);
            expect(await botAccount['isValidSigner(address,bytes)'](botOwner.address, "0x00abcd")).eq(MAGIC_VALUE_IS_VALID_SIGNER);
            expect(await botAccount['isValidSigner(address,bytes)'](deployer.address, "0x")).eq(MAGIC_VALUE_0);
            expect(await botAccount['isValidSigner(address,bytes)'](AddressZero, "0x")).eq(MAGIC_VALUE_0);
            expect(await botAccount.isValidSignature(toBytes32(0), "0x")).eq(MAGIC_VALUE_0);
            expect(await botAccount.supportsInterface("0x01ffc9a7")).eq(true); // ERC165
            expect(await botAccount.supportsInterface("0x6faff5f1")).eq(true); // ERC6551Account
            expect(await botAccount.supportsInterface("0x51945447")).eq(true); // ERC6551Executable
            expect(await botAccount.supportsInterface("0xffffffff")).eq(false);
            expect(await botAccount.supportsInterface("0x00000000")).eq(false);
            if(accountType == "BoomBotAccount") {
              expect(await botAccount['isValidSigner(address)'](botOwner.address)).eq(true);
              expect(await botAccount['isValidSigner(address)'](deployer.address)).eq(false);
              expect(await botAccount['isValidSigner(address)'](AddressZero)).eq(false);
              expect(await botAccount.dataStore()).eq(dataStore.address)
              expect(await botAccount.reentrancyGuardState()).eq(1)
              expect(await botAccount.supportsInterface("0x1f931c1c")).eq(true); // DiamondCut
              expect(await botAccount.supportsInterface("0x48e2b093")).eq(true); // DiamondLoupe
            } else {
              expect(await botAccount.supportsInterface("0x1f931c1c")).eq(false); // DiamondCut
              expect(await botAccount.supportsInterface("0x48e2b093")).eq(false); // DiamondLoupe
            }
          });
          if(accountType == "BoomBotAccount") {
            it("has the correct modules", async function () {
              let diamondAccount = await ethers.getContractAt("ERC2535Module", botAccount.address) as ERC2535Module;
              /*
              // facets()
              let facets = await diamondAccount.facets();
              console.log(facets)
              expect(facets.length).eq(3);
              expect(facets[0].facetAddress).eq(erc2535Module.address);
              expect(facets[1].facetAddress).eq(diamondLoupeModule.address);
              expect(facets[2].facetAddress).eq(erc6551AccountModule.address);
              // facetAddresses()
              facets = await diamondAccount.facetAddresses();
              console.log(facets)
              expect(facets.length).eq(3);
              expect(facets[0]).eq(diamondCutModule.address);
              expect(facets[1]).eq(diamondLoupeModule.address);
              expect(facets[2]).eq(erc6551AccountModule.address);
              */
              // facets(), facetAddresses()
              let facets = await diamondAccount.facets();
              let facetAddresses = await diamondAccount.facetAddresses();
              //console.log(facets)
              //console.log(facetAddresses)
              let diamondCutExpected = diamondCutInit
              if(!!extraModules && extraModules == "fallback") diamondCutExpected = diamondCutInit2
              expect(facets.length).eq(diamondCutExpected.length);
              for(let i = 0; i < diamondCutExpected.length; i++) {
                expect(facets[i].facetAddress).eq(diamondCutExpected[i].facetAddress);
                expect(facetAddresses[i]).eq(diamondCutExpected[i].facetAddress);
                assert.sameMembers(facets[i].functionSelectors, diamondCutExpected[i].functionSelectors);
                // facetFunctionSelectors()
                let selectors = await diamondAccount.facetFunctionSelectors(facetAddresses[i]);
                assert.sameMembers(selectors, diamondCutExpected[i].functionSelectors);
                // facetAddress()
                for(let j = 0; j < diamondCutExpected[i].functionSelectors.length; j++) {
                  let selector = diamondCutExpected[i].functionSelectors[j];
                  let facetAddress = await diamondAccount.facetAddress(selector);
                  expect(facetAddress).eq(diamondCutExpected[i].facetAddress);
                }
              }
            });
          } else {
            it("has no modules", async function () {
              let diamondAccount = await ethers.getContractAt("ERC2535Module", botAccount.address) as ERC2535Module;
              await expect(diamondAccount.facets()).to.be.reverted;
              await expect(diamondAccount.facetFunctionSelectors(AddressZero)).to.be.reverted;
              await expect(diamondAccount.facetFunctionSelectors(user1.address)).to.be.reverted;
              await expect(diamondAccount.facetAddresses()).to.be.reverted;
              await expect(diamondAccount.facetAddress("0x01ffc9a7")).to.be.reverted;
            });
          }
          //it("it can isValidSignature on an eoa", async function () {})
          it("it can isValidSignature on an erc1271", async function () {
            let tx1 = await boomBotsNft.connect(botOwner).transferFrom(botOwner.address, mockERC1271.address, botID);
            expect(await boomBotsNft.ownerOf(botID)).eq(mockERC1271.address)
            expect(await botAccount['isValidSigner(address,bytes)'](botOwner.address, "0x")).eq(MAGIC_VALUE_0);
            expect(await botAccount['isValidSigner(address,bytes)'](botOwner.address, "0x00abcd")).eq(MAGIC_VALUE_0);
            expect(await botAccount['isValidSigner(address,bytes)'](mockERC1271.address, "0x")).eq(MAGIC_VALUE_IS_VALID_SIGNER);
            expect(await botAccount['isValidSigner(address,bytes)'](mockERC1271.address, "0x00abcd")).eq(MAGIC_VALUE_IS_VALID_SIGNER);
            expect(await botAccount.isValidSignature(toBytes32(0), "0x")).eq(MAGIC_VALUE_IS_VALID_SIGNATURE);
            expect(await botAccount.isValidSignature(toBytes32(123), "0x9988776655")).eq(MAGIC_VALUE_IS_VALID_SIGNATURE);
          })
        }
        else if(createdState == "incorrect") {
          it("account begins with incorrect state", async function () {
            await expect(botAccount.owner()).to.be.reverted;
            await expect(botAccount.token()).to.be.reverted;
            await expect(botAccount.state()).to.be.reverted;
            //await expect(botAccount.isValidSigner(user1.address, "0x")).to.be.reverted;
            await expect(botAccount['isValidSigner(address,bytes)'](user1.address, "0x")).to.be.reverted;
            await expect(botAccount.isValidSignature(toBytes32(0), "0x")).to.be.reverted;
            await expect(botAccount.supportsInterface("0x01ffc9a7")).to.be.reverted;
          });
        }
        else {
          throw new Error(`unknown createdState ${createdState}`)
        }
        //it("can receive gas token", async function () {})

      });
    }
  });

  describe("metadata", function () {
    it("has the correct name and symbol", async function () {
      expect(await boomBotsNft.name()).eq("BOOM! Bot Ownership Tokens")
      expect(await boomBotsNft.symbol()).eq("BBOT")
    })
  })

  describe("tokenURI", function () {
    let base = "https://stats.boombots.xyz/bots/?chainID=31337&botID=";
    let uri = "https://stats.boombots.xyz/bots/?chainID=31337&botID=1";
    it("starts as id", async function () {
      expect(await boomBotsNft.baseURI()).eq("");
      expect(await boomBotsNft.tokenURI(1)).eq("1");
    });
    it("non owner cannot set base", async function () {
      await expect(boomBotsNft.connect(user1).setBaseURI(base)).to.be.revertedWithCustomError(boomBotsNft, "NotContractOwner");
    });
    it("owner can set base", async function () {
      let tx = await boomBotsNft.connect(owner).setBaseURI(base);
      await expect(tx).to.emit(boomBotsNft, "BaseURISet").withArgs(base);
      l1DataFeeAnalyzer.register("setBaseURI", tx);
    });
    it("can get new uri", async function () {
      expect(await boomBotsNft.baseURI()).eq(base);
      expect(await boomBotsNft.tokenURI(1)).eq(uri);
    });
    it("cannot get uri of nonexistant token", async function () {
      await expect(boomBotsNft.tokenURI(0)).to.be.revertedWithCustomError(boomBotsNft, "BotDoesNotExist");
      await expect(boomBotsNft.tokenURI(999)).to.be.revertedWithCustomError(boomBotsNft, "BotDoesNotExist");
    });
  });

  describe("contractURI", function () {
    let uri = "https://stats-cdn.boombots.xyz/contract-uri.json";
    it("starts null", async function () {
      expect(await boomBotsNft.contractURI()).eq("");
    });
    it("non owner cannot set uri", async function () {
      await expect(boomBotsNft.connect(user1).setContractURI(uri)).to.be.revertedWithCustomError(boomBotsNft, "NotContractOwner");
    });
    it("owner can set uri", async function () {
      let tx = await boomBotsNft.connect(owner).setContractURI(uri);
      await expect(tx).to.emit(boomBotsNft, "ContractURISet").withArgs(uri);
      l1DataFeeAnalyzer.register("setContractURI", tx);
    });
    it("can get new uri", async function () {
      expect(await boomBotsNft.contractURI()).eq(uri);
    });
  });

  describe("L1 gas fees", function () {
    it("calculate", async function () {
      l1DataFeeAnalyzer.analyze()
    });
  });
});
