// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { IMulticallModule } from "./../interfaces/modules/IMulticallModule.sol";
import { Calls } from  "./../libraries/Calls.sol";
import { Errors } from  "./../libraries/Errors.sol";
import { ERC2535Library } from  "./../libraries/modules/ERC2535Library.sol";


/**
 * @title MulticallModule
 * @author Blue Matter Technologies
 * @notice A module that allows multiple calls to be executed against a contract in a single transaction.
 */
contract MulticallModule is IMulticallModule {

    /**
     * @notice Receives and executes a batch of function calls on this contract.
     * @param data A list of function calls to execute.
     * @return results The results of each function call.
     */
    function multicall(bytes[] memory data) external payable override returns (bytes[] memory results) {
        results = new bytes[](data.length);
        for (uint256 i = 0; i < data.length; ) {
            bytes memory nextcall = data[i];
            // get function selector
            bytes4 msgsig;
            // solhint-disable-next-line no-inline-assembly
            assembly {
                msgsig := mload(add(nextcall, 32))
            }
            // get facet from function selector
            address facet = ERC2535Library.getFacetAddress(msgsig);
            // execute external function from facet using delegatecall and return any value
            results[i] = Calls.functionDelegateCall(facet, nextcall);
            unchecked { i++; }
        }
    }
}
