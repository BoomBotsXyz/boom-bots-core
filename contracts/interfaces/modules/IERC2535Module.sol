// SPDX-License-Identifier: none
pragma solidity 0.8.19;

import { ERC2535Library } from "./../../libraries/modules/ERC2535Library.sol";


/**
 * @title IERC2535Module
 * @author Blue Matter Technologies
 * @notice A module that allows modification and inspection of an ERC2535 Modular Smart Contract.
 *
 * See details of the `ERC2535` diamond standard at https://eips.ethereum.org/EIPS/eip-2535.
 */
interface IERC2535Module {

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Gets all facets and their selectors.
     * @return facets_ A list of all facets on the diamond.
     */
    function facets() external view returns (ERC2535Library.Facet[] memory facets_);

    /**
     * @notice Gets all the function selectors provided by a facet.
     * @param _facet The facet address.
     * @return facetFunctionSelectors_ The function selectors provided by the facet.
     */
    function facetFunctionSelectors(address _facet) external view returns (bytes4[] memory facetFunctionSelectors_);

    /**
     * @notice Get all the facet addresses used by a diamond.
     * @return facetAddresses_ The list of all facets on the diamond.
     */
    function facetAddresses() external view returns (address[] memory facetAddresses_);

    /**
     * @notice Gets the facet that supports the given selector.
     * @dev If facet is not found return address(0).
     * @param _functionSelector The function selector.
     * @return facetAddress_ The facet address.
     */
    function facetAddress(bytes4 _functionSelector) external view returns (address facetAddress_);

    /***************************************
    MUTATOR FUNCTIONS
    ***************************************/

    /**
     * @notice Add/replace/remove any number of functions and optionally execute a function with delegatecall.
     * @dev Add access control in implementation.
     * @param _diamondCut Contains the facet addresses and function selectors.
     * @param _init The address of the contract or facet to execute `_calldata`.
     * @param _calldata A function call, including function selector and arguments.
     */
    function diamondCut(
        ERC2535Library.FacetCut[] calldata _diamondCut,
        address _init,
        bytes calldata _calldata
    ) external payable;
}
