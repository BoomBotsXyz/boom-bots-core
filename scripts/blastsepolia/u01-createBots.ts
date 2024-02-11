import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const boombotsdeployer = new ethers.Wallet(accounts.boombotsdeployer.key, provider);

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

async function main() {
  console.log(`Using ${boombotseth.address} as boombotseth`);
  console.log(`Using ${boombotsdeployer.address} as boombotsdeployer`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    return ((chainID === chainid) || ((chainID === 31337) && (process.env.FORK_NETWORK === chainName)));
  }
  if(!isChain(168587773, "blastsepolia")) throw("Only run this on Blast Sepolia or a local fork of Blast Sepolia");

  boomBotsNft = await ethers.getContractAt("BoomBots", BOOM_BOTS_NFT_ADDRESS, boombotseth) as BoomBots;
  boomBotsNftMC = new MulticallContract(BOOM_BOTS_NFT_ADDRESS, ABI_BOOM_BOTS_NFT)
  factory = await ethers.getContractAt("BoomBotsFactory", BOOM_BOTS_FACTORY_ADDRESS, boombotseth) as BoomBotsFactory;

  await listBots();
  await createBots();
  await listBots();
}

async function listBots() {
  let ts = (await boomBotsNft.totalSupply()).toNumber();
  console.log(`Number bots created: ${ts}`);
  if(ts == 0) return;
  console.log("Info:")
  let calls = [] as any[]
  for(let botID = 1; botID <= ts; botID++) {
    calls.push(boomBotsNftMC.getBotInfo(botID))
    calls.push(boomBotsNftMC.ownerOf(botID))
  }
  const results = await multicallChunked(mcProvider, calls, "latest", 200)
  for(let botID = 1; botID <= ts; botID++) {
    console.log(`Bot ID ${botID}`)
    let botInfo = results[botID*2-2]
    let botAddress = botInfo.botAddress
    let implementationAddress = botInfo.implementationAddress
    let owner = results[botID*2-1]
    console.log(`  Bot Address   ${botAddress}`)
    console.log(`  TBA Impl      ${implementationAddress}`)
    console.log(`  Owner         ${owner}`)
  }
}

async function createBots() {
  await createBot(boombotsdeployer);
  /*
  await createBot(boombotsdeployer);
  await createBot(boombotseth);
  await createBot(boombotsdeployer);
  await createBot(boombotseth);
  await createBot(boombotsdeployer);
  await createBot(boombotseth);
  await createBot(boombotsdeployer);
  await createBot(boombotseth);
  */
  //await createBotsMulticall(boombotseth, 5);
  //await createBotsMulticall(boombotsdeployer, 5);
}

async function createBot(creator=boombotseth) {
  console.log(`Creating new bot`)
  let tx = await factory.connect(creator)['createBot()']({...networkSettings.overrides, gasLimit: 1_500_000})
  await watchTxForCreatedBotID(tx)
}

async function createBotsMulticall(creator=boombotseth, numBots=5) {
  console.log(`Creating ${numBots} new bots`)
  let txdata = factory.interface.encodeFunctionData('createBot()', [])
  let txdatas = [] as any[]
  for(let i = 0; i < numBots; i++) txdatas.push(txdata)
  let tx = await factory.connect(creator).multicall(txdatas, {...networkSettings.overrides, gasLimit: 1_500_000*numBots})
  await watchTxForCreatedBotID(tx)
}

async function watchTxForCreatedBotID(tx:any) {
  console.log("tx:", tx);
  let receipt = await tx.wait(networkSettings.confirmations);
  if(!receipt || !receipt.events || receipt.events.length == 0) {
    console.log(receipt)
    throw new Error("events not found");
  }
  let createEvents = (receipt.events as any).filter((event:any) => {
    if(event.address != BOOM_BOTS_NFT_ADDRESS) return false
    if(event.topics.length != 4) return false;
    if(event.topics[0] != "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") return false // transfer topic
    if(event.topics[1] != "0x0000000000000000000000000000000000000000000000000000000000000000") return false // from address zero
    return true
  });
  if(createEvents.length == 0) {
    throw new Error("Create event not detected")
  }
  if(createEvents.length == 1) {
    let createEvent = createEvents[0]
    let botID = BN.from(createEvent.topics[3]).toNumber()
    console.log(`Created 1 bot. botID ${botID}`)
    return botID
  }
  if(createEvents.length > 1) {
    let botIDs = createEvents.map((createEvent:any) => BN.from(createEvent.topics[3]).toNumber())
    console.log(`Created ${botIDs.length} bots. Bot IDs ${botIDs.join(', ')}`)
    return botIDs
  }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
