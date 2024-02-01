// SPDX-License-Identifier: none
pragma solidity 0.8.19;

import { Errors } from "./../Errors.sol";


/**
 * @title ReentrancyGuardLibrary
 * @author Blue Matter Tehcnologies
 * @notice A library that helps protect against unwanted reentrancy.
 *
 * The state can be fetched via [`reentrancyGuardState()`](#reentrancyguardstate). A return value of `1` means that it can be entered. Any other value means that it cannot.
 *
 * Modules that wish to protect against reentrancy should call [`reentrancyGuardCheck()`](#reentrancyguardcheck) in their functions. They can then [`reentrancyGuardSetEnterable()`](#reentrancyguardsetenterable) and [`reentrancyGuardSetNotEnterable()`](#reentrancyguardsetnotenterable) as needed.
 */
library ReentrancyGuardLibrary {

    bytes32 constant private REENTRANCY_GUARD_LIBRARY_STORAGE_POSITION = keccak256("boom.storage.reentrancyguard");

    struct ReentrancyGuardLibraryStorage {
        // the reentrancy guard state
        uint256 reentrancyGuardState;
    }

    // allow entrance
    uint256 internal constant ENTERABLE = 1;
    // deny entrance
    uint256 internal constant NOT_ENTERABLE = 2;

    /**
     * @notice Returns the `ReentrancyGuardLibraryStorage` struct.
     * @return rgls The `ReentrancyGuardLibraryStorage` struct.
     */
    function reentrancyGuardLibraryStorage() internal pure returns (ReentrancyGuardLibraryStorage storage rgls) {
        bytes32 position = REENTRANCY_GUARD_LIBRARY_STORAGE_POSITION;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            rgls.slot := position
        }
    }

    /**
     * @notice Returns the stored state of reentrancy guard.
     * @return rgState The current state.
     */
    function reentrancyGuardState() internal view returns (uint256 rgState) {
        rgState = reentrancyGuardLibraryStorage().reentrancyGuardState;
    }

    /**
     * @notice Reverts on unallowed reentrant call.
     */
    function reentrancyGuardCheck() internal view {
        if(reentrancyGuardLibraryStorage().reentrancyGuardState != ENTERABLE) revert Errors.ReentrancyGuard();
    }

    /**
     * @notice Marks the contract as enterable.
     * Should be called when exiting the context of this contract.
     */
    function reentrancyGuardSetEnterable() internal {
        reentrancyGuardLibraryStorage().reentrancyGuardState = ENTERABLE;
    }

    /**
     * @notice Marks the contract as not enterable.
     * Should be called when entering the context of this contract.
     */
    function reentrancyGuardSetNotEnterable() internal {
        reentrancyGuardLibraryStorage().reentrancyGuardState = NOT_ENTERABLE;
    }
}
