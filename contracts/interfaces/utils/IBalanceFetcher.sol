// SPDX-License-Identifier: none
pragma solidity 0.8.19;


/**
 * @title IBalanceFetcher
 * @author Blue Matter Technologies
 * @notice The BalanceFetcher is a purely utility contract that helps offchain components efficiently fetch an account's balance of tokens.
 */
interface IBalanceFetcher {

    /**
     * @notice Given an account and a list of tokens, returns that account's balance of each token.
     * Supports ERC20s and the gas token.
     * @param account The account to query.
     * @param tokens The list of tokens to query.
     */
    function fetchBalances(address account, address[] calldata tokens) external payable returns (uint256[] memory balances);
}
