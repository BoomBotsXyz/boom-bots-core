import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const boombotsdeployer = new ethers.Wallet(accounts.boombotsdeployer.key, provider);
const blasttestnetuser2 = new ethers.Wallet(accounts.blasttestnetuser2.key, provider);
const blasttestnetuser3 = new ethers.Wallet(accounts.blasttestnetuser3.key, provider);
const hydrogendefieth = new ethers.Wallet(accounts.hydrogendefieth.key, provider);

import { getNetworkSettings } from "./../utils/getNetworkSettings";
import { isDeployed, expectDeployed } from "./../utils/expectDeployed";
import { BalanceFetcher, MockERC20 } from "../../typechain-types";

const { AddressZero, WeiPerEther, MaxUint256 } = ethers.constants;

let networkSettings: any;
let chainID: number;

const BALANCE_FETCHER_ADDRESS  = "0x183D60a574Ef5F75e65e3aC2190b8B1Ad0707d71";

const ETH_ADDRESS              = "0x0000000000000000000000000000000000000000";
const WETH_ADDRESS             = "0x4200000000000000000000000000000000000023";
const USDB_ADDRESS             = "0x4200000000000000000000000000000000000022";
const USDC_ADDRESS             = "0xF19A5b56b419170Aa2ee49E5c9195F5902D39BF1";
const USDT_ADDRESS             = "0xD8F542D710346DF26F28D6502A48F49fB2cFD19B";
const DAI_ADDRESS              = "0x9C6Fc5bF860A4a012C9De812002dB304AD04F581";
const BOLT_ADDRESS             = "0x1B0cC80F4E2A7d205518A1Bf36de5bED686662FE";
const RGB_ADDRESS              = "0x7647a41596c1Ca0127BaCaa25205b310A0436B4C";
const MOCK_USDB_ADDRESS        = "0xc967D8dE80f2eD6ABd2FA597e920A9744cDc71a6";

const TOKEN_LIST = [
  ETH_ADDRESS,
  WETH_ADDRESS,
  USDB_ADDRESS,
  USDC_ADDRESS,
  USDT_ADDRESS,
  DAI_ADDRESS,
  BOLT_ADDRESS,
  RGB_ADDRESS,
  MOCK_USDB_ADDRESS,
]

let balanceFetcher: BalanceFetcher;

let botAddress9 = "0xab19214Cb88F29F1cCD4e97E361Ba9F83c6c90c0"

async function main() {
  console.log(`Using ${boombotseth.address} as boombotseth`);
  console.log(`Using ${boombotsdeployer.address} as boombotsdeployer`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    return ((chainID === chainid) || ((chainID === 31337) && (process.env.FORK_NETWORK === chainName)));
  }
  if(!isChain(168587773, "blastsepolia")) throw("Only run this on Blast Sepolia or a local fork of Blast Sepolia");

  balanceFetcher = await ethers.getContractAt("BalanceFetcher", BALANCE_FETCHER_ADDRESS, boombotsdeployer) as BalanceFetcher;

  await getBalances(boombotseth.address, 'boombotseth');
  await getBalances(botAddress9, "Bot 9");
  //await transferUsdb();
  //await getBalances(boombotseth.address, 'boombotseth');
  //await getBalances(botAddress9, "Bot 9");
}

async function getBalances(account:string, name='') {
  console.log(`getting balances of ${account} ${name}`)
  let res = await balanceFetcher.callStatic.fetchBalances(account, TOKEN_LIST)
  for(let i = 0; i < TOKEN_LIST.length; ++i) {
    console.log(`${TOKEN_LIST[i]}: ${res[i]}`)
  }
}

async function transferUsdb() {
  console.log("transferring usdb")
  let usdb = await ethers.getContractAt("MockERC20", USDB_ADDRESS, boombotseth) as MockERC20;
  //let to = "0x1144108d5eA65E03294ca56657EC6cb44852491e" // bot 129
  let to = botAddress9
  let value = WeiPerEther.mul(100)
  let tx = await usdb.transfer(to, value, networkSettings.overrides)
  console.log('tx')
  console.log(tx)
  await tx.wait(networkSettings.confirmations)
  console.log("transferred usdb")
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
