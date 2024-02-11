import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const boombotsdeployer = new ethers.Wallet(accounts.boombotsdeployer.key, provider);

import { ERC20BalanceFetcher } from "../../typechain-types";

import { delay } from "./../utils/misc";
import { isDeployed, expectDeployed } from "./../utils/expectDeployed";
import { logContractAddress } from "./../utils/logContractAddress";
import { getNetworkSettings } from "./../utils/getNetworkSettings";
import { deployContractUsingContractFactory, verifyContract } from "./../utils/deployContract";
import { toBytes32 } from "./../utils/setStorage";

const { AddressZero, WeiPerEther, MaxUint256 } = ethers.constants;

let networkSettings: any;
let chainID: number;

const ERC20_BALANCE_FETCHER_ADDRESS   = "0x9339Cc91FCE462428181BE1C47f7813f3B76AA9A";

let balanceFetcher: ERC20BalanceFetcher;

async function main() {
  console.log(`Using ${boombotsdeployer.address} as boombotsdeployer`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    return ((chainID === chainid) || ((chainID === 31337) && (process.env.FORK_NETWORK === chainName)));
  }
  if(!isChain(168587773, "blastsepolia")) throw("Only run this on Blast Sepolia or a local fork of Blast Sepolia");

  await deployERC20BalanceFetcher();
}

async function deployERC20BalanceFetcher() {
  if(await isDeployed(ERC20_BALANCE_FETCHER_ADDRESS)) {
    balanceFetcher = await ethers.getContractAt("ERC20BalanceFetcher", ERC20_BALANCE_FETCHER_ADDRESS, boombotsdeployer) as ERC20BalanceFetcher;
  } else {
    console.log("Deploying ERC20BalanceFetcher");
    let args = [];
    balanceFetcher = await deployContractUsingContractFactory(boombotsdeployer, "ERC20BalanceFetcher", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as ERC20BalanceFetcher;
    console.log(`Deployed ERC20BalanceFetcher to ${balanceFetcher.address}`);
    if(chainID != 31337) await verifyContract(balanceFetcher.address, args);
    if(!!ERC20_BALANCE_FETCHER_ADDRESS && balanceFetcher.address != ERC20_BALANCE_FETCHER_ADDRESS) throw new Error(`Deployed ModulePack100 to ${balanceFetcher.address}, expected ${ERC20_BALANCE_FETCHER_ADDRESS}`)
  }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });