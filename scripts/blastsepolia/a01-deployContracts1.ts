import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const boombotsdeployer = new ethers.Wallet(accounts.boombotsdeployer.key, provider);

import { BoomBots, BoomBotAccount, ModulePack102, BoomBotsFactory01, BoomBotsFactory02, DataStore, IBlast, ContractFactory, GasCollector, RingProtocolModuleB, BalanceFetcher, MockERC20Rebasing, PreBOOM } from "../../typechain-types";

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

const CONTRACT_FACTORY_ADDRESS        = "0xA74500382CAb2EBFe9A08dc2c01430821A4A8E15"; // v0.1.2
const GAS_COLLECTOR_ADDRESS           = "0xf67f800486E8B9cC7e4416F329dF56bB43D2B7B4"; // V0.1.2
const BOOM_BOTS_NFT_ADDRESS           = "0x7724cc10B42760d4C624d6b81C4367118194E39B"; // v0.1.2
const ACCOUNT_IMPLEMENTATION_ADDRESS  = "0x8EA19CA269A3F3A7563F7A098C9C3dC46f4A2448"; // v0.1.2
const MODULE_PACK_102_ADDRESS         = "0xfEC2e1F3c66f181650641eC50a5E131C1f3b4740"; // v0.1.2
const DATA_STORE_ADDRESS              = "0xDFF8DCD5441B1B709cDCB7897dB304041Cc9DE4C"; // v0.1.2
const BOOM_BOTS_FACTORY01_ADDRESS     = "0x92e795B8D78eA13a564da4F4E03965FBB89cb788"; // v0.1.2
const BOOM_BOTS_FACTORY02_ADDRESS     = "0x4acb9D0243dF085B4F59683cee2F36597334bDa4"; // v0.1.2

const BALANCE_FETCHER_ADDRESS         = "0x0268efA44785909AAb150Ff00545568351dd25b6"; // v0.1.2
const PRE_BOOM_ADDRESS                = "0xdBa6Cb5a91AE6F0ac3883F3841190c2BFa168f9b"; // v0.1.2

const MOCK_USDB_ADDRESS               = "0x3114ded1fA1b406e270A65a21bC96E86C171a244"; // v0.1.1

const RING_PROTOCOL_MODULE_B_ADDRESS  = "0x141268a519D42149c6dcA9695d065d91eda66501"; // v0.1.2

let iblast: IBlast;

let contractFactory: ContractFactory;
let gasCollector: GasCollector;
let boomBotsNft: BoomBots;
let accountImplementation: BoomBotAccount; // the base implementation for boom bot accounts
let modulePack102: ModulePack102;
let dataStore: DataStore;
let factory01: BoomBotsFactory01;
let factory02: BoomBotsFactory02;

let balanceFetcher: BalanceFetcher;
let preboom: PreBOOM;
let mockusdb: MockERC20Rebasing;

let ringProtocolModuleB: RingProtocolModuleB;


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

  await deployGasCollector();
  await deployBoomBotsNft();
  await deployBoomBotAccount();
  await deployModulePack102();
  await deployDataStore();
  await deployBoomBotsFactory01();
  await deployBoomBotsFactory02();

  await deployBalanceFetcher();
  await deployPreBOOM();
  await deployMockUSDB();
  await deployRingProtocolModuleB();

  logAddresses()
}

async function deployContractFactory() {
  if(await isDeployed(CONTRACT_FACTORY_ADDRESS)) {
    contractFactory = await ethers.getContractAt("ContractFactory", CONTRACT_FACTORY_ADDRESS, boombotsdeployer) as ContractFactory;
  } else {
    console.log("Deploying ContractFactory");
    let args = [boombotsdeployer.address, BLAST_ADDRESS, boombotsdeployer.address];
    contractFactory = await deployContractUsingContractFactory(boombotsdeployer, "ContractFactory", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as ContractFactory;
    console.log(`Deployed ContractFactory to ${contractFactory.address}`);
    if(chainID != 31337) await verifyContract(contractFactory.address, args);
    if(!!CONTRACT_FACTORY_ADDRESS && contractFactory.address != CONTRACT_FACTORY_ADDRESS) throw new Error(`Deployed ContractFactoryto ${contractFactory.address}, expected ${CONTRACT_FACTORY_ADDRESS}`)
  }
}

async function deployGasCollector() {
  if(await isDeployed(GAS_COLLECTOR_ADDRESS)) {
    gasCollector = await ethers.getContractAt("GasCollector", GAS_COLLECTOR_ADDRESS, boombotsdeployer) as GasCollector;
  } else {
    console.log("Deploying GasCollector");
    let args = [boombotsdeployer.address, BLAST_ADDRESS];
    gasCollector = await deployContractUsingContractFactory(boombotsdeployer, "GasCollector", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as GasCollector;
    console.log(`Deployed GasCollector to ${gasCollector.address}`);
    if(chainID != 31337) await verifyContract(gasCollector.address, args);
    if(!!GAS_COLLECTOR_ADDRESS && gasCollector.address != GAS_COLLECTOR_ADDRESS) throw new Error(`Deployed GasCollector to ${gasCollector.address}, expected ${GAS_COLLECTOR_ADDRESS}`)
  }
}

async function deployBoomBotsNft() {
  if(await isDeployed(BOOM_BOTS_NFT_ADDRESS)) {
    boomBotsNft = await ethers.getContractAt("BoomBots", BOOM_BOTS_NFT_ADDRESS, boombotsdeployer) as BoomBots;
  } else {
    console.log("Deploying BoomBots NFT");
    let args = [boombotsdeployer.address, BLAST_ADDRESS, gasCollector.address, ERC6551_REGISTRY_ADDRESS];
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
    let args = [BLAST_ADDRESS, gasCollector.address];
    accountImplementation = await deployContractUsingContractFactory(boombotsdeployer, "BoomBotAccount", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as BoomBotAccount;
    console.log(`Deployed BoomBotAccount to ${accountImplementation.address}`);
    if(chainID != 31337) await verifyContract(accountImplementation.address, args);
    if(!!ACCOUNT_IMPLEMENTATION_ADDRESS && accountImplementation.address != ACCOUNT_IMPLEMENTATION_ADDRESS) throw new Error(`Deployed BoomBotAccount to ${accountImplementation.address}, expected ${ACCOUNT_IMPLEMENTATION_ADDRESS}`)
  }
}

async function deployModulePack102() {
  if(await isDeployed(MODULE_PACK_102_ADDRESS)) {
    modulePack102 = await ethers.getContractAt("ModulePack102", MODULE_PACK_102_ADDRESS, boombotsdeployer) as ModulePack102;
  } else {
    console.log("Deploying ModulePack102");
    let args = [BLAST_ADDRESS, gasCollector.address];
    modulePack102 = await deployContractUsingContractFactory(boombotsdeployer, "ModulePack102", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as ModulePack102;
    console.log(`Deployed ModulePack102 to ${modulePack102.address}`);
    if(chainID != 31337) await verifyContract(modulePack102.address, args);
    if(!!MODULE_PACK_102_ADDRESS && modulePack102.address != MODULE_PACK_102_ADDRESS) throw new Error(`Deployed ModulePack102 to ${modulePack102.address}, expected ${MODULE_PACK_102_ADDRESS}`)
  }
}

async function deployDataStore() {
  if(await isDeployed(DATA_STORE_ADDRESS)) {
    dataStore = await ethers.getContractAt("DataStore", DATA_STORE_ADDRESS, boombotsdeployer) as DataStore;
  } else {
    console.log("Deploying DataStore");
    let args = [boombotsdeployer.address, BLAST_ADDRESS, gasCollector.address];
    dataStore = await deployContractUsingContractFactory(boombotsdeployer, "DataStore", args, toBytes32(1), undefined, {...networkSettings.overrides, gasLimit: 10_000_000}, networkSettings.confirmations) as DataStore;
    console.log(`Deployed DataStore to ${dataStore.address}`);
    if(chainID != 31337) await verifyContract(dataStore.address, args);
    if(!!DATA_STORE_ADDRESS && dataStore.address != DATA_STORE_ADDRESS) throw new Error(`Deployed DataStore to ${dataStore.address}, expected ${DATA_STORE_ADDRESS}`)
  }
}

async function deployBoomBotsFactory01() {
  if(await isDeployed(BOOM_BOTS_FACTORY01_ADDRESS)) {
    factory01 = await ethers.getContractAt("BoomBotsFactory01", BOOM_BOTS_FACTORY01_ADDRESS, boombotsdeployer) as BoomBotsFactory01;
  } else {
    console.log("Deploying BoomBotsFactory01");
    let args = [boombotsdeployer.address, BLAST_ADDRESS, gasCollector.address, boomBotsNft.address];
    factory01 = await deployContractUsingContractFactory(boombotsdeployer, "BoomBotsFactory01", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as BoomBotsFactory01;
    console.log(`Deployed BoomBotsFactory01 to ${factory01.address}`);
    if(chainID != 31337) await verifyContract(factory01.address, args);
    if(!!BOOM_BOTS_FACTORY01_ADDRESS && factory01.address != BOOM_BOTS_FACTORY01_ADDRESS) throw new Error(`Deployed BoomBotsFactory01 to ${factory01.address}, expected ${BOOM_BOTS_FACTORY01_ADDRESS}`)
  }
}

async function deployBoomBotsFactory02() {
  if(await isDeployed(BOOM_BOTS_FACTORY02_ADDRESS)) {
    factory02 = await ethers.getContractAt("BoomBotsFactory02", BOOM_BOTS_FACTORY02_ADDRESS, boombotsdeployer) as BoomBotsFactory02;
  } else {
    console.log("Deploying BoomBotsFactory02");
    let args = [boombotsdeployer.address, BLAST_ADDRESS, gasCollector.address, boomBotsNft.address];
    factory02 = await deployContractUsingContractFactory(boombotsdeployer, "BoomBotsFactory02", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as BoomBotsFactory02;
    console.log(`Deployed BoomBotsFactory02 to ${factory02.address}`);
    if(chainID != 31337) await verifyContract(factory02.address, args);
    if(!!BOOM_BOTS_FACTORY02_ADDRESS && factory02.address != BOOM_BOTS_FACTORY02_ADDRESS) throw new Error(`Deployed BoomBotsFactory02 to ${factory02.address}, expected ${BOOM_BOTS_FACTORY02_ADDRESS}`)
  }
}

async function deployBalanceFetcher() {
  if(await isDeployed(BALANCE_FETCHER_ADDRESS)) {
    balanceFetcher = await ethers.getContractAt("BalanceFetcher", BALANCE_FETCHER_ADDRESS, boombotsdeployer) as BalanceFetcher;
  } else {
    console.log("Deploying BalanceFetcher");
    let args = [boombotsdeployer.address, BLAST_ADDRESS, GAS_COLLECTOR_ADDRESS];
    balanceFetcher = await deployContractUsingContractFactory(boombotsdeployer, "BalanceFetcher", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as BalanceFetcher;
    console.log(`Deployed BalanceFetcher to ${balanceFetcher.address}`);
    if(chainID != 31337) await verifyContract(balanceFetcher.address, args);
    if(!!BALANCE_FETCHER_ADDRESS && balanceFetcher.address != BALANCE_FETCHER_ADDRESS) throw new Error(`Deployed ModulePack100 to ${balanceFetcher.address}, expected ${BALANCE_FETCHER_ADDRESS}`)
  }
}

async function deployPreBOOM() {
  if(await isDeployed(PRE_BOOM_ADDRESS)) {
    preboom = await ethers.getContractAt("PreBOOM", PRE_BOOM_ADDRESS, boombotsdeployer) as PreBOOM;
  } else {
    console.log("Deploying PreBOOM");
    let args = [boombotsdeployer.address, BLAST_ADDRESS, GAS_COLLECTOR_ADDRESS];
    preboom = await deployContractUsingContractFactory(boombotsdeployer, "PreBOOM", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as PreBOOM;
    console.log(`Deployed PreBOOM to ${preboom.address}`);
    if(chainID != 31337) await verifyContract(preboom.address, args);
    if(!!PRE_BOOM_ADDRESS && preboom.address != PRE_BOOM_ADDRESS) throw new Error(`Deployed PreBOOM to ${preboom.address}, expected ${PRE_BOOM_ADDRESS}`)
  }
}

async function deployMockUSDB() {
  if(await isDeployed(MOCK_USDB_ADDRESS)) {
    mockusdb = await ethers.getContractAt("MockERC20Rebasing", MOCK_USDB_ADDRESS, boombotsdeployer) as MockERC20Rebasing;
  } else {
    console.log("Deploying MockUSDB");
    let args = [
      'Mock Rebasing USDB',
      'mUSDB',
      18,
      500
    ];
    mockusdb = await deployContractUsingContractFactory(boombotsdeployer, "MockERC20Rebasing", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as MockERC20Rebasing;
    console.log(`Deployed MockUSDB to ${mockusdb.address}`);
    if(chainID != 31337) await verifyContract(mockusdb.address, args);
    if(!!MOCK_USDB_ADDRESS && mockusdb.address != MOCK_USDB_ADDRESS) throw new Error(`Deployed MockUSDB to ${mockusdb.address}, expected ${MOCK_USDB_ADDRESS}`)
  }
}

async function deployRingProtocolModuleB() {
  if(await isDeployed(RING_PROTOCOL_MODULE_B_ADDRESS)) {
    ringProtocolModuleB = await ethers.getContractAt("RingProtocolModuleB", RING_PROTOCOL_MODULE_B_ADDRESS, boombotsdeployer) as RingProtocolModuleB;
  } else {
    console.log("Deploying RingProtocolModuleB");
    let args = [BLAST_ADDRESS, GAS_COLLECTOR_ADDRESS];
    ringProtocolModuleB = await deployContractUsingContractFactory(boombotsdeployer, "RingProtocolModuleB", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as RingProtocolModuleB;
    console.log(`Deployed RingProtocolModuleB to ${ringProtocolModuleB.address}`);
    if(chainID != 31337) await verifyContract(ringProtocolModuleB.address, args);
    if(!!RING_PROTOCOL_MODULE_B_ADDRESS && ringProtocolModuleB.address != RING_PROTOCOL_MODULE_B_ADDRESS) throw new Error(`Deployed ModulePack100 to ${ringProtocolModuleB.address}, expected ${RING_PROTOCOL_MODULE_B_ADDRESS}`)
  }
}


function logAddresses() {
  console.log("");
  console.log("| Contract Name                | Address                                      |");
  console.log("|------------------------------|----------------------------------------------|");
  logContractAddress("ERC6551Registry", ERC6551Registry);
  logContractAddress("ContractFactory", contractFactory.address);
  logContractAddress("GasCollector", gasCollector.address);
  logContractAddress("BoomBotsNFT", boomBotsNft.address);
  logContractAddress("BoomBotsAccount", accountImplementation.address);
  logContractAddress("ModulePack102", modulePack102.address);
  logContractAddress("DataStore", dataStore.address);
  logContractAddress("Factory01", factory01.address);
  logContractAddress("Factory02", factory02.address);
  logContractAddress("BalanceFetcher", balanceFetcher.address);
  logContractAddress("PreBOOM", preboom.address);
  logContractAddress("MockUSDB", mockusdb.address);
  logContractAddress("RingProtocolModuleB", ringProtocolModuleB.address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
