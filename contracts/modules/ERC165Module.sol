// SPDX-License-Identifier: none
pragma solidity 0.8.19;

import { IERC165Module } from "./../interfaces/modules/IERC165Module.sol";
import { ERC165Library } from "./../libraries/modules/ERC165Library.sol";
import { ERC6551AccountLibrary } from "./../libraries/modules/ERC6551AccountLibrary.sol";
import { ReentrancyGuardLibrary } from "./../libraries/modules/ReentrancyGuardLibrary.sol";


/**
 * @title ERC165Module
 * @author Blue Matter Technologies
 * @notice A module that supports ERC165 Standard Interface Detection.
 *
 * Allows [`supportsInterface()`](#supportsinterface) per ERC165. Also allows the contract owner to update the list of supported interfaces via [`updateSupportedInterfaces()`](#updatesupportedinterfaces).
 */
contract ERC165Module is IERC165Module {

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Query if a contract implements an interface.
     * @param interfaceID The interface identifier, as specified in ERC-165.
     * @dev Interface identification is specified in ERC-165. This function uses less than 30,000 gas.
     * @return supported `true` if the contract implements `interfaceID` and `interfaceID` is not `0xffffffff`, `false` otherwise.
     */
    function supportsInterface(bytes4 interfaceID) external view override returns (bool supported) {
        supported = ERC165Library.supportsInterface(interfaceID);
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
    function updateSupportedInterfaces(bytes4[] calldata interfaceIDs, bool[] calldata support) external payable override {
        ReentrancyGuardLibrary.reentrancyGuardCheck();
        ERC6551AccountLibrary.validateSender();
        ERC165Library.updateSupportedInterfaces(interfaceIDs, support);
    }
}
