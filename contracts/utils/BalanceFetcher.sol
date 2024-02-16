// SPDX-License-Identifier: none
pragma solidity 0.8.19;

import { Multicall } from "./Multicall.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IBalanceFetcher } from "./../interfaces/utils/IBalanceFetcher.sol";
import { Blastable } from "./Blastable.sol";


/**
 * @title BalanceFetcher
 * @author Blue Matter Technologies
 * @notice The BalanceFetcher is a purely utility contract that helps offchain components efficiently fetch an account's balance of tokens.
 */
contract BalanceFetcher is IBalanceFetcher, Blastable, Multicall {

    /**
     * @notice Constructs the BalanceFetcher contract.
     * @param _owner The owner of the contract.
     */
    constructor(address _owner) {
        _transferOwnership(_owner);
    }

    /**
     * @notice Given an account and a list of tokens, returns that account's balance of each token.
     * Supports ERC20s and the gas token.
     * @param account The account to query.
     * @param tokens The list of tokens to query.
     */
    function fetchBalances(address account, address[] calldata tokens) external payable override returns (uint256[] memory balances) {
        balances = new uint256[](tokens.length);
        for(uint256 i = 0; i < tokens.length; ) {
            address token = tokens[i];
            if(token == address(0)) balances[i] = account.balance;
            else if(token == address(1)) balances[i] = _tryQuoteClaimAllGas(account);
            else if(token == address(2)) balances[i] = _tryQuoteClaimMaxGas(account);
            else balances[i] = IERC20(token).balanceOf(account);
            unchecked { ++i; }
        }
    }

    /**
     * @notice Quotes the amount of gas expected when claiming all gas.
     * Can be called by anyone.
     * @return quoteAmount The amount of gas that can be claimed.
     */
    function _tryQuoteClaimAllGas(address account) internal returns (uint256 quoteAmount) {
        bytes memory payload = abi.encodeWithSignature("quoteClaimAllGas()");
        (bool success, bytes memory returndata) = account.call(payload);
        if(!success) return 0;
        if(returndata.length != 32) return 0;
        (quoteAmount) = abi.decode(returndata, (uint256));
    }

    /**
     * @notice Quotes the amount of gas expected when claiming max gas.
     * Can be called by anyone.
     * @return quoteAmount The amount of gas that can be claimed.
     */
    function _tryQuoteClaimMaxGas(address account) internal returns (uint256 quoteAmount) {
        bytes memory payload = abi.encodeWithSignature("quoteClaimMaxGas()");
        (bool success, bytes memory returndata) = account.call(payload);
        if(!success) return 0;
        if(returndata.length != 32) return 0;
        (quoteAmount) = abi.decode(returndata, (uint256));
    }
}
