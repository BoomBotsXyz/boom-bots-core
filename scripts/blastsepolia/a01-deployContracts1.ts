import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const boombotsdeployer = new ethers.Wallet(accounts.boombotsdeployer.key, provider);

import { BoomBots, BoomBotAccount, ModulePack100, ModulePack101, BoomBotsFactory, DataStore, IBlast, MockBlastableAccount, ContractFactory } from "../../typechain-types";

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

const CONTRACT_FACTORY_ADDRESS        = "0xa43C26F8cbD9Ea70e7B0C45e17Af81B6330AC543";

const BOOM_BOTS_NFT_ADDRESS           = "0xB3856D22fE476892Af3Cc6dee3D84F015AD5F5b1"; // v0.1.1
const ACCOUNT_IMPLEMENTATION_ADDRESS  = "0x152d3Ba1f7ac4a0AD0ec485b6A292B1F92aB8876"; // v0.1.1
const MODULE_PACK_100_ADDRESS         = "0x044CA8B45C270E744BDaE436E7FA861c6de6b5A5"; // v0.1.0
const MODULE_PACK_101_ADDRESS         = "0x0ea0b9aF8dD6D2C294281E7a983909BA81Bbb199"; // v0.1.1
const DATA_STORE_ADDRESS              = "0x4092c948cE402c18c8Ad6342859dEe8bcAD932bC"; // v0.1.1
const BOOM_BOTS_FACTORY_ADDRESS       = "0x0B0eEBa9CC8035D8EB2516835E57716f0eAE7B73"; // v0.1.1
//const MOCK_ACCOUNT_IMPL_ADDRESS       = ""; // v0.1.1
/*
const BOOM_BOTS_NFT_ADDRESS           = "0xb5DbaFAa38220247d1CA6F8741C21FbEB926A73a"; // v0.1.1
const ACCOUNT_IMPLEMENTATION_ADDRESS  = "0xf24f3A8a7D49031eD95EBD13774BA77a6a470b80"; // v0.1.0
const MODULE_PACK_100_ADDRESS         = "0xdD0b84cB4DA1a1D1c262Cc4009036417BB3165eb"; // v0.1.0
const DATA_STORE_ADDRESS              = "0x2cA4c52DBCe87068e1Cd158a6a971e1E550fB40a"; // v0.1.1
const BOOM_BOTS_FACTORY_ADDRESS       = "0xC984c1Bff51F8BE99440F936BDd21163287291A2"; // v0.1.1
const MOCK_ACCOUNT_IMPL_ADDRESS       = "0x2B76A49cF26aB633A492CCB52664201be57B6DcB"; // v0.1.1
*/

let boomBotsNft: BoomBots;
let accountImplementation: BoomBotAccount; // the base implementation for boom bot accounts
//let mockAccountImplementation: MockBlastableAccount; // a mock to test gas
let modulePack100: ModulePack100;
let modulePack101: ModulePack101;
let dataStore: DataStore;
let factory: BoomBotsFactory;

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

  await deployContractFactory();
  await deployBoomBotsNft();
  await deployBoomBotAccount();
  //await deployMockAccount();
  await deployModulePack100();
  await deployModulePack101();
  await deployDataStore();
  await whitelistModules();
  await deployBoomBotsFactory();
  await postBotCreationSettings1();
  await postBotCreationSettings2();
  await postBotCreationSettings3();
  await whitelistFactories();
  await setNftMetadata();
  //await configureBlastRewards();
}

async function deployContractFactory() {
  if(await isDeployed(CONTRACT_FACTORY_ADDRESS)) {

  } else {
    console.log("Deploying ContractFactory");
    let args = [boombotsdeployer.address];
    let contractFactory = await deployContractUsingContractFactory(boombotsdeployer, "ContractFactory", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as BoomBots;
    console.log(`Deployed ContractFactory to ${contractFactory.address}`);
    if(chainID != 31337) await verifyContract(contractFactory.address, args);
    if(!!ContractFactory && contractFactory.address != ContractFactory) throw new Error(`Deployed ContractFactoryto ${contractFactory.address}, expected ${ContractFactory}`)
  }
}

async function deployBoomBotsNft() {
  if(await isDeployed(BOOM_BOTS_NFT_ADDRESS)) {
    boomBotsNft = await ethers.getContractAt("BoomBots", BOOM_BOTS_NFT_ADDRESS, boombotsdeployer) as BoomBots;
  } else {
    console.log("Deploying BoomBots NFT");
    let args = [ERC6551_REGISTRY_ADDRESS, boombotsdeployer.address];
    boomBotsNft = await deployContractUsingContractFactory(boombotsdeployer, "BoomBots", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as BoomBots;
    console.log(`Deployed BoomBots NFT to ${boomBotsNft.address}`);
    if(chainID != 31337) await verifyContract(boomBotsNft.address, args);
    if(!!BOOM_BOTS_NFT_ADDRESS && boomBotsNft.address != BOOM_BOTS_NFT_ADDRESS) throw new Error(`Deployed BoomBots NFT to ${boomBotsNft.address}, expected ${BOOM_BOTS_NFT_ADDRESS}`)
  }
}

async function deployBoomBotAccount() {
  if(await isDeployed(ACCOUNT_IMPLEMENTATION_ADDRESS)) {
    accountImplementation = await ethers.getContractAt("BoomBotAccount", ACCOUNT_IMPLEMENTATION_ADDRESS, boombotsdeployer) as BoomBotAccount;
  } else {
    console.log("Deploying BoomBotAccount");
    let args = [boombotsdeployer.address];
    accountImplementation = await deployContractUsingContractFactory(boombotsdeployer, "BoomBotAccount", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as BoomBotAccount;
    console.log(`Deployed BoomBotAccount to ${accountImplementation.address}`);
    if(chainID != 31337) await verifyContract(accountImplementation.address, args);
    if(!!ACCOUNT_IMPLEMENTATION_ADDRESS && accountImplementation.address != ACCOUNT_IMPLEMENTATION_ADDRESS) throw new Error(`Deployed BoomBotAccount to ${accountImplementation.address}, expected ${ACCOUNT_IMPLEMENTATION_ADDRESS}`)
  }
}
/*
async function deployMockAccount() {
  if(await isDeployed(MOCK_ACCOUNT_IMPL_ADDRESS)) {
    mockAccountImplementation = await ethers.getContractAt("MockBlastableAccount", MOCK_ACCOUNT_IMPL_ADDRESS, boombotsdeployer) as MockBlastableAccount;
  } else {
    console.log("Deploying MockBlastableAccount");
    let args = [boombotsdeployer.address];
    mockAccountImplementation = await deployContractUsingContractFactory(boombotsdeployer, "MockBlastableAccount", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as MockBlastableAccount;
    console.log(`Deployed MockBlastableAccount to ${mockAccountImplementation.address}`);
    if(chainID != 31337) await verifyContract(mockAccountImplementation.address, args);
    if(!!MOCK_ACCOUNT_IMPL_ADDRESS && mockAccountImplementation.address != MOCK_ACCOUNT_IMPL_ADDRESS) throw new Error(`Deployed MockBlastableAccount to ${mockAccountImplementation.address}, expected ${MOCK_ACCOUNT_IMPL_ADDRESS}`)
  }
}
*/
async function deployModulePack100() {
  if(await isDeployed(MODULE_PACK_100_ADDRESS)) {
    modulePack100 = await ethers.getContractAt("ModulePack100", MODULE_PACK_100_ADDRESS, boombotsdeployer) as ModulePack100;
  } else {
    console.log("Deploying ModulePack100");
    let args = [];
    modulePack100 = await deployContractUsingContractFactory(boombotsdeployer, "ModulePack100", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as ModulePack100;
    console.log(`Deployed ModulePack100 to ${modulePack100.address}`);
    if(chainID != 31337) await verifyContract(modulePack100.address, args);
    if(!!MODULE_PACK_100_ADDRESS && modulePack100.address != MODULE_PACK_100_ADDRESS) throw new Error(`Deployed ModulePack100 to ${modulePack100.address}, expected ${MODULE_PACK_100_ADDRESS}`)
  }
}

async function deployModulePack101() {
  if(await isDeployed(MODULE_PACK_101_ADDRESS)) {
    modulePack101 = await ethers.getContractAt("ModulePack101", MODULE_PACK_101_ADDRESS, boombotsdeployer) as ModulePack101;
  } else {
    console.log("Deploying ModulePack101");
    let args = [boombotsdeployer.address];
    modulePack101 = await deployContractUsingContractFactory(boombotsdeployer, "ModulePack101", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as ModulePack101;
    console.log(`Deployed ModulePack101 to ${modulePack101.address}`);
    if(chainID != 31337) await verifyContract(modulePack101.address, args);
    if(!!MODULE_PACK_101_ADDRESS && modulePack101.address != MODULE_PACK_101_ADDRESS) throw new Error(`Deployed ModulePack101 to ${modulePack101.address}, expected ${MODULE_PACK_101_ADDRESS}`)
  }
}

async function deployDataStore() {
  if(await isDeployed(DATA_STORE_ADDRESS)) {
    dataStore = await ethers.getContractAt("DataStore", DATA_STORE_ADDRESS, boombotsdeployer) as DataStore;
  } else {
    console.log("Deploying DataStore");
    let args = [boombotsdeployer.address];
    dataStore = await deployContractUsingContractFactory(boombotsdeployer, "DataStore", args, toBytes32(1), undefined, {...networkSettings.overrides, gasLimit: 10_000_000}, networkSettings.confirmations) as DataStore;
    console.log(`Deployed DataStore to ${dataStore.address}`);
    if(chainID != 31337) await verifyContract(dataStore.address, args);
    if(!!DATA_STORE_ADDRESS && dataStore.address != DATA_STORE_ADDRESS) throw new Error(`Deployed DataStore to ${dataStore.address}, expected ${DATA_STORE_ADDRESS}`)
  }
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

async function deployBoomBotsFactory() {
  if(await isDeployed(BOOM_BOTS_FACTORY_ADDRESS)) {
    factory = await ethers.getContractAt("BoomBotsFactory", BOOM_BOTS_FACTORY_ADDRESS, boombotsdeployer) as BoomBotsFactory;
  } else {
    console.log("Deploying BoomBotsFactory");
    let args = [
      boombotsdeployer.address,
      boomBotsNft.address
    ];
    factory = await deployContractUsingContractFactory(boombotsdeployer, "BoomBotsFactory", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as BoomBotsFactory;
    console.log(`Deployed BoomBotsFactory to ${factory.address}`);
    if(chainID != 31337) await verifyContract(factory.address, args);
    if(!!BOOM_BOTS_FACTORY_ADDRESS && factory.address != BOOM_BOTS_FACTORY_ADDRESS) throw new Error(`Deployed BoomBotsFactory to ${factory.address}, expected ${BOOM_BOTS_FACTORY_ADDRESS}`)
  }
}

async function postBotCreationSettings1() {
  let count1 = await factory.getBotCreationSettingsCount()
  if(count1 >= 1) return
  console.log(`Calling postBotCreationSettings(1)`)

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
  let tx = await factory.connect(boombotsdeployer).postBotCreationSettings(params)
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

  console.log(`Called postBotCreationSettings(1)`)
}

async function postBotCreationSettings2() {
  let count1 = await factory.getBotCreationSettingsCount()
  if(count1 >= 2) return
  console.log(`Calling postBotCreationSettings(2)`)

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
  let tx = await factory.connect(boombotsdeployer).postBotCreationSettings(params)
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

async function postBotCreationSettings3() {
  let count1 = await factory.getBotCreationSettingsCount()
  if(count1 >= 3) return
  console.log(`Calling postBotCreationSettings(3)`)

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
  let tx = await factory.connect(boombotsdeployer).postBotCreationSettings(params)
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

  console.log(`Called postBotCreationSettings(3)`)
}

//async function _watchTxForExpectedSettingsID()
/*
async function postBotCreationSettings2() {
  let count1 = await factory.getBotCreationSettingsCount()
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
  let tx = await factory.connect(boombotsdeployer).postBotCreationSettings(params)
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
  let isWhitelisted = await boomBotsNft.connect(boombotseth).factoryIsWhitelisted(factory.address)
  if(!isWhitelisted) {
    console.log("Whitelisting factories")
    let tx = await boomBotsNft.connect(boombotsdeployer).setWhitelist([
      {
        factory: factory.address,
        shouldWhitelist: true,
      }
    ], networkSettings.overrides)
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
    factory,
  ]
  for(let i = 0; i < contracts.length; i++) {
    console.log(`configuring blast rewards ${i}`)
    let tx = await contracts[i].connect(boombotsdeployer).multicall(txdatas, {...networkSettings.overrides, gasLimit: 500_000})
    console.log('tx')
    console.log(tx)
    await tx.wait(networkSettings.confirmations)
  }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
