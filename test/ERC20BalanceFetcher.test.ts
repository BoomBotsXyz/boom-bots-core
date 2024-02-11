/* global describe it before ethers */

import hre from "hardhat";
const { ethers } = hre;
const { provider } = ethers;
import { BigNumber as BN, BigNumberish } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
const { expect, assert } = chai;
import fs from "fs";

import { ERC20BalanceFetcher, MockERC20 } from "./../typechain-types";

import { isDeployed, expectDeployed } from "./../scripts/utils/expectDeployed";
import { toBytes32 } from "./../scripts/utils/setStorage";
import { getNetworkSettings } from "../scripts/utils/getNetworkSettings";
import { decimalsToAmount } from "../scripts/utils/price";
import { leftPad } from "../scripts/utils/strings";
import { deployContract } from "../scripts/utils/deployContract";
import L1DataFeeAnalyzer from "../scripts/utils/L1DataFeeAnalyzer";

const { AddressZero, WeiPerEther, MaxUint256, Zero } = ethers.constants;
const WeiPerUsdc = BN.from(1_000_000); // 6 decimals

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
  });

  after(async function () {
    await provider.send("evm_revert", [snapshot]);
  });

  describe("setup", function () {
    it("can deploy ERC20BalanceFetcher", async function () {
      balanceFetcher = await deployContract(deployer, "ERC20BalanceFetcher", []) as ERC20BalanceFetcher;
      await expectDeployed(balanceFetcher.address);
      l1DataFeeAnalyzer.register("deploy ERC20BalanceFetcher", balanceFetcher.deployTransaction);
    });
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
  });

  describe("L1 gas fees", function () {
    it("calculate", async function () {
      l1DataFeeAnalyzer.analyze()
    });
  });
});
