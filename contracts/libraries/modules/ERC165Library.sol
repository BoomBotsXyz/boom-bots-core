// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { Errors } from "./../Errors.sol";


/**
 * @title ERC165Library
 * @author Blue Matter Technologies
 * @notice A library that supports ERC165 Standard Interface Detection.
 *
 * Allows [`supportsInterface()`](#supportsinterface) per ERC165. Also allows the contract owner to update the list of supported interfaces via [`updateSupportedInterfaces()`](#updatesupportedinterfaces).
 */
library ERC165Library {

    /***************************************
    STORAGE FUNCTIONS
    ***************************************/

    /// @notice Emitted when support for an interface is updated.
    event InterfaceSupportUpdated(bytes4 indexed interfaceID, bool supported);

    bytes32 constant internal ERC165_STORAGE_POSITION = keccak256("boom.storage.erc165");

    struct ERC165LibraryStorage {
        // Used to query if a contract implements an interface.
        // Used to implement ERC-165.
        mapping(bytes4 => bool) supportedInterfaces;
    }

    /**
     * @notice Returns the `ERC165LibraryStorage` struct.
     * @return erc165ls The `ERC165LibraryStorage` struct.
     */
    function erc165LibraryStorage() internal pure returns (ERC165LibraryStorage storage erc165ls) {
        bytes32 position = ERC165_STORAGE_POSITION;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            erc165ls.slot := position
        }
    }

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Query if a contract implements an interface.
     * @param interfaceID The interface identifier, as specified in ERC-165.
     * @dev Interface identification is specified in ERC-165. This function uses less than 30,000 gas.
     * @return supported `true` if the contract implements `interfaceID` and `interfaceID` is not `0xffffffff`, `false` otherwise.
     */
    function supportsInterface(bytes4 interfaceID) internal view returns (bool supported) {
        ERC165LibraryStorage storage erc165ls = erc165LibraryStorage();
        supported = erc165ls.supportedInterfaces[interfaceID];
    }

    /***************************************
    MUTATOR FUNCTIONS
    ***************************************/

    /**
     * @notice Adds or removes supported interfaces.
     * Can only be called by the contract owner.
     * @param interfaceIDs The list of interfaces to update.
     * @param support The list of true to signal support, false otherwise.
     */
    function updateSupportedInterfaces(bytes4[] calldata interfaceIDs, bool[] calldata support) internal {
        if(interfaceIDs.length != support.length) revert Errors.LengthMismatch();
        ERC165LibraryStorage storage erc165ls = erc165LibraryStorage();
        for(uint256 i = 0; i < interfaceIDs.length; ) {
            bytes4 interfaceID = interfaceIDs[i];
            bool supported = support[i];
            erc165ls.supportedInterfaces[interfaceID] = supported;
            emit InterfaceSupportUpdated(interfaceID, supported);
            unchecked { i++; }
        }
    }
}
