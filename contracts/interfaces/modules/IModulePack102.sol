// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IModulePack102
 * @author Blue Matter Technologies
 * @notice
 */
interface IModulePack102 {

    /***************************************
    CLAIM FUNCTIONS
    ***************************************/

    /**
     * @notice Claims all gas from the blast gas reward contract.
     * Can only be called by the TBA owner.
     * @return amountClaimed The amount of gas claimed.
     */
    function claimAllGas() external payable returns (uint256 amountClaimed);

    /**
     * @notice Claims max gas from the blast gas reward contract.
     * Can only be called by the TBA owner.
     * @return amountClaimed The amount of gas claimed.
     */
    function claimMaxGas() external payable returns (uint256 amountClaimed);

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
