// SPDX-License-Identifier: none
pragma solidity 0.8.19;

import { Calls } from "./../libraries/Calls.sol";
import { IBoomBotAccount } from "./../interfaces/accounts/IBoomBotAccount.sol";
import { ERC2535Library } from "./../libraries/modules/ERC2535Library.sol";
import { ReentrancyGuardLibrary } from "./../libraries/modules/ReentrancyGuardLibrary.sol";
import { DataStoreLibrary } from "./../libraries/modules/DataStoreLibrary.sol";


/**
 * @title BoomBotAccount
 * @author Blue Matter Technologies
 * @notice The base contract for bot accounts. May be deployed and used as-is or extended via modules.
 */
contract BoomBotAccount is IBoomBotAccount {

    /**
     * @notice Initializes the account.
     * Can only be called once.
     * @param diamondCut_ The modules to install.
     * @param dataStore_ The address of the DataStore contract.
     */
    function initialize(ERC2535Library.FacetCut[] memory diamondCut_, address dataStore_) external payable override {
        DataStoreLibrary.setDataStore(dataStore_); // also handles double init check
        ERC2535Library.diamondCut(diamondCut_, address(0), new bytes(0));
        ReentrancyGuardLibrary.reentrancyGuardSetEnterable();
    }

    /**
     * @notice Executes an arbitrary function call on this contract.
     * @param data The data for the function to call.
     * @return result The result of the function call.
     */
    fallback(bytes calldata data) external payable override returns (bytes memory result) {
        // get facet from function selector
        address facet = ERC2535Library.getFacetAddress(msg.sig);
        // execute external function from facet using delegatecall and return any value
        result = Calls.functionDelegateCall(facet, data);
    }

    /**
     * @notice Allows this contract to receive the gas token.
     */
    // solhint-disable-next-line no-empty-blocks
    receive() external payable override {}
}
