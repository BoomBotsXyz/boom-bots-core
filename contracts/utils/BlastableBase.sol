// SPDX-License-Identifier: none
pragma solidity 0.8.19;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IBlast } from "./../interfaces/external/Blast/IBlast.sol";
import { IBlastableBase } from "./../interfaces/utils/IBlastableBase.sol";
import { Ownable2Step } from "./Ownable2Step.sol";
import { Errors } from "./../libraries/Errors.sol";
import { Calls } from "./../libraries/Calls.sol";
import { BlastableLibrary } from "./../libraries/BlastableLibrary.sol";


/**
 * @title BlastableBase
 * @author Blue Matter Technologies
 * @notice An abstract contract that provides access to basic Blast functions.
 *
 * This primarily involves configuring the connection to Blast and quoting the gas rewards.
 */
abstract contract BlastableBase is IBlastableBase {

    /**
     * @notice Constructs the BlastableBase contract.
     * Configures the contract to receive automatic yield and claimable gas.
     */
    constructor() {
        // allow these calls to fail. check status after deployment and call again if necessary
        address b = blast();
        b.call(abi.encodeWithSignature("configureAutomaticYield()"));
        b.call(abi.encodeWithSignature("configureClaimableGas()"));
    }

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Returns the address of the Blast contract.
     * @return blast_ The address of the Blast contract.
     */
    function blast() public view virtual override returns (address blast_) {
        blast_ = 0x4300000000000000000000000000000000000002;
    }

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
    function quoteClaimAllGas() external payable virtual override returns (uint256 quoteAmount) {
        try IBlastableBase(payable(address(this))).quoteClaimAllGasWithRevert() {}
        catch (bytes memory reason) {
            quoteAmount = BlastableLibrary.parseRevertReasonForAmount(reason);
        }
    }

    /**
     * @notice Quotes the amount of gas expected when claiming all gas.
     * This function will revert, including the amount in the error.
     * This _should_ only be called via [`quoteClaimAllGas()`](#quoteclaimallgas).
     */
    function quoteClaimAllGasWithRevert() external payable virtual override {
        uint256 quoteAmount = IBlast(blast()).claimAllGas(address(this), address(this));
        revert Errors.RevertForAmount(quoteAmount);
    }

    /**
     * @notice Quotes the amount of gas expected when claiming max gas.
     * This _should_ be a view function, except that it relies on the state change then reverting it.
     * This _should_ be called with an offchain staticcall.
     * This _should not_ be called onchain.
     * Can be called by anyone.
     * @return quoteAmount The amount of gas that can be claimed.
     */
    function quoteClaimMaxGas() external payable virtual override returns (uint256 quoteAmount) {
        try IBlastableBase(payable(address(this))).quoteClaimMaxGasWithRevert() {}
        catch (bytes memory reason) {
            quoteAmount = BlastableLibrary.parseRevertReasonForAmount(reason);
        }
    }

    /**
     * @notice Quotes the amount of gas expected when claiming max gas.
     * This function will revert, including the amount in the error.
     * This _should_ only be called via [`quoteClaimMaxGas()`](#quoteclaimmaxgas).
     */
    function quoteClaimMaxGasWithRevert() external payable virtual override {
        uint256 quoteAmount = IBlast(blast()).claimMaxGas(address(this), address(this));
        revert Errors.RevertForAmount(quoteAmount);
    }

    /***************************************
    RECEIVE FUNCTIONS
    ***************************************/

    /**
     * @notice Allows this contract to receive the gas token.
     */
    receive() external payable virtual override {}
}
