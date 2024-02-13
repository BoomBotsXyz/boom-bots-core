// SPDX-License-Identifier: none
pragma solidity 0.8.19;


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
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Returns the address of the Blast contract.
     * @return blast_ The address of the Blast contract.
     */
    function blast() external view returns (address blast_);

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

    /**
     * @notice Allows this contract to receive the gas token.
     */
    receive() external payable;

    /***************************************
    QUOTE CLAIM FUNCTIONS
    ***************************************/

    /**
     * @notice Quotes the amount of gas expected when claiming all gas.
     * This _should_ be a view function, except that it relies on the state change then reverting it.
     * This _should_ be called with an offchain staticcall.
     * This _should not_ be called onchain.
     * Can be called by anyone.
     * @return quoteAmount The amount of gas that can be claimed.
     */
    function quoteClaimAllGas() external payable returns (uint256 quoteAmount);

    /**
     * @notice Quotes the amount of gas expected when claiming all gas.
     * This function will revert, including the amount in the error.
     * This _should_ only be called via [`quoteClaimAllGas()`](#quoteclaimallgas).
     */
    function quoteClaimAllGasWithRevert() external payable;

    /**
     * @notice Quotes the amount of gas expected when claiming max gas.
     * This _should_ be a view function, except that it relies on the state change then reverting it.
     * This _should_ be called with an offchain staticcall.
     * This _should not_ be called onchain.
     * Can be called by anyone.
     * @return quoteAmount The amount of gas that can be claimed.
     */
    function quoteClaimMaxGas() external payable returns (uint256 quoteAmount);

    /**
     * @notice Quotes the amount of gas expected when claiming max gas.
     * This function will revert, including the amount in the error.
     * This _should_ only be called via [`quoteClaimMaxGas()`](#quoteclaimmaxgas).
     */
    function quoteClaimMaxGasWithRevert() external payable;
}
