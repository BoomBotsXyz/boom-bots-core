import hardhat from "hardhat";
const { ethers } = hardhat;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { config as dotenv_config } from "dotenv";
dotenv_config();

const accounts = JSON.parse(process.env.ACCOUNTS || "{}");
const boombotseth = new ethers.Wallet(accounts.boombotseth.key, provider);
const boombotsdeployer = new ethers.Wallet(accounts.boombotsdeployer.key, provider);
const blasttestnetuser1 = new ethers.Wallet(accounts.blasttestnetuser1.key, provider);

import { BoomBots, BoomBotAccount, ModulePack102, BoomBotsFactory01, BoomBotsFactory02, DataStore, IBlast, MockBlastableAccount, ContractFactory, GasCollector, RingProtocolModuleB, BalanceFetcher, MockERC20Rebasing, PreBOOM } from "../../typechain-types";

import { delay, deduplicateArray } from "./../utils/misc";
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

const ERC6551_REGISTRY_ADDRESS        = "0x000000006551c19487814612e58FE06813775758";
const BLAST_ADDRESS                   = "0x4300000000000000000000000000000000000002";

const CONTRACT_FACTORY_ADDRESS        = "0xA74500382CAb2EBFe9A08dc2c01430821A4A8E15"; // v0.1.2
const GAS_COLLECTOR_ADDRESS           = "0xf67f800486E8B9cC7e4416F329dF56bB43D2B7B4"; // V0.1.2
const BOOM_BOTS_NFT_ADDRESS           = "0x7724cc10B42760d4C624d6b81C4367118194E39B"; // v0.1.2
const ACCOUNT_IMPLEMENTATION_ADDRESS  = "0x8EA19CA269A3F3A7563F7A098C9C3dC46f4A2448"; // v0.1.2
const MODULE_PACK_102_ADDRESS         = "0xfEC2e1F3c66f181650641eC50a5E131C1f3b4740"; // v0.1.2
const DATA_STORE_ADDRESS              = "0xDFF8DCD5441B1B709cDCB7897dB304041Cc9DE4C"; // v0.1.2
const BOOM_BOTS_FACTORY01_ADDRESS     = "0x92e795B8D78eA13a564da4F4E03965FBB89cb788"; // v0.1.2
const BOOM_BOTS_FACTORY02_ADDRESS     = "0x4acb9D0243dF085B4F59683cee2F36597334bDa4"; // v0.1.2
const BALANCE_FETCHER_ADDRESS         = "0x0268efA44785909AAb150Ff00545568351dd25b6"; // v0.1.2
const RING_PROTOCOL_MODULE_B_ADDRESS  = "0x141268a519D42149c6dcA9695d065d91eda66501"; // v0.1.2

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
const PRE_BOOM_ADDRESS           = "0xdBa6Cb5a91AE6F0ac3883F3841190c2BFa168f9b"; // v0.1.2

let iblast: IBlast;
let gasCollector: GasCollector;
let boomBotsNft: BoomBots;
let accountImplementation: BoomBotAccount; // the base implementation for boom bot accounts
//let mockAccountImplementation: MockBlastableAccount; // a mock to test gas
let modulePack102: ModulePack102;
let dataStore: DataStore;
let factory01: BoomBotsFactory01;
let factory02: BoomBotsFactory02;

let usdb: MockERC20;
let preboom: PreBOOM;

let ringProtocolModuleB: RingProtocolModuleB;

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

  gasCollector = await ethers.getContractAt("GasCollector", GAS_COLLECTOR_ADDRESS, boombotsdeployer) as GasCollector;
  boomBotsNft = await ethers.getContractAt("BoomBots", BOOM_BOTS_NFT_ADDRESS, boombotsdeployer) as BoomBots;
  accountImplementation = await ethers.getContractAt("BoomBotAccount", ACCOUNT_IMPLEMENTATION_ADDRESS, boombotsdeployer) as BoomBotAccount;
  modulePack102 = await ethers.getContractAt("ModulePack102", MODULE_PACK_102_ADDRESS, boombotsdeployer) as ModulePack102;
  dataStore = await ethers.getContractAt("DataStore", DATA_STORE_ADDRESS, boombotsdeployer) as DataStore;
  factory01 = await ethers.getContractAt("BoomBotsFactory01", BOOM_BOTS_FACTORY01_ADDRESS, boombotsdeployer) as BoomBotsFactory01;
  factory02 = await ethers.getContractAt("BoomBotsFactory02", BOOM_BOTS_FACTORY02_ADDRESS, boombotsdeployer) as BoomBotsFactory02;

  usdb = await ethers.getContractAt("MockERC20", USDB_ADDRESS, boombotsdeployer) as MockERC20;
  preboom = await ethers.getContractAt("PreBOOM", PRE_BOOM_ADDRESS, boombotsdeployer) as PreBOOM;

  //await configureContractFactoryGasGovernor();
  //await whitelistModules();

  //await whitelistFactories();
  //await setNftMetadata();

  //await configureGasCollector();
  //await collectGasRewards();

  //await postBotCreationSettings02_01();
  //await postBotCreationSettings02_02();
  //await postBotCreationSettings02_03();

  //await pauseBotCreationSettings02();
  //await postBotCreationSettings02_04();


  //await checkPreBOOMMinterRole()

  //await mintPreBOOM(boombotsdeployer.address, WeiPerEther.mul(1000));
  //await mintPreBOOM(boombotseth.address, WeiPerEther.mul(1000));

  //await transferFundsFromFactory02()
  //await transferFundsToFactory02();

}

async function configureContractFactoryGasGovernor() {
  console.log("Configuring contract factory gas governor")
  let tx = await iblast.connect(boombotsdeployer).configureGovernorOnBehalf(gasCollector.address, CONTRACT_FACTORY_ADDRESS, networkSettings.overrides)
  await tx.wait(networkSettings.confirmations)
  console.log("Configured contract factory gas governor")
}

async function whitelistModules() {
  let expectedSettings = [
    {
      module: modulePack102.address,
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

async function whitelistFactories() {
  let expectedSettings = [
    {
      factory: factory01.address,
      shouldWhitelist: true,
    },
    {
      factory: factory02.address,
      shouldWhitelist: true,
    },
  ]
  let diffs = [] as any[]
  for(let i = 0; i < expectedSettings.length; i++) {
    let { factory , shouldWhitelist } = expectedSettings[i]
    let isWhitelisted = await boomBotsNft.connect(boombotseth).factoryIsWhitelisted(factory)
    if(isWhitelisted != shouldWhitelist) diffs.push(expectedSettings[i])
  }
  if(diffs.length > 0) {
    console.log("Whitelisting factories")
    let tx = await boomBotsNft.connect(boombotsdeployer).setWhitelist(diffs, networkSettings.overrides)
    await tx.wait(networkSettings.confirmations)
    console.log("Whitelisted factories")
  }
}

async function setNftMetadata() {
  let txdatas = [] as any[]
  let desiredContractURI = "https://stats-cdn.boombots.xyz/contractURI.json"
  let desiredBaseURI = "https://stats.boombots.xyz/bots/metadata/?chainID=168587773&v=0.1.2&botID="
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
    tx = await boomBotsNft.connect(boombotsdeployer).multicall(txdatas, {...networkSettings.overrides, gasLimit: 1_000_000});
  }
  //console.log("tx:", tx);
  await tx.wait(networkSettings.confirmations);
  console.log("Set NFT metadata");
}

async function pauseBotCreationSettings02() {
  let expectedSettings = [
    {
      settingsID: 1,
      isPaused: true,
    },
    {
      settingsID: 2,
      isPaused: true,
    },
    {
      settingsID: 3,
      isPaused: true,
    },
  ]
  let diffs = []
  for(let i = 0; i < expectedSettings.length; ++i) {
    let { settingsID, isPaused } = expectedSettings[i]
    let res = await factory02.getBotCreationSettings(settingsID)
    if(res.isPaused != isPaused) {
      diffs.push(expectedSettings[i])
    }
  }
  if(diffs.length == 0) return
  console.log(`Pausing factory02 bot creation settings`)
  console.log(diffs)
  let txdatas = diffs.map(d=>factory02.interface.encodeFunctionData("setPaused",[d.settingsID,d.isPaused]))
  let tx = await factory02.connect(boombotsdeployer).multicall(txdatas, networkSettings.overrides)
  await tx.wait(networkSettings.confirmations)
  console.log(`Paused factory02 bot creation settings`)
}

async function postBotCreationSettings02_04() {
  let expectedSettingsID = 4
  let count = await factory02.getBotCreationSettingsCount()
  if(count >= expectedSettingsID) return
  console.log(`Calling postBotCreationSettings02_04`)

  let sighashes = [
    //'0x175e1a7d', // blast()
    '0x645dd1fa', // claimAllGas()
    '0xb2b8c93f', // claimMaxGas()
    '0x660d0d67', // dataStore()
    '0x1f931c1c', // diamondCut((address,uint8,bytes4[])[],address,bytes)
    '0x51945447', // execute(address,uint256,bytes,uint8)
    '0xcdffacc6', // facetAddress(bytes4)
    '0x52ef6b2c', // facetAddresses()
    '0xadfca15e', // facetFunctionSelectors(address)
    '0x7a0ed627', // facets()
    '0x1626ba7e', // isValidSignature(bytes32,bytes)
    '0x523e3260', // isValidSigner(address,bytes)
    '0xd5f50582', // isValidSigner(address)
    '0xac9650d8', // multicall(bytes[])
    '0xbc197c81', // onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)
    '0xf23a6e61', // onERC1155Received(address,address,uint256,uint256,bytes)
    '0x150b7a02', // onERC721Received(address,address,uint256,bytes)
    '0x8da5cb5b', // owner()
    '0x7cb81437', // quoteClaimAllGas()
    '0xc3eb9fc5', // quoteClaimAllGasWithRevert()
    '0x97370879', // quoteClaimMaxGas()
    '0x1f15cbde', // quoteClaimMaxGasWithRevert()
    '0xa2d2dd3c', // reentrancyGuardState()
    '0xc19d93fb', // state()
    '0x01ffc9a7', // supportsInterface(bytes4)
    '0xfc0c546a', // token()
    '0xf71a8a0f', // updateSupportedInterfaces(bytes4[],bool[])
    '0xde52f07d', // inscribe()
  ]
  let diamondCutInit = [
    {
      facetAddress: modulePack102.address,
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
  let support = interfaceIDs.map(id=>true)
  let botInitializationCode1 = accountImplementation.interface.encodeFunctionData("initialize", [diamondCutInit, dataStore.address]);
  let botInitializationCode2 = modulePack102.interface.encodeFunctionData("updateSupportedInterfaces", [interfaceIDs, support]);
  let blastcalldata3 = iblast.interface.encodeFunctionData("configureAutomaticYield")
  let botInitializationCode3 = modulePack102.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata3, 0]);
  let blastcalldata4 = iblast.interface.encodeFunctionData("configureClaimableGas")
  let botInitializationCode4 = modulePack102.interface.encodeFunctionData("execute", [BLAST_ADDRESS, 0, blastcalldata4, 0]);

  let giveTokenList = [ETH_ADDRESS, USDB_ADDRESS, PRE_BOOM_ADDRESS]
  let giveTokenAmounts = [WeiPerEther.div(1000), WeiPerEther.mul(100), WeiPerEther.mul(5)]

  let params = {
    botImplementation: accountImplementation.address,
    initializationCalls: [
      botInitializationCode1,
      botInitializationCode2,
      botInitializationCode3,
      botInitializationCode4,
    ],
    isPaused: false,
    giveTokenList,
    giveTokenAmounts,
  }
  let tx = await factory02.connect(boombotsdeployer).postBotCreationSettings(params)
  let receipt = await tx.wait(networkSettings.confirmations)
  let postEvent = receipt.events.filter(event=>event.event=="BotCreationSettingsPosted")[0]
  let settingsID = postEvent.args[0]
  if(settingsID != expectedSettingsID) throw new Error(`Unexpected settingsID returned. Expected ${expectedSettingsID} got ${settingsID}`)

  console.log(`Called postBotCreationSettings02_04`)
}

async function configureGasCollector() {
  let contractListExpected = deduplicateArray([
    GAS_COLLECTOR_ADDRESS,
    CONTRACT_FACTORY_ADDRESS,
    BOOM_BOTS_NFT_ADDRESS,
    ACCOUNT_IMPLEMENTATION_ADDRESS,
    MODULE_PACK_102_ADDRESS,
    DATA_STORE_ADDRESS,
    BOOM_BOTS_FACTORY01_ADDRESS,
    BOOM_BOTS_FACTORY02_ADDRESS,
    BALANCE_FETCHER_ADDRESS,
    PRE_BOOM_ADDRESS,
    RING_PROTOCOL_MODULE_B_ADDRESS,
  ])
  let receiverExpected = GAS_COLLECTOR_ADDRESS
  let res = await gasCollector.getContractList()
  let { contractList_, gasReceiver_ } = res
  /*
  console.log('contract list expected')
  console.log(contractListExpected)
  console.log('contract list real')
  console.log(contractList_)
  console.log('receiver expected')
  console.log(receiverExpected)
  console.log('receiver real')
  console.log(gasReceiver_)
  */
  let diff = gasReceiver_ != receiverExpected
  for(let i = 0; i < contractListExpected.length && !diff; ++i) {
    if(!contractList_.includes(contractListExpected[i])) {
      diff = true;
      break;
    }
  }
  if(!diff) return

  console.log(`Configuring gas rewards`)
  //let contractList = [gasCollector.address, dataStore.address]
  let tx = await gasCollector.connect(boombotsdeployer).setClaimContractList(contractListExpected, receiverExpected, networkSettings.overrides)
  await tx.wait(networkSettings.confirmations)
  console.log(`Configured gas rewards`)
}

async function collectGasRewards() {
  console.log(`Collecting gas rewards`)
  let tx = await gasCollector.connect(boombotseth).claimGas(networkSettings.overrides)
  await tx.wait(networkSettings.confirmations)
  console.log(`Collected gas rewards`)
}

async function checkPreBOOMMinterRole() {
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

async function mintPreBOOM(to:string, amount:any) {
  console.log(`Minting ${formatUnits(amount)} PreBOOM to ${to}`)
  let tx = await preboom.connect(boombotsdeployer).mint(to, amount, networkSettings.overrides)
  await tx.wait(networkSettings.confirmations)
  console.log(`Minted PreBOOM`)
}

async function transferFundsToFactory02() {
  /*
  var bal = await provider.getBalance(factory02.address)
  if(bal.eq(0)) {
    console.log(`Transferring ETH to factory02`)
    let tx1 = await boombotseth.sendTransaction({
      ...networkSettings.overrides,
      to: factory02.address,
      value: WeiPerEther,
      gasLimit: 50_000,
    })
    await tx1.wait(networkSettings.confirmations)
    console.log(`Transferred ETH to factory02`)
  }

  var bal = await preboom.balanceOf(factory02.address)
  if(bal.eq(0)) {
    console.log(`Minting PreBOOM to factory02`)
    let tx3 = await preboom.connect(boombotsdeployer).mint(factory02.address, WeiPerEther.mul(1_000_000), networkSettings.overrides)
    await tx3.wait(networkSettings.confirmations)
    console.log(`MintedPreBOOM to factory02`)
  }

  var bal = await usdb.balanceOf(factory02.address)
  if(bal.eq(0)) {
    console.log(`Transferring USDB to factory02`)
    //let tx2 = await usdb.connect(boombotseth).transfer(factory02.address, WeiPerEther.mul(100_000), networkSettings.overrides)
    let tx2 = await usdb.connect(boombotseth).transfer(factory02.address, WeiPerEther.mul(100_000), networkSettings.overrides)
    await tx2.wait(networkSettings.confirmations)
    console.log(`Transferred USDB to factory02`)
  }
  */
  console.log(`Minting PreBOOM to factory02`)
  //let tx3 = await preboom.connect(boombotsdeployer).mint(factory02.address, WeiPerEther.mul(5_000), networkSettings.overrides)
  let tx3 = await preboom.connect(boombotsdeployer).transfer(factory02.address, WeiPerEther.mul(5_000), networkSettings.overrides)
  await tx3.wait(networkSettings.confirmations)
  console.log(`MintedPreBOOM to factory02`)
}

async function transferFundsFromFactory02() {
  console.log(`Transferring funds from factory02`)
  let tx3 = await factory02.connect(boombotsdeployer).sweep(boombotsdeployer.address, [preboom.address], networkSettings.overrides)
  //let tx3 = await factory02.connect(boombotsdeployer).sweep("0x3114ded1fA1b406e270A65a21bC96E86C171a244", ["0x3114ded1fA1b406e270A65a21bC96E86C171a244"], networkSettings.overrides)
  await tx3.wait(networkSettings.confirmations)
  console.log(`Transferred funds from factory02`)
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
  });
