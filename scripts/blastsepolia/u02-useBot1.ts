import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const blasttestnetuser2 = new ethers.Wallet(accounts.blasttestnetuser2.key, provider);

import { BoomBots, BoomBotAccount, ModulePack100, BoomBotsFactory, DataStore } from "../../typechain-types";

import { delay } from "./../utils/misc";
import { isDeployed, expectDeployed } from "./../utils/expectDeployed";
import { logContractAddress } from "./../utils/logContractAddress";
import { getNetworkSettings } from "./../utils/getNetworkSettings";
import { deployContractUsingContractFactory, verifyContract } from "./../utils/deployContract";
import { toBytes32 } from "./../utils/setStorage";
import { getSelectors, FacetCutAction, calcSighash, calcSighashes, getCombinedAbi } from "./../utils/diamond"
import { MulticallProvider, MulticallContract } from "./../utils/multicall";
import { multicallChunked } from "./../utils/network";

const { AddressZero, WeiPerEther, MaxUint256 } = ethers.constants;

let networkSettings: any;
let chainID: number;

const fs = require("fs")
const ABI_MULTICALL = JSON.parse(fs.readFileSync("data/abi/other/Multicall3.json").toString())
const ABI_BOOM_BOTS_NFT = JSON.parse(fs.readFileSync("data/abi/BoomBots/tokens/BoomBots.json").toString())
let mcProvider = new MulticallProvider(provider, 168587773);

const ERC6551_REGISTRY_ADDRESS        = "0x000000006551c19487814612e58FE06813775758";
const BOOM_BOTS_NFT_ADDRESS           = "0x2b119FA2796215f627344509581D8F39D742317F";
const ACCOUNT_IMPLEMENTATION_ADDRESS  = "0xf24f3A8a7D49031eD95EBD13774BA77a6a470b80";
const MODULE_PACK_100_ADDRESS         = "0xdD0b84cB4DA1a1D1c262Cc4009036417BB3165eb";
const DATA_STORE_ADDRESS              = "0xaf724B10370130c1E106FdA3da0b71D812A570d8";
const BOOM_BOTS_FACTORY_ADDRESS       = "0x53A4f1C1b2D9603B3D3ae057B075a0EDC3d7A615";

let boomBotsNft: BoomBots;
let boomBotsNftMC: any;
let accountImplementation: BoomBotAccount; // the base implementation for boom bot accounts
let modulePack100: ModulePack100;
let dataStore: DataStore;
let factory: BoomBotsFactory;

let abi = getCombinedAbi([
  "artifacts/contracts/accounts/BoomBotAccount.sol/BoomBotAccount.json",
  "artifacts/contracts/modules/ModulePack100.sol/ModulePack100.json",
  "artifacts/contracts/libraries/Errors.sol/Errors.json",
])


async function main() {
  console.log(`Using ${boombotseth.address} as boombotseth`);
  console.log(`Using ${blasttestnetuser2.address} as blasttestnetuser2`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    return ((chainID == chainid)/* || ((chainID == 31337) && (process.env.FORK_NETWORK === chainName))*/);
  }
  if(!isChain(168587773, "blastsepolia")) throw("Only run this on Blast Sepolia. Cannot use a local fork");

  await useBot1();
}

async function useBot1() {
  console.log("Using bot 1")
  let botAddress1 = "0x205F327ADE02628e831f73282F92510DfecFAA04"
  let botAddress2 = "0x63D28325406c3fDEf901fba6320440626C12ffDc"
  let botAddress3 = "0x93d0A21b7c9Dcd97Af132503935bD408b8112Ee5"
  let botAddress4 = "0x97F58b36b338D2D37D207750b55C67950bD4800F"
  let botAddress5 = "0x902B9499bdc66066C0c2a31De8127f7C57CFEA93"
  let accountProxy1 = await ethers.getContractAt(abi, botAddress1, boombotseth);
  let tx = await accountProxy1.execute(botAddress2, WeiPerEther.mul(1).div(100), "0x", 0, {...networkSettings.overrides, gasLimit:1_000_000, value: WeiPerEther.mul(3).div(100)})
  console.log('tx')
  console.log(tx)
  await tx.wait(networkSettings.confirmations)
  console.log("Used bot 1")
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
