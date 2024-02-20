// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { ERC2535Library } from "./../../libraries/modules/ERC2535Library.sol";


/**
 * @title IBoomBotAccount
 * @author Blue Matter Technologies
 * @notice The base contract for bot accounts. May be deployed and used as-is or extended via modules.
*/
interface IBoomBotAccount {

    /**
     * @notice Initializes the account.
     * Can only be called once.
     * @param diamondCut_ The modules to install.
     * @param dataStore_ The address of the DataStore contract.
     */
    function initialize(ERC2535Library.FacetCut[] memory diamondCut_, address dataStore_) external payable;

    /**
     * @notice Executes an arbitrary function call on this contract.
     * @param data The data for the function to call.
     * @return result The result of the function call.
     */
    fallback(bytes calldata data) external payable returns (bytes memory result);

    /**
     * @notice Allows this contract to receive the gas token.
     */
    receive() external payable;
}
