import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const boombotsdeployer = new ethers.Wallet(accounts.boombotsdeployer.key, provider);

import { BalanceFetcher, IBlast } from "../../typechain-types";

import { delay } from "./../utils/misc";
import { isDeployed, expectDeployed } from "./../utils/expectDeployed";
import { logContractAddress } from "./../utils/logContractAddress";
import { getNetworkSettings } from "./../utils/getNetworkSettings";
import { deployContractUsingContractFactory, verifyContract } from "./../utils/deployContract";
import { toBytes32 } from "./../utils/setStorage";

const { AddressZero, WeiPerEther, MaxUint256 } = ethers.constants;

let networkSettings: any;
let chainID: number;

const BLAST_ADDRESS                   = "0x4300000000000000000000000000000000000002";
const BALANCE_FETCHER_ADDRESS         = "0xd00b294c170322CCCF386329820d88420DADBc5e"; // v0.1.1

let balanceFetcher: BalanceFetcher;
let iblast: IBlast;

async function main() {
  console.log(`Using ${boombotsdeployer.address} as boombotsdeployer`);

  chainID = (await provider.getNetwork()).chainId;
  networkSettings = getNetworkSettings(chainID);
  function isChain(chainid: number, chainName: string) {
    return ((chainID === chainid) || ((chainID === 31337) && (process.env.FORK_NETWORK === chainName)));
  }
  if(!isChain(168587773, "blastsepolia")) throw("Only run this on Blast Sepolia or a local fork of Blast Sepolia");

  iblast = await ethers.getContractAt("IBlast", BLAST_ADDRESS, boombotseth) as IBlast;

  await deployBalanceFetcher();
  //await configureBlastRewards();
}

async function deployBalanceFetcher() {
  if(await isDeployed(BALANCE_FETCHER_ADDRESS)) {
    balanceFetcher = await ethers.getContractAt("BalanceFetcher", BALANCE_FETCHER_ADDRESS, boombotsdeployer) as BalanceFetcher;
  } else {
    console.log("Deploying BalanceFetcher");
    let args = [boombotsdeployer.address];
    balanceFetcher = await deployContractUsingContractFactory(boombotsdeployer, "BalanceFetcher", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as BalanceFetcher;
    console.log(`Deployed BalanceFetcher to ${balanceFetcher.address}`);
    if(chainID != 31337) await verifyContract(balanceFetcher.address, args);
    if(!!BALANCE_FETCHER_ADDRESS && balanceFetcher.address != BALANCE_FETCHER_ADDRESS) throw new Error(`Deployed ModulePack100 to ${balanceFetcher.address}, expected ${BALANCE_FETCHER_ADDRESS}`)
  }
}

async function configureBlastRewards() {
  let blastcalldata1 = iblast.interface.encodeFunctionData("configureAutomaticYield")
  let mctxdata1 = balanceFetcher.interface.encodeFunctionData("callBlast", [blastcalldata1]);
  let blastcalldata2 = iblast.interface.encodeFunctionData("configureClaimableGas")
  let mctxdata2 = balanceFetcher.interface.encodeFunctionData("callBlast", [blastcalldata2]);
  let txdatas = [mctxdata1, mctxdata2]

  let contracts = [
    balanceFetcher
  ]
  for(let i = 0; i < contracts.length; i++) {
    console.log(`configuring blast rewards ${i}`)
    let tx = await contracts[i].connect(boombotsdeployer).multicall(txdatas, {...networkSettings.overrides, gasLimit: 500_000})
    console.log('tx')
    console.log(tx)
    await tx.wait(networkSettings.confirmations)
  }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
