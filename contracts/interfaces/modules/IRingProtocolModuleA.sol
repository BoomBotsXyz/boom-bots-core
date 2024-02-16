// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IRingProtocolModuleA
 * @author Blue Matter Technologies
 * @notice A module that helps automate trades in Ring Protocol.
 *
 * Uses the Ring Protocol UniversalRouter to swap ETH for WETH, USDC, USDT, DAI, BOLT, and RGB.
 */
interface IRingProtocolModuleA {

    /***************************************
    MUTATOR FUNCTIONS
    ***************************************/

    /**
     * @notice Executes trades in Ring Protocol.
     * Will trade eth for usdc, usdt, dai, bolt, and rgb.
     * Can only be called by the contract owner.
     * @param ethAmount The amount of eth to input in whole. Will be split across multiple trades.
     */
    function executeRingProtocolModuleA(uint256 ethAmount) external payable;
}
