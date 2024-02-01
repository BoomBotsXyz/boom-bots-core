// SPDX-License-Identifier: none
pragma solidity 0.8.19;

import { Errors } from "./../Errors.sol";


/**
 * @title DataStoreLibrary
 * @author Blue Matter Tehcnologies
 * @notice A library that stores and retrieves the address of the DataStore contract.
 *
 * This library is NOT the DataStore nor does it store similar data. It simply stores the DataStore contract address so that other modules and libraries may query it.
 */
library DataStoreLibrary {

    bytes32 constant private DATA_STORE_LIBRARY_STORAGE_POSITION = keccak256("boom.storage.datastore");

    struct DataStoreLibraryStorage {
        // the address of the DataStore contract
        address dataStore;
    }

    /**
     * @notice Returns the `DataStoreLibraryStorage` struct.
     * @return dsls The `DataStoreLibraryStorage` struct.
     */
    function dataStoreLibraryStorage() internal pure returns (DataStoreLibraryStorage storage dsls) {
        bytes32 position = DATA_STORE_LIBRARY_STORAGE_POSITION;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            dsls.slot := position
        }
    }

    /**
     * @notice Gets the address of the DataStore contract.
     * @return dataStore_ The address of the DataStore contract.
     */
    function dataStore() internal view returns (address dataStore_) {
        DataStoreLibraryStorage storage dsls = dataStoreLibraryStorage();
        dataStore_ = dsls.dataStore;
    }

    /**
     * @notice Sets the address of the DataStore contract.
     * Can only be called once.
     * @param dataStore_ The address of the DataStore contract.
     */
    function setDataStore(address dataStore_) internal {
        if(dataStore_ == address(0)) revert Errors.AddressZero();
        DataStoreLibraryStorage storage dsls = dataStoreLibraryStorage();
        address dataStore0 = dsls.dataStore;
        if(dataStore0 != address(0)) revert Errors.AlreadyInitialized();
        dsls.dataStore = dataStore_;
    }
}
