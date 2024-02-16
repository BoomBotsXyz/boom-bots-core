// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IMulticallModule
 * @author Blue Matter Technologies
 * @notice A module that allows multiple calls to be executed against a contract in a single transaction.
 */
interface IMulticallModule {

    /**
     * @notice Receives and executes a batch of function calls on this contract.
     * @param data A list of function calls to execute.
     * @return results The results of each function call.
     */
    function multicall(bytes[] memory data) external payable returns (bytes[] memory results);
}
