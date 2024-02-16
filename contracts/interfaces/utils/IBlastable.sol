// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IBlastable
 * @author Blue Matter Technologies
 * @notice An abstract contract that provides access to basic Blast functions.
 *
 * This primarily involves collecting ETH yield and gas rewards. These functions are restricted to only the contract owner.
 *
 * This contract also provides [`sweep()`](#sweep) to rescue misplaced tokens.
 */
interface IBlastable {

    /***************************************
    MUTATOR FUNCTIONS
    ***************************************/

    /**
     * @notice Calls the Blast contract with arbitrary data.
     * Can only be called by the contract owner.
     * @param data The data to pass to the Blast contract.
     * @return result The result of the call.
     */
    function callBlast(bytes calldata data) external payable returns (bytes memory result);

    /**
     * @notice Claims max gas from the Blast contract (100% maturity, willing to wait).
     * Can only be called by the contract owner.
     * @param receiver The receiver of the gas claimed.
     * @return amountClaimed The amount of gas claimed.
     */
    function claimMaxGas(address receiver) external payable returns (uint256 amountClaimed);

    /**
     * @notice Claims max gas from the Blast contract (any maturity, get it now).
     * Can only be called by the contract owner.
     * @param receiver The receiver of the gas claimed.
     * @return amountClaimed The amount of gas claimed.
     */
    function claimAllGas(address receiver) external payable returns (uint256 amountClaimed);

    /***************************************
    TOKEN BALANCE FUNCTIONS
    ***************************************/

    /**
     * @notice Rescues tokens that may have been accidentally transferred in.
     * Can only be called by the contract owner.
     * @param receiver The receiver of the rescued tokens.
     * @param tokens The tokens to rescue. Can be ETH or ERC20s.
     */
    function sweep(address receiver, address[] calldata tokens) external payable;
}
