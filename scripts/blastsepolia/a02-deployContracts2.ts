import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const boombotsdeployer = new ethers.Wallet(accounts.boombotsdeployer.key, provider);

import { BoomBots, BoomBotAccount, ModulePack100, BoomBotsFactory, DataStore, RingProtocolModuleA, GasQuoterModuleA } from "../../typechain-types";

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

const DATA_STORE_ADDRESS              = "0xaf724B10370130c1E106FdA3da0b71D812A570d8"; // v0.1.0
const RING_PROTOCOL_MODULE_A_ADDRESS  = "0xD071924d2eD9cF44dB9a62A88A80E9bED9782711"; // v0.1.0
const GAS_QUOTER_MODULE_A_ADDRESS     = "0x3eA984bda93FbF884c6af77D1f90C3eC01419752"; // v0.1.1

let dataStore: DataStore;
let ringProtocolModuleA: RingProtocolModuleA;
let gasQuoterModuleA: GasQuoterModuleA;

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

  dataStore = await ethers.getContractAt("DataStore", DATA_STORE_ADDRESS, boombotsdeployer) as DataStore;

  await deployRingProtocolModuleA();
  await deployGasQuoterModuleA();
  await whitelistModules();
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

async function deployGasQuoterModuleA() {
  if(await isDeployed(GAS_QUOTER_MODULE_A_ADDRESS)) {
    gasQuoterModuleA = await ethers.getContractAt("GasQuoterModuleA", GAS_QUOTER_MODULE_A_ADDRESS, boombotsdeployer) as GasQuoterModuleA;
  } else {
    console.log("Deploying GasQuoterModuleA");
    let args = [];
    gasQuoterModuleA = await deployContractUsingContractFactory(boombotsdeployer, "GasQuoterModuleA", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as GasQuoterModuleA;
    console.log(`Deployed GasQuoterModuleA to ${gasQuoterModuleA.address}`);
    if(chainID != 31337) await verifyContract(gasQuoterModuleA.address, args);
    if(!!GAS_QUOTER_MODULE_A_ADDRESS && gasQuoterModuleA.address != GAS_QUOTER_MODULE_A_ADDRESS) throw new Error(`Deployed ModulePack100 to ${gasQuoterModuleA.address}, expected ${GAS_QUOTER_MODULE_A_ADDRESS}`)
  }
}

async function whitelistModules() {
  /*
  let isWhitelisted = await dataStore.connect(boombotseth).moduleCanBeInstalled(ringProtocolModuleA.address)
  if(!isWhitelisted) {
    console.log("Whitelisting modules")
    let tx = await dataStore.connect(boombotsdeployer).setModuleWhitelist([
      {
        module: ringProtocolModuleA.address,
        shouldWhitelist: true,
      }
    ], networkSettings.overrides)
    await tx.wait(networkSettings.confirmations)
    console.log("Whitelisted modules")
  }
  */
  let expectedSettings = [
    {
      module: ringProtocolModuleA.address,
      shouldWhitelist: true,
    },
    {
      module: gasQuoterModuleA.address,
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

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
