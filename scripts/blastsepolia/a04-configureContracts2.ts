import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const boombotsdeployer = new ethers.Wallet(accounts.boombotsdeployer.key, provider);

import { BoomBots, BoomBotAccount, ModulePack100, BoomBotsFactory01, BoomBotsFactory02, DataStore, RingProtocolModuleA, RingProtocolModuleB, BalanceFetcher, MockERC20Rebasing, PreBOOM } from "../../typechain-types";

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

const BOOM_BOTS_NFT_ADDRESS           = "0xB3856D22fE476892Af3Cc6dee3D84F015AD5F5b1"; // v0.1.1
const ACCOUNT_IMPLEMENTATION_ADDRESS  = "0x152d3Ba1f7ac4a0AD0ec485b6A292B1F92aB8876"; // v0.1.1
const MODULE_PACK_100_ADDRESS         = "0x044CA8B45C270E744BDaE436E7FA861c6de6b5A5"; // v0.1.0
const MODULE_PACK_101_ADDRESS         = "0x0ea0b9aF8dD6D2C294281E7a983909BA81Bbb199"; // v0.1.1
const DATA_STORE_ADDRESS              = "0x4092c948cE402c18c8Ad6342859dEe8bcAD932bC"; // v0.1.1
const BOOM_BOTS_FACTORY01_ADDRESS     = "0x0B0eEBa9CC8035D8EB2516835E57716f0eAE7B73"; // v0.1.1
const BOOM_BOTS_FACTORY02_ADDRESS     = "0xf57E8cCFD2a415aEc9319E5bc1ABD19aAF130bA1"; // v0.1.1

const RING_PROTOCOL_MODULE_A_ADDRESS  = "0xD071924d2eD9cF44dB9a62A88A80E9bED9782711"; // v0.1.0
const RING_PROTOCOL_MODULE_B_ADDRESS  = "0x6D48d58b6E04aD003E8e49EE298d965658eBb7E8"; // v0.1.1

const BALANCE_FETCHER_ADDRESS         = "0x183D60a574Ef5F75e65e3aC2190b8B1Ad0707d71"; // v0.1.1
const PRE_BOOM_ADDRESS                = "0xf10C6886e26204F61cA9e0E89db74b7774d7ADa6"; // v0.1.1
const MOCK_USDB_ADDRESS               = "0x3114ded1fA1b406e270A65a21bC96E86C171a244"; // v0.1.1

let factory02: BoomBotsFactory02;
let dataStore: DataStore;
let ringProtocolModuleA: RingProtocolModuleA;
let ringProtocolModuleB: RingProtocolModuleB;

let mockusdb: MockERC20Rebasing;
let preboom: PreBOOM;

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

  factory02 = await ethers.getContractAt("BoomBotsFactory02", BOOM_BOTS_FACTORY02_ADDRESS, boombotsdeployer) as BoomBotsFactory02;
  dataStore = await ethers.getContractAt("DataStore", DATA_STORE_ADDRESS, boombotsdeployer) as DataStore;

  //ringProtocolModuleA = await ethers.getContractAt("RingProtocolModuleA", RING_PROTOCOL_MODULE_A_ADDRESS, boombotsdeployer) as RingProtocolModuleA;
  //ringProtocolModuleB = await ethers.getContractAt("RingProtocolModuleB", RING_PROTOCOL_MODULE_B_ADDRESS, boombotsdeployer) as RingProtocolModuleB;

  mockusdb = await ethers.getContractAt("MockERC20Rebasing", MOCK_USDB_ADDRESS, boombotsdeployer) as MockERC20Rebasing;
  preboom = await ethers.getContractAt("PreBOOM", PRE_BOOM_ADDRESS, boombotsdeployer) as PreBOOM;

  await whitelistModules();

  await checkMinterRole()

  let bot9Address = "0xab19214Cb88F29F1cCD4e97E361Ba9F83c6c90c0"

  //await mintPreBOOM(boombotsdeployer.address, WeiPerEther.mul(1000));
  //await mintPreBOOM(boombotseth.address, WeiPerEther.mul(1000));
  //await mintPreBOOM(bot9Address, WeiPerEther.mul(1000));

  //await transferFundsToFactory02();
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

async function transferFundsToFactory02() {
  /*
  console.log(`Transferring ETH to factory02`)
  let tx1 = await boombotseth.sendTransaction({
    ...networkSettings.overrides,
    to: factory02.address,
    value: WeiPerEther,
    gasLimit: 50_000,
  })
  await tx1.wait(networkSettings.confirmations)
  console.log(`Transferred ETH to factory02`)

  console.log(`Transferring MockUSDB to factory02`)
  //let tx2 = await mockusdb.connect(boombotseth).transfer(factory02.address, WeiPerEther.mul(100_000), networkSettings.overrides)
  let tx2 = await mockusdb.connect(boombotseth).mint(factory02.address, WeiPerEther.mul(100_000), networkSettings.overrides)
  await tx2.wait(networkSettings.confirmations)
  console.log(`Transferred MockUSDB to factory02`)
  */
  console.log(`Minting PreBOOM to factory02`)
  let tx3 = await preboom.connect(boombotsdeployer).mint(factory02.address, WeiPerEther.mul(1_000_000), networkSettings.overrides)
  await tx3.wait(networkSettings.confirmations)
  console.log(`MintedPreBOOM to factory02`)
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
