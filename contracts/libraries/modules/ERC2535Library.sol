// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { Calls } from "./../Calls.sol";
import { Errors } from "./../Errors.sol";
import { IDataStore } from "./../../interfaces/utils/IDataStore.sol";
import { DataStoreLibrary } from "./DataStoreLibrary.sol";


/**
 * @title ERC2535Library
 * @author Blue Matter Technologies
 * @notice A library that allows modification and inspection of an ERC2535 Modular Smart Contract.
 *
 * See details of the `ERC2535` diamond standard at https://eips.ethereum.org/EIPS/eip-2535.
 */
library ERC2535Library {

    /***************************************
    EVENTS
    ***************************************/

    /// @notice Emitted when the diamond is cut.
    event DiamondCut(FacetCut[] _diamondCut, address _init, bytes _calldata);

    /***************************************
    STORAGE FUNCTIONS
    ***************************************/

    struct Facet {
        address facetAddress;
        bytes4[] functionSelectors;
    }

    // Add=0, Replace=1, Remove=2
    enum FacetCutAction { Add, Replace, Remove }

    struct FacetCut {
        address facetAddress;
        FacetCutAction action;
        bytes4[] functionSelectors;
    }

    bytes32 constant internal ERC2535_STORAGE_POSITION = keccak256("boom.storage.erc2535");

    struct FacetAddressAndPosition {
        address facetAddress;
        uint96 functionSelectorPosition; // position in facetFunctionSelectors.functionSelectors array
    }

    struct FacetFunctionSelectors {
        bytes4[] functionSelectors;
        uint256 facetAddressPosition; // position of facetAddress in facetAddresses array
    }

    struct ERC2535LibraryStorage {
        // maps function selector to the facet address and
        // the position of the selector in the facetFunctionSelectors.selectors array
        mapping(bytes4 => FacetAddressAndPosition) selectorToFacetAndPosition;
        // maps facet addresses to function selectors
        mapping(address => FacetFunctionSelectors) facetFunctionSelectors;
        // facet addresses
        address[] facetAddresses;
    }

    /**
     * @notice Returns the `ERC2535LibraryStorage` struct.
     * @return erc2535ls The `ERC2535LibraryStorage` struct.
     */
    function erc2535LibraryStorage() internal pure returns (ERC2535LibraryStorage storage erc2535ls) {
        bytes32 position = ERC2535_STORAGE_POSITION;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            erc2535ls.slot := position
        }
    }

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Gets all facets and their selectors.
     * @return facets_ A list of all facets on the diamond.
     */
    function facets() internal view returns (Facet[] memory facets_) {
        ERC2535LibraryStorage storage erc2535ls = erc2535LibraryStorage();
        uint256 numFacets = erc2535ls.facetAddresses.length;
        facets_ = new Facet[](numFacets);
        for (uint256 i = 0; i < numFacets; ) {
            address facetAddress_ = erc2535ls.facetAddresses[i];
            facets_[i].facetAddress = facetAddress_;
            facets_[i].functionSelectors = erc2535ls.facetFunctionSelectors[facetAddress_].functionSelectors;
            unchecked { i++; }
        }
    }

    /**
     * @notice Gets all the function selectors provided by a facet.
     * @param _facet The facet address.
     * @return facetFunctionSelectors_ The function selectors provided by the facet.
     */
    function facetFunctionSelectors(address _facet) internal view returns (bytes4[] memory facetFunctionSelectors_) {
        ERC2535LibraryStorage storage erc2535ls = erc2535LibraryStorage();
        facetFunctionSelectors_ = erc2535ls.facetFunctionSelectors[_facet].functionSelectors;
    }

    /**
     * @notice Get all the facet addresses used by a diamond.
     * @return facetAddresses_ The list of all facets on the diamond.
     */
    function facetAddresses() internal view returns (address[] memory facetAddresses_) {
        ERC2535LibraryStorage storage erc2535ls = erc2535LibraryStorage();
        facetAddresses_ = erc2535ls.facetAddresses;
    }

    /**
     * @notice Gets the facet that supports the given selector.
     * @dev If facet is not found return address(0).
     * @param _functionSelector The function selector.
     * @return facetAddress_ The facet address.
     */
    function facetAddress(bytes4 _functionSelector) internal view returns (address facetAddress_) {
        ERC2535LibraryStorage storage erc2535ls = erc2535LibraryStorage();
        facetAddress_ = erc2535ls.selectorToFacetAndPosition[_functionSelector].facetAddress;
    }

    /**
     * @notice Gets the facet that supports the given selector.
     * @dev Similar to facetAddress except reverts if facet is not found.
     * @param _functionSelector The function selector.
     * @return facetAddress_ The facet address.
     */
    function getFacetAddress(bytes4 _functionSelector) internal view returns (address facetAddress_) {
        ERC2535LibraryStorage storage erc2535ls = erc2535LibraryStorage();
        facetAddress_ = erc2535ls.selectorToFacetAndPosition[_functionSelector].facetAddress;
        if(facetAddress_ == address(0)) revert Errors.FunctionDoesNotExist();
    }

    /***************************************
    MUTATOR FUNCTIONS
    ***************************************/

    /**
     * @notice Add/replace/remove any number of functions and optionally execute a function with delegatecall.
     * @param _diamondCut Contains the facet addresses and function selectors.
     * @param _init The address of the contract or facet to execute `_calldata`.
     * @param _calldata A function call, including function selector and arguments.
     */
    function diamondCut(
        FacetCut[] memory _diamondCut,
        address _init,
        bytes memory _calldata
    ) internal {
        for (uint256 facetIndex; facetIndex < _diamondCut.length; ) {
            // safe to assume valid FacetCutAction
            FacetCutAction action = _diamondCut[facetIndex].action;
            if (action == FacetCutAction.Add) {
                addFunctions(_diamondCut[facetIndex].facetAddress, _diamondCut[facetIndex].functionSelectors);
            } else if (action == FacetCutAction.Replace) {
                replaceFunctions(_diamondCut[facetIndex].facetAddress, _diamondCut[facetIndex].functionSelectors);
            } else {
                removeFunctions(_diamondCut[facetIndex].facetAddress, _diamondCut[facetIndex].functionSelectors);
            }
            unchecked { facetIndex++; }
        }
        emit DiamondCut(_diamondCut, _init, _calldata);
        initializeDiamondCut(_init, _calldata);
    }

    /**
     * @notice Adds one or more functions from the facet to this diamond.
     * @param _facetAddress The address of the facet with the logic.
     * @param _functionSelectors The function selectors to add to this diamond.
     */
    function addFunctions(address _facetAddress, bytes4[] memory _functionSelectors) internal {
        if(_functionSelectors.length == 0) revert Errors.LengthZero();
        if(_facetAddress == address(0)) revert Errors.AddressZero();
        ERC2535LibraryStorage storage erc2535ls = erc2535LibraryStorage();
        uint256 selectorPosition256 = erc2535ls.facetFunctionSelectors[_facetAddress].functionSelectors.length;
        uint96 selectorPosition96 = uint96(selectorPosition256);
        // add new facet address if it does not exist
        if (selectorPosition256 == 0) {
            addFacet(erc2535ls, _facetAddress);
        }
        for (uint256 selectorIndex; selectorIndex < _functionSelectors.length; ) {
            bytes4 selector = _functionSelectors[selectorIndex];
            address oldFacetAddress = erc2535ls.selectorToFacetAndPosition[selector].facetAddress;
            if(oldFacetAddress != address(0)) revert Errors.AddFunctionDuplicate();
            addFunction(erc2535ls, selector, selectorPosition96, _facetAddress);
            unchecked { selectorPosition96++; }
            unchecked { selectorIndex++; }
        }
    }

    /**
     * @notice Replaces one or more functions from the facet to this diamond.
     * @param _facetAddress The address of the facet with the logic.
     * @param _functionSelectors The function selectors to replace on this diamond.
     */
    function replaceFunctions(address _facetAddress, bytes4[] memory _functionSelectors) internal {
        if(_functionSelectors.length == 0) revert Errors.LengthZero();
        if(_facetAddress == address(0)) revert Errors.AddressZero();
        ERC2535LibraryStorage storage erc2535ls = erc2535LibraryStorage();
        uint256 selectorPosition256 = erc2535ls.facetFunctionSelectors[_facetAddress].functionSelectors.length;
        uint96 selectorPosition96 = uint96(selectorPosition256);
        // add new facet address if it does not exist
        if (selectorPosition256 == 0) {
            addFacet(erc2535ls, _facetAddress);
        }
        for (uint256 selectorIndex; selectorIndex < _functionSelectors.length; ) {
            bytes4 selector = _functionSelectors[selectorIndex];
            address oldFacetAddress = erc2535ls.selectorToFacetAndPosition[selector].facetAddress;
            if(oldFacetAddress == _facetAddress) revert Errors.ReplaceFunctionSame();
            removeFunction(erc2535ls, oldFacetAddress, selector);
            addFunction(erc2535ls, selector, selectorPosition96, _facetAddress);
            unchecked { selectorPosition96++; }
            unchecked { selectorIndex++; }
        }
    }

    /**
     * @notice Removes one or more functions from the facet from this diamond.
     * @param _facetAddress The address of the facet with the logic.
     * @param _functionSelectors The function selectors to remove from this diamond.
     */
    function removeFunctions(address _facetAddress, bytes4[] memory _functionSelectors) internal {
        if(_functionSelectors.length == 0) revert Errors.LengthZero();
        if(_facetAddress != address(0)) revert Errors.AddressNotZero();
        ERC2535LibraryStorage storage erc2535ls = erc2535LibraryStorage();
        // if function does not exist then do nothing and return
        for (uint256 selectorIndex; selectorIndex < _functionSelectors.length; ) {
            bytes4 selector = _functionSelectors[selectorIndex];
            address oldFacetAddress = erc2535ls.selectorToFacetAndPosition[selector].facetAddress;
            removeFunction(erc2535ls, oldFacetAddress, selector);
            unchecked { selectorIndex++; }
        }
    }

    /**
     * @notice Adds a new facet to the list of known facets.
     * @param erc2535ls The ERC2535LibraryStorage struct.
     * @param _facetAddress The address of the facet to add.
     */
    function addFacet(ERC2535LibraryStorage storage erc2535ls, address _facetAddress) internal {
        enforceCanUseModule(_facetAddress);
        erc2535ls.facetFunctionSelectors[_facetAddress].facetAddressPosition = erc2535ls.facetAddresses.length;
        erc2535ls.facetAddresses.push(_facetAddress);
    }

    /**
     * @notice Adds a function from the facet to this diamond.
     * @param erc2535ls The ERC2535LibraryStorage struct.
     * @param _selector The function selector to add to this diamond.
     * @param _selectorPosition The position in facetFunctionSelectors.functionSelectors array.
     * @param _facetAddress The address of the facet with the logic.
     */
    function addFunction(ERC2535LibraryStorage storage erc2535ls, bytes4 _selector, uint96 _selectorPosition, address _facetAddress) internal {
        erc2535ls.selectorToFacetAndPosition[_selector].functionSelectorPosition = _selectorPosition;
        erc2535ls.facetFunctionSelectors[_facetAddress].functionSelectors.push(_selector);
        erc2535ls.selectorToFacetAndPosition[_selector].facetAddress = _facetAddress;
    }

    /**
     * @notice Removes a function from the facet from this diamond.
     * @param erc2535ls The ERC2535LibraryStorage struct.
     * @param _facetAddress The address of the facet with the logic.
     * @param _selector The function selector to add to this diamond.
     */
    function removeFunction(ERC2535LibraryStorage storage erc2535ls, address _facetAddress, bytes4 _selector) internal {
        if(_facetAddress == address(0)) revert Errors.RemoveFunctionDoesNotExist();
        // an immutable function is a function defined directly in a diamond
        if(_facetAddress == address(this)) revert Errors.RemoveFunctionImmutable();
        // replace selector with last selector, then delete last selector
        uint256 selectorPosition = erc2535ls.selectorToFacetAndPosition[_selector].functionSelectorPosition;
        uint256 lastSelectorPosition = erc2535ls.facetFunctionSelectors[_facetAddress].functionSelectors.length - 1;
        // if not the same then replace _selector with lastSelector
        if (selectorPosition != lastSelectorPosition) {
            bytes4 lastSelector = erc2535ls.facetFunctionSelectors[_facetAddress].functionSelectors[lastSelectorPosition];
            erc2535ls.facetFunctionSelectors[_facetAddress].functionSelectors[selectorPosition] = lastSelector;
            erc2535ls.selectorToFacetAndPosition[lastSelector].functionSelectorPosition = uint96(selectorPosition);
        }
        // delete the last selector
        erc2535ls.facetFunctionSelectors[_facetAddress].functionSelectors.pop();
        delete erc2535ls.selectorToFacetAndPosition[_selector];
        // if no more selectors for facet address then delete the facet address
        if (lastSelectorPosition == 0) {
            // replace facet address with last facet address and delete last facet address
            uint256 lastFacetAddressPosition = erc2535ls.facetAddresses.length - 1;
            uint256 facetAddressPosition = erc2535ls.facetFunctionSelectors[_facetAddress].facetAddressPosition;
            if (facetAddressPosition != lastFacetAddressPosition) {
                address lastFacetAddress = erc2535ls.facetAddresses[lastFacetAddressPosition];
                erc2535ls.facetAddresses[facetAddressPosition] = lastFacetAddress;
                erc2535ls.facetFunctionSelectors[lastFacetAddress].facetAddressPosition = facetAddressPosition;
            }
            erc2535ls.facetAddresses.pop();
            delete erc2535ls.facetFunctionSelectors[_facetAddress].facetAddressPosition;
        }
    }

    /***************************************
    HELPER FUNCTIONS
    ***************************************/

    /**
     * @notice Optionally delegatecalls a contract on diamond cut.
     * @param _init The address of the contract to delegatecall to or zero to skip.
     * @param _calldata The data to send to _init.
     */
    function initializeDiamondCut(address _init, bytes memory _calldata) internal {
        if (_init == address(0)) {
            return;
        }
        enforceCanUseModule(_init);
        Calls.functionDelegateCall(_init, _calldata);
    }

    /**
     * @notice Reverts execution if the module cannot be used.
     * Only enforced on diamondCut.
     * @param module The address of the module to use.
     */
    function enforceCanUseModule(address module) internal view {
        // account should be able to install functions from its implementation
        if(module == address(this)) return;
        // enforcement on other modules
        Calls.verifyHasCode(module);
        address payable dataStore = payable(DataStoreLibrary.dataStore());
        if(!IDataStore(dataStore).moduleCanBeInstalled(module)) revert Errors.ModuleNotWhitelisted();
    }
}
