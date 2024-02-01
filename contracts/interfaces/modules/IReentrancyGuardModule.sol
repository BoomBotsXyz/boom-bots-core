// SPDX-License-Identifier: none
pragma solidity 0.8.19;


/**
 * @title IReentrancyGuardModule
 * @author Blue Matter Technologies
 * @notice A module that helps protect against unwanted reentrancy.
 *
 * This module allows for the retrieval of the reentrancy guard state. Protection is offered in the associated ReentrancyGuardLibrary.
 *
 * The state can be fetched via [`reentrancyGuardState()`](#reentrancyguardstate). A return value of `1` means that it can be entered. Any other value means that it cannot.
 */
interface IReentrancyGuardModule {

    /**
     * @notice Returns the stored state of reentrancy guard.
     * @return rgState The current state.
     */
    function reentrancyGuardState() external view returns (uint256 rgState);
}
