// SPDX-License-Identifier: none
pragma solidity 0.8.19;

import { IReentrancyGuardModule } from "./../interfaces/modules/IReentrancyGuardModule.sol";
import { ReentrancyGuardLibrary } from "./../libraries/modules/ReentrancyGuardLibrary.sol";


/**
 * @title ReentrancyGuardModule
 * @author Blue Matter Tehcnologies
 * @notice A module that helps protect against unwanted reentrancy.
 *
 * This module allows for the retrieval of the reentrancy guard state. Protection is offered in the associated ReentrancyGuardLibrary.
 *
 * The state can be fetched via [`reentrancyGuardState()`](#reentrancyguardstate). A return value of `1` means that it can be entered. Any other value means that it cannot.
 */
contract ReentrancyGuardModule is IReentrancyGuardModule {

    /**
     * @notice Returns the stored state of reentrancy guard.
     * @return rgState The current state.
     */
    function reentrancyGuardState() external view override returns (uint256 rgState) {
        rgState = ReentrancyGuardLibrary.reentrancyGuardState();
    }
}
