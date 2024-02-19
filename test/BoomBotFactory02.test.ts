/* global describe it before ethers */

import hre from "hardhat";
const { ethers } = hre;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
const { expect, assert } = chai;

import { IERC6551Registry, ERC6551Account, BoomBots, BoomBotAccount, ERC2535Module, ERC6551AccountModule, MulticallModule, ERC165Module, FallbackModule, RevertModule, Pack100, BoomBotsFactory01, BoomBotFactory02, MockERC20, MockERC721, DataStore, RevertAccount, MockERC1271, GasCollector } from "./../typechain-types";

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
const BLAST_ADDRESS            = "0x4300000000000000000000000000000000000002";

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

describe("BoomBotFactory02", function () {
  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let user4: SignerWithAddress;
  let user5: SignerWithAddress;

  let erc6551Registry: IERC6551Registry;

  let gasCollector: GasCollector;
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
  let revertModule: RevertModule;
  let revertAccount: RevertAccount;
  // diamond cuts
  let diamondCutInits: any[] = [];
  for(let i = 0; i < 20; i++) diamondCutInits.push([])
  let botInitializationCode1: any;
  let botInitializationCode2: any;
  // factory
  let factory: BoomBotFactory02;

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
      //"artifacts/contracts/mocks/accounts/MockBlastableAccount.sol/MockBlastableAccount.json",
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
    it("can deploy gas collector", async function () {
      gasCollector = await deployContract(deployer, "GasCollector", [owner.address, BLAST_ADDRESS]);
      await expectDeployed(gasCollector.address);
      expect(await gasCollector.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy GasCollector", gasCollector.deployTransaction);
    })
    it("can deploy BoomBots ERC721", async function () {
      // to deployer
      boomBotsNft = await deployContract(deployer, "BoomBots", [deployer.address, BLAST_ADDRESS, gasCollector.address, ERC6551_REGISTRY_ADDRESS]) as BoomBots;
      await expectDeployed(boomBotsNft.address);
      expect(await boomBotsNft.owner()).eq(deployer.address);
      l1DataFeeAnalyzer.register("deploy Boombots", boomBotsNft.deployTransaction);
      // to owner
      boomBotsNft = await deployContract(deployer, "BoomBots", [owner.address, BLAST_ADDRESS, gasCollector.address, ERC6551_REGISTRY_ADDRESS]) as BoomBots;
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
      // ERC6551Account
      erc6551AccountImplementation = await deployContract(deployer, "ERC6551Account") as ERC6551Account;
      await expectDeployed(erc6551AccountImplementation.address);
      l1DataFeeAnalyzer.register("deploy ERC6551Account impl", erc6551AccountImplementation.deployTransaction);
      // BooomBotAccount
      boomBotAccountImplementation = await deployContract(deployer, "BoomBotAccount", [BLAST_ADDRESS, deployer.address]) as BoomBotAccount;
      await expectDeployed(boomBotAccountImplementation.address);
      l1DataFeeAnalyzer.register("deploy BoomBotAccount impl", boomBotAccountImplementation.deployTransaction);
    });
    it("can deploy data store", async function () {
      // to deployer
      dataStore = await deployContract(deployer, "DataStore", [deployer.address, BLAST_ADDRESS, gasCollector.address]);
      await expectDeployed(dataStore.address);
      expect(await dataStore.owner()).eq(deployer.address);
      l1DataFeeAnalyzer.register("deploy DataStore", dataStore.deployTransaction);
      // to owner
      dataStore = await deployContract(deployer, "DataStore", [owner.address, BLAST_ADDRESS, gasCollector.address]);
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
      // RevertModule
      revertModule = await deployContract(deployer, "RevertModule", []) as RevertModule;
      await expectDeployed(revertModule.address);
      l1DataFeeAnalyzer.register("deploy RevertModule impl", revertModule.deployTransaction);
    });
    it("can deploy BoomBotsFactory02", async function () {
      // to deployer
      factory = await deployContract(deployer, "BoomBotsFactory02", [deployer.address, BLAST_ADDRESS, gasCollector.address, boomBotsNft.address]) as BoomBotsFactory02;
      await expectDeployed(factory.address);
      expect(await factory.owner()).eq(deployer.address);
      l1DataFeeAnalyzer.register("deploy BoomBotsFactory02", factory.deployTransaction);
      // to owner
      factory = await deployContract(deployer, "BoomBotsFactory02", [owner.address, BLAST_ADDRESS, gasCollector.address, boomBotsNft.address]) as BoomBotsFactory02;
      await expectDeployed(factory.address);
      expect(await factory.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy BoomBotsFactory02", factory.deployTransaction);
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
    it("cannot getBotCreationSettings with invalid creationSettingsID pt 1", async function () {
      expect(await factory.getBotCreationSettingsCount()).eq(0)
      await expect(factory.getBotCreationSettings(0)).to.be.revertedWithCustomError(factory, "OutOfRange")
      await expect(factory.getBotCreationSettings(1)).to.be.revertedWithCustomError(factory, "OutOfRange")
      await expect(factory.getBotCreationSettings(2)).to.be.revertedWithCustomError(factory, "OutOfRange")
      await expect(factory.getBotCreationSettings(999)).to.be.revertedWithCustomError(factory, "OutOfRange")
    })
    it("cannot createBot with invalid creationSettingsID pt 1", async function () {
      await expect(factory['createBot(uint256)'](0)).to.be.revertedWithCustomError(factory, "OutOfRange")
      await expect(factory['createBot(uint256,bytes[])'](0, [])).to.be.revertedWithCustomError(factory, "OutOfRange")
      await expect(factory['createBot(uint256,address)'](0, user1.address)).to.be.revertedWithCustomError(factory, "OutOfRange")
      await expect(factory['createBot(uint256,bytes[],address)'](0, [], user1.address)).to.be.revertedWithCustomError(factory, "OutOfRange")
      await expect(factory['createBot(uint256)'](1)).to.be.revertedWithCustomError(factory, "OutOfRange")
      await expect(factory['createBot(uint256,bytes[])'](1, [])).to.be.revertedWithCustomError(factory, "OutOfRange")
      await expect(factory['createBot(uint256,address)'](1, user1.address)).to.be.revertedWithCustomError(factory, "OutOfRange")
      await expect(factory['createBot(uint256,bytes[],address)'](1, [], user1.address)).to.be.revertedWithCustomError(factory, "OutOfRange")
    })
    it("can non owner cannot postBotCreationSettings", async function () {
      let params = {
        botImplementation: boomBotAccountImplementation.address,
        initializationCalls: [],
        isPaused: false,
        giveTokenList: [],
        giveTokenAmounts: [],
      }
      await expect(factory.connect(user1).postBotCreationSettings(params)).to.be.revertedWithCustomError(factory, "NotContractOwner")
    })
    it("cannot postBotCreationSettings with non contract", async function () {
      let params = {
        botImplementation: user1.address,
        initializationCalls: [],
        isPaused: false,
        giveTokenList: [],
        giveTokenAmounts: [],
      }
      await expect(factory.connect(owner).postBotCreationSettings(params)).to.be.revertedWithCustomError(factory, "NotAContract")
    })
    it("owner can postBotCreationSettings", async function () {
      let params = {
        botImplementation: boomBotAccountImplementation.address,
        initializationCalls: [],
        isPaused: false,
        giveTokenList: [],
        giveTokenAmounts: [],
      }
      let tx = await factory.connect(owner).postBotCreationSettings(params)
      expect(await factory.getBotCreationSettingsCount()).eq(1)
      let res = await factory.getBotCreationSettings(1)
      expect(res.botImplementation).eq(params.botImplementation)
      expect(res.initializationCalls.length).eq(params.initializationCalls.length)
      expect(res.isPaused).eq(params.isPaused)
      expect(res.giveTokenList).deep.eq(params.giveTokenList)
      expect(res.giveTokenAmounts).deep.eq(params.giveTokenAmounts)
      await expect(tx).to.emit(factory, "BotCreationSettingsPosted").withArgs(1)
      await expect(tx).to.emit(factory, "BotCreationSettingsPaused").withArgs(1, params.isPaused)

      await expect(factory.getBotCreationSettings(0)).to.be.revertedWithCustomError(factory, "OutOfRange")
      await expect(factory.getBotCreationSettings(2)).to.be.revertedWithCustomError(factory, "OutOfRange")
    })
    it("can create bot pt 2", async function () {
      let ts = await boomBotsNft.totalSupply();
      let bal = await boomBotsNft.balanceOf(user1.address);
      let botID = ts.add(1);
      let botRes = await factory.connect(user1).callStatic['createBot(uint256)'](1);
      expect(botRes.botID).eq(botID);
      expect(await boomBotsNft.exists(botID)).eq(false);
      //await expect(boomBotsNft.getBotID(botRes.botAddress)).to.be.revertedWithCustomError(boomBotsNft, "BotDoesNotExist");
      expect(await boomBotsNft.getBotID(botRes.botAddress)).eq(0);
      expect(await boomBotsNft.isAddressBot(botRes.botAddress)).eq(false);
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
      expect(await boomBotsNft.getBotID(botInfo.botAddress)).eq(botID);
      expect(await boomBotsNft.isAddressBot(botInfo.botAddress)).eq(true);
      let isDeployed2 = await isDeployed(botInfo.botAddress)
      expect(isDeployed2).to.be.true;
      expect(botInfo.implementationAddress).eq(boomBotAccountImplementation.address);
      tbaccount2 = await ethers.getContractAt("BoomBotAccount", botInfo.botAddress) as BoomBotAccount;
      l1DataFeeAnalyzer.register("createBot", tx);
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
      let botRes = await factory.connect(user1).callStatic['createBot(uint256)'](1);
      expect(botRes.botID).eq(botID);
      expect(await boomBotsNft.exists(botID)).eq(false);
      //await expect(boomBotsNft.getBotID(botRes.botAddress)).to.be.revertedWithCustomError(boomBotsNft, "BotDoesNotExist");
      expect(await boomBotsNft.getBotID(botRes.botAddress)).eq(0);
      expect(await boomBotsNft.isAddressBot(botRes.botAddress)).eq(false);
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
    it("non owner cannot pause", async function () {
      await expect(factory.connect(user1).setPaused(1, true)).to.be.revertedWithCustomError(factory, "NotContractOwner")
      await expect(factory.connect(user1).setPaused(1, false)).to.be.revertedWithCustomError(factory, "NotContractOwner")
    })
    it("cannot pause non existing creationSettingsID", async function () {
      await expect(factory.connect(owner).setPaused(0, true)).to.be.revertedWithCustomError(factory, "OutOfRange")
      await expect(factory.connect(owner).setPaused(0, false)).to.be.revertedWithCustomError(factory, "OutOfRange")
      await expect(factory.connect(owner).setPaused(999, true)).to.be.revertedWithCustomError(factory, "OutOfRange")
      await expect(factory.connect(owner).setPaused(999, false)).to.be.revertedWithCustomError(factory, "OutOfRange")
    })
    it("owner can pause", async function () {
      let settings1 = await factory.getBotCreationSettings(1);
      expect(settings1.isPaused).eq(false)
      let tx = await factory.connect(owner).setPaused(1, true)
      await expect(tx).to.emit(factory, "BotCreationSettingsPaused").withArgs(1, true)
      let settings2 = await factory.getBotCreationSettings(1);
      expect(settings2.isPaused).eq(true)
    })
    it("cannot create bot while creation settings paused", async function () {
      await expect(factory.connect(user1)['createBot(uint256)'](1)).to.be.revertedWithCustomError(factory, "CreationSettingsPaused")
      await expect(factory.connect(user1)['createBot(uint256,address)'](1,user1.address)).to.be.revertedWithCustomError(factory, "CreationSettingsPaused")
      await expect(factory.connect(user1)['createBot(uint256,bytes[])'](1,[])).to.be.revertedWithCustomError(factory, "CreationSettingsPaused")
      await expect(factory.connect(user1)['createBot(uint256,bytes[],address)'](1,[],user1.address)).to.be.revertedWithCustomError(factory, "CreationSettingsPaused")
    })
    it("owner can postBotCreationSettings pt 2", async function () {
      let params = {
        botImplementation: boomBotAccountImplementation.address,
        initializationCalls: [],
        isPaused: false,
        giveTokenList: [],
        giveTokenAmounts: [],
      }
      let tx = await factory.connect(owner).postBotCreationSettings(params)
      expect(await factory.getBotCreationSettingsCount()).eq(2)
      let res = await factory.getBotCreationSettings(2)
      expect(res.botImplementation).eq(params.botImplementation)
      expect(res.initializationCalls.length).eq(params.initializationCalls.length)
      expect(res.isPaused).eq(params.isPaused)
      expect(res.giveTokenList).deep.eq(params.giveTokenList)
      expect(res.giveTokenAmounts).deep.eq(params.giveTokenAmounts)
      await expect(tx).to.emit(factory, "BotCreationSettingsPosted").withArgs(2)
      await expect(tx).to.emit(factory, "BotCreationSettingsPaused").withArgs(2, params.isPaused)

      await expect(factory.getBotCreationSettings(0)).to.be.revertedWithCustomError(factory, "OutOfRange")
      await expect(factory.getBotCreationSettings(3)).to.be.revertedWithCustomError(factory, "OutOfRange")
    })
    it("can create bot pt 4", async function () {
      let ts = await boomBotsNft.totalSupply();
      let bal = await boomBotsNft.balanceOf(user1.address);
      let botID = ts.add(1);
      let botRes = await factory.connect(user1).callStatic['createBot(uint256)'](2);
      expect(botRes.botID).eq(botID);
      expect(await boomBotsNft.exists(botID)).eq(false);
      //await expect(boomBotsNft.getBotID(botRes.botAddress)).to.be.revertedWithCustomError(boomBotsNft, "BotDoesNotExist");
      expect(await boomBotsNft.getBotID(botRes.botAddress)).eq(0);
      expect(await boomBotsNft.isAddressBot(botRes.botAddress)).eq(false);
      let isDeployed1 = await isDeployed(botRes.botAddress)
      expect(isDeployed1).to.be.false;
      let tx = await factory.connect(user1)['createBot(uint256)'](2);
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
      var settings = await factory.getBotCreationSettings(1);
      var { botImplementation, initializationCalls, isPaused } = settings
      //console.log(settings)
      expect(botImplementation).eq(boomBotAccountImplementation.address)
    });
    it("can create bot pt 7", async function () {
      let ts = await boomBotsNft.totalSupply();
      let bal = await boomBotsNft.balanceOf(user1.address);
      let botID = ts.add(1);
      let extraData = [] // no data
      let botRes = await factory.connect(user1).callStatic['createBot(uint256,bytes[])'](2,extraData);
      expect(botRes.botID).eq(botID);
      expect(await boomBotsNft.exists(botID)).eq(false);
      //await expect(boomBotsNft.getBotID(botRes.botAddress)).to.be.revertedWithCustomError(boomBotsNft, "BotDoesNotExist");
      expect(await boomBotsNft.getBotID(botRes.botAddress)).eq(0);
      expect(await boomBotsNft.isAddressBot(botRes.botAddress)).eq(false);
      let isDeployed1 = await isDeployed(botRes.botAddress)
      expect(isDeployed1).to.be.false;
      let tx = await factory.connect(user1)['createBot(uint256,bytes[])'](2,extraData);
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
      let extraData = ["0x"] // single call to receive
      let botRes = await factory.connect(user1).callStatic['createBot(uint256,bytes[])'](2,extraData);
      expect(botRes.botID).eq(botID);
      expect(await boomBotsNft.exists(botID)).eq(false);
      //await expect(boomBotsNft.getBotID(botRes.botAddress)).to.be.revertedWithCustomError(boomBotsNft, "BotDoesNotExist");
      expect(await boomBotsNft.getBotID(botRes.botAddress)).eq(0);
      expect(await boomBotsNft.isAddressBot(botRes.botAddress)).eq(false);
      let isDeployed1 = await isDeployed(botRes.botAddress)
      expect(isDeployed1).to.be.false;
      let tx = await factory.connect(user1)['createBot(uint256,bytes[])'](2,extraData);
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
      await expect(factory.connect(user1)['createBot(uint256,bytes[])'](1,["0x1"])).to.be.revertedWithCustomError;
      await expect(factory.connect(user1)['createBot(uint256,bytes[])'](1,["0x12"])).to.be.revertedWithCustomError;
      await expect(factory.connect(user1)['createBot(uint256,bytes[])'](1,["0x12345678"])).to.be.revertedWithCustomError;
      await expect(factory.connect(user1)['createBot(uint256,bytes[])'](1,["0x1234567800000000000"])).to.be.revertedWithCustomError;
      await expect(factory.connect(user1)['createBot(uint256,bytes[])'](1,[multicallSighash+"a"])).to.be.revertedWithCustomError;
      await expect(factory.connect(user1)['createBot(uint256,bytes[])'](1,[multicallSighash+"ab"])).to.be.revertedWithCustomError;
      await expect(factory.connect(user1)['createBot(uint256,bytes[],address)'](1,["0x1"],user1.address)).to.be.revertedWithCustomError;
      await expect(factory.connect(user1)['createBot(uint256,bytes[],address)'](1,["0x12"],user1.address)).to.be.revertedWithCustomError;
      await expect(factory.connect(user1)['createBot(uint256,bytes[],address)'](1,["0x12345678"],user1.address)).to.be.revertedWithCustomError;
      await expect(factory.connect(user1)['createBot(uint256,bytes[],address)'](1,["0x1234567800000000000"],user1.address)).to.be.revertedWithCustomError;
      await expect(factory.connect(user1)['createBot(uint256,bytes[],address)'](1,[multicallSighash+"a"],user1.address)).to.be.revertedWithCustomError;
      await expect(factory.connect(user1)['createBot(uint256,bytes[],address)'](1,[multicallSighash+"ab"],user1.address)).to.be.revertedWithCustomError;
    });
    it("owner can postBotCreationSettings pt 3", async function () {
      let diamondCut = [
        {
          facetAddress: modulePack100.address,
          action: FacetCutAction.Add,
          functionSelectors: calcSighashes(modulePack100, 'ModulePack100'),
        },
        {
          facetAddress: fallbackModule.address,
          action: FacetCutAction.Add,
          functionSelectors: [dummy1Sighash],
        },
      ]
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
        isPaused: false,
        giveTokenList: [],
        giveTokenAmounts: [],
      }
      let tx = await factory.connect(owner).postBotCreationSettings(params)
      expect(await factory.getBotCreationSettingsCount()).eq(3)
      let res = await factory.getBotCreationSettings(3)
      expect(res.botImplementation).eq(params.botImplementation)
      expect(res.initializationCalls.length).eq(params.initializationCalls.length)
      expect(res.isPaused).eq(params.isPaused)
      expect(res.giveTokenList).deep.eq(params.giveTokenList)
      expect(res.giveTokenAmounts).deep.eq(params.giveTokenAmounts)
      await expect(tx).to.emit(factory, "BotCreationSettingsPosted").withArgs(3)
      await expect(tx).to.emit(factory, "BotCreationSettingsPaused").withArgs(3, params.isPaused)
      diamondCut = [
        {
          facetAddress: boomBotAccountImplementation.address,
          action: FacetCutAction.Add,
          functionSelectors: calcSighashes(boomBotAccountImplementation, 'boomBotAccountImplementation'),
        },
      ].concat(diamondCut)
      diamondCutInits[9] = diamondCut
    })
    it("can create bot pt 9", async function () {
      let ts = await boomBotsNft.totalSupply();
      let bal = await boomBotsNft.balanceOf(user1.address);
      let botID = ts.add(1);
      let extraData = ["0x"] // single call to receive
      let botRes = await factory.connect(user1).callStatic['createBot(uint256,bytes[])'](3,extraData);
      expect(botRes.botID).eq(botID);
      expect(await boomBotsNft.exists(botID)).eq(false);
      //await expect(boomBotsNft.getBotID(botRes.botAddress)).to.be.revertedWithCustomError(boomBotsNft, "BotDoesNotExist");
      expect(await boomBotsNft.getBotID(botRes.botAddress)).eq(0);
      expect(await boomBotsNft.isAddressBot(botRes.botAddress)).eq(false);
      let isDeployed1 = await isDeployed(botRes.botAddress)
      expect(isDeployed1).to.be.false;
      let tx = await factory.connect(user1)['createBot(uint256,bytes[])'](3,extraData);
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
      diamondCutInits[9][0].facetAddress = botInfo.botAddress
    });
    it("owner can postBotCreationSettings pt 4", async function () {
      let diamondCut = [
        {
          facetAddress: modulePack100.address,
          action: FacetCutAction.Add,
          functionSelectors: calcSighashes(modulePack100, 'ModulePack100'),
        },
        {
          facetAddress: fallbackModule.address,
          action: FacetCutAction.Add,
          functionSelectors: [dummy1Sighash],
        },
      ]
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
        isPaused: false,
        giveTokenList: [],
        giveTokenAmounts: [],
      }
      let tx = await factory.connect(owner).postBotCreationSettings(params)
      expect(await factory.getBotCreationSettingsCount()).eq(4)
      let res = await factory.getBotCreationSettings(4)
      expect(res.botImplementation).eq(params.botImplementation)
      expect(res.initializationCalls.length).eq(params.initializationCalls.length)
      expect(res.isPaused).eq(params.isPaused)
      expect(res.giveTokenList).deep.eq(params.giveTokenList)
      expect(res.giveTokenAmounts).deep.eq(params.giveTokenAmounts)
      await expect(tx).to.emit(factory, "BotCreationSettingsPosted").withArgs(4)
      await expect(tx).to.emit(factory, "BotCreationSettingsPaused").withArgs(4, params.isPaused)
      diamondCut = [
        {
          facetAddress: boomBotAccountImplementation.address,
          action: FacetCutAction.Add,
          //functionSelectors: calcSighashes(boomBotAccountImplementation, 'boomBotAccountImplementation'),
          functionSelectors: calcSighashes(boomBotAccountImplementation, 'boomBotAccountImplementation'),
        },
      ].concat(diamondCut)
      diamondCutInits[10] = JSON.parse(JSON.stringify(diamondCut))
      diamondCutInits[11] = JSON.parse(JSON.stringify(diamondCut))
      diamondCutInits[12] = JSON.parse(JSON.stringify(diamondCut))
      diamondCutInits[13] = JSON.parse(JSON.stringify(diamondCut))
    })
    it("can create bot pt 10", async function () {
      let ts = await boomBotsNft.totalSupply();
      let bal = await boomBotsNft.balanceOf(user1.address);
      let botID = ts.add(1);
      let extraData = ["0x"] // single call to receive
      let botRes = await factory.connect(user1).callStatic['createBot(uint256,bytes[])'](4,extraData);
      expect(botRes.botID).eq(botID);
      expect(await boomBotsNft.exists(botID)).eq(false);
      //await expect(boomBotsNft.getBotID(botRes.botAddress)).to.be.revertedWithCustomError(boomBotsNft, "BotDoesNotExist");
      expect(await boomBotsNft.getBotID(botRes.botAddress)).eq(0);
      expect(await boomBotsNft.isAddressBot(botRes.botAddress)).eq(false);
      let isDeployed1 = await isDeployed(botRes.botAddress)
      expect(isDeployed1).to.be.false;
      let tx = await factory.connect(user1)['createBot(uint256,bytes[])'](4,extraData);
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
      diamondCutInits[10][0].facetAddress = botInfo.botAddress
    });
    it("can create bot pt 11", async function () {
      let ts = await boomBotsNft.totalSupply();
      let bal = await boomBotsNft.balanceOf(user1.address);
      let botID = ts.add(1);
      let extraData = ["0x", erc6551AccountImplementation.interface.encodeFunctionData("execute", [user1.address, 0, "0x", 0])] // more calls
      let botRes = await factory.connect(user1).callStatic['createBot(uint256,bytes[])'](4,extraData);
      expect(botRes.botID).eq(botID);
      expect(await boomBotsNft.exists(botID)).eq(false);
      //await expect(boomBotsNft.getBotID(botRes.botAddress)).to.be.revertedWithCustomError(boomBotsNft, "BotDoesNotExist");
      expect(await boomBotsNft.getBotID(botRes.botAddress)).eq(0);
      expect(await boomBotsNft.isAddressBot(botRes.botAddress)).eq(false);
      let isDeployed1 = await isDeployed(botRes.botAddress)
      expect(isDeployed1).to.be.false;
      let tx = await factory.connect(user1)['createBot(uint256,bytes[])'](4,extraData);
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
      diamondCutInits[11][0].facetAddress = botInfo.botAddress
    });
    it("can create bot pt 12", async function () {
      let ts = await boomBotsNft.totalSupply();
      let bal = await boomBotsNft.balanceOf(user2.address);
      let botID = ts.add(1);
      let botRes = await factory.connect(user1).callStatic['createBot(uint256,address)'](4,user2.address);
      expect(botRes.botID).eq(botID);
      expect(await boomBotsNft.exists(botID)).eq(false);
      //await expect(boomBotsNft.getBotID(botRes.botAddress)).to.be.revertedWithCustomError(boomBotsNft, "BotDoesNotExist");
      expect(await boomBotsNft.getBotID(botRes.botAddress)).eq(0);
      expect(await boomBotsNft.isAddressBot(botRes.botAddress)).eq(false);
      let isDeployed1 = await isDeployed(botRes.botAddress)
      expect(isDeployed1).to.be.false;
      let tx = await factory.connect(user1)['createBot(uint256,address)'](4,user2.address);
      await expect(tx).to.emit(boomBotsNft, "Transfer").withArgs(AddressZero, factory.address, botRes.botID);
      await expect(tx).to.emit(boomBotsNft, "Transfer").withArgs(factory.address, user2.address, botRes.botID);
      expect(await boomBotsNft.totalSupply()).eq(ts.add(1));
      expect(await boomBotsNft.balanceOf(user2.address)).eq(bal.add(1));
      expect(await boomBotsNft.exists(botID)).eq(true);
      expect(await boomBotsNft.ownerOf(botRes.botID)).eq(user2.address);
      let botInfo = await boomBotsNft.getBotInfo(botID);
      //expect(botInfo.botAddress).eq(botRes.botAddress); // may change
      expect(await boomBotsNft.getBotID(botInfo.botAddress)).eq(botID);
      expect(await boomBotsNft.isAddressBot(botInfo.botAddress)).eq(true);
      let isDeployed2 = await isDeployed(botInfo.botAddress)
      expect(isDeployed2).to.be.true;
      expect(botInfo.implementationAddress).eq(boomBotAccountImplementation.address);
      tbaccount2 = await ethers.getContractAt("BoomBotAccount", botInfo.botAddress) as BoomBotAccount;
      l1DataFeeAnalyzer.register("createBot", tx);
      diamondCutInits[12][0].facetAddress = botInfo.botAddress
    });
    it("can create bot pt 13", async function () {
      let ts = await boomBotsNft.totalSupply();
      let bal = await boomBotsNft.balanceOf(user2.address);
      let botID = ts.add(1);
      let extraData = ["0x"] // single call to receive
      let botRes = await factory.connect(user1).callStatic['createBot(uint256,bytes[],address)'](4,extraData,user2.address);
      expect(botRes.botID).eq(botID);
      expect(await boomBotsNft.exists(botID)).eq(false);
      //await expect(boomBotsNft.getBotID(botRes.botAddress)).to.be.revertedWithCustomError(boomBotsNft, "BotDoesNotExist");
      expect(await boomBotsNft.getBotID(botRes.botAddress)).eq(0);
      expect(await boomBotsNft.isAddressBot(botRes.botAddress)).eq(false);
      let isDeployed1 = await isDeployed(botRes.botAddress)
      expect(isDeployed1).to.be.false;
      await user3.sendTransaction({
        to: factory.address,
        value: 5
      })
      let tx = await factory.connect(user1)['createBot(uint256,bytes[],address)'](4,extraData,user2.address, { value: 70 });
      await expect(tx).to.emit(boomBotsNft, "Transfer").withArgs(AddressZero, factory.address, botRes.botID);
      await expect(tx).to.emit(boomBotsNft, "Transfer").withArgs(factory.address, user2.address, botRes.botID);
      expect(await boomBotsNft.totalSupply()).eq(ts.add(1));
      expect(await boomBotsNft.balanceOf(user2.address)).eq(bal.add(1));
      expect(await boomBotsNft.exists(botID)).eq(true);
      expect(await boomBotsNft.ownerOf(botRes.botID)).eq(user2.address);
      let botInfo = await boomBotsNft.getBotInfo(botID);
      //expect(botInfo.botAddress).eq(botRes.botAddress); // may change
      expect(await boomBotsNft.getBotID(botInfo.botAddress)).eq(botID);
      expect(await boomBotsNft.isAddressBot(botInfo.botAddress)).eq(true);
      let isDeployed2 = await isDeployed(botInfo.botAddress)
      expect(isDeployed2).to.be.true;
      expect(botInfo.implementationAddress).eq(boomBotAccountImplementation.address);
      tbaccount2 = await ethers.getContractAt("BoomBotAccount", botInfo.botAddress) as BoomBotAccount;
      l1DataFeeAnalyzer.register("createBot", tx);
      diamondCutInits[13][0].facetAddress = botInfo.botAddress
      expect(await provider.getBalance(factory.address)).eq(75)
      expect(await provider.getBalance(botInfo.botAddress)).eq(0)
    });
    it("can create bot pt 14", async function () {
      let ts = await boomBotsNft.totalSupply();
      let bal = await boomBotsNft.balanceOf(user1.address);
      let botID = ts.add(1);
      let extraData = ["0x"] // single call to receive
      let botRes = await factory.connect(user1).callStatic['createBot(uint256)'](2);
      expect(botRes.botID).eq(botID);
      expect(await boomBotsNft.exists(botID)).eq(false);
      //await expect(boomBotsNft.getBotID(botRes.botAddress)).to.be.revertedWithCustomError(boomBotsNft, "BotDoesNotExist");
      expect(await boomBotsNft.getBotID(botRes.botAddress)).eq(0);
      expect(await boomBotsNft.isAddressBot(botRes.botAddress)).eq(false);
      let isDeployed1 = await isDeployed(botRes.botAddress)
      expect(isDeployed1).to.be.false;
      let tx = await factory.connect(user1)['createBot(uint256)'](2, { value: 20 });
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
      expect(await provider.getBalance(factory.address)).eq(95)
      expect(await provider.getBalance(botInfo.botAddress)).eq(0)
    });
    it("cannot create bot with bad init code pt 1", async function () {
      // revert with reason
      let botInitializationCode32 = revertModule.interface.encodeFunctionData("revertWithReason", [])
      let botInitializationCode31 = modulePack100.interface.encodeFunctionData("diamondCut", [[{
        facetAddress: revertModule.address,
        action: FacetCutAction.Add,
        functionSelectors: [botInitializationCode32]
      }], AddressZero, "0x"])
      let txdatas3 = [botInitializationCode31, botInitializationCode32]
      let botInitializationCode33 = modulePack100.interface.encodeFunctionData("multicall", [txdatas3])
      let params = {
        botImplementation: boomBotAccountImplementation.address,
        initializationCalls: [botInitializationCode1, botInitializationCode33],
        isPaused: false,
        giveTokenList: [],
        giveTokenAmounts: [],
      }
      let tx = await factory.connect(owner).postBotCreationSettings(params)
      expect(await factory.getBotCreationSettingsCount()).eq(5)
      await expect(factory.connect(user1)['createBot(uint256)'](5)).to.be.revertedWithCustomError;//(newAccount, "RevertWithReason")
    })
    it("cannot create bot with bad init code pt 2", async function () {
      // revert without reason
      let botInitializationCode42 = revertModule.interface.encodeFunctionData("revertWithoutReason", [])
      let botInitializationCode41 = modulePack100.interface.encodeFunctionData("diamondCut", [[{
        facetAddress: revertModule.address,
        action: FacetCutAction.Add,
        functionSelectors: [botInitializationCode42]
      }], AddressZero, "0x"])
      let txdatas4 = [botInitializationCode41, botInitializationCode42]
      let botInitializationCode43 = modulePack100.interface.encodeFunctionData("multicall", [txdatas4])
      let params = {
        botImplementation: boomBotAccountImplementation.address,
        initializationCalls: [botInitializationCode1, botInitializationCode43],
        isPaused: false,
        giveTokenList: [],
        giveTokenAmounts: [],
      }
      let tx = await factory.connect(owner).postBotCreationSettings(params)
      expect(await factory.getBotCreationSettingsCount()).eq(6)
      await expect(factory.connect(user1)['createBot(uint256)'](6)).to.be.revertedWithCustomError;//(factory, "CallFailed");
    })
    it("cannot create bot with bad init code pt 3", async function () {
      await expect(user1.sendTransaction({
        to: revertModule.address,
        data: "0x"
      })).to.be.reverted;
      await expect(user1.sendTransaction({
        to: revertModule.address,
        data: "0xabcd"
      })).to.be.reverted;
    })
    it("cannot create bot with bad init code pt 4", async function () {
      revertAccount = await deployContract(deployer, "RevertAccount", []) as RevertAccount;
      await expect(user1.sendTransaction({
        to: revertAccount.address,
        data: "0x"
      })).to.be.reverted;
      await expect(user1.sendTransaction({
        to: revertAccount.address,
        data: "0xabcd"
      })).to.be.reverted;
    })
    it("owner can postBotCreationSettings pt 7", async function () {
      let diamondCut = [
        {
          facetAddress: modulePack100.address,
          action: FacetCutAction.Add,
          functionSelectors: calcSighashes(modulePack100, 'ModulePack100'),
        },
      ]
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
        isPaused: false,
        giveTokenList: [AddressZero, erc20a.address],
        giveTokenAmounts: [60, WeiPerEther.mul(100)],
      }
      let tx = await factory.connect(owner).postBotCreationSettings(params)
      expect(await factory.getBotCreationSettingsCount()).eq(7)
      let res = await factory.getBotCreationSettings(7)
      expect(res.botImplementation).eq(params.botImplementation)
      expect(res.initializationCalls.length).eq(params.initializationCalls.length)
      expect(res.isPaused).eq(params.isPaused)
      expect(res.giveTokenList).deep.eq(params.giveTokenList)
      expect(res.giveTokenAmounts).deep.eq(params.giveTokenAmounts)
      await expect(tx).to.emit(factory, "BotCreationSettingsPosted").withArgs(7)
      await expect(tx).to.emit(factory, "BotCreationSettingsPaused").withArgs(7, params.isPaused)
      diamondCut = [
        {
          facetAddress: boomBotAccountImplementation.address,
          action: FacetCutAction.Add,
          //functionSelectors: calcSighashes(boomBotAccountImplementation, 'boomBotAccountImplementation'),
          functionSelectors: calcSighashes(boomBotAccountImplementation, 'boomBotAccountImplementation'),
        },
      ].concat(diamondCut)
      diamondCutInits[15] = JSON.parse(JSON.stringify(diamondCut))
      diamondCutInits[16] = JSON.parse(JSON.stringify(diamondCut))
      diamondCutInits[17] = JSON.parse(JSON.stringify(diamondCut))
      await erc20a.mint(factory.address, WeiPerEther.mul(125));
    })
    it("cannot postBotCreationSettings with length mismatch", async function () {
      let params = {
        botImplementation: boomBotAccountImplementation.address,
        initializationCalls: [],
        isPaused: false,
        giveTokenList: [AddressZero],
        giveTokenAmounts: [60, WeiPerEther.mul(100)],
      }
      await expect(factory.connect(owner).postBotCreationSettings(params)).to.be.revertedWithCustomError(factory, "LengthMismatch")
    })
    it("can create bot pt 15", async function () {
      let ts = await boomBotsNft.totalSupply();
      let bal = await boomBotsNft.balanceOf(user1.address);
      let botID = ts.add(1);
      let extraData = ["0x"] // single call to receive
      let botRes = await factory.connect(user1).callStatic['createBot(uint256)'](7);
      expect(botRes.botID).eq(botID);
      expect(await boomBotsNft.exists(botID)).eq(false);
      //await expect(boomBotsNft.getBotID(botRes.botAddress)).to.be.revertedWithCustomError(boomBotsNft, "BotDoesNotExist");
      expect(await boomBotsNft.getBotID(botRes.botAddress)).eq(0);
      expect(await boomBotsNft.isAddressBot(botRes.botAddress)).eq(false);
      let isDeployed1 = await isDeployed(botRes.botAddress)
      expect(isDeployed1).to.be.false;
      let tx = await factory.connect(user1)['createBot(uint256)'](7);
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
      diamondCutInits[15][0].facetAddress = botInfo.botAddress
      expect(await provider.getBalance(factory.address)).eq(35)
      expect(await provider.getBalance(botInfo.botAddress)).eq(60)
      expect(await erc20a.balanceOf(factory.address)).eq(WeiPerEther.mul(25))
      expect(await erc20a.balanceOf(botInfo.botAddress)).eq(WeiPerEther.mul(100))
    });
    it("can create bot pt 16", async function () {
      let ts = await boomBotsNft.totalSupply();
      let bal = await boomBotsNft.balanceOf(user1.address);
      let botID = ts.add(1);
      let extraData = ["0x"] // single call to receive
      let botRes = await factory.connect(user1).callStatic['createBot(uint256)'](7);
      expect(botRes.botID).eq(botID);
      expect(await boomBotsNft.exists(botID)).eq(false);
      //await expect(boomBotsNft.getBotID(botRes.botAddress)).to.be.revertedWithCustomError(boomBotsNft, "BotDoesNotExist");
      expect(await boomBotsNft.getBotID(botRes.botAddress)).eq(0);
      expect(await boomBotsNft.isAddressBot(botRes.botAddress)).eq(false);
      let isDeployed1 = await isDeployed(botRes.botAddress)
      expect(isDeployed1).to.be.false;
      let tx = await factory.connect(user1)['createBot(uint256)'](7);
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
      diamondCutInits[16][0].facetAddress = botInfo.botAddress
      expect(await provider.getBalance(factory.address)).eq(0)
      expect(await provider.getBalance(botInfo.botAddress)).eq(35)
      expect(await erc20a.balanceOf(factory.address)).eq(0)
      expect(await erc20a.balanceOf(botInfo.botAddress)).eq(WeiPerEther.mul(25))
    });
    it("can create bot pt 17", async function () {
      let ts = await boomBotsNft.totalSupply();
      let bal = await boomBotsNft.balanceOf(user1.address);
      let botID = ts.add(1);
      let extraData = ["0x"] // single call to receive
      let botRes = await factory.connect(user1).callStatic['createBot(uint256)'](7);
      expect(botRes.botID).eq(botID);
      expect(await boomBotsNft.exists(botID)).eq(false);
      //await expect(boomBotsNft.getBotID(botRes.botAddress)).to.be.revertedWithCustomError(boomBotsNft, "BotDoesNotExist");
      expect(await boomBotsNft.getBotID(botRes.botAddress)).eq(0);
      expect(await boomBotsNft.isAddressBot(botRes.botAddress)).eq(false);
      let isDeployed1 = await isDeployed(botRes.botAddress)
      expect(isDeployed1).to.be.false;
      let tx = await factory.connect(user1)['createBot(uint256)'](7);
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
      diamondCutInits[17][0].facetAddress = botInfo.botAddress
      expect(await provider.getBalance(factory.address)).eq(0)
      expect(await provider.getBalance(botInfo.botAddress)).eq(0)
      expect(await erc20a.balanceOf(factory.address)).eq(0)
      expect(await erc20a.balanceOf(botInfo.botAddress)).eq(WeiPerEther.mul(0))
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
      let diamondCutInit = [
        {
          facetAddress: modulePack100.address,
          action: FacetCutAction.Add,
          functionSelectors: calcSighashes(modulePack100, 'ModulePack100'),
        },
      ]
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
      createdState: "incorrect",
    },{ // created by factory, properly setup
      botID: 4,
      accountType: "BoomBotAccount",
      createdBy: "contract",
      createdState: "incorrect",
    },{ // created by eoa, improperly setup
      botID: 5,
      accountType: "BoomBotAccount",
      createdBy: "EOA",
      createdState: "incorrect",
    },{ // created by eoa, properly setup
      botID: 6,
      accountType: "BoomBotAccount",
      createdBy: "EOA",
      createdState: "incorrect",
    },{ // created by factory, properly setup
      botID: 7,
      accountType: "BoomBotAccount",
      createdBy: "contract",
      createdState: "incorrect",
    },{ // created by factory, properly setup
      botID: 8,
      accountType: "BoomBotAccount",
      createdBy: "contract",
      createdState: "incorrect",
      extraModules: "fallback",
    },{ // created by factory, properly setup
      botID: 9,
      accountType: "BoomBotAccount",
      createdBy: "contract",
      createdState: "correct",
      extraModules: "fallback",
    },{ // created by factory, properly setup
      botID: 10,
      accountType: "BoomBotAccount",
      createdBy: "contract",
      createdState: "correct",
      extraModules: "fallback",
    },{ // created by factory, properly setup
      botID: 11,
      accountType: "BoomBotAccount",
      createdBy: "contract",
      createdState: "correct",
      extraModules: "fallback",
      initialStateNum: 1
    },{ // created by factory, properly setup
      botID: 12,
      accountType: "BoomBotAccount",
      createdBy: "contract",
      createdState: "correct",
      extraModules: "fallback",
    },{ // created by factory, properly setup
      botID: 13,
      accountType: "BoomBotAccount",
      createdBy: "contract",
      createdState: "correct",
      extraModules: "fallback",
    },{ // created by factory, properly setup
      botID: 14,
      accountType: "BoomBotAccount",
      createdBy: "contract",
      createdState: "incorrect",
    },{ // created by factory, properly setup
      botID: 15,
      accountType: "BoomBotAccount",
      createdBy: "contract",
      createdState: "correct",
    },{ // created by factory, properly setup
      botID: 16,
      accountType: "BoomBotAccount",
      createdBy: "contract",
      createdState: "correct",
    },{ // created by factory, properly setup
      botID: 17,
      accountType: "BoomBotAccount",
      createdBy: "contract",
      createdState: "correct",
    }
  ];

  describe("bots in prod", function () {
    for(const botMetadata of botMetadatas) {
      const { botID, accountType, createdBy, createdState, initialStateNum } = botMetadata;
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
          else if(accountType == "BoomBotAccount" || accountType == "BoomBotAccount") {
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
            expect(await botAccount.state()).eq(initialStateNum||0);
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
            if(accountType == "BoomBotAccount" || accountType == "BoomBotAccount") {
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
          if(accountType == "BoomBotAccount" || accountType == "BoomBotAccount") {
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
              let c = (accountType == "BoomBotAccount" ? boomBotAccountImplementation : boomBotAccountImplementation)

              let diamondCutExpected = diamondCutInits[botID]
              /*
              let sighashes = calcSighashes(c)
              diamondCutExpected = [
                {
                  facetAddress: diamondAccount.address,
                  action: FacetCutAction.Add,
                  functionSelectors: sighashes,
                },
                ...diamondCutExpected
              ]
              */
              //console.log(`testing correct modules ${botID}`)
              //console.log(botAccount.address, "bot account")
              //console.log(boomBotAccountImplementation.address, "impl")
              //console.log(facets.map(f=>f.facetAddress))
              //console.log(diamondCutExpected.map(f=>f.facetAddress))
              //console.log(facets)
              //console.log(facetAddresses)
              //let diamondCutExpected = diamondCutInit
              //if(!!extraModules && extraModules == "fallback") diamondCutExpected = diamondCutInit2
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
