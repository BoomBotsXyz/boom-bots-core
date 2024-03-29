import hardhat from "hardhat";
const { ethers } = hardhat;
import { Wallet } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import fs from "fs";

import { expectDeployed, isDeployed } from "./expectDeployed";
import { toBytes32 } from "./setStorage";

// deploys a contract using CREATE from an EOA
export async function deployContract(deployer:Wallet|SignerWithAddress, contractName:string, args:any[]=[], overrides:any={}, confirmations:number=0) {
  const factory = await ethers.getContractFactory(contractName, deployer);
  const contract = await factory.deploy(...args, overrides);
  await contract.deployed();
  const tx = contract.deployTransaction;
  await tx.wait(confirmations);
  await expectDeployed(contract.address);
  return contract;
}
exports.deployContract = deployContract

// deploys a contract using CREATE2 from a contract factory
export async function deployContractUsingContractFactory(deployer:Wallet|SignerWithAddress, contractName:string, args:any[]=[], salt:string=toBytes32(0), calldata:string|undefined=undefined, overrides:any={}, confirmations:number=0, desiredFactoryAddress=undefined) {
  let factoryContract = (await getFactoryContract(desiredFactoryAddress)).connect(deployer)

  const contractFactory = await ethers.getContractFactory(contractName, deployer);
  const bytecode = contractFactory.getDeployTransaction(...args).data;
  const tx = await (!calldata
    ? factoryContract.deploy(bytecode, salt, overrides)
    : factoryContract.deployAndCall(bytecode, salt, calldata, overrides)
  );
  const receipt = await tx.wait(confirmations);
  if(!receipt.events || receipt.events.length == 0) {
    console.error("receipt")
    console.error(receipt)
    throw new Error("no events")
  }
  const createEvents = receipt.events.filter(event=>event.address == factoryContract.address)
  if(createEvents.length > 1) {
    console.log(`somehow created two contracts?`)
    const deployedContracts = await Promise.all(createEvents.map(async event=>await ethers.getContractAt(contractName, event.args[0])))
    return deployedContracts
  }
  if(createEvents.length == 1) {
    const contractAddress = createEvents[0].args[0];
    await expectDeployed(contractAddress);
    const deployedContract = await ethers.getContractAt(contractName, contractAddress);
    return deployedContract;
  }
  if(createEvents.length == 0) {
    console.error("receipt")
    console.error(receipt)
    throw new Error("no matching events found")
  }
}
exports.deployContractUsingContractFactory = deployContractUsingContractFactory

// gets the factory contract
// takes an optional desiredFactoryAddress param
// if not given, searches through a list of known addresses
async function getFactoryContract(desiredFactoryAddress=undefined) {
  let addr = await getFactoryAddress(desiredFactoryAddress)
  let c = await ethers.getContractAt("ContractFactory", addr);
  return c
}

// gets the factory address
// takes an optional desiredFactoryAddress param
// if not given, searches through a list of known addresses
async function getFactoryAddress(desiredFactoryAddress=undefined) {
  if(!!desiredFactoryAddress) {
    if(!(await isDeployed(desiredFactoryAddress))) throw new Error("Factory contract not detected");
    return desiredFactoryAddress
  }
  const KNOWN_FACTORY_ADDRESSES = [
    "0xA74500382CAb2EBFe9A08dc2c01430821A4A8E15",
    "0x2eF7f9C8545cB13EEaBc10CFFA3481553C70Ffc8",
  ]
  for(const addr of KNOWN_FACTORY_ADDRESSES) {
    if(await isDeployed(addr)) {
      return addr
    }
  }
  throw new Error("Factory contract not detected");
}

export async function verifyContract(address: string, constructorArguments: any) {
  console.log("Verifying contract");
  async function _sleeper(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  await _sleeper(30000); // likely just deployed a contract, let etherscan index it
  var verifyArgs: any = {
    address: address,
    constructorArguments: constructorArguments
  };
  try {
    await hardhat.run("verify:verify", verifyArgs);
    console.log("Verified")
  } catch(e) { /* probably already verified */ }
}
exports.verifyContract
