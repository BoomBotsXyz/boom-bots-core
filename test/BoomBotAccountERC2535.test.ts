/* global describe it before ethers */

import hre from "hardhat";
const { ethers } = hre;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
const { expect, assert } = chai;

import { BoomBots, BoomBotAccount, ERC2535Module, ERC6551AccountModule, MulticallModule, ERC165Module, ERC721ReceiverModule, FallbackModule, RevertModule, Test1Module, Test2Module, Test3Module, InscriptionModule, ReentrancyGuardModule, DataStoreModule, BoomBotsFactory01, MockERC20, MockERC721, DataStore } from "./../typechain-types";

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

describe("BoomBotAccountERC2535", function () {
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
  let erc2535Module: ERC2535Module;
  let erc6551AccountModule: ERC6551AccountModule;
  let multicallModule: MulticallModule;
  let erc165Module: ERC165Module;
  let erc721ReceiverModule: ERC721ReceiverModule;
  let fallbackModule: FallbackModule;
  let fallbackModule2: FallbackModule;
  let revertModule: RevertModule;
  let test1Module: Test1Module;
  let test2Module: Test2Module;
  let test3Module: Test3Module;
  let inscriptionModule: InscriptionModule;
  let reentrancyGuardModule: ReentrancyGuardModule;
  let dataStoreModule: DataStoreModule;
  // diamond cuts
  let diamondCutInit: any[] = [];
  let botInitializationCode1: any;
  let botInitializationCode2: any;
  // factory
  let factory: BoomBotsFactory01;

  let erc20a: MockERC20;
  let erc20b: MockERC20;
  let erc20c: MockERC20;
  let erc721Asset: MockERC721; // an erc721 that token bound accounts may hold

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
    it("can deploy account implementations", async function () {
      //boomBotAccountImplementation = await deployContract(deployer, "BoomBotAccount") as BoomBotAccount;
      boomBotAccountImplementation = await deployContract(deployer, "BoomBotAccount", [deployer.address]) as BoomBotAccount;
      await expectDeployed(boomBotAccountImplementation.address);
      l1DataFeeAnalyzer.register("deploy BoomBotAccount impl", boomBotsNft.deployTransaction);
    });
    it("can deploy modules", async function () {
      // ERC2535Module
      erc2535Module = await deployContract(deployer, "ERC2535Module", []) as ERC2535Module;
      await expectDeployed(erc2535Module.address);
      l1DataFeeAnalyzer.register("deploy ERC2535Module impl", erc2535Module.deployTransaction);
      // ERC6551AccountModule
      erc6551AccountModule = await deployContract(deployer, "ERC6551AccountModule", []) as ERC6551AccountModule;
      await expectDeployed(erc6551AccountModule.address);
      l1DataFeeAnalyzer.register("deploy ERC6551AccountModule impl", erc6551AccountModule.deployTransaction);
      // ERC165Module
      erc165Module = await deployContract(deployer, "ERC165Module", []) as ERC165Module;
      await expectDeployed(erc165Module.address);
      l1DataFeeAnalyzer.register("deploy ERC165Module impl", erc165Module.deployTransaction);
      // MulticallModule
      multicallModule = await deployContract(deployer, "MulticallModule", []) as MulticallModule;
      await expectDeployed(multicallModule.address);
      l1DataFeeAnalyzer.register("deploy MulticallModule impl", multicallModule.deployTransaction);
      // ERC721ReceiverModule
      erc721ReceiverModule = await deployContract(deployer, "ERC721ReceiverModule", []) as ERC721ReceiverModule;
      await expectDeployed(erc721ReceiverModule.address);
      l1DataFeeAnalyzer.register("deploy ERC721ReceiverModule impl", erc721ReceiverModule.deployTransaction);
      // FallbackModule
      fallbackModule = await deployContract(deployer, "FallbackModule", []) as FallbackModule;
      fallbackModule2 = await deployContract(deployer, "FallbackModule", []) as FallbackModule;
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
      await test3Module.testFunc4();
      // InscriptionModule
      inscriptionModule = await deployContract(deployer, "InscriptionModule", []) as InscriptionModule;
      await expectDeployed(inscriptionModule.address);
      l1DataFeeAnalyzer.register("deploy InscriptionModule impl", inscriptionModule.deployTransaction);
      // DataStoreModule
      dataStoreModule = await deployContract(deployer, "DataStoreModule", []) as DataStoreModule;
      await expectDeployed(dataStoreModule.address);
      l1DataFeeAnalyzer.register("deploy DataStoreModule impl", dataStoreModule.deployTransaction);
      // ReentrancyGuardModule
      reentrancyGuardModule = await deployContract(deployer, "ReentrancyGuardModule", []) as ReentrancyGuardModule;
      await expectDeployed(reentrancyGuardModule.address);
      l1DataFeeAnalyzer.register("deploy ReentrancyGuardModule impl", reentrancyGuardModule.deployTransaction);
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
      let diamondCut = [
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
        {
          facetAddress: erc165Module.address,
          action: FacetCutAction.Add,
          functionSelectors: calcSighashes(erc165Module, 'ERC165Module'),
        },
        {
          facetAddress: erc721ReceiverModule.address,
          action: FacetCutAction.Add,
          functionSelectors: calcSighashes(erc721ReceiverModule, 'ERC721ReceiverModule'),
        },
        {
          facetAddress: inscriptionModule.address,
          action: FacetCutAction.Add,
          functionSelectors: [inscribeSighash],
        },
        {
          facetAddress: dataStoreModule.address,
          action: FacetCutAction.Add,
          functionSelectors: calcSighashes(dataStoreModule, 'DataStoreModule'),
        },
        {
          facetAddress: reentrancyGuardModule.address,
          action: FacetCutAction.Add,
          functionSelectors: calcSighashes(reentrancyGuardModule, 'ReentrancyGuardModule'),
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
          erc165Module.interface.encodeFunctionData("updateSupportedInterfaces", [interfaceIDs, support]),
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
    it("create bot fails if zero address datastore", async function () {
      let diamondCut = [
        {
          facetAddress: erc2535Module.address,
          action: FacetCutAction.Add,
          functionSelectors: calcSighashes(erc2535Module, 'ERC2535Module'),
        },
      ]
      let params = {
        botImplementation: boomBotAccountImplementation.address,
        initializationCalls: [
          boomBotAccountImplementation.interface.encodeFunctionData("initialize", [diamondCut, AddressZero])
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

      await expect(factory.connect(user1)['createBot(uint256)'](2)).to.be.revertedWithCustomError;//(newContract, "AddressZero") // error thrown from contract being deployed
    });
    it("create bot fails if modules not whitelisted", async function () {
      await expect(factory.connect(user1)['createBot(uint256)'](1)).to.be.revertedWithCustomError;//(newContract, "ModuleNotWhitelisted") // error thrown from contract being deployed
    });
    it("non owner cannot whitelist modules", async function () {
      await expect(dataStore.connect(user1).setModuleWhitelist([])).to.be.revertedWithCustomError(dataStore, "NotContractOwner");
    });
    it("owner can whitelist modules", async function () {
      let modules = [
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
        {
          module: erc721ReceiverModule.address,
          shouldWhitelist: true,
        },
        {
          module: revertModule.address,
          shouldWhitelist: true,
        },
        {
          module: inscriptionModule.address,
          shouldWhitelist: true,
        },
        {
          module: dataStoreModule.address,
          shouldWhitelist: true,
        },
        {
          module: reentrancyGuardModule.address,
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
    it("can get combined abi", async function () {
      let abi = getCombinedAbi([
        "artifacts/contracts/accounts/BoomBotAccount.sol/BoomBotAccount.json",
        "artifacts/contracts/modules/ModulePack100.sol/ModulePack100.json",
        "artifacts/contracts/mocks/modules/FallbackModule.sol/FallbackModule.json",
        "artifacts/contracts/mocks/modules/RevertModule.sol/RevertModule.json",
        "artifacts/contracts/mocks/modules/Test1Module.sol/Test1Module.json",
        "artifacts/contracts/mocks/modules/Test2Module.sol/Test2Module.json",
        "artifacts/contracts/mocks/modules/Test3Module.sol/Test3Module.json",
        "artifacts/contracts/libraries/Errors.sol/Errors.json",
        "artifacts/contracts/libraries/modules/ERC2535Library.sol/ERC2535Library.json",
        "artifacts/contracts/libraries/modules/ERC165Library.sol/ERC165Library.json",
      ])
      accountProxy = await ethers.getContractAt(abi, bbaccount1.address);
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
      let diamondAccount = await ethers.getContractAt("ERC2535Module", bbaccount1.address) as ERC2535Module;
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
    it("cannot initialize address zero datastore", async function () {
      // proxies are initialized by the factory. the implementation was not initialized
      await expect(boomBotAccountImplementation.connect(user3).initialize([], AddressZero)).to.be.revertedWithCustomError(boomBotAccountImplementation, "AddressZero");
    });
    it("can be initialized once", async function () {
      // proxies are initialized by the factory. the implementation was not initialized
      await boomBotAccountImplementation.connect(user3).initialize([], dataStore.address);
    });
    it("cannot be initialized twice", async function () {
      await expect(tbaccount1.connect(user1).initialize([], dataStore.address)).to.be.revertedWithCustomError(tbaccount1, "AlreadyInitialized");
      await expect(boomBotAccountImplementation.connect(user1).initialize([], dataStore.address)).to.be.revertedWithCustomError(boomBotAccountImplementation, "AlreadyInitialized");
    });
  });

  describe("account ownership", function () {
    let botID = 1;
    let botOwner: any;
    let botInfo: any;

    before("get basic info", async function () {
      // get info
      botInfo = await boomBotsNft.getBotInfo(botID);
      botOwner = user1;
    });
    it("is nft owner", async function () {
      expect(await boomBotsNft.ownerOf(botID)).eq(user1.address);
      expect(await bbaccount1.owner()).eq(user1.address);
    });
    it("owner can execute", async function () {
      let state1 = await bbaccount1.state();
      await bbaccount1.connect(user1).execute(user3.address, 0, "0x", 0);
      let state2 = await bbaccount1.state();
      expect(state2.sub(state1)).eq(1);
    });
    it("is tied to nft owner", async function () {
      expect(await boomBotsNft.ownerOf(botID)).eq(user1.address);
      expect(await bbaccount1.owner()).eq(user1.address);
      await boomBotsNft.connect(user1).transferFrom(user1.address, user2.address, botID);
      expect(await boomBotsNft.ownerOf(botID)).eq(user2.address);
      expect(await bbaccount1.owner()).eq(user2.address);
    });
    it("old owner cannot execute", async function () {
      await expect(bbaccount1.connect(user1).execute(user1.address, 0, "0x", 0)).to.be.revertedWithCustomError(bbaccount1, "ERC6551InvalidSigner");
    });
    it("new owner can execute", async function () {
      let state1 = await bbaccount1.state();
      await bbaccount1.connect(user2).execute(user3.address, 0, "0x", 0);
      let state2 = await bbaccount1.state();
      expect(state2.sub(state1)).eq(1);
    });
    it("is tied to nft owner pt 2", async function () {
      expect(await boomBotsNft.ownerOf(botID)).eq(user2.address);
      expect(await bbaccount1.owner()).eq(user2.address);
      await boomBotsNft.connect(user2).transferFrom(user2.address, user1.address, botID);
      expect(await boomBotsNft.ownerOf(botID)).eq(user1.address);
      expect(await bbaccount1.owner()).eq(user1.address);
    });
  });

  describe("account receiving", function () {
    it("can receive ETH", async function () {
      let bal1 = await provider.getBalance(tbaccount1.address);
      expect(bal1).eq(0);
      await user1.sendTransaction({
        to: tbaccount1.address,
        value: 0,
        data: "0x"
      });
      let bal2 = await provider.getBalance(tbaccount1.address);
      expect(bal2).eq(0);
      let transferAmount = WeiPerEther.mul(10);
      await user1.sendTransaction({
        to: tbaccount1.address,
        value: transferAmount,
        data: "0x"
      });
      let bal3 = await provider.getBalance(tbaccount1.address);
      expect(bal3).eq(transferAmount);
    });
    it("can receive ERC20", async function () {
      let bal1 = await erc20a.balanceOf(tbaccount1.address);
      expect(bal1).eq(0);
      await erc20a.mint(user1.address, WeiPerEther.mul(1000));
      let transferAmount = WeiPerEther.mul(800);
      await erc20a.connect(user1).transfer(tbaccount1.address, transferAmount);
      let bal2 = await erc20a.balanceOf(tbaccount1.address);
      expect(bal2).eq(transferAmount);
    });
    it("can receive ERC721", async function () {
      // mint
      erc721Asset = await deployContract(deployer, "MockERC721", ["AssetERC721", "ASS"]) as MockERC721;
      await erc721Asset.mint(user1.address, 1);
      await erc721Asset.mint(user1.address, 2);
      expect(await erc721Asset.balanceOf(tbaccount1.address)).eq(0);
      expect(await erc721Asset.ownerOf(1)).eq(user1.address);
      expect(await erc721Asset.ownerOf(2)).eq(user1.address);
      // transferFrom()
      await erc721Asset.connect(user1).transferFrom(user1.address, tbaccount1.address, 1);
      expect(await erc721Asset.balanceOf(tbaccount1.address)).eq(1);
      expect(await erc721Asset.ownerOf(1)).eq(tbaccount1.address);
      // safeTransferFrom()
      //console.log('h 1')
      await erc721Asset.connect(user1)['safeTransferFrom(address,address,uint256)'](user1.address, tbaccount1.address, 2);
      //console.log('h 2')
      expect(await erc721Asset.balanceOf(tbaccount1.address)).eq(2);
      expect(await erc721Asset.ownerOf(2)).eq(tbaccount1.address);
    });
    //it("can receive ERC1155", async function () {});
  });

  describe("account execution", function () {
    it("non owner cannot execute", async function () {
      // no data
      await expect(bbaccount1.connect(user2).execute(user2.address, 0, "0x", 0)).to.be.revertedWithCustomError(bbaccount1, "ERC6551InvalidSigner");
      // erc20 transfer
      let calldata = erc20a.interface.encodeFunctionData("transfer", [user2.address, 0]);
      await expect(bbaccount1.connect(user2).execute(erc20a.address, 0, calldata, 0)).to.be.revertedWithCustomError(bbaccount1, "ERC6551InvalidSigner");
    });
    it("owner cannot execute not call", async function () {
      let calldata = erc20a.interface.encodeFunctionData("transfer", [user2.address, 0]);
      await expect(bbaccount1.connect(user1).execute(erc20a.address, 0, calldata, 1)).to.be.revertedWithCustomError(bbaccount1, "OnlyCallsAllowed");
      await expect(bbaccount1.connect(user1).execute(erc20a.address, 0, calldata, 2)).to.be.revertedWithCustomError(bbaccount1, "OnlyCallsAllowed");
      await expect(bbaccount1.connect(user1).execute(erc20a.address, 0, calldata, 3)).to.be.revertedWithCustomError(bbaccount1, "OnlyCallsAllowed");
    });
    it("reverts unsuccessful call", async function () {
      await expect(bbaccount1.connect(user1).execute(user2.address, WeiPerEther.mul(9999), "0x", 0)).to.be.reverted;
      await expect(bbaccount1.connect(user1).execute(revertModule.address, 0, revertModule.interface.encodeFunctionData("revertWithReason", []), 0)).to.be.revertedWithCustomError//(bbaccount1, "RevertWithReason");
      await expect(bbaccount1.connect(user1).execute(revertModule.address, 0, revertModule.interface.encodeFunctionData("revertWithoutReason", []), 0)).to.be.reverted;
    });
    it("owner can send ETH", async function () {
      let state1 = await bbaccount1.state();
      let bal1 = await provider.getBalance(user2.address);
      let transferAmount = WeiPerEther.div(3);
      let tx = await bbaccount1.connect(user1).execute(user2.address, transferAmount, "0x", 0);
      let bal2 = await provider.getBalance(user2.address);
      expect(bal2.sub(bal1)).eq(transferAmount);
      let state2 = await bbaccount1.state();
      expect(state2.sub(state1)).eq(1);
      l1DataFeeAnalyzer.register("execute transfer ETH", tx);
    });
    it("owner can send ERC20", async function () {
      let state1 = await bbaccount1.state();
      let bal11 = await erc20a.balanceOf(bbaccount1.address);
      let bal12 = await erc20a.balanceOf(user2.address);
      let transferAmount = WeiPerEther.mul(25);
      let calldata = erc20a.interface.encodeFunctionData("transfer", [user2.address, transferAmount]);
      let tx = await bbaccount1.connect(user1).execute(erc20a.address, 0, calldata, 0);
      let bal21 = await erc20a.balanceOf(bbaccount1.address);
      let bal22 = await erc20a.balanceOf(user2.address);
      expect(bal22.sub(bal12)).eq(transferAmount);
      expect(bal11.sub(bal21)).eq(transferAmount);
      let state2 = await bbaccount1.state();
      expect(state2.sub(state1)).eq(1);
      l1DataFeeAnalyzer.register("execute transfer ERC20", tx);
    });
    it("owner can send ERC721", async function () {
      let state1 = await bbaccount1.state();
      let tokenId = 2;
      expect(await erc721Asset.ownerOf(tokenId)).eq(bbaccount1.address);
      let calldata = erc721Asset.interface.encodeFunctionData("transferFrom", [bbaccount1.address, user2.address, tokenId]);
      let tx = await bbaccount1.connect(user1).execute(erc721Asset.address, 0, calldata, 0);
      expect(await erc721Asset.ownerOf(tokenId)).eq(user2.address);
      let state2 = await bbaccount1.state();
      expect(state2.sub(state1)).eq(1);
      l1DataFeeAnalyzer.register("execute transfer ERC721", tx);
    });
    //it("owner can send ERC1155", async function () {});
    it("can multicall execute", async function () {
      let state1 = await bbaccount1.state();
      let ethBal11 = await provider.getBalance(bbaccount1.address);
      let ethBal12 = await provider.getBalance(user2.address);
      let erc20Bal11 = await erc20a.balanceOf(bbaccount1.address);
      let erc20Bal12 = await erc20a.balanceOf(user2.address);
      let ethTransferAmount = WeiPerEther.div(25);
      let erc20TransferAmount = WeiPerEther.mul(500);
      let txdata0 = bbaccount1.interface.encodeFunctionData("execute", [user2.address, ethTransferAmount, "0x", 0])
      let erc20Calldata = erc20a.interface.encodeFunctionData("transfer", [user2.address, erc20TransferAmount]);
      let txdata1 = bbaccount1.interface.encodeFunctionData("execute", [erc20a.address, 0, erc20Calldata, 0]);
      let txdatas = [txdata0, txdata1];
      let tx = await bbaccount1.connect(user1).multicall(txdatas);
      let ethBal21 = await provider.getBalance(bbaccount1.address);
      let ethBal22 = await provider.getBalance(user2.address);
      let erc20Bal21 = await erc20a.balanceOf(bbaccount1.address);
      let erc20Bal22 = await erc20a.balanceOf(user2.address);
      expect(ethBal22.sub(ethBal12)).eq(ethTransferAmount);
      expect(ethBal11.sub(ethBal21)).eq(ethTransferAmount);
      expect(erc20Bal22.sub(erc20Bal12)).eq(erc20TransferAmount);
      expect(erc20Bal11.sub(erc20Bal21)).eq(erc20TransferAmount);
      let state2 = await bbaccount1.state();
      expect(state2.sub(state1)).eq(2);
      l1DataFeeAnalyzer.register("execute multicall", tx);
    });
    it("is payable", async function () {
      let state1 = await bbaccount1.state();
      let ethBal11 = await provider.getBalance(bbaccount1.address);
      let ethPayableAmount = WeiPerEther.mul(3);
      let tx = await bbaccount1.connect(user1).execute(user2.address, 0, "0x", 0, {value: ethPayableAmount});
      let ethBal21 = await provider.getBalance(bbaccount1.address);
      expect(ethBal21.sub(ethBal11)).eq(ethPayableAmount);
      let state2 = await bbaccount1.state();
      expect(state2.sub(state1)).eq(1);
      l1DataFeeAnalyzer.register("execute payable", tx);
    });
    it("some functions are reenterable", async function () {
      let calldatas = [
        "0x", // receive
        accountProxy.interface.encodeFunctionData("dataStore", []),
        accountProxy.interface.encodeFunctionData("reentrancyGuardState", []),
        accountProxy.interface.encodeFunctionData("supportsInterface", [dummy1Sighash]),
        accountProxy.interface.encodeFunctionData("multicall", [[]]),
        inscribeSighash,
        inscribeSighash+"1234",
      ]
      for(const calldata of calldatas) {
        //console.log(`test some functions are reenterable ${calldata}`)
        let state1 = await bbaccount1.state();
        let tx = await bbaccount1.connect(user1).execute(bbaccount1.address, 0, calldata, 0);
        let state2 = await bbaccount1.state();
        expect(state2.sub(state1)).eq(1);
      }
    });
    it("some functions are not reenterable", async function () {
      let calldatas = [
        // erc6551 account
        accountProxy.interface.encodeFunctionData("owner", []),
        accountProxy.interface.encodeFunctionData("token", []),
        accountProxy.interface.encodeFunctionData("state", []),
        accountProxy.interface.encodeFunctionData("isValidSigner(address)", [user1.address]),
        accountProxy.interface.encodeFunctionData("isValidSigner(address,bytes)", [user1.address, "0x"]),
        accountProxy.interface.encodeFunctionData("isValidSignature", [toBytes32(0), "0x"]),
        accountProxy.interface.encodeFunctionData("execute", [accountProxy.address, 0, "0x", 0]), // execute -> execute
        // erc2535
        accountProxy.interface.encodeFunctionData("facets", []),
        accountProxy.interface.encodeFunctionData("facetFunctionSelectors", [erc2535Module.address]),
        accountProxy.interface.encodeFunctionData("facetAddresses", []),
        accountProxy.interface.encodeFunctionData("facetAddress", [dummy1Sighash]),
        accountProxy.interface.encodeFunctionData("diamondCut", [[], AddressZero, "0x"]),
        accountProxy.interface.encodeFunctionData("updateSupportedInterfaces", [[],[]]),
      ]
      for(const calldata of calldatas) {
        //console.log(`test some functions are not reenterable ${calldata}`)
        await expect(accountProxy.connect(user1).execute(accountProxy.address, 0, calldata, 0)).to.be.revertedWithCustomError(accountProxy, "ReentrancyGuard");
      }
    });
  });

  describe("install modules", function () {
    it("cannot be called by non owner", async function () {
      await expect(accountProxy.connect(user2).diamondCut([{
        facetAddress: fallbackModule.address,
        action: FacetCutAction.Add,
        functionSelectors: [dummy1Sighash]
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "ERC6551InvalidSigner");
    });
    it("cannot use invalid FacetCutAction", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: fallbackModule.address,
        action: 3,
        functionSelectors: [dummy1Sighash]
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "DelegateCallFailed");
    });
    it("cannot add zero functions", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: fallbackModule.address,
        action: FacetCutAction.Add,
        functionSelectors: []
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "LengthZero");
    });
    it("cannot add zero address facet", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: AddressZero,
        action: FacetCutAction.Add,
        functionSelectors: [dummy1Sighash]
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "AddressZero");
    });
    it("cannot add a not whitelisted module", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: fallbackModule.address,
        action: FacetCutAction.Add,
        functionSelectors: [diamondCutSighash]
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "ModuleNotWhitelisted");
    })
    it("can whitelist more modules", async function () {
      let modules = [
        {
          module: fallbackModule.address,
          shouldWhitelist: true,
        },
        {
          module: test1Module.address,
          shouldWhitelist: true,
        },
        {
          module: test2Module.address,
          shouldWhitelist: true,
        },
        {
          module: test3Module.address,
          shouldWhitelist: true,
        },
        {
          module: user2.address,
          shouldWhitelist: false,
        },
      ]
      let tx = await dataStore.connect(owner).setModuleWhitelist(modules)
      for(let m of modules) {
        expect(await dataStore.moduleIsWhitelisted(m.module)).to.eq(m.shouldWhitelist)
        expect(await dataStore.moduleCanBeInstalled(m.module)).to.eq(m.shouldWhitelist)
        await expect(tx).to.emit(dataStore, "ModuleWhitelisted").withArgs(m.module, m.shouldWhitelist)
      }
    })
    it("cannot add function that already exists", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: fallbackModule.address,
        action: FacetCutAction.Add,
        functionSelectors: [diamondCutSighash]
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "AddFunctionDuplicate");
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: fallbackModule.address,
        action: FacetCutAction.Add,
        functionSelectors: [multicallSighash]
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "AddFunctionDuplicate");
    });
    it("cannot init to non contract", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: fallbackModule.address,
        action: FacetCutAction.Add,
        functionSelectors: [dummy1Sighash]
      }], user1.address, "0x")).to.be.revertedWithCustomError(accountProxy, "NotAContract");
    });
    it("cannot init to non whitelisted module", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: fallbackModule.address,
        action: FacetCutAction.Add,
        functionSelectors: [dummy1Sighash]
      }], fallbackModule2.address, "0xabcdef12")).to.be.revertedWithCustomError(accountProxy, "ModuleNotWhitelisted");
    });
    it("cannot add if init fails", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: fallbackModule.address,
        action: FacetCutAction.Add,
        functionSelectors: [dummy1Sighash]
      }], revertModule.address, revertModule.interface.encodeFunctionData("revertWithReason()"))).to.be.revertedWithCustomError(accountProxy, "RevertWithReason");
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: fallbackModule.address,
        action: FacetCutAction.Add,
        functionSelectors: [dummy1Sighash]
      }], revertModule.address, revertModule.interface.encodeFunctionData("revertWithoutReason()"))).to.be.revertedWithCustomError(accountProxy, "DelegateCallFailed");
    });
    it("can add functions from a known facet", async function () {
      let tx = await accountProxy.connect(user1).diamondCut([{
        facetAddress: fallbackModule.address,
        action: FacetCutAction.Add,
        functionSelectors: [dummy1Sighash]
      }], AddressZero, "0x");
      await expect(tx).to.emit(accountProxy, "DiamondCut");
    });
    it("can add functions from a new facet", async function () {
      let tx = await accountProxy.connect(user1).diamondCut([{
        facetAddress: fallbackModule.address,
        action: FacetCutAction.Add,
        functionSelectors: [dummy2Sighash]
      }], fallbackModule.address, dummy1Sighash, {value: 1}); // and delegatecall
      await expect(tx).to.emit(accountProxy, "DiamondCut");
    });
  });

  describe("remove modules", function () {
    before("add modules", async function () {
      // add test1Module
      await accountProxy.connect(user1).diamondCut([{
        facetAddress: test1Module.address,
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(test1Module)
      }], AddressZero, "0x", {value: 1});
      let test1Selectors = [testFunc1Sighash, testFunc2Sighash, testFunc3Sighash];
      let result = await accountProxy.facetFunctionSelectors(test1Module.address)
      assert.sameMembers(result, test1Selectors);
      await expect(await accountProxy.testFunc1()).to.emit(accountProxy, "Test1Event").withArgs(1);
      await expect(await accountProxy.testFunc2()).to.emit(accountProxy, "Test1Event").withArgs(2);
      await expect(await accountProxy.testFunc3()).to.emit(accountProxy, "Test1Event").withArgs(3);
    });
    it("cannot be called by non owner", async function () {
      await expect(accountProxy.connect(user2).diamondCut([{
        facetAddress: AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: [dummy1Sighash]
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "ERC6551InvalidSigner");
    });
    it("cannot use invalid FacetCutAction", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: AddressZero,
        action: 3,
        functionSelectors: [dummy1Sighash]
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "DelegateCallFailed");
    });
    it("cannot remove zero functions", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: []
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "LengthZero");
    });
    it("cannot remove nonzero address facet", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: accountProxy.address,
        action: FacetCutAction.Remove,
        functionSelectors: [dummy1Sighash]
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "AddressNotZero");
    });
    it("cannot remove function that doesn't exist", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: [dummy3Sighash]
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "RemoveFunctionDoesNotExist");
    });
    it("cannot init to non contract", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: [testFunc1Sighash]
      }], user1.address, "0x")).to.be.revertedWithCustomError(accountProxy, "NotAContract");
    });
    it("cannot init to non whitelisted module", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: [testFunc1Sighash]
      }], fallbackModule2.address, "0xabcdef12")).to.be.revertedWithCustomError(accountProxy, "ModuleNotWhitelisted");
    });
    it("cannot remove if init fails", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: [testFunc1Sighash]
      }], revertModule.address, revertModule.interface.encodeFunctionData("revertWithReason()"))).to.be.revertedWithCustomError(accountProxy, "RevertWithReason");
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: [testFunc1Sighash]
      }], revertModule.address, revertModule.interface.encodeFunctionData("revertWithoutReason()"))).to.be.revertedWithCustomError(accountProxy, "DelegateCallFailed");
    });
    it("can remove functions", async function () {
      let tx = await accountProxy.connect(user1).diamondCut([{
        facetAddress: AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: [testFunc1Sighash]
      }], AddressZero, "0x", {value: 1});
      await expect(tx).to.emit(accountProxy, "DiamondCut");
      let test1Selectors = [testFunc2Sighash, testFunc3Sighash];
      let result = await accountProxy.facetFunctionSelectors(test1Module.address)
      assert.sameMembers(result, test1Selectors);
    });
    it("cannot remove function twice", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: [testFunc1Sighash]
      }], user1.address, "0x")).to.be.revertedWithCustomError(accountProxy, "RemoveFunctionDoesNotExist");
    });
    it("can remove multiple functions", async function () {
      let tx = await accountProxy.connect(user1).diamondCut([{
        facetAddress: AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: [testFunc2Sighash, testFunc3Sighash]
      }], AddressZero, "0x", {value: 1});
      await expect(tx).to.emit(accountProxy, "DiamondCut");
      let test1Selectors:string[] = [];
      let result = await accountProxy.facetFunctionSelectors(test1Module.address)
      assert.sameMembers(result, test1Selectors);
    });
    it("cannot remove an immutable function", async function () {
      // add immutable function => facet address == diamond address
      await dataStore.connect(owner).setModuleWhitelist([{
        module: accountProxy.address,
        shouldWhitelist: true,
      }])
      await accountProxy.connect(user1).diamondCut([{
        facetAddress: accountProxy.address,
        action: FacetCutAction.Add,
        functionSelectors: [dummy3Sighash]
      }], AddressZero, "0x", {value: 1});
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: [dummy3Sighash]
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "RemoveFunctionImmutable");
    });
    it("can remove facets", async function () {
      // add facets
      await accountProxy.connect(user1).diamondCut([{
        facetAddress: test1Module.address,
        action: FacetCutAction.Add,
        functionSelectors: [testFunc1Sighash]
      },{
        facetAddress: test2Module.address,
        action: FacetCutAction.Add,
        functionSelectors: [testFunc2Sighash]
      }], AddressZero, "0x", {value: 1});
      let facets0 = await accountProxy.facetAddresses();
      //accountProxy = await ethers.getContractAt(artifacts.Test2Module.abi, accountProxy.address) as Test2Module;
      let result11 = await accountProxy.facetFunctionSelectors(test1Module.address)
      assert.sameMembers(result11, [testFunc1Sighash]);
      let result12 = await accountProxy.facetFunctionSelectors(test2Module.address)
      assert.sameMembers(result12, [testFunc2Sighash]);
      let facets1 = await accountProxy.facetAddresses();
      //expect(facets1.length).eq(6);
      //expect(facets0.length-facets1.length).eq(1);
      // remove facets
      await accountProxy.connect(user1).diamondCut([{
        facetAddress: AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: [testFunc1Sighash]
      },{
        facetAddress: AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: [testFunc2Sighash]
      }], AddressZero, "0x", {value: 1});
      let result21 = await accountProxy.facetFunctionSelectors(test1Module.address)
      assert.sameMembers(result21, []);
      let result22 = await accountProxy.facetFunctionSelectors(test2Module.address)
      assert.sameMembers(result22, []);
      let facets2 = await accountProxy.facetAddresses();
      //expect(facets2.length).eq(4);
      expect(facets1.length-facets2.length).eq(2);
    });
  });

  describe("replace modules", function () {
    before("add modules", async function () {
      // add test1Module
      await accountProxy.connect(user1).diamondCut([{
        facetAddress: test1Module.address,
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(test1Module)
      }], AddressZero, "0x", {value: 1});
      let test1Selectors = [testFunc1Sighash, testFunc2Sighash, testFunc3Sighash];
      let result = await accountProxy.facetFunctionSelectors(test1Module.address)
      assert.sameMembers(result, test1Selectors);
      await expect(await accountProxy.testFunc1()).to.emit(accountProxy, "Test1Event").withArgs(1);
      await expect(await accountProxy.testFunc2()).to.emit(accountProxy, "Test1Event").withArgs(2);
      await expect(await accountProxy.testFunc3()).to.emit(accountProxy, "Test1Event").withArgs(3);
    });
    it("cannot be called by non owner", async function () {
      await expect(accountProxy.connect(user2).diamondCut([{
        facetAddress: test2Module.address,
        action: FacetCutAction.Replace,
        functionSelectors: [testFunc1Sighash]
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "ERC6551InvalidSigner");
    });
    it("cannot use invalid FacetCutAction", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: test2Module.address,
        action: 3,
        functionSelectors: [testFunc1Sighash]
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "DelegateCallFailed");
    });
    it("cannot replace zero functions", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: test2Module.address,
        action: FacetCutAction.Replace,
        functionSelectors: []
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "LengthZero");
    });
    it("cannot replace zero address facet", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: AddressZero,
        action: FacetCutAction.Replace,
        functionSelectors: [testFunc1Sighash]
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "AddressZero");
    });
    it("cannot replace function that doesn't exist", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: test2Module.address,
        action: FacetCutAction.Replace,
        functionSelectors: [dummy4Sighash]
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "RemoveFunctionDoesNotExist");
    });
    it("cannot replace function with same facet", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: test1Module.address,
        action: FacetCutAction.Replace,
        functionSelectors: [testFunc1Sighash]
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "ReplaceFunctionSame");
    });
    it("cannot init to non contract", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: test2Module.address,
        action: FacetCutAction.Replace,
        functionSelectors: [testFunc1Sighash]
      }], user1.address, "0x")).to.be.revertedWithCustomError(accountProxy, "NotAContract");
    });
    it("cannot init to non whitelisted module", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: fallbackModule2.address,
        action: FacetCutAction.Replace,
        functionSelectors: [dummy1Sighash]
      }], fallbackModule2.address, "0xabcdef12")).to.be.revertedWithCustomError(accountProxy, "ModuleNotWhitelisted");
    });
    it("cannot replace if init fails", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: test2Module.address,
        action: FacetCutAction.Replace,
        functionSelectors: [testFunc1Sighash]
      }], revertModule.address, revertModule.interface.encodeFunctionData("revertWithReason()"))).to.be.revertedWithCustomError(accountProxy, "RevertWithReason");
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: test2Module.address,
        action: FacetCutAction.Replace,
        functionSelectors: [testFunc1Sighash]
      }], revertModule.address, revertModule.interface.encodeFunctionData("revertWithoutReason()"))).to.be.revertedWithCustomError(accountProxy, "DelegateCallFailed");
    });
    it("can replace functions", async function () {
      let tx = await accountProxy.connect(user1).diamondCut([{
        facetAddress: test2Module.address,
        action: FacetCutAction.Replace,
        functionSelectors: [testFunc1Sighash]
      }], AddressZero, "0x", {value: 1});
      await expect(tx).to.emit(accountProxy, "DiamondCut");
      let test1Selectors = [testFunc2Sighash, testFunc3Sighash];
      let result1 = await accountProxy.facetFunctionSelectors(test1Module.address)
      assert.sameMembers(result1, test1Selectors);
      let test2Selectors = [testFunc1Sighash];
      let result2 = await accountProxy.facetFunctionSelectors(test2Module.address)
      assert.sameMembers(result2, test2Selectors);
      await expect(await accountProxy.testFunc1()).to.emit(accountProxy, "Test2Event").withArgs(1);
      await expect(await accountProxy.testFunc2()).to.emit(accountProxy, "Test1Event").withArgs(2);
      await expect(await accountProxy.testFunc3()).to.emit(accountProxy, "Test1Event").withArgs(3);
    });
    it("can replace multiple functions", async function () {
      let facets1 = await accountProxy.facetAddresses();
      //expect(facets1.length).eq(6);
      let tx = await accountProxy.connect(user1).diamondCut([{
        facetAddress: test2Module.address,
        action: FacetCutAction.Replace,
        functionSelectors: [testFunc2Sighash, testFunc3Sighash]
      }], AddressZero, "0x", {value: 1});
      await expect(tx).to.emit(accountProxy, "DiamondCut");
      let test1Selectors:string[] = [];
      let result1 = await accountProxy.facetFunctionSelectors(test1Module.address)
      assert.sameMembers(result1, test1Selectors);
      let test2Selectors = [testFunc1Sighash, testFunc2Sighash, testFunc3Sighash];
      let result2 = await accountProxy.facetFunctionSelectors(test2Module.address)
      assert.sameMembers(result2, test2Selectors);
      await expect(await accountProxy.testFunc1()).to.emit(accountProxy, "Test2Event").withArgs(1);
      await expect(await accountProxy.testFunc2()).to.emit(accountProxy, "Test2Event").withArgs(2);
      await expect(await accountProxy.testFunc3()).to.emit(accountProxy, "Test2Event").withArgs(3);
      let facets2 = await accountProxy.facetAddresses();
      //expect(facets2.length).eq(5);
      expect(facets1.length-facets2.length).eq(1);
    });
    it("cannot replace an immutable function", async function () {
      await expect(accountProxy.connect(user1).diamondCut([{
        facetAddress: test2Module.address,
        action: FacetCutAction.Replace,
        functionSelectors: [dummy3Sighash]
      }], AddressZero, "0x")).to.be.revertedWithCustomError(accountProxy, "RemoveFunctionImmutable");
    });
  });

  describe("account execution pt 2", function () {
    it("cannot call function that does not exist", async function () {
      //await expect(accountProxy.connect(user1).execute(user2.address, WeiPerEther.mul(9999), "0x", 0)).to.be.reverted;
      //await expect(accountProxy.connect(user1).execute(revertModule.address, 0, revertModule.interface.encodeFunctionData("revertWithReason", []), 0)).to.be.revertedWithCustomError(accountProxy, "RevertWithReason");
      //await expect(bbaccount1.connect(user1).execute(revertModule.address, 0, revertModule.interface.encodeFunctionData("revertWithoutReason", []), 0)).to.be.reverted;
      await expect(user1.sendTransaction({
        to: accountProxy.address,
        data: dummy4Sighash
      })).to.be.revertedWithCustomError(accountProxy, "FunctionDoesNotExist");
      await expect(accountProxy.testFunc4()).to.be.revertedWithCustomError(accountProxy, "FunctionDoesNotExist");
      let txdata = test3Module.interface.encodeFunctionData("testFunc4", []);
      await expect(accountProxy.multicall([])).to.not.be.reverted;
      await expect(accountProxy.multicall([txdata])).to.be.revertedWithCustomError(accountProxy, "FunctionDoesNotExist");
    });
    it("non owner cannot updateSupportedInterfaces", async function () {
      await expect(accountProxy.connect(user2).updateSupportedInterfaces([], [])).to.be.revertedWithCustomError(accountProxy, "ERC6551InvalidSigner");
    });
    it("cannot updateSupportedInterfaces with length mismatch", async function () {
      //await accountProxy.connect(user1).updateSupportedInterfaces([], [true])
      await expect(accountProxy.connect(user1).updateSupportedInterfaces([], [true])).to.be.revertedWithCustomError(accountProxy, "LengthMismatch")
    });
    it("can updateSupportedInterfaces", async function () {
      expect(await accountProxy.supportsInterface(dummy1Sighash)).to.be.false;
      expect(await accountProxy.supportsInterface(dummy2Sighash)).to.be.false;
      let tx = await accountProxy.connect(user1).updateSupportedInterfaces([dummy1Sighash, dummy2Sighash], [true, false]);
      await expect(tx).to.emit(accountProxy, "InterfaceSupportUpdated").withArgs(dummy1Sighash, true);
      await expect(tx).to.emit(accountProxy, "InterfaceSupportUpdated").withArgs(dummy2Sighash, false);
      expect(await accountProxy.supportsInterface(dummy1Sighash)).to.be.true;
      expect(await accountProxy.supportsInterface(dummy2Sighash)).to.be.false;
    });
  });

  describe("account receiving pt 2", function () {
    it("cannot transfer bot nft to bot account", async function () {
      // only handles ownership cycle if one layer deep. can be greater
      // only triggers on safeTransferFrom
      await expect(boomBotsNft.connect(user1)['safeTransferFrom(address,address,uint256)'](user1.address, accountProxy.address, 1)).to.be.revertedWithCustomError(accountProxy, "OwnershipCycle");
      await expect(boomBotsNft.connect(user1)['safeTransferFrom(address,address,uint256,bytes)'](user1.address, accountProxy.address, 1, "0x")).to.be.revertedWithCustomError(accountProxy, "OwnershipCycle");
      // does not trigger on unsafe transferFrom
      let tx = await boomBotsNft.connect(user1).transferFrom(user1.address, accountProxy.address, 1)
      expect(await boomBotsNft.ownerOf(1)).eq(accountProxy.address)
    });
  });

  describe("L1 gas fees", function () {
    it("calculate", async function () {
      l1DataFeeAnalyzer.analyze()
    });
  });
});
