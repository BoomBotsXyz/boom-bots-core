// SPDX-License-Identifier: none
pragma solidity 0.8.19;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


/**
 * @title ERC20BalanceFetcher
 * @author Blue Matter Technologies
 * @notice The ERC20BalanceFetcher is a purely utility contract that helps offchain components efficiently fetch an account's balance of tokens.
 */
contract ERC20BalanceFetcher {

    /**
     * @notice Given an account and a list of tokens, returns that account's balance of each token.
     * Supports ERC20s and the gas token.
     * @param account The account to query.
     * @param tokens The list of tokens to query.
     */
    function fetchBalances(address account, address[] calldata tokens) external view returns (uint256[] memory balances) {
        balances = new uint256[](tokens.length);
        for(uint256 i; i < tokens.length; ) {
            address token = tokens[i];
            if(token == address(0)) balances[i] = account.balance;
            else balances[i] = IERC20(token).balanceOf(account);
            unchecked { ++i; }
        }
    }
}
