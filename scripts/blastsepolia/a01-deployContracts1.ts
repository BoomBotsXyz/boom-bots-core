import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const boombotsdeployer = new ethers.Wallet(accounts.boombotsdeployer.key, provider);

import { BoomBots, BoomBotAccount, ModulePack100, ModulePack101, BoomBotsFactory, DataStore, IBlast, MockBlastableAccount, ContractFactory,  } from "../../typechain-types";

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

const CONTRACT_FACTORY_ADDRESS        = "0xa43C26F8cbD9Ea70e7B0C45e17Af81B6330AC543"; // v0.1.1

const BOOM_BOTS_NFT_ADDRESS           = "0xB3856D22fE476892Af3Cc6dee3D84F015AD5F5b1"; // v0.1.1
const ACCOUNT_IMPLEMENTATION_ADDRESS  = "0x152d3Ba1f7ac4a0AD0ec485b6A292B1F92aB8876"; // v0.1.1
const MODULE_PACK_100_ADDRESS         = "0x044CA8B45C270E744BDaE436E7FA861c6de6b5A5"; // v0.1.0
const MODULE_PACK_101_ADDRESS         = "0x0ea0b9aF8dD6D2C294281E7a983909BA81Bbb199"; // v0.1.1
const DATA_STORE_ADDRESS              = "0x4092c948cE402c18c8Ad6342859dEe8bcAD932bC"; // v0.1.1
const BOOM_BOTS_FACTORY_ADDRESS       = "0x0B0eEBa9CC8035D8EB2516835E57716f0eAE7B73"; // v0.1.1

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
  await deployModulePack100();
  await deployModulePack101();
  await deployDataStore();
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

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
