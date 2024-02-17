import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const blasttestnetuser3 = new ethers.Wallet(accounts.blasttestnetuser3.key, provider);

import { BoomBots, BoomBotAccount, ModulePack100, BoomBotsFactory, DataStore, RingProtocolModuleA, RingProtocolModuleB, IBlast, BalanceFetcher, MockERC20 } from "../../typechain-types";

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

let mcProvider = new MulticallProvider(provider, 168587773);

const ERC6551_REGISTRY_ADDRESS        = "0x000000006551c19487814612e58FE06813775758";
const BLAST_ADDRESS                   = "0x4300000000000000000000000000000000000002";

const CONTRACT_FACTORY_ADDRESS        = "0xa43C26F8cbD9Ea70e7B0C45e17Af81B6330AC543"; // v0.1.1

const BOOM_BOTS_NFT_ADDRESS           = "0xB3856D22fE476892Af3Cc6dee3D84F015AD5F5b1"; // v0.1.1
const ACCOUNT_IMPLEMENTATION_ADDRESS  = "0x152d3Ba1f7ac4a0AD0ec485b6A292B1F92aB8876"; // v0.1.1
const MODULE_PACK_100_ADDRESS         = "0x044CA8B45C270E744BDaE436E7FA861c6de6b5A5"; // v0.1.0
const MODULE_PACK_101_ADDRESS         = "0x0ea0b9aF8dD6D2C294281E7a983909BA81Bbb199"; // v0.1.1
const DATA_STORE_ADDRESS              = "0x4092c948cE402c18c8Ad6342859dEe8bcAD932bC"; // v0.1.1
const BOOM_BOTS_FACTORY_ADDRESS       = "0x0B0eEBa9CC8035D8EB2516835E57716f0eAE7B73"; // v0.1.1

const RING_PROTOCOL_MODULE_A_ADDRESS  = "0xD071924d2eD9cF44dB9a62A88A80E9bED9782711"; // v0.1.0
const RING_PROTOCOL_MODULE_B_ADDRESS  = "0x6D48d58b6E04aD003E8e49EE298d965658eBb7E8"; // v0.1.1

const BALANCE_FETCHER_ADDRESS         = "0x183D60a574Ef5F75e65e3aC2190b8B1Ad0707d71"; // v0.1.1

const ETH_ADDRESS                = "0x0000000000000000000000000000000000000000";
const ALL_CLAIMABLE_GAS_ADDRESS  = "0x0000000000000000000000000000000000000001";
const MAX_CLAIMABLE_GAS_ADDRESS  = "0x0000000000000000000000000000000000000002";
const WETH_ADDRESS               = "0x4200000000000000000000000000000000000023";
const USDB_ADDRESS               = "0x4200000000000000000000000000000000000022";
const USDC_ADDRESS               = "0xF19A5b56b419170Aa2ee49E5c9195F5902D39BF1";
const USDT_ADDRESS               = "0xD8F542D710346DF26F28D6502A48F49fB2cFD19B";
const DAI_ADDRESS                = "0x9C6Fc5bF860A4a012C9De812002dB304AD04F581";
const BOLT_ADDRESS               = "0x1B0cC80F4E2A7d205518A1Bf36de5bED686662FE";
const RGB_ADDRESS                = "0x7647a41596c1Ca0127BaCaa25205b310A0436B4C";
const PRE_BOOM_ADDRESS           = "0xf10C6886e26204F61cA9e0E89db74b7774d7ADa6"; // v0.1.1
const MOCK_USDB_ADDRESS          = "0xc967D8dE80f2eD6ABd2FA597e920A9744cDc71a6";

const TOKEN_LIST = [
  ETH_ADDRESS,
  ALL_CLAIMABLE_GAS_ADDRESS,
  MAX_CLAIMABLE_GAS_ADDRESS,
  WETH_ADDRESS,
  USDB_ADDRESS,
  PRE_BOOM_ADDRESS,
  USDC_ADDRESS,
  USDT_ADDRESS,
  DAI_ADDRESS,
  BOLT_ADDRESS,
  RGB_ADDRESS,
  MOCK_USDB_ADDRESS,
]

let boomBotsNft: BoomBots;
let boomBotsNftMC: any;
let accountImplementation: BoomBotAccount; // the base implementation for boom bot accounts
let modulePack100: ModulePack100;
let dataStore: DataStore;
let factory: BoomBotsFactory;
let ringProtocolModuleA: RingProtocolModuleA;
let ringProtocolModuleB: RingProtocolModuleB;
let balanceFetcher: BalanceFetcher;

let abi = getCombinedAbi([
  "artifacts/contracts/accounts/BoomBotAccount.sol/BoomBotAccount.json",
  "artifacts/contracts/modules/ModulePack101.sol/ModulePack101.json",
  //"artifacts/contracts/modules/RingProtocolModuleA.sol/RingProtocolModuleA.json",
  "artifacts/contracts/modules/RingProtocolModuleB.sol/RingProtocolModuleB.json",
  "artifacts/contracts/libraries/Errors.sol/Errors.json",
])

let botID9 = 9
let botAddress9 = "0xab19214Cb88F29F1cCD4e97E361Ba9F83c6c90c0"
let implAddress9 = "0x152d3Ba1f7ac4a0AD0ec485b6A292B1F92aB8876"
let botowner = boombotseth
let accountProxy9: any;

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

  accountProxy9 = await ethers.getContractAt(abi, botAddress9, botowner);
  iblast = await ethers.getContractAt("IBlast", BLAST_ADDRESS, botowner) as IBlast;

  ringProtocolModuleA = await ethers.getContractAt("RingProtocolModuleA", RING_PROTOCOL_MODULE_A_ADDRESS, botowner) as RingProtocolModuleA;
  ringProtocolModuleB = await ethers.getContractAt("RingProtocolModuleB", RING_PROTOCOL_MODULE_A_ADDRESS, botowner) as RingProtocolModuleB;
  balanceFetcher = await ethers.getContractAt("BalanceFetcher", BALANCE_FETCHER_ADDRESS, botowner) as BalanceFetcher;
  //gasQuoterModuleA = await ethers.getContractAt("GasQuoterModuleA", GAS_QUOTER_MODULE_A_ADDRESS, botowner) as GasQuoterModuleA;

  await fetchBotBalances();

  //await useBot9_1();
  //await useBot9_2();

  //await useBot9_6();
  //await useBot9_7();

  //await mintUSDB()

  //await fetchBotBalances();
}

// get token balances
async function fetchBotBalances() {
  console.log("Fetching bot 9 balances")

  let balances = await balanceFetcher.callStatic.fetchBalances(botAddress9, TOKEN_LIST, {...networkSettings.overrides, gasLimit: 30_000_000})
  for(let i = 0; i < TOKEN_LIST.length; i++) {
    console.log(`${TOKEN_LIST[i]}: ${balances[i].toString()}`)
  }

  var hardcall = false
  if(hardcall) {
    let tx = await balanceFetcher.fetchBalances(botAddress9, TOKEN_LIST)
    console.log('tx')
    console.log(tx)
    await tx.wait(networkSettings.confirmations)
  }

  console.log("Fetched bot 9 balances")
}

// install and execute ring protocol module a
async function useBot9_1() {
  console.log("Using bot 9_1")

  /*
  // describe
  console.log("Describing")
  let token = await accountProxy9.token();
  console.log('token')
  console.log(token)
  let owner = await accountProxy9.owner();
  console.log('owner')
  console.log(owner)
  console.log(owner == botowner.address)
  */

  let ethAmount1 = WeiPerEther.mul(5).div(1000)
  let ethAmount2 = ethAmount1.mul(9).div(10)
  //let sighashes = calcSighashes(ringProtocolModuleA, 'RingProtocolModuleA')
  //let sighashes = ['0xb7937b97'] // executeRingProtocolModuleA(uint256)
  let sighashes = ['0x25d315e0'] // executeRingProtocolModuleB(uint256)
  let delegatecalldata = accountProxy9.interface.encodeFunctionData("executeRingProtocolModuleB", [ethAmount2])
  let cut = [{
    facetAddress: RING_PROTOCOL_MODULE_B_ADDRESS,
    action: FacetCutAction.Add,
    functionSelectors: sighashes
  }]
  console.log("executing cut")
  console.log(cut)
  console.log(RING_PROTOCOL_MODULE_B_ADDRESS)
  console.log(delegatecalldata)
  let tx = await accountProxy9.connect(botowner).diamondCut(cut, RING_PROTOCOL_MODULE_B_ADDRESS, delegatecalldata, {...networkSettings.overrides, value: ethAmount1, gasLimit: 2_000_000}); // and delegatecall
  await tx.wait(networkSettings.confirmations)
  console.log("Used bot 9_1")
}

// execute ring protocol module b
async function useBot9_2() {
  console.log("Using bot 9_2")
  let ethAmount1 = WeiPerEther.mul(5).div(1000)
  let ethAmount2 = ethAmount1.mul(9).div(10)
  let tx = await accountProxy9.connect(botowner).executeRingProtocolModuleB(ethAmount2, {...networkSettings.overrides, value: ethAmount1, gasLimit: 2_000_000});
  await tx.wait(networkSettings.confirmations)
  console.log("Used bot 9_2")
}

// claim max gas rewards
async function useBot9_6() {
  console.log("Using bot 9_6")
  let calldata = iblast.interface.encodeFunctionData("claimMaxGas", [botAddress9, botAddress9])
  let tx = await accountProxy9.connect(botowner).execute(BLAST_ADDRESS, 0, calldata, 0, {...networkSettings.overrides, gasLimit:1_000_000})
  console.log('tx')
  console.log(tx)
  await tx.wait(networkSettings.confirmations)
  console.log("Used bot 9_6")
}

// claim all gas rewards
async function useBot9_7() {
  console.log("Using bot 9_7")
  let calldata = iblast.interface.encodeFunctionData("claimAllGas", [botAddress9, botAddress9])
  let tx = await accountProxy9.connect(botowner).execute(BLAST_ADDRESS, 0, calldata, 0, {...networkSettings.overrides, gasLimit:1_000_000})
  console.log('tx')
  console.log(tx)
  await tx.wait(networkSettings.confirmations)
  console.log("Used bot 9_7")
}

// mints usdb to the bot
async function mintUSDB() {
  console.log("Minting MockUSDB")
  let mockusdb = await ethers.getContractAt("MockERC20", MOCK_USDB_ADDRESS) as MockERC20;
  let calldata = mockusdb.interface.encodeFunctionData("mint", [botAddress9, WeiPerEther.mul(1000)])
  let tx = await accountProxy9.connect(botowner).execute(MOCK_USDB_ADDRESS, 0, calldata, 0, {...networkSettings.overrides, gasLimit:1_000_000})
  console.log('tx')
  console.log(tx)
  await tx.wait(networkSettings.confirmations)
  console.log("Minted MockUSDB")
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
