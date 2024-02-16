/* global describe it before ethers */

import hre from "hardhat";
const { ethers } = hre;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
const { expect, assert } = chai;
import fs from "fs";

import { BoomBots, BoomBotAccount, ERC2535Module, ERC6551AccountModule, MulticallModule, ERC20HolderModule, ERC721HolderModule, FallbackModule, RevertModule, Test1Module, Test2Module, Test3Module, ModulePack100, BoomBotsFactory, MockERC20, MockERC721, MockERC1155, DataStore } from "./../typechain-types";

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

describe("BoomBotAccountInscriptions", function () {
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
  let erc20HolderModule: ERC20HolderModule;
  let erc721HolderModule: ERC721HolderModule;
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
      boomBotAccountImplementation = await deployContract(deployer, "BoomBotAccount", [deployer.address]) as BoomBotAccount;
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
      /*
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
      erc20HolderModule = await deployContract(deployer, "ERC20HolderModule", []) as ERC20HolderModule;
      await expectDeployed(erc20HolderModule.address);
      l1DataFeeAnalyzer.register("deploy ERC20HolderModule impl", erc20HolderModule.deployTransaction);
      // ERC721HolderModule
      erc721HolderModule = await deployContract(deployer, "ERC721HolderModule", []) as ERC721HolderModule;
      await expectDeployed(erc721HolderModule.address);
      l1DataFeeAnalyzer.register("deploy ERC721HolderModule impl", erc721HolderModule.deployTransaction);
      */
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
    it("can deploy BoomBotsFactory", async function () {
      // to deployer
      factory = await deployContract(deployer, "BoomBotsFactory", [deployer.address, boomBotsNft.address]) as BoomBotsFactory;
      await expectDeployed(factory.address);
      expect(await factory.owner()).eq(deployer.address);
      l1DataFeeAnalyzer.register("deploy BoomBotsFactory", factory.deployTransaction);
      // to owner
      factory = await deployContract(deployer, "BoomBotsFactory", [owner.address, boomBotsNft.address]) as BoomBotsFactory;
      await expectDeployed(factory.address);
      expect(await factory.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy BoomBotsFactory", factory.deployTransaction);
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
      let params = {
        botImplementation: boomBotAccountImplementation.address,
        initializationCalls: [
          boomBotAccountImplementation.interface.encodeFunctionData("initialize", [diamondCut, dataStore.address]),
          modulePack100.interface.encodeFunctionData("updateSupportedInterfaces", [interfaceIDs, support]),
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
    it("can get combined abi", async function () {
      let abi = getCombinedAbi([
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
      //console.log('abi');
      //console.log(abi);
      // get info
      let botID = 1
      expect(await boomBotsNft.exists(botID)).eq(true);
      let botInfo = await boomBotsNft.getBotInfo(botID);
      tbaccount1 = await ethers.getContractAt("BoomBotAccount", botInfo.botAddress) as BoomBotAccount;
      bbaccount1 = await ethers.getContractAt("ERC6551Account", botInfo.botAddress) as ERC6551Account;
      accountProxy = await ethers.getContractAt(abi, botInfo.botAddress);
      //console.log('accountProxy')
      //console.log(accountProxy)
    });
  });
  /*
  describe("inscription", function () {
    it("can inscribe messages", async function () {
      let strings = [
        `Hello Roboto!`,
        `{"botName":"Roboto"}`,
      ]
      for(let s of strings) {
        let originalData = s
        let hexData = hexEncodeString(originalData)
        await testInscription(originalData, hexData)
      }
    })
    it("can inscribe files", async function () {
      let filenames = [
        'stash/images/bot8x8.png',
        //'stash/images/bot16x16.png',
        //'stash/images/bot32x32.png',
        //'stash/images/bot64x64.png',
        //'stash/images/bot128x128.png',
        //'stash/images/bot256x256.png',
        //'stash/images/bot512x512.png',
        //'stash/images/bot1024x1024.png',
        'stash/images/1.svg',
        //'stash/images/2.svg',
        //'stash/images/3.svg',
        //'stash/images/4.svg',
      ]
      for(let filename of filenames) {
        console.log('')
        console.log('filename', filename)
        let originalData = fs.readFileSync(filename)
        let hexData = hexEncodeBuffer(originalData)
        await testInscription(originalData, hexData)
      }
      console.log('')
    });
    async function testInscription(originalData:any, hexData:string) {
      console.log("\nBeginning inscription")
      console.log('original data length in bytes')
      const maxLength = 100_000
      console.log(originalData.length)
      if(originalData.length < maxLength) {
        console.log('originalData')
        console.log(originalData)
        console.log(originalData.toString())
        //originalData = originalData.toString()
      }
      //let message = '0x'+hexEncodeString(data)
      //console.log('message length in bytes')
      //console.log(message.length/2-1)
      //if(message.length < maxLength) {
        //console.log('message')
        //console.log(message)
      //}
      // inscribe on bot
      try {
        //let txBot = await accountProxy.connect(user3).inscribe(message, {gasLimit:30_000_000})
        let message = inscribeSighash+hexData
        console.log('message to bot. length in bytes')
        console.log(message.length/2-1)
        if(message.length < maxLength) {
          console.log('message')
          console.log(message)
        }
        let txBot = await user3.sendTransaction({
          to: accountProxy.address,
          data: message
        })
        let receiptBot = await txBot.wait();
        console.log('gas used txBot')
        console.log(receiptBot.gasUsed.toString())
        console.log('txBot.data length in bytes')
        console.log(txBot.data.length/2-1)
        if(txBot.data.length < maxLength) {
          console.log('txBot.data')
          console.log(txBot.data)
        }
        l1DataFeeAnalyzer.register(`inscribe ${leftPad(txBot.data.length, 8)} b bot 2`, txBot);
      } catch(e) {
        console.error('call to bot failed')
        //e.transaction = undefined
        //console.error(e)
      }
      // inscribe self
      try {
        //message = '0x'+hexEncodeString(message)
        let message = '0x'+hexData
        console.log('message to bot. length in bytes')
        console.log(message.length/2-1)
        if(message.length < maxLength) {
          console.log('message')
          console.log(message)
        }
        let txSelf = await user3.sendTransaction({
          to: user3.address,
          data: message
        })
        let receiptSelf = await txSelf.wait();
        console.log('gas used txSelf')
        console.log(receiptSelf.gasUsed.toString())
        console.log('tx.data length in bytes')
        console.log(txSelf.data.length/2-1)
        if(txSelf.data.length < maxLength) {
          console.log('txSelf.data')
          console.log(txSelf.data)
        }
        l1DataFeeAnalyzer.register(`inscribe ${leftPad(txSelf.data.length, 8)} b self`, txSelf);
      } catch(e) {
        console.error('call to self failed')
        //e.transaction = undefined
        //console.error(e)
      }
    }
  })
  */
  describe("inscription 2", function () {
    let strings = [
      '',
      `{"botName":"Roboto"}`,
      `Hello Roboto! I am testing a long message here. Please ignore. Anyways I was saying. This is somewhat a long message. We can end it here.`,
    ]
    for(let s of strings) {
      //let originalData = s
      //let hexData = hexEncodeString(originalData)
      //await testInscription(originalData, hexData)
      let originalData = s
      let hexData = hexEncodeString(originalData)
      var desc = `can inscribe message${s.length < 50 ? ` '${s}'` : ''}`
      it(desc, async function () {
        await testInscription2(originalData, hexData)
      })
    }

    let filenames = [
      'stash/images/bot64x64.png',
      'stash/images/bot64x64.jpg',
      'stash/images/1.svg',
      /*
      'stash/images/bot8x8.png',
      'stash/images/bot8x8.jpg',
      'stash/images/bot16x16.png',
      'stash/images/bot16x16.jpg',
      'stash/images/bot32x32.png',
      'stash/images/bot32x32.jpg',
      'stash/images/bot64x64.png',
      'stash/images/bot64x64.jpg',
      'stash/images/bot128x128.png',
      'stash/images/bot128x128.jpg',
      'stash/images/bot256x256.png',
      'stash/images/bot256x256.jpg',
      'stash/images/bot512x512.png',
      'stash/images/bot512x512.jpg',
      //'stash/images/bot1024x1024.png', // file too big for bot. works on self but takes 26m gas and costs $573 in l1 data fee
      'stash/images/bot1024x1024.jpg',
      'stash/images/1.svg',
      'stash/images/2.svg',
      'stash/images/3.svg',
      'stash/images/4.svg',
      */
    ]
    for(let filename of filenames) {
      //console.log('')
      //console.log('filename', filename)
      var desc = `can inscribe file ${filename}`
      let originalData = fs.readFileSync(filename)
      let hexData = hexEncodeBuffer(originalData)
      //await testInscription(originalData, hexData)
      it(desc, async function () {
        await testInscription2(originalData, hexData)
      })
    }
    let lengths = [
      /*
      10_000,
      20_000,
      30_000,
      40_000,
      50_000,
      60_000,
      70_000,
      80_000,
      90_000,
      100_000,
      110_000,
      120_000,
      130_000,
      140_000,
      150_000,
      160_000,
      170_000,
      180_000,
      190_000,
      */
      100_000,
      200_000,
      /* // work but are expensive and take a long time
      300_000,
      400_000,
      500_000,
      600_000,
      700_000,
      800_000,
      900_000,
      1_000_000,
      */
    ]
    for(let length of lengths) {
      var desc = `can inscribe ${length} bytes`
      let originalData = rightPad('', length, 'a')
      let hexData = hexEncodeString(originalData)
      it(desc, async function () {
        await testInscription2(originalData, hexData)
      })
    }
    console.log('')
    async function testInscription2(originalData:any, hexData:string) {
      console.log("\nBeginning inscription")
      console.log(`original data length ${leftPad(originalData.length, 8)}`)
      const maxLength = 1_000
      //if(originalData.length < maxLength) {
        //console.log('originalData')
        //console.log(originalData)
        //console.log(originalData.toString())
      //}
      //let message = '0x'+hexEncodeString(data)
      //console.log('message length in bytes')
      //console.log(message.length/2-1)
      //if(message.length < maxLength) {
        //console.log('message')
        //console.log(message)
      //}
      // inscribe on bot
      var e1, e2
      try {
        //let txBot = await accountProxy.connect(user3).inscribe(message, {gasLimit:30_000_000})
        let message = inscribeSighash+hexData
        //console.log(`message to bot length in bytes ${message.length/2-1}`) // original + 4
        //if(message.length < maxLength) {
          //console.log('message')
          //console.log(message)
        //}
        let txBot = await user3.sendTransaction({
          to: accountProxy.address,
          data: message
        })
        let receiptBot = await txBot.wait();
        console.log(`gas used txBot  ${leftPad(receiptBot.gasUsed.toString(), 8)}`)
        //console.log('txBot.data length in bytes')
        //console.log(txBot.data.length/2-1)
        //if(txBot.data.length < maxLength) {
          //console.log('txBot.data')
          //console.log(txBot.data)
        //}
        l1DataFeeAnalyzer.register(`inscribe ${leftPad(originalData.length, 8)} b bot 2`, txBot);
      } catch(e) {
        e1 = e
        console.error('call to bot failed')
        //e.transaction = undefined
        //console.error(e)
      }
      // inscribe self
      try {
        //message = '0x'+hexEncodeString(message)
        let message = '0x'+hexData
        //console.log(`message to self length in bytes ${message.length/2-1}`) // = originalData
        //if(message.length < maxLength) {
          //console.log('message')
          //console.log(message)
        //}
        let txSelf = await user3.sendTransaction({
          to: user3.address,
          data: message
        })
        let receiptSelf = await txSelf.wait();
        console.log(`gas used txSelf ${leftPad(receiptSelf.gasUsed.toString(), 8)}`)
        //console.log('txSelf.data length in bytes')
        //console.log(txSelf.data.length/2-1)
        //if(txSelf.data.length < maxLength) {
          //console.log('txSelf.data')
          //console.log(txSelf.data)
        //}
        l1DataFeeAnalyzer.register(`inscribe ${leftPad(originalData.length, 8)} b self`, txSelf);
      } catch(e) {
        e2 = e
        console.error('call to self failed')
        //e.transaction = undefined
        //console.error(e)
      }
      var e = e1 || e2
      if(e) throw e
    }
  })
  /*
  // inscribe()
  0x449b2cf60000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000027efffd0050004e0047000d000a001a000a000000000000000d00490048004400520000000000000008000000000000000800080006000000000000fffd000ffffdfffd000000000000000100730052004700420000fffdfffd001cfffd0000000000010005004900440041005400280053001dfffd003d002f000300610000fffdfffdfffdfffd0056005dfffd0023002400680023fffdfffd046305cb0036fffd0012fffdfffdfffd0045fffd00660031fffdfffd0007fffd0011002c0046002bfffdfffd0048fffd0550fffd000100550003fffd005dfffd00250069002ffffd0047fffd0037fffdfffd006efffd02f6fffd0032fffd0048fffdfffdfffdfffd0053fffd004c0036fffd0055fffdfffd004efffd0011005afffd0020fffdfffd00420044fffdfffd003cfffd005efffd00630076002a004bfffdfffd00970012fffdfffd00364099fffd07b2fffdfffd00430014000b001a055b005bfffdfffd0022fffd00670017fffdfffdfffd0025fffdfffd00740071003a006dfffd0000fffdfffd001100540035004afffdfffdfffdfffdfffd0021fffdfffd0036fffdfffdfffd001500110065fffdfffd0064fffd0041fffd0026001afffd0038fffd0038fffd0051fffdfffdfffd0028fffd02c7007700260035fffdfffd004e00170023005ffffd0052fffd0060007bfffdfffd0028000e0077fffdfffdfffd004d004dfffd0034fffd007d0062fffd0017fffdfffd0057fffdfffd0019fffdfffd0065fffdfffdfffd00290077fffd000cfffdfffd002f00760030fffd0049003f0043fffd006dfffd003b002ffffdfffd001afffd00010069fffd00680070fffd0061fffd0001000000000000000000490045004e0044fffd00420060fffd0000
  0x449b2cf6
  0000000000000000000000000000000000000000000000000000000000000020
  000000000000000000000000000000000000000000000000000000000000027e
  fffd0050004e0047000d000a001a000a000000000000000d00490048004400520000000000000008000000000000000800080006000000000000fffd000ffffdfffd000000000000000100730052004700420000fffdfffd001cfffd0000000000010005004900440041005400280053001dfffd003d002f000300610000fffdfffdfffdfffd0056005dfffd0023002400680023fffdfffd046305cb0036fffd0012fffdfffdfffd0045fffd00660031fffdfffd0007fffd0011002c0046002bfffdfffd0048fffd0550fffd000100550003fffd005dfffd00250069002ffffd0047fffd0037fffdfffd006efffd02f6fffd0032fffd0048fffdfffdfffdfffd0053fffd004c0036fffd0055fffdfffd004efffd0011005afffd0020fffdfffd00420044fffdfffd003cfffd005efffd00630076002a004bfffdfffd00970012fffdfffd00364099fffd07b2fffdfffd00430014000b001a055b005bfffdfffd0022fffd00670017fffdfffdfffd0025fffdfffd00740071003a006dfffd0000fffdfffd001100540035004afffdfffdfffdfffdfffd0021fffdfffd0036fffdfffdfffd001500110065fffdfffd0064fffd0041fffd0026001afffd0038fffd0038fffd0051fffdfffdfffd0028fffd02c7007700260035fffdfffd004e00170023005ffffd0052fffd0060007bfffdfffd0028000e0077fffdfffdfffd004d004dfffd0034fffd007d0062fffd0017fffdfffd0057fffdfffd0019fffdfffd0065fffdfffdfffd00290077fffd000cfffdfffd002f00760030fffd0049003f0043fffd006dfffd003b002ffffdfffd001afffd00010069fffd00680070fffd0061fffd0001000000000000000000490045004e0044fffd00420060fffd0000

  // https://ethscriptions.com/create
  0x646174613a696d6167652f706e673b6261736536342c6956424f5277304b47676f414141414e5355684555674141414167414141414943415941414144454437364c4141414141584e535230494172733463365141414151564a524546554b464d64796a3076413245417750482f30315a646d794d6b614350707939476a3134733233684b54734970467a4759786d73554838524573526975526b45696b315a43634156554478563376716956704c396448346a662f6847374f793762724d7035496b4b504a2b564f54544461465661755454715552577134676c5a6843524954775049396530474e324b6b76317a734b58457047644e7553436d656665736f69725178514c4774576257387a694971646e4634697431535835374852784f6d3243414c534a455651315376327a672f2f6a495937324e755842385255525a5a69785a4a4a427a7959616c6a69524f4d565269646a664b4d6e4c6833636d4e5a32335468636a58364a53715742377266386f446e6533355966375455326f4e4e7039597534586a2f56583576515a7273746c785071794b586657444d4c424c33597777456b2f5139787434547376724951612f414670336d687771574752415141414141424a52553545726b4a6767673d3d

  // inscribe 2
  0x89504e470d0a1a0a0000000d4948445200000008000000080806000000c40fbe8b000000017352474200aece1ce9000001054944415428531dca3d2f036100c0f1ffd3565d9b23246823e9cbd1a3d78b36de1293b08a45cc66319ac507f1112c462b919048a4d5909c015503c55defaa25692fd747e237ff846ececbb6eb329e4890a3c9f953934c368555ab934ea5115aae209598424484f03c8f5ed063762a4bf5cec29712919d36e48299e7deb288ab43140b1ad59b5bcce222a7671788add525f9ec74713a6d8200b4891154354afdb383ffe3218ef636e5c1f115116598b1649241cf261a96389138c55189d8df28c9cb877726359db74e17235fa252a9607badff280e77b7e587fb4d4da834da7d62ee178ff557e6f419aecb65c4fab22977d60cc2c12f7630c0493f43dc6de13b2fac841afc0169de6870a96191010000000049454e44ae426082
  */
  function hexEncodeString(s: string){
    var hex, i;

    var result = "";
    for (i=0; i<s.length; i++) {
        hex = s.charCodeAt(i).toString(16);
        hex = ("000"+hex).slice(-4);
        if(hex.substring(0, 2) != "00") {
          throw new Error(`unknown hex string ${hex}`)
        }
        hex = hex.substring(2, 4)
        result += hex
        //result += ("000"+hex).slice(-4);
        //console.log(`${s[i]} -> ${s.charCodeAt(i)} -> ${hex} -> ${result}`)
    }

    return result;
  }

  function hexEncodeBuffer(b: any) {
    var result = ""
    for(let i = 0; i < b.length; i++) {
      var ele = b[i];
      if(ele < 0 || ele > 255) {
        console.error(`unknown hex buffer ${ele} at position ${i}`)
        throw new Error(`unknown hex buffer ${ele} at position ${i}`)
      }
      var hex = ele.toString(16)
      hex = leftPad(hex, 2, '0')
      result += hex
    }
    if(result.length != b.length * 2) {
      console.error(`bad length`)
      throw new Error(`bad length`)
    }
    return result
  }

  describe("L1 gas fees", function () {
    it("calculate", async function () {
      l1DataFeeAnalyzer.analyze()
    });
  });
});
