import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const boombotsdeployer = new ethers.Wallet(accounts.boombotsdeployer.key, provider);

import { BoomBots, BoomBotAccount, ModulePack100, BoomBotsFactory, DataStore, IBlast } from "../../typechain-types";

import { delay } from "./../utils/misc";
import { isDeployed, expectDeployed } from "./../utils/expectDeployed";
import { logContractAddress } from "./../utils/logContractAddress";
import { getNetworkSettings } from "./../utils/getNetworkSettings";
import { deployContractUsingContractFactory, verifyContract } from "./../utils/deployContract";
import { toBytes32 } from "./../utils/setStorage";
import { getSelectors, FacetCutAction, calcSighash, calcSighashes, getCombinedAbi } from "./../utils/diamond"

const { AddressZero, WeiPerEther, MaxUint256 } = ethers.constants;

let networkSettings: any;
let chainID: number;

const ERC6551_REGISTRY_ADDRESS        = "0x000000006551c19487814612e58FE06813775758";
const BLAST_ADDRESS                   = "0x4300000000000000000000000000000000000002";

const BOOM_BOTS_NFT_ADDRESS           = "0x2b119FA2796215f627344509581D8F39D742317F";
const ACCOUNT_IMPLEMENTATION_ADDRESS  = "0xf24f3A8a7D49031eD95EBD13774BA77a6a470b80";
const MODULE_PACK_100_ADDRESS         = "0xdD0b84cB4DA1a1D1c262Cc4009036417BB3165eb";
const DATA_STORE_ADDRESS              = "0xaf724B10370130c1E106FdA3da0b71D812A570d8";
const BOOM_BOTS_FACTORY_ADDRESS       = "0x53A4f1C1b2D9603B3D3ae057B075a0EDC3d7A615";

let boomBotsNft: BoomBots;
let accountImplementation: BoomBotAccount; // the base implementation for boom bot accounts
let modulePack100: ModulePack100;
let dataStore: DataStore;
let factory: BoomBotsFactory;

let iblast: IBlast;

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

  iblast = await ethers.getContractAt("IBlast", BLAST_ADDRESS, boombotseth) as IBlast;

  await deployBoomBotsNft();
  await deployBoomBotAccount();
  await deployModulePack100();
  await deployDataStore();
  await whitelistModules();
  await deployBoomBotsFactory();
  await setFactoryInitcode();
  await whitelistFactories();
  await setNftMetadata();
}

async function deployBoomBotsNft() {
  if(await isDeployed(BOOM_BOTS_NFT_ADDRESS)) {
    boomBotsNft = await ethers.getContractAt("BoomBots", BOOM_BOTS_NFT_ADDRESS, boombotsdeployer) as BoomBots;
  } else {
    console.log("Deploying BoomBots NFT");
    let args = [ERC6551_REGISTRY_ADDRESS, boombotsdeployer.address];
    boomBotsNft = await deployContractUsingContractFactory(boombotsdeployer, "BoomBots", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as BoomBots;
    console.log(`Deployed BoomBots NFT to ${boomBotsNft.address}`);
    if(chainID != 31337) await verifyContract(boomBotsNft.address, args);
    if(!!BOOM_BOTS_NFT_ADDRESS && boomBotsNft.address != BOOM_BOTS_NFT_ADDRESS) throw new Error(`Deployed BoomBots NFT to ${boomBotsNft.address}, expected ${BOOM_BOTS_NFT_ADDRESS}`)
  }
}

async function deployBoomBotAccount() {
  if(await isDeployed(ACCOUNT_IMPLEMENTATION_ADDRESS)) {
    accountImplementation = await ethers.getContractAt("BoomBotAccount", ACCOUNT_IMPLEMENTATION_ADDRESS, boombotsdeployer) as BoomBotAccount;
  } else {
    console.log("Deploying BoomBotAccount");
    let args = [];
    accountImplementation = await deployContractUsingContractFactory(boombotsdeployer, "BoomBotAccount", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as BoomBotAccount;
    console.log(`Deployed BoomBotAccount to ${accountImplementation.address}`);
    if(chainID != 31337) await verifyContract(accountImplementation.address, args);
    if(!!ACCOUNT_IMPLEMENTATION_ADDRESS && accountImplementation.address != ACCOUNT_IMPLEMENTATION_ADDRESS) throw new Error(`Deployed BoomBotAccount to ${accountImplementation.address}, expected ${ACCOUNT_IMPLEMENTATION_ADDRESS}`)
  }
}

async function deployModulePack100() {
  if(await isDeployed(MODULE_PACK_100_ADDRESS)) {
    modulePack100 = await ethers.getContractAt("ModulePack100", MODULE_PACK_100_ADDRESS, boombotsdeployer) as ModulePack100;
  } else {
    console.log("Deploying ModulePack100");
    let args = [];
    modulePack100 = await deployContractUsingContractFactory(boombotsdeployer, "ModulePack100", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as ModulePack100;
    console.log(`Deployed ModulePack100 to ${modulePack100.address}`);
    if(chainID != 31337) await verifyContract(modulePack100.address, args);
    if(!!MODULE_PACK_100_ADDRESS && modulePack100.address != MODULE_PACK_100_ADDRESS) throw new Error(`Deployed ModulePack100 to ${modulePack100.address}, expected ${MODULE_PACK_100_ADDRESS}`)
  }
}

async function deployDataStore() {
  if(await isDeployed(DATA_STORE_ADDRESS)) {
    dataStore = await ethers.getContractAt("DataStore", DATA_STORE_ADDRESS, boombotsdeployer) as DataStore;
  } else {
    console.log("Deploying DataStore");
    let args = [boombotsdeployer.address];
    dataStore = await deployContractUsingContractFactory(boombotsdeployer, "DataStore", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as DataStore;
    console.log(`Deployed DataStore to ${dataStore.address}`);
    if(chainID != 31337) await verifyContract(dataStore.address, args);
    if(!!DATA_STORE_ADDRESS && dataStore.address != DATA_STORE_ADDRESS) throw new Error(`Deployed DataStore to ${dataStore.address}, expected ${DATA_STORE_ADDRESS}`)
  }
}

async function whitelistModules() {
  let isWhitelisted = await dataStore.connect(boombotseth).moduleCanBeInstalled(MODULE_PACK_100_ADDRESS)
  if(!isWhitelisted) {
    console.log("Whitelisting modules")
    let tx = await dataStore.connect(boombotsdeployer).setModuleWhitelist([
      {
        module: MODULE_PACK_100_ADDRESS,
        shouldWhitelist: true,
      }
    ], networkSettings.overrides)
    await tx.wait(networkSettings.confirmations)
    console.log("Whitelisted modules")
  }
}

async function deployBoomBotsFactory() {
  if(await isDeployed(BOOM_BOTS_FACTORY_ADDRESS)) {
    factory = await ethers.getContractAt("BoomBotsFactory", BOOM_BOTS_FACTORY_ADDRESS, boombotsdeployer) as BoomBotsFactory;
  } else {
    console.log("Deploying BoomBotsFactory");
    const inscribeSighash = "0xde52f07d";
    let sighashes = calcSighashes(modulePack100, 'ModulePack100')
    sighashes.push(inscribeSighash)
    let diamondCutInit = [
      {
        facetAddress: modulePack100.address,
        action: FacetCutAction.Add,
        functionSelectors: sighashes,
      },
    ]
    let interfaceIDs = [
      "0x01ffc9a7", // ERC165
      "0x1f931c1c", // DiamondCut
      "0x48e2b093", // DiamondLoupe
      "0x6faff5f1", // ERC6551Account
      "0x51945447", // ERC6551Executable
    ]
    let support = [
      true,
      true,
      true,
      true,
      true,
    ]
    let botInitializationCode1 = accountImplementation.interface.encodeFunctionData("initialize", [diamondCutInit, dataStore.address]);
    let botInitializationCode2 = modulePack100.interface.encodeFunctionData("updateSupportedInterfaces", [interfaceIDs, support]);
    let args = [
      boombotsdeployer.address,
      boomBotsNft.address,
      accountImplementation.address,
      botInitializationCode1,
      botInitializationCode2,
    ];
    factory = await deployContractUsingContractFactory(boombotsdeployer, "BoomBotsFactory", args, toBytes32(0), undefined, {...networkSettings.overrides, gasLimit: 6_000_000}, networkSettings.confirmations) as BoomBotsFactory;
    console.log(`Deployed BoomBotsFactory to ${factory.address}`);
    if(chainID != 31337) await verifyContract(factory.address, args);
    if(!!BOOM_BOTS_FACTORY_ADDRESS && factory.address != BOOM_BOTS_FACTORY_ADDRESS) throw new Error(`Deployed BoomBotsFactory to ${factory.address}, expected ${BOOM_BOTS_FACTORY_ADDRESS}`)
  }
}

async function setFactoryInitcode() {
  console.log(`Setting factory init code`)
  const inscribeSighash = "0xde52f07d";
  let sighashes = calcSighashes(modulePack100, 'ModulePack100')
  sighashes.push(inscribeSighash)
  let diamondCutInit = [
    {
      facetAddress: modulePack100.address,
      action: FacetCutAction.Add,
      functionSelectors: sighashes,
    },
  ]
  let interfaceIDs = [
    "0x01ffc9a7", // ERC165
    "0x1f931c1c", // DiamondCut
    "0x48e2b093", // DiamondLoupe
    "0x6faff5f1", // ERC6551Account
    "0x51945447", // ERC6551Executable
  ]
  let support = [
    true,
    true,
    true,
    true,
    true,
  ]
  let botInitializationCode1 = accountImplementation.interface.encodeFunctionData("initialize", [diamondCutInit, dataStore.address]);
  let mctxdata0 = modulePack100.interface.encodeFunctionData("updateSupportedInterfaces", [interfaceIDs, support]);
  let blastcalldata1 = iblast.interface.encodeFunctionData("configureAutomaticYield")
  let mctxdata1 = modulePack100.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata1, 0]);
  let blastcalldata2 = iblast.interface.encodeFunctionData("configureClaimableGas")
  let mctxdata2 = modulePack100.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata2, 0]);
  let txdatas = [mctxdata0, mctxdata1, mctxdata2]
  let botInitializationCode2 = modulePack100.interface.encodeFunctionData("multicall", [txdatas]);

  let tx = await factory.connect(boombotsdeployer).setBotInitializationCode(botInitializationCode1, botInitializationCode2, networkSettings.overrides)
  console.log('tx')
  console.log(tx)
  await tx.wait(networkSettings.confirmations)

  console.log(`Set factory init code`)
}

async function whitelistFactories() {
  let isWhitelisted = await boomBotsNft.connect(boombotseth).factoryIsWhitelisted(factory.address)
  if(!isWhitelisted) {
    console.log("Whitelisting factories")
    let tx = await boomBotsNft.connect(boombotsdeployer).setWhitelist([
      {
        factory: factory.address,
        shouldWhitelist: true,
      }
    ], networkSettings.overrides)
    await tx.wait(networkSettings.confirmations)
    console.log("Whitelisted factories")
  }
}

async function setNftMetadata() {
  let txdatas = [] as any[]
  let desiredContractURI = "https://stats-cdn.boombots.xyz/contractURI.json"
  let desiredBaseURI = "https://stats.boombots.xyz/bots/metadata/?chainID=168587773&v=0.1.0&botID="
  //let desiredBaseURI = "https://stats.boombots.xyz/bots/metadata/?chainID=168587773&v=0.1.0&botID="
  let currentContractURI = await boomBotsNft.contractURI()
  let currentBaseURI = await boomBotsNft.baseURI()
  if(currentContractURI != desiredContractURI) {
    txdatas.push(boomBotsNft.interface.encodeFunctionData("setContractURI", [desiredContractURI]))
  }
  if(currentBaseURI != desiredBaseURI) {
    txdatas.push(boomBotsNft.interface.encodeFunctionData("setBaseURI", [desiredBaseURI]))
  }
  if(txdatas.length == 0) return
  var tx
  console.log("Setting NFT metadata");
  if(txdatas.length == 1) {
    tx = await boombotsdeployer.sendTransaction({
      to: boomBotsNft.address,
      data: txdatas[0],
      ...networkSettings.overrides,
      gasLimit: 1_000_000
    })
  } else { // length > 1
    tx = await boomBotsNft.multicall(txdatas, {...networkSettings.overrides, gasLimit: 1_000_000});
  }
  console.log("tx:", tx);
  await tx.wait(networkSettings.confirmations);
  console.log("Set NFT metadata");
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
