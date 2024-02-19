import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const boombotsdeployer = new ethers.Wallet(accounts.boombotsdeployer.key, provider);
const blasttestnetuser1 = new ethers.Wallet(accounts.blasttestnetuser1.key, provider);

import { BoomBots, BoomBotAccount, ModulePack100, ModulePack101, BoomBotsFactory01, BoomBotsFactory02, DataStore, IBlast, MockBlastableAccount, ContractFactory } from "../../typechain-types";

import { delay } from "./../utils/misc";
import { isDeployed, expectDeployed } from "./../utils/expectDeployed";
import { logContractAddress } from "./../utils/logContractAddress";
import { getNetworkSettings } from "./../utils/getNetworkSettings";
import { deployContractUsingContractFactory, verifyContract } from "./../utils/deployContract";
import { toBytes32 } from "./../utils/setStorage";
import { getSelectors, FacetCutAction, calcSighash, calcSighashes, getCombinedAbi } from "./../utils/diamond"

const { AddressZero, WeiPerEther, MaxUint256 } = ethers.constants;

let networkSettings: any;
let chainID: number;

const ERC6551_REGISTRY_ADDRESS        = "0x000000006551c19487814612e58FE06813775758";
const BLAST_ADDRESS                   = "0x4300000000000000000000000000000000000002";

//const GAS_COLLECTOR_ADDRESS           = "0xDb83331A22b03E9E6E2C61dECcB0C71F35fe8424"; // V0.1.2
const GAS_COLLECTOR_ADDRESS           = "0xc2bD0a189632A8b9eEb546D5398088659D62BABA"; // V0.1.2

const CONTRACT_FACTORY_ADDRESS        = "0xa43C26F8cbD9Ea70e7B0C45e17Af81B6330AC543"; // v0.1.1

const BOOM_BOTS_NFT_ADDRESS           = "0xB3856D22fE476892Af3Cc6dee3D84F015AD5F5b1"; // v0.1.1
const ACCOUNT_IMPLEMENTATION_ADDRESS  = "0x152d3Ba1f7ac4a0AD0ec485b6A292B1F92aB8876"; // v0.1.1
const MODULE_PACK_100_ADDRESS         = "0x044CA8B45C270E744BDaE436E7FA861c6de6b5A5"; // v0.1.0
const MODULE_PACK_101_ADDRESS         = "0x0ea0b9aF8dD6D2C294281E7a983909BA81Bbb199"; // v0.1.1

//const DATA_STORE_ADDRESS              = "0x4092c948cE402c18c8Ad6342859dEe8bcAD932bC"; // v0.1.1
//const DATA_STORE_ADDRESS              = "0x97D3cA0d406202DA7506F8e14006E7f9C1651dc2"; // v0.1.2
const DATA_STORE_ADDRESS              = "0xD105250218C6aD8A7D79498161ba45509464EAbC"; // v0.1.2

const BOOM_BOTS_FACTORY01_ADDRESS     = "0x0B0eEBa9CC8035D8EB2516835E57716f0eAE7B73"; // v0.1.1
const BOOM_BOTS_FACTORY02_ADDRESS     = "0xf57E8cCFD2a415aEc9319E5bc1ABD19aAF130bA1"; // v0.1.1

const ETH_ADDRESS                = "0x0000000000000000000000000000000000000000";
const ALL_CLAIMABLE_GAS_ADDRESS  = "0x0000000000000000000000000000000000000001";
const MAX_CLAIMABLE_GAS_ADDRESS  = "0x0000000000000000000000000000000000000002";
const WETH_ADDRESS               = "0x4200000000000000000000000000000000000023";
const USDB_ADDRESS               = "0x4200000000000000000000000000000000000022";
const USDC_ADDRESS               = "0xF19A5b56b419170Aa2ee49E5c9195F5902D39BF1";
const USDT_ADDRESS               = "0xD8F542D710346DF26F28D6502A48F49fB2cFD19B";
const DAI_ADDRESS                = "0x9C6Fc5bF860A4a012C9De812002dB304AD04F581";
const BOLT_ADDRESS               = "0x1B0cC80F4E2A7d205518A1Bf36de5bED686662FE";
const RGB_ADDRESS                = "0x7647a41596c1Ca0127BaCaa25205b310A0436B4C";
const PRE_BOOM_ADDRESS           = "0xf10C6886e26204F61cA9e0E89db74b7774d7ADa6"; // v0.1.1
const MOCK_USDB_ADDRESS          = "0x3114ded1fA1b406e270A65a21bC96E86C171a244";

let gasCollector: GasCollector;
let boomBotsNft: BoomBots;
let accountImplementation: BoomBotAccount; // the base implementation for boom bot accounts
//let mockAccountImplementation: MockBlastableAccount; // a mock to test gas
let modulePack100: ModulePack100;
let modulePack101: ModulePack101;
let dataStore: DataStore;
let factory01: BoomBotsFactory01;
let factory02: BoomBotsFactory02;

let iblast: IBlast;

async function main() {
  console.log(`Using ${boombotseth.address} as boombotseth`);
  console.log(`Using ${boombotsdeployer.address} as boombotsdeployer`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    return ((chainID === chainid) || ((chainID === 31337) && (process.env.FORK_NETWORK === chainName)));
  }
  if(!isChain(168587773, "blastsepolia")) throw("Only run this on Blast Sepolia or a local fork of Blast Sepolia");
  //await expectDeployed(ERC6551_REGISTRY_ADDRESS)

  iblast = await ethers.getContractAt("IBlast", BLAST_ADDRESS, boombotseth) as IBlast;

  gasCollector = await ethers.getContractAt("GasCollector", GAS_COLLECTOR_ADDRESS, boombotsdeployer) as GasCollector;
  boomBotsNft = await ethers.getContractAt("BoomBots", BOOM_BOTS_NFT_ADDRESS, boombotsdeployer) as BoomBots;
  accountImplementation = await ethers.getContractAt("BoomBotAccount", ACCOUNT_IMPLEMENTATION_ADDRESS, boombotsdeployer) as BoomBotAccount;
  modulePack100 = await ethers.getContractAt("ModulePack100", MODULE_PACK_100_ADDRESS, boombotsdeployer) as ModulePack100;
  modulePack101 = await ethers.getContractAt("ModulePack101", MODULE_PACK_101_ADDRESS, boombotsdeployer) as ModulePack101;
  dataStore = await ethers.getContractAt("DataStore", DATA_STORE_ADDRESS, boombotsdeployer) as DataStore;
  factory01 = await ethers.getContractAt("BoomBotsFactory01", BOOM_BOTS_FACTORY01_ADDRESS, boombotsdeployer) as BoomBotsFactory01;
  factory02 = await ethers.getContractAt("BoomBotsFactory02", BOOM_BOTS_FACTORY02_ADDRESS, boombotsdeployer) as BoomBotsFactory02;

  await whitelistModules();

  await postBotCreationSettings01_01();
  await postBotCreationSettings01_02();
  await postBotCreationSettings01_03();

  await postBotCreationSettings02_01();
  await postBotCreationSettings02_02();

  await whitelistFactories();
  await setNftMetadata();
  //await configureBlastRewards();

  await configureGasRewards();
  await collectGasRewards();
}

async function whitelistModules() {
  let expectedSettings = [
    {
      module: modulePack100.address,
      shouldWhitelist: true,
    },
    {
      module: modulePack101.address,
      shouldWhitelist: true,
    },
  ]
  let diffs = [] as any[]
  for(let i = 0; i < expectedSettings.length; i++) {
    let { module, shouldWhitelist } = expectedSettings[i]
    let isWhitelisted = await dataStore.connect(boombotseth).moduleCanBeInstalled(module)
    if(isWhitelisted != shouldWhitelist) diffs.push(expectedSettings[i])
  }
  if(diffs.length > 0) {
    console.log("Whitelisting modules")
    let tx = await dataStore.connect(boombotsdeployer).setModuleWhitelist(diffs, networkSettings.overrides)
    await tx.wait(networkSettings.confirmations)
    console.log("Whitelisted modules")
  }
}

async function postBotCreationSettings01_01() {
  let count1 = await factory01.getBotCreationSettingsCount()
  if(count1 >= 1) return
  console.log(`Calling postBotCreationSettings01_01`)

  const inscribeSighash = "0xde52f07d";
  let sighashes = calcSighashes(modulePack100, 'ModulePack100')
  sighashes.push(inscribeSighash)
  let diamondCutInit = [
    {
      facetAddress: modulePack100.address,
      action: FacetCutAction.Add,
      functionSelectors: sighashes,
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
  let botInitializationCode1 = accountImplementation.interface.encodeFunctionData("initialize", [diamondCutInit, dataStore.address]);
  let botInitializationCode2 = modulePack100.interface.encodeFunctionData("updateSupportedInterfaces", [interfaceIDs, support]);
  let blastcalldata3 = iblast.interface.encodeFunctionData("configureAutomaticYield")
  let botInitializationCode3 = modulePack100.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata3, 0]);
  let blastcalldata4 = iblast.interface.encodeFunctionData("configureClaimableGas")
  let botInitializationCode4 = modulePack100.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata4, 0]);

  let params = {
    botImplementation: accountImplementation.address,
    initializationCalls: [
      botInitializationCode1,
      botInitializationCode2,
      botInitializationCode3,
      botInitializationCode4,
    ],
    isPaused: false
  }
  let tx = await factory01.connect(boombotsdeployer).postBotCreationSettings(params)
  //console.log('tx')
  //console.log(tx)
  let receipt = await tx.wait(networkSettings.confirmations)
  //console.log('receipt')
  //console.log(receipt)
  //console.log(receipt.events)
  let postEvent = receipt.events.filter(event=>event.event=="BotCreationSettingsPosted")[0]
  //console.log('postEvent')
  //console.log(postEvent)
  let settingsID = postEvent.args[0]
  //console.log('settingsID')
  //console.log(settingsID)
  let expectedSettingsID = 1
  if(settingsID != expectedSettingsID) throw new Error(`Unexpected settingsID returned. Expected ${expectedSettingsID} got ${settingsID}`)

  console.log(`Called postBotCreationSettings01_01`)
}

async function postBotCreationSettings01_02() {
  let count1 = await factory01.getBotCreationSettingsCount()
  if(count1 >= 2) return
  console.log(`Calling postBotCreationSettings01_02`)

  //const inscribeSighash = "0xde52f07d";
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
  let diamondCutInit = [
    {
      facetAddress: modulePack101.address,
      action: FacetCutAction.Add,
      functionSelectors: sighashes,
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
  let botInitializationCode1 = accountImplementation.interface.encodeFunctionData("initialize", [diamondCutInit, dataStore.address]);
  let botInitializationCode2 = modulePack100.interface.encodeFunctionData("updateSupportedInterfaces", [interfaceIDs, support]);
  let blastcalldata3 = iblast.interface.encodeFunctionData("configureAutomaticYield")
  let botInitializationCode3 = modulePack100.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata3, 0]);
  let blastcalldata4 = iblast.interface.encodeFunctionData("configureClaimableGas")
  let botInitializationCode4 = modulePack100.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata4, 0]);

  let params = {
    botImplementation: accountImplementation.address,
    initializationCalls: [
      botInitializationCode1,
      botInitializationCode2,
      botInitializationCode3,
      botInitializationCode4,
    ],
    isPaused: false
  }
  let tx = await factory01.connect(boombotsdeployer).postBotCreationSettings(params)
  //console.log('tx')
  //console.log(tx)
  let receipt = await tx.wait(networkSettings.confirmations)
  //console.log('receipt')
  //console.log(receipt)
  //console.log(receipt.events)
  let postEvent = receipt.events.filter(event=>event.event=="BotCreationSettingsPosted")[0]
  //console.log('postEvent')
  //console.log(postEvent)
  let settingsID = postEvent.args[0]
  //console.log('settingsID')
  //console.log(settingsID)
  let expectedSettingsID = 2
  if(settingsID != expectedSettingsID) throw new Error(`Unexpected settingsID returned. Expected ${expectedSettingsID} got ${settingsID}`)

  console.log(`Called postBotCreationSettings01_02`)
}

async function postBotCreationSettings01_03() {
  let count1 = await factory01.getBotCreationSettingsCount()
  if(count1 >= 3) return
  console.log(`Calling postBotCreationSettings01_03`)

  //const inscribeSighash = "0xde52f07d";
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
  let diamondCutInit = [
    {
      facetAddress: modulePack101.address,
      action: FacetCutAction.Add,
      functionSelectors: sighashes,
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
  let botInitializationCode1 = accountImplementation.interface.encodeFunctionData("initialize", [diamondCutInit, dataStore.address]);
  let botInitializationCode2 = modulePack100.interface.encodeFunctionData("updateSupportedInterfaces", [interfaceIDs, support]);
  let blastcalldata3 = iblast.interface.encodeFunctionData("configureAutomaticYield")
  let botInitializationCode3 = modulePack100.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata3, 0]);
  let blastcalldata4 = iblast.interface.encodeFunctionData("configureClaimableGas")
  let botInitializationCode4 = modulePack100.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata4, 0]);

  let params = {
    botImplementation: accountImplementation.address,
    initializationCalls: [
      botInitializationCode1,
      botInitializationCode2,
      botInitializationCode3,
      botInitializationCode4,
    ],
    isPaused: false
  }
  let tx = await factory01.connect(boombotsdeployer).postBotCreationSettings(params)
  //console.log('tx')
  //console.log(tx)
  let receipt = await tx.wait(networkSettings.confirmations)
  //console.log('receipt')
  //console.log(receipt)
  //console.log(receipt.events)
  let postEvent = receipt.events.filter(event=>event.event=="BotCreationSettingsPosted")[0]
  //console.log('postEvent')
  //console.log(postEvent)
  let settingsID = postEvent.args[0]
  //console.log('settingsID')
  //console.log(settingsID)
  let expectedSettingsID = 3
  if(settingsID != expectedSettingsID) throw new Error(`Unexpected settingsID returned. Expected ${expectedSettingsID} got ${settingsID}`)

  console.log(`Called postBotCreationSettings01_03`)
}


async function postBotCreationSettings02_01() {
  let count1 = await factory02.getBotCreationSettingsCount()
  if(count1 >= 1) return
  console.log(`Calling postBotCreationSettings02_01`)

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
  let diamondCutInit = [
    {
      facetAddress: modulePack101.address,
      action: FacetCutAction.Add,
      functionSelectors: sighashes,
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
  let botInitializationCode1 = accountImplementation.interface.encodeFunctionData("initialize", [diamondCutInit, dataStore.address]);
  let botInitializationCode2 = modulePack100.interface.encodeFunctionData("updateSupportedInterfaces", [interfaceIDs, support]);
  let blastcalldata3 = iblast.interface.encodeFunctionData("configureAutomaticYield")
  let botInitializationCode3 = modulePack100.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata3, 0]);
  let blastcalldata4 = iblast.interface.encodeFunctionData("configureClaimableGas")
  let botInitializationCode4 = modulePack100.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata4, 0]);

  let giveTokenList = [ETH_ADDRESS, MOCK_USDB_ADDRESS, PRE_BOOM_ADDRESS]
  let giveTokenAmounts = [WeiPerEther.div(1000), WeiPerEther.mul(100), WeiPerEther.mul(1000)]

  let params = {
    botImplementation: accountImplementation.address,
    initializationCalls: [
      botInitializationCode1,
      botInitializationCode2,
      botInitializationCode3,
      botInitializationCode4,
    ],
    isPaused: false,
    giveTokenList,
    giveTokenAmounts,
  }
  let tx = await factory02.connect(boombotsdeployer).postBotCreationSettings(params)
  let receipt = await tx.wait(networkSettings.confirmations)
  let postEvent = receipt.events.filter(event=>event.event=="BotCreationSettingsPosted")[0]
  let settingsID = postEvent.args[0]
  let expectedSettingsID = 1
  if(settingsID != expectedSettingsID) throw new Error(`Unexpected settingsID returned. Expected ${expectedSettingsID} got ${settingsID}`)

  console.log(`Called postBotCreationSettings02_01`)
}

async function postBotCreationSettings02_02() {
  let count1 = await factory02.getBotCreationSettingsCount()
  if(count1 >= 2) return
  console.log(`Calling postBotCreationSettings02_02`)

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
  let diamondCutInit = [
    {
      facetAddress: modulePack101.address,
      action: FacetCutAction.Add,
      functionSelectors: sighashes,
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
  let botInitializationCode1 = accountImplementation.interface.encodeFunctionData("initialize", [diamondCutInit, dataStore.address]);
  let botInitializationCode2 = modulePack100.interface.encodeFunctionData("updateSupportedInterfaces", [interfaceIDs, support]);
  let blastcalldata3 = iblast.interface.encodeFunctionData("configureAutomaticYield")
  let botInitializationCode3 = modulePack100.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata3, 0]);
  let blastcalldata4 = iblast.interface.encodeFunctionData("configureClaimableGas")
  let botInitializationCode4 = modulePack100.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata4, 0]);

  let giveTokenList = [ETH_ADDRESS, MOCK_USDB_ADDRESS, PRE_BOOM_ADDRESS]
  let giveTokenAmounts = [WeiPerEther.div(1000), WeiPerEther.mul(100), WeiPerEther.mul(1000)]

  let params = {
    botImplementation: accountImplementation.address,
    initializationCalls: [
      botInitializationCode1,
      botInitializationCode2,
      botInitializationCode3,
      botInitializationCode4,
    ],
    isPaused: false,
    giveTokenList,
    giveTokenAmounts,
  }
  let tx = await factory02.connect(boombotsdeployer).postBotCreationSettings(params)
  let receipt = await tx.wait(networkSettings.confirmations)
  let postEvent = receipt.events.filter(event=>event.event=="BotCreationSettingsPosted")[0]
  let settingsID = postEvent.args[0]
  let expectedSettingsID = 2
  if(settingsID != expectedSettingsID) throw new Error(`Unexpected settingsID returned. Expected ${expectedSettingsID} got ${settingsID}`)

  console.log(`Called postBotCreationSettings02_02`)
}

//async function _watchTxForExpectedSettingsID()
/*
async function postBotCreationSettings01_02() {
  let count1 = await factory01.getBotCreationSettingsCount()
  if(count1 >= 2) return
  console.log(`Calling postBotCreationSettings(2)`)

  const inscribeSighash = "0xde52f07d";
  let sighashes = calcSighashes(modulePack100, 'ModulePack100')
  sighashes.push(inscribeSighash)
  let diamondCutInit = [
    {
      facetAddress: modulePack100.address,
      action: FacetCutAction.Add,
      functionSelectors: sighashes,
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
  let botInitializationCode1 = accountImplementation.interface.encodeFunctionData("initialize", [diamondCutInit, dataStore.address]);
  let botInitializationCode2 = modulePack100.interface.encodeFunctionData("updateSupportedInterfaces", [interfaceIDs, support]);
  let blastcalldata3 = iblast.interface.encodeFunctionData("configureAutomaticYield")
  let botInitializationCode3 = modulePack100.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata3, 0]);
  let blastcalldata4 = iblast.interface.encodeFunctionData("configureClaimableGas")
  let botInitializationCode4 = modulePack100.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata4, 0]);

  let params = {
    botImplementation: mockAccountImplementation.address,
    initializationCalls: [
      botInitializationCode1,
      botInitializationCode2,
      botInitializationCode3,
      botInitializationCode4,
    ],
    isPaused: false
  }
  let tx = await factory01.connect(boombotsdeployer).postBotCreationSettings(params)
  //console.log('tx')
  //console.log(tx)
  let receipt = await tx.wait(networkSettings.confirmations)
  //console.log('receipt')
  //console.log(receipt)
  //console.log(receipt.events)
  let postEvent = receipt.events.filter(event=>event.event=="BotCreationSettingsPosted")[0]
  //console.log('postEvent')
  //console.log(postEvent)
  let settingsID = postEvent.args[0]
  //console.log('settingsID')
  //console.log(settingsID)
  let expectedSettingsID = 2
  if(settingsID != expectedSettingsID) throw new Error(`Unexpected settingsID returned. Expected ${expectedSettingsID} got ${settingsID}`)

  console.log(`Called postBotCreationSettings(2)`)
}
*/

async function whitelistFactories() {
  let expectedSettings = [
    {
      factory: factory01.address,
      shouldWhitelist: true,
    },
    {
      factory: factory02.address,
      shouldWhitelist: true,
    },
  ]
  let diffs = [] as any[]
  for(let i = 0; i < expectedSettings.length; i++) {
    let { factory , shouldWhitelist } = expectedSettings[i]
    let isWhitelisted = await boomBotsNft.connect(boombotseth).factoryIsWhitelisted(factory)
    if(isWhitelisted != shouldWhitelist) diffs.push(expectedSettings[i])
  }
  if(diffs.length > 0) {
    console.log("Whitelisting factories")
    let tx = await boomBotsNft.connect(boombotsdeployer).setWhitelist(diffs, networkSettings.overrides)
    await tx.wait(networkSettings.confirmations)
    console.log("Whitelisted factories")
  }
}

async function setNftMetadata() {
  let txdatas = [] as any[]
  let desiredContractURI = "https://stats-cdn.boombots.xyz/contractURI.json"
  let desiredBaseURI = "https://stats.boombots.xyz/bots/metadata/?chainID=168587773&v=0.1.1&botID="
  let currentContractURI = await boomBotsNft.contractURI()
  let currentBaseURI = await boomBotsNft.baseURI()
  if(currentContractURI != desiredContractURI) {
    txdatas.push(boomBotsNft.interface.encodeFunctionData("setContractURI", [desiredContractURI]))
  }
  if(currentBaseURI != desiredBaseURI) {
    txdatas.push(boomBotsNft.interface.encodeFunctionData("setBaseURI", [desiredBaseURI]))
  }
  if(txdatas.length == 0) return
  var tx
  console.log("Setting NFT metadata");
  if(txdatas.length == 1) {
    tx = await boombotsdeployer.sendTransaction({
      to: boomBotsNft.address,
      data: txdatas[0],
      ...networkSettings.overrides,
      gasLimit: 1_000_000
    })
  } else { // length > 1
    tx = await boomBotsNft.connect(boombotsdeployer).multicall(txdatas, {...networkSettings.overrides, gasLimit: 1_000_000});
  }
  //console.log("tx:", tx);
  await tx.wait(networkSettings.confirmations);
  console.log("Set NFT metadata");
}

async function configureBlastRewards() {
  let blastcalldata1 = iblast.interface.encodeFunctionData("configureAutomaticYield")
  let mctxdata1 = boomBotsNft.interface.encodeFunctionData("callBlast", [blastcalldata1]);
  let blastcalldata2 = iblast.interface.encodeFunctionData("configureClaimableGas")
  let mctxdata2 = boomBotsNft.interface.encodeFunctionData("callBlast", [blastcalldata2]);
  let txdatas = [mctxdata1, mctxdata2]

  let contracts = [
    boomBotsNft,
    dataStore,
    factory01,
  ]
  for(let i = 0; i < contracts.length; i++) {
    console.log(`configuring blast rewards ${i}`)
    let tx = await contracts[i].connect(boombotsdeployer).multicall(txdatas, {...networkSettings.overrides, gasLimit: 500_000})
    console.log('tx')
    console.log(tx)
    await tx.wait(networkSettings.confirmations)
  }
}

async function configureGasRewards() {
  console.log(`Configuring gas rewards`)
  let contractList = [gasCollector.address, dataStore.address]
  let receiver = boombotsdeployer.address
  let tx = await gasCollector.connect(boombotsdeployer).setClaimContractList(contractList, receiver, networkSettings.overrides)
  await tx.wait(networkSettings.confirmations)
  console.log(`Configured gas rewards`)
}

async function collectGasRewards() {
  console.log(`Collecting gas rewards`)
  let tx = await gasCollector.connect(boombotseth).claimGas(networkSettings.overrides)
  await tx.wait(networkSettings.confirmations)
  console.log(`Collected gas rewards`)
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
