import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const blasttestnetuser3 = new ethers.Wallet(accounts.blasttestnetuser3.key, provider);

import { BoomBots, BoomBotAccount, ModulePack100, BoomBotsFactory, DataStore, RingProtocolModuleA, IBlast } from "../../typechain-types";

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
const BLAST_ADDRESS                   = "0x4300000000000000000000000000000000000002";

const BOOM_BOTS_NFT_ADDRESS           = "0x2b119FA2796215f627344509581D8F39D742317F";
const ACCOUNT_IMPLEMENTATION_ADDRESS  = "0xf24f3A8a7D49031eD95EBD13774BA77a6a470b80";
const MODULE_PACK_100_ADDRESS         = "0xdD0b84cB4DA1a1D1c262Cc4009036417BB3165eb";
const DATA_STORE_ADDRESS              = "0xaf724B10370130c1E106FdA3da0b71D812A570d8";
const BOOM_BOTS_FACTORY_ADDRESS       = "0x53A4f1C1b2D9603B3D3ae057B075a0EDC3d7A615";
const RING_PROTOCOL_MODULE_A_ADDRESS  = "0xD071924d2eD9cF44dB9a62A88A80E9bED9782711";

let boomBotsNft: BoomBots;
let boomBotsNftMC: any;
let accountImplementation: BoomBotAccount; // the base implementation for boom bot accounts
let modulePack100: ModulePack100;
let dataStore: DataStore;
let factory: BoomBotsFactory;
let ringProtocolModuleA: RingProtocolModuleA;

let abi = getCombinedAbi([
  "artifacts/contracts/accounts/BoomBotAccount.sol/BoomBotAccount.json",
  "artifacts/contracts/modules/ModulePack100.sol/ModulePack100.json",
  "artifacts/contracts/modules/RingProtocolModuleA.sol/RingProtocolModuleA.json",
  "artifacts/contracts/libraries/Errors.sol/Errors.json",
])

let botID129 = 129
let botAddress129 = "0x1144108d5eA65E03294ca56657EC6cb44852491e"
let accountProxy129: any;
let iblast: IBlast;

async function main() {
  console.log(`Using ${boombotseth.address} as boombotseth`);
  console.log(`Using ${blasttestnetuser3.address} as blasttestnetuser3`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    return ((chainID == chainid)/* || ((chainID == 31337) && (process.env.FORK_NETWORK === chainName))*/);
  }
  if(!isChain(168587773, "blastsepolia")) throw("Only run this on Blast Sepolia. Cannot use a local fork");
  //await expectDeployed(ERC6551_REGISTRY_ADDRESS)

  accountProxy129 = await ethers.getContractAt(abi, botAddress129, blasttestnetuser3);
  iblast = await ethers.getContractAt("IBlast", BLAST_ADDRESS, boombotseth) as IBlast;

  //boomBotsNft = await ethers.getContractAt("BoomBots", BOOM_BOTS_NFT_ADDRESS, boombotseth) as BoomBots;
  //mcContract = new MulticallContract(mcProvider._multicallAddress, ABI_MULTICALL)
  //boomBotsNftMC = new MulticallContract(BOOM_BOTS_NFT_ADDRESS, ABI_BOOM_BOTS_NFT)
  //accountImplementation = await ethers.getContractAt("BoomBotAccount", ACCOUNT_IMPLEMENTATION_ADDRESS, boombotseth) as BoomBotAccount;
  //modulePack100 = await ethers.getContractAt("ModulePack100", MODULE_PACK_100_ADDRESS, boombotseth) as ModulePack100;
  //dataStore = await ethers.getContractAt("DataStore", DATA_STORE_ADDRESS, boombotseth) as DataStore;
  //factory = await ethers.getContractAt("BoomBotsFactory", BOOM_BOTS_FACTORY_ADDRESS, boombotseth) as BoomBotsFactory;
  ringProtocolModuleA = await ethers.getContractAt("RingProtocolModuleA", RING_PROTOCOL_MODULE_A_ADDRESS, boombotseth) as RingProtocolModuleA;

  //await useBot129_1();
  //await useBot129_2();
}

// install and execute
async function useBot129_1() {
  console.log("Using bot 129_1")

  /*
  // describe
  console.log("Describing")
  let token = await accountProxy129.token();
  console.log('token')
  console.log(token)
  let owner = await accountProxy129.owner();
  console.log('owner')
  console.log(owner)
  console.log(owner == blasttestnetuser3.address)
  */

  let ethAmount1 = WeiPerEther.mul(5).div(1000)
  let ethAmount2 = ethAmount1.mul(9).div(10)
  //let sighashes = calcSighashes(ringProtocolModuleA, 'RingProtocolModuleA')
  let sighashes = ['0xb7937b97'] // executeRingProtocolModuleA(uint256)
  let delegatecalldata = accountProxy129.interface.encodeFunctionData("executeRingProtocolModuleA", [ethAmount2])
  let tx = await accountProxy129.connect(blasttestnetuser3).diamondCut([{
    facetAddress: ringProtocolModuleA.address,
    action: FacetCutAction.Add,
    functionSelectors: sighashes
  }], ringProtocolModuleA.address, delegatecalldata, {...networkSettings.overrides, value: ethAmount1, gasLimit: 2_000_000}); // and delegatecall
  await tx.wait(networkSettings.confirmations)
  console.log("Used bot 129_1")
}

// execute
async function useBot129_2() {
  console.log("Using bot 129_2")
  let ethAmount1 = WeiPerEther.mul(5).div(1000)
  let ethAmount2 = ethAmount1.mul(9).div(10)
  let tx = await accountProxy129.connect(blasttestnetuser3).executeRingProtocolModuleA(ethAmount2, {...networkSettings.overrides, value: ethAmount1, gasLimit: 2_000_000});
  await tx.wait(networkSettings.confirmations)
  console.log("Used bot 129_2")
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
