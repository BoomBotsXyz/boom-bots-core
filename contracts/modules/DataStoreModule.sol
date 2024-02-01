// SPDX-License-Identifier: none
pragma solidity 0.8.19;

import { IDataStoreModule } from "./../interfaces/modules/IDataStoreModule.sol";
import { DataStoreLibrary } from "./../libraries/modules/DataStoreLibrary.sol";


/**
 * @title DataStoreModule
 * @author Blue Matter Tehcnologies
 * @notice A module that stores and retrieves the address of the DataStore contract.
 *
 * This module is NOT the DataStore nor does it store similar data. It simply stores the DataStore contract address so that other modules may query it.
 */
contract DataStoreModule is IDataStoreModule {

    /**
     * @notice Gets the address of the DataStore contract.
     * @return dataStore_ The address of the DataStore contract.
     */
    function dataStore() external view override returns (address dataStore_) {
        dataStore_ = DataStoreLibrary.dataStore();
    }
}
