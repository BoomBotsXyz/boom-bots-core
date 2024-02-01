// SPDX-License-Identifier: none
pragma solidity 0.8.19;


/**
 * @title IERC165Module
 * @author Blue Matter Technologies
 * @notice A module that supports ERC165 Standard Interface Detection.
 *
 * Allows [`supportsInterface()`](#supportsinterface) per ERC165. Also allows the contract owner to update the list of supported interfaces via [`updateSupportedInterfaces()`](#updatesupportedinterfaces).
 */
interface IERC165Module {

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Query if a contract implements an interface.
     * @param interfaceID The interface identifier, as specified in ERC-165.
     * @dev Interface identification is specified in ERC-165. This function uses less than 30,000 gas.
     * @return supported `true` if the contract implements `interfaceID` and `interfaceID` is not `0xffffffff`, `false` otherwise.
     */
    function supportsInterface(bytes4 interfaceID) external view returns (bool supported);

    /***************************************
    MUTATOR FUNCTIONS
    ***************************************/

    /**
     * @notice Adds or removes supported interfaces.
     * @dev Add access control in implementation.
     * @param interfaceIDs The list of interfaces to update.
     * @param support The list of true to signal support, false otherwise.
     */
    function updateSupportedInterfaces(bytes4[] calldata interfaceIDs, bool[] calldata support) external payable;
}
