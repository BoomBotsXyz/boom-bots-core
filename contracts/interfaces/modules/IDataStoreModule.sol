// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IDataStoreModule
 * @author Blue Matter Technologies
 * @notice A module that stores and retrieves the address of the DataStore contract.
 *
 * This module is NOT the DataStore nor does it store similar data. It simply stores the DataStore contract address so that other modules may query it.
 */
interface IDataStoreModule {

    /**
     * @notice Gets the address of the DataStore contract.
     * @return dataStore_ The address of the DataStore contract.
     */
    function dataStore() external view returns (address dataStore_);
}
