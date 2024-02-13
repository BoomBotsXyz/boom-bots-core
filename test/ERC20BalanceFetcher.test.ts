/* global describe it before ethers */

import hre from "hardhat";
const { ethers } = hre;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
const { expect, assert } = chai;
import fs from "fs";

import { ERC20BalanceFetcher, MockERC20, MockGasBurner, MockGasBurner2, IBlast, MockBlast } from "./../typechain-types";

import { isDeployed, expectDeployed } from "./../scripts/utils/expectDeployed";
import { toBytes32 } from "./../scripts/utils/setStorage";
import { getNetworkSettings } from "../scripts/utils/getNetworkSettings";
import { decimalsToAmount } from "../scripts/utils/price";
import { leftPad } from "../scripts/utils/strings";
import { deployContract } from "../scripts/utils/deployContract";
import L1DataFeeAnalyzer from "../scripts/utils/L1DataFeeAnalyzer";

const { AddressZero, WeiPerEther, MaxUint256, Zero } = ethers.constants;
const WeiPerUsdc = BN.from(1_000_000); // 6 decimals

const ERC6551_REGISTRY_ADDRESS = "0x000000006551c19487814612e58FE06813775758";
const BLAST_ADDRESS            = "0x4300000000000000000000000000000000000002";

describe("ERC20BalanceFetcher", function () {
  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let user4: SignerWithAddress;
  let user5: SignerWithAddress;

  let erc20a: MockERC20;
  let erc20b: MockERC20;
  let erc20c: MockERC20;

  let chainID: number;
  let networkSettings: any;
  let snapshot: BN;

  let balanceFetcher: ERC20BalanceFetcher;
  let gasBurner: MockGasBurner; // inherits blastable
  let gasBurner2: MockGasBurner2; // inherits blastable
  let iblast: any;
  let mockblast: MockBlast;

  let l1DataFeeAnalyzer = new L1DataFeeAnalyzer();

  before(async function () {
    [deployer, owner, user1, user2, user3, user4, user5] = await ethers.getSigners();
    chainID = (await provider.getNetwork()).chainId;
    networkSettings = getNetworkSettings(chainID);
    if(!networkSettings.isTestnet) throw new Error("Do not run tests on production networks");
    snapshot = await provider.send("evm_snapshot", []);
    await deployer.sendTransaction({to:deployer.address}); // for some reason this helps solidity-coverage

    erc20a = await deployContract(deployer, "MockERC20", [`Token A`, `TKNA`, 18]) as MockERC20;
    erc20b = await deployContract(deployer, "MockERC20", [`Token B`, `TKNB`, 18]) as MockERC20;
    erc20c = await deployContract(deployer, "MockERC20", [`Token C`, `TKNC`, 18]) as MockERC20;

    iblast = await ethers.getContractAt("IBlast", BLAST_ADDRESS, owner) as IBlast;
  });

  after(async function () {
    await provider.send("evm_revert", [snapshot]);
  });

  describe("setup", function () {
    it("can deploy ERC20BalanceFetcher", async function () {
      balanceFetcher = await deployContract(deployer, "ERC20BalanceFetcher", [owner.address]) as ERC20BalanceFetcher;
      await expectDeployed(balanceFetcher.address);
      l1DataFeeAnalyzer.register("deploy ERC20BalanceFetcher", balanceFetcher.deployTransaction);
    });
    it("can deploy gas burner", async function () {
      gasBurner = await deployContract(deployer, "MockGasBurner", [owner.address]);
      await expectDeployed(gasBurner.address);
      expect(await gasBurner.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy MockGasBurner", gasBurner.deployTransaction);
    })
    it("can deploy gas burner 2", async function () {
      gasBurner2 = await deployContract(deployer, "MockGasBurner2", [owner.address]);
      await expectDeployed(gasBurner2.address);
      expect(await gasBurner2.owner()).eq(owner.address);
      l1DataFeeAnalyzer.register("deploy MockGasBurner2", gasBurner2.deployTransaction);
    })
    it("can deploy mockblast", async function () {
      mockblast = await deployContract(deployer, "MockBlast", []);
      await expectDeployed(mockblast.address);
      l1DataFeeAnalyzer.register("deploy MockBlast", mockblast.deployTransaction);
      await user1.sendTransaction({
        to: mockblast.address,
        value: WeiPerEther
      })
    })
    it("can configure gas burner 2", async function () {
      await gasBurner2.setBlast(mockblast.address)
      let blastcalldata1 = iblast.interface.encodeFunctionData("configureAutomaticYield")
      let mctxdata1 = gasBurner2.interface.encodeFunctionData("callBlast", [blastcalldata1]);
      let blastcalldata2 = iblast.interface.encodeFunctionData("configureClaimableGas")
      let mctxdata2 = gasBurner2.interface.encodeFunctionData("callBlast", [blastcalldata2]);
      let txdatas = [mctxdata1, mctxdata2]
      await gasBurner2.connect(owner).multicall(txdatas)
      await user1.sendTransaction({
        to: gasBurner2.address,
        value: WeiPerEther
      })
    })
    it("can use gas burner", async function () {
      await gasBurner2.burnGas(10)
    })
  });

  describe("fetch balances", function () {
    it("can fetch empty list", async function () {
      let res = await balanceFetcher.fetchBalances(user1.address, [])
      expect(res).deep.eq([])
    })
    it("can fetch zeros", async function () {
      let res = await balanceFetcher.fetchBalances(user1.address, [erc20a.address, erc20b.address])
      expect(res).deep.eq([0,0])
    })
    it("can fetch nonzeros", async function () {
      let balEth = await provider.getBalance(user1.address)
      let bal1 = WeiPerEther
      let bal2 = WeiPerUsdc.mul(5)
      await erc20a.mint(user1.address, bal1)
      await erc20b.mint(user1.address, bal2)
      let res = await balanceFetcher.fetchBalances(user1.address, [AddressZero, erc20a.address, erc20b.address, erc20c.address])
      expect(res).deep.eq([balEth, bal1, bal2, 0])
    })
    it("reverts invalid token", async function () {
      await expect(balanceFetcher.fetchBalances(user1.address, [user1.address])).to.be.reverted;
    })
    it("can fetch claimable gas for eoa", async function () {
      let balEth = await provider.getBalance(user1.address)
      let bal1 = await erc20a.balanceOf(user1.address)
      let bal2 = await erc20b.balanceOf(user1.address)
      let bal3 = await erc20c.balanceOf(user1.address)
      let bal4 = 0
      let bal5 = 0
      const AddressOne = "0x0000000000000000000000000000000000000001"
      const AddressTwo = "0x0000000000000000000000000000000000000002"
      let res = await balanceFetcher.fetchBalances(user1.address, [AddressZero, erc20a.address, erc20b.address, erc20c.address, AddressOne, AddressTwo])
      expect(res).deep.eq([balEth, bal1, bal2, bal3, bal4, bal5])
    })
    it("can fetch claimable gas for non blastable contract 1", async function () {
      let balEth = await provider.getBalance(ERC6551_REGISTRY_ADDRESS)
      let bal1 = await erc20a.balanceOf(ERC6551_REGISTRY_ADDRESS)
      let bal2 = await erc20b.balanceOf(ERC6551_REGISTRY_ADDRESS)
      let bal3 = await erc20c.balanceOf(ERC6551_REGISTRY_ADDRESS)
      let bal4 = 0
      let bal5 = 0
      const AddressOne = "0x0000000000000000000000000000000000000001"
      const AddressTwo = "0x0000000000000000000000000000000000000002"
      let res = await balanceFetcher.fetchBalances(ERC6551_REGISTRY_ADDRESS, [AddressZero, erc20a.address, erc20b.address, erc20c.address, AddressOne, AddressTwo])
      expect(res).deep.eq([balEth, bal1, bal2, bal3, bal4, bal5])
    })
    it("can fetch claimable gas for blastable contract 1", async function () {
      let balEth = await provider.getBalance(gasBurner.address)
      let bal1 = await erc20a.balanceOf(gasBurner.address)
      let bal2 = await erc20b.balanceOf(gasBurner.address)
      let bal3 = await erc20c.balanceOf(gasBurner.address)
      let bal4 = 0 // these SHOULD be nonzero, but
      let bal5 = 0
      const AddressOne = "0x0000000000000000000000000000000000000001"
      const AddressTwo = "0x0000000000000000000000000000000000000002"
      let res = await balanceFetcher.fetchBalances(gasBurner.address, [AddressZero, erc20a.address, erc20b.address, erc20c.address, AddressOne, AddressTwo])
      expect(res).deep.eq([balEth, bal1, bal2, bal3, bal4, bal5])
    })
    it("can fetch claimable gas for blastable contract 2", async function () {
      let balEth = await provider.getBalance(gasBurner2.address)
      let bal1 = await erc20a.balanceOf(gasBurner2.address)
      let bal2 = await erc20b.balanceOf(gasBurner2.address)
      let bal3 = await erc20c.balanceOf(gasBurner2.address)
      let bal4 = 2255
      let bal5 = 1500
      const AddressOne = "0x0000000000000000000000000000000000000001"
      const AddressTwo = "0x0000000000000000000000000000000000000002"
      let res = await balanceFetcher.fetchBalances(gasBurner2.address, [AddressZero, erc20a.address, erc20b.address, erc20c.address, AddressOne, AddressTwo])
      expect(res).deep.eq([balEth, bal1, bal2, bal3, bal4, bal5])
    })
  });

  describe("L1 gas fees", function () {
    it("calculate", async function () {
      l1DataFeeAnalyzer.analyze()
    });
  });
});
