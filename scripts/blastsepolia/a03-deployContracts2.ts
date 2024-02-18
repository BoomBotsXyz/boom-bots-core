import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const boombotsdeployer = new ethers.Wallet(accounts.boombotsdeployer.key, provider);

import { BoomBots, BoomBotAccount, ModulePack100, BoomBotsFactory01, BoomBotsFactory02, RingProtocolModuleA, RingProtocolModuleB, BalanceFetcher, MockERC20Rebasing, PreBOOM } from "../../typechain-types";

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

const BLAST_ADDRESS                   = "0x4300000000000000000000000000000000000002";

const DATA_STORE_ADDRESS              = "0x4092c948cE402c18c8Ad6342859dEe8bcAD932bC"; // v0.1.1
const RING_PROTOCOL_MODULE_A_ADDRESS  = "0xD071924d2eD9cF44dB9a62A88A80E9bED9782711"; // v0.1.0
const RING_PROTOCOL_MODULE_B_ADDRESS  = "0x6D48d58b6E04aD003E8e49EE298d965658eBb7E8"; // v0.1.1

const BALANCE_FETCHER_ADDRESS         = "0x183D60a574Ef5F75e65e3aC2190b8B1Ad0707d71"; // v0.1.1
const PRE_BOOM_ADDRESS                = "0xf10C6886e26204F61cA9e0E89db74b7774d7ADa6"; // v0.1.1
const MOCK_USDB_ADDRESS               = "0x3114ded1fA1b406e270A65a21bC96E86C171a244"; // v0.1.1

let ringProtocolModuleA: RingProtocolModuleA;
let ringProtocolModuleB: RingProtocolModuleB;

let balanceFetcher: BalanceFetcher;
let preboom: PreBOOM;
let mockusdb: MockERC20Rebasing;

async function main() {
  console.log(`Using ${boombotseth.address} as boombotseth`);
  console.log(`Using ${boombotsdeployer.address} as boombotsdeployer`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    return ((chainID === chainid) || ((chainID === 31337) && (process.env.FORK_NETWORK === chainName)));
  }
  if(!isChain(168587773, "blastsepolia")) throw("Only run this on Blast Sepolia or a local fork of Blast Sepolia");

  await deployRingProtocolModuleA();
  await deployRingProtocolModuleB();

  await deployBalanceFetcher();
  await deployPreBOOM();
  await deployMockUSDB();
}

async function deployRingProtocolModuleA() {
  if(await isDeployed(RING_PROTOCOL_MODULE_A_ADDRESS)) {
    ringProtocolModuleA = await ethers.getContractAt("RingProtocolModuleA", RING_PROTOCOL_MODULE_A_ADDRESS, boombotsdeployer) as RingProtocolModuleA;
  } else {
    console.log("Deploying RingProtocolModuleA");
    let args = [];
    ringProtocolModuleA = await deployContractUsingContractFactory(boombotsdeployer, "RingProtocolModuleA", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as RingProtocolModuleA;
    console.log(`Deployed RingProtocolModuleA to ${ringProtocolModuleA.address}`);
    if(chainID != 31337) await verifyContract(ringProtocolModuleA.address, args);
    if(!!RING_PROTOCOL_MODULE_A_ADDRESS && ringProtocolModuleA.address != RING_PROTOCOL_MODULE_A_ADDRESS) throw new Error(`Deployed ModulePack100 to ${ringProtocolModuleA.address}, expected ${RING_PROTOCOL_MODULE_A_ADDRESS}`)
  }
}

async function deployRingProtocolModuleB() {
  if(await isDeployed(RING_PROTOCOL_MODULE_B_ADDRESS)) {
    ringProtocolModuleB = await ethers.getContractAt("RingProtocolModuleB", RING_PROTOCOL_MODULE_B_ADDRESS, boombotsdeployer) as RingProtocolModuleB;
  } else {
    console.log("Deploying RingProtocolModuleB");
    let args = [boombotsdeployer.address];
    ringProtocolModuleB = await deployContractUsingContractFactory(boombotsdeployer, "RingProtocolModuleB", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as RingProtocolModuleB;
    console.log(`Deployed RingProtocolModuleB to ${ringProtocolModuleB.address}`);
    if(chainID != 31337) await verifyContract(ringProtocolModuleB.address, args);
    if(!!RING_PROTOCOL_MODULE_B_ADDRESS && ringProtocolModuleB.address != RING_PROTOCOL_MODULE_B_ADDRESS) throw new Error(`Deployed ModulePack100 to ${ringProtocolModuleB.address}, expected ${RING_PROTOCOL_MODULE_B_ADDRESS}`)
  }
}

async function deployBalanceFetcher() {
  if(await isDeployed(BALANCE_FETCHER_ADDRESS)) {
    balanceFetcher = await ethers.getContractAt("BalanceFetcher", BALANCE_FETCHER_ADDRESS, boombotsdeployer) as BalanceFetcher;
  } else {
    console.log("Deploying BalanceFetcher");
    let args = [boombotsdeployer.address];
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
    let args = [boombotsdeployer.address];
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

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
