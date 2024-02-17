import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const boombotsdeployer = new ethers.Wallet(accounts.boombotsdeployer.key, provider);

import { BoomBots, BoomBotAccount, ModulePack100, BoomBotsFactory, DataStore, RingProtocolModuleA, RingProtocolModuleB, BalanceFetcher, MockERC20Rebasing, PreBOOM } from "../../typechain-types";

import { delay } from "./../utils/misc";
import { isDeployed, expectDeployed } from "./../utils/expectDeployed";
import { logContractAddress } from "./../utils/logContractAddress";
import { getNetworkSettings } from "./../utils/getNetworkSettings";
import { deployContractUsingContractFactory, verifyContract } from "./../utils/deployContract";
import { toBytes32 } from "./../utils/setStorage";
import { getSelectors, FacetCutAction, calcSighash, calcSighashes, getCombinedAbi } from "./../utils/diamond"

const { AddressZero, WeiPerEther, MaxUint256 } = ethers.constants;
const { formatUnits } = ethers.utils;

let networkSettings: any;
let chainID: number;

const BLAST_ADDRESS                   = "0x4300000000000000000000000000000000000002";

const DATA_STORE_ADDRESS              = "0x4092c948cE402c18c8Ad6342859dEe8bcAD932bC"; // v0.1.1
const RING_PROTOCOL_MODULE_A_ADDRESS  = "0xD071924d2eD9cF44dB9a62A88A80E9bED9782711"; // v0.1.0
const RING_PROTOCOL_MODULE_B_ADDRESS  = "0x6D48d58b6E04aD003E8e49EE298d965658eBb7E8"; // v0.1.1

const BALANCE_FETCHER_ADDRESS         = "0x183D60a574Ef5F75e65e3aC2190b8B1Ad0707d71"; // v0.1.1
const PRE_BOOM_ADDRESS                = "0xf10C6886e26204F61cA9e0E89db74b7774d7ADa6"; // v0.1.1
const MOCK_USDB_ADDRESS               = "0xc967D8dE80f2eD6ABd2FA597e920A9744cDc71a6"; // v0.1.1

let dataStore: DataStore;
let ringProtocolModuleA: RingProtocolModuleA;
let ringProtocolModuleB: RingProtocolModuleB;

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
  //await expectDeployed(ERC6551_REGISTRY_ADDRESS)

  dataStore = await ethers.getContractAt("DataStore", DATA_STORE_ADDRESS, boombotsdeployer) as DataStore;

  //ringProtocolModuleA = await ethers.getContractAt("RingProtocolModuleA", RING_PROTOCOL_MODULE_A_ADDRESS, boombotsdeployer) as RingProtocolModuleA;
  //ringProtocolModuleB = await ethers.getContractAt("RingProtocolModuleB", RING_PROTOCOL_MODULE_B_ADDRESS, boombotsdeployer) as RingProtocolModuleB;

  preboom = await ethers.getContractAt("PreBOOM", PRE_BOOM_ADDRESS, boombotsdeployer) as PreBOOM;

  await whitelistModules();

  await checkMinterRole()

  let bot9Address = "0xab19214Cb88F29F1cCD4e97E361Ba9F83c6c90c0"

  //await mintPreBOOM(boombotsdeployer.address, WeiPerEther.mul(1000));
  //await mintPreBOOM(boombotseth.address, WeiPerEther.mul(1000));
  //await mintPreBOOM(bot9Address, WeiPerEther.mul(1000));
}

async function whitelistModules() {
  let expectedSettings = [
    {
      module: RING_PROTOCOL_MODULE_A_ADDRESS,
      shouldWhitelist: true,
    },
    {
      module: RING_PROTOCOL_MODULE_B_ADDRESS,
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

async function mintPreBOOM(to:string, amount:any) {
  console.log(`Minting ${formatUnits(amount)} PreBOOM to ${to}`)
  let tx = await preboom.connect(boombotsdeployer).mint(to, amount, networkSettings.overrides)
  await tx.wait(networkSettings.confirmations)
  console.log(`Minted PreBOOM`)
}

async function checkMinterRole() {
  let isMinter = await preboom.isMinter(boombotsdeployer.address)
  if(!isMinter) {
    console.log(`Setting minter role`)
    let params = [{
      account: boombotsdeployer.address,
      isMinter: true
    }]
    let tx = await preboom.connect(boombotsdeployer).setMinters(params, networkSettings.overrides)
    await tx.wait(networkSettings.confirmations)
    console.log(`Set minter role`)
  }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
