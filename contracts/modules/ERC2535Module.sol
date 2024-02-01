// SPDX-License-Identifier: none
pragma solidity 0.8.19;

import { IERC2535Module } from "./../interfaces/modules/IERC2535Module.sol";
import { ERC2535Library } from "./../libraries/modules/ERC2535Library.sol";
import { ERC6551AccountLibrary } from "./../libraries/modules/ERC6551AccountLibrary.sol";
import { ReentrancyGuardLibrary } from "./../libraries/modules/ReentrancyGuardLibrary.sol";


/**
 * @title ERC2535Module
 * @author Blue Matter Tehcnologies
 * @notice A module that allows modification and inspection of an ERC2535 Modular Smart Contract.
 *
 * See details of the `ERC2535` diamond standard at https://eips.ethereum.org/EIPS/eip-2535.
 */
contract ERC2535Module is IERC2535Module {

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Gets all facets and their selectors.
     * @return facets_ A list of all facets on the diamond.
     */
    function facets() external view override returns (ERC2535Library.Facet[] memory facets_) {
        ReentrancyGuardLibrary.reentrancyGuardCheck();
        facets_ = ERC2535Library.facets();
    }

    /**
     * @notice Gets all the function selectors provided by a facet.
     * @param _facet The facet address.
     * @return facetFunctionSelectors_ The function selectors provided by the facet.
     */
    function facetFunctionSelectors(address _facet) external view override returns (bytes4[] memory facetFunctionSelectors_) {
        ReentrancyGuardLibrary.reentrancyGuardCheck();
        facetFunctionSelectors_ = ERC2535Library.facetFunctionSelectors(_facet);
    }

    /**
     * @notice Get all the facet addresses used by a diamond.
     * @return facetAddresses_ The list of all facets on the diamond.
     */
    function facetAddresses() external view override returns (address[] memory facetAddresses_) {
        ReentrancyGuardLibrary.reentrancyGuardCheck();
        facetAddresses_ = ERC2535Library.facetAddresses();
    }

    /**
     * @notice Gets the facet that supports the given selector.
     * @dev If facet is not found return address(0).
     * @param _functionSelector The function selector.
     * @return facetAddress_ The facet address.
     */
    function facetAddress(bytes4 _functionSelector) external view override returns (address facetAddress_) {
        ReentrancyGuardLibrary.reentrancyGuardCheck();
        facetAddress_ = ERC2535Library.facetAddress(_functionSelector);
    }

    /***************************************
    MUTATOR FUNCTIONS
    ***************************************/

    /**
     * @notice Add/replace/remove any number of functions and optionally execute a function with delegatecall.
     * Can only be called by the contract owner.
     * @param _diamondCut Contains the facet addresses and function selectors.
     * @param _init The address of the contract or facet to execute `_calldata`.
     * @param _calldata A function call, including function selector and arguments.
     */
    function diamondCut(
        ERC2535Library.FacetCut[] calldata _diamondCut,
        address _init,
        bytes calldata _calldata
    ) external payable override {
        ReentrancyGuardLibrary.reentrancyGuardCheck();
        ERC6551AccountLibrary.validateSender();
        ERC2535Library.diamondCut(_diamondCut, _init, _calldata);
    }
}
