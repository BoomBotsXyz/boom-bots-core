import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const boombotsdeployer = new ethers.Wallet(accounts.boombotsdeployer.key, provider);

import { BoomBots, BoomBotAccount, ModulePack100, BoomBotsFactory01, BoomBotsFactory02, DataStore } from "../../typechain-types";

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

const BOOM_BOTS_NFT_ADDRESS           = "0xB3856D22fE476892Af3Cc6dee3D84F015AD5F5b1"; // v0.1.1
const ACCOUNT_IMPLEMENTATION_ADDRESS  = "0x152d3Ba1f7ac4a0AD0ec485b6A292B1F92aB8876"; // v0.1.1
const MODULE_PACK_100_ADDRESS         = "0x044CA8B45C270E744BDaE436E7FA861c6de6b5A5"; // v0.1.0
const MODULE_PACK_101_ADDRESS         = "0x0ea0b9aF8dD6D2C294281E7a983909BA81Bbb199"; // v0.1.1
const DATA_STORE_ADDRESS              = "0x4092c948cE402c18c8Ad6342859dEe8bcAD932bC"; // v0.1.1
const BOOM_BOTS_FACTORY01_ADDRESS     = "0x0B0eEBa9CC8035D8EB2516835E57716f0eAE7B73"; // v0.1.1
const BOOM_BOTS_FACTORY02_ADDRESS     = "0xf57E8cCFD2a415aEc9319E5bc1ABD19aAF130bA1"; // v0.1.1

let boomBotsNft: BoomBots;
let boomBotsNftMC: any;
let accountImplementation: BoomBotAccount; // the base implementation for boom bot accounts
let modulePack100: ModulePack100;
let dataStore: DataStore;
let factory01: BoomBotsFactory01;
let factory02: BoomBotsFactory02;

async function main() {
  console.log(`Using ${boombotseth.address} as boombotseth`);
  console.log(`Using ${boombotsdeployer.address} as boombotsdeployer`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    return ((chainID == chainid)/* || ((chainID == 31337) && (process.env.FORK_NETWORK === chainName))*/);
  }
  if(!isChain(168587773, "blastsepolia")) throw("Only run this on Blast Sepolia. Cannot use a local fork");

  boomBotsNft = await ethers.getContractAt("BoomBots", BOOM_BOTS_NFT_ADDRESS, boombotseth) as BoomBots;
  boomBotsNftMC = new MulticallContract(BOOM_BOTS_NFT_ADDRESS, ABI_BOOM_BOTS_NFT)
  factory01 = await ethers.getContractAt("BoomBotsFactory01", BOOM_BOTS_FACTORY01_ADDRESS, boombotseth) as BoomBotsFactory01;
  factory02 = await ethers.getContractAt("BoomBotsFactory02", BOOM_BOTS_FACTORY02_ADDRESS, boombotseth) as BoomBotsFactory02;

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
  await createBot(boombotsdeployer, 2);
  //await createBot(boombotseth, 3);
  //await createBot(boombotsdeployer, 2);
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

async function createBot(creator=boombotseth, createSettingsID=1) {
  console.log(`Creating new bot`)
  //let tx = await factory01.connect(creator)['createBot(uint256)'](createSettingsID, {...networkSettings.overrides, gasLimit: 2_000_000})
  let tx = await factory02.connect(creator)['createBot(uint256)'](createSettingsID, {...networkSettings.overrides, gasLimit: 2_000_000})
  await watchTxForCreatedBotID(tx)
}

async function createBotsMulticall(creator=boombotseth, numBots=5, createSettingsID=1) {
  console.log(`Creating ${numBots} new bots`)
  let txdata = factory01.interface.encodeFunctionData('createBot(uint256)', [createSettingsID])
  let txdatas = [] as any[]
  for(let i = 0; i < numBots; i++) txdatas.push(txdata)
  //let tx = await factory01.connect(creator).multicall(txdatas, {...networkSettings.overrides, gasLimit: 2_000_000*numBots})
  let tx = await factory02.connect(creator).multicall(txdatas, {...networkSettings.overrides, gasLimit: 2_000_000*numBots})
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
