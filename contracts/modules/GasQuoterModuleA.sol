// SPDX-License-Identifier: none
pragma solidity 0.8.19;

import { Errors } from "./../libraries/Errors.sol";
import { IBlast } from "./../interfaces/external/Blast/IBlast.sol";


/**
 * @title GasQuoterModuleA
 * @author Blue Matter Technologies
 * @notice A module that helps quote claimable gas.
 */
contract GasQuoterModuleA {

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
    function quoteClaimAllGas() external payable virtual returns (uint256 quoteAmount) {
        try GasQuoterModuleA(payable(address(this))).quoteClaimAllGasWithRevert() {}
        catch (bytes memory reason) {
            quoteAmount = parseRevertReason(reason);
        }
    }

    /**
     * @notice Quotes the amount of gas expected when claiming all gas.
     * This function will revert, including the amount in the error.
     * This _should_ only be called via [`quoteClaimAllGas()`](#quoteclaimallgas).
     */
    function quoteClaimAllGasWithRevert() external payable virtual {
        uint256 quoteAmount = IBlast(0x4300000000000000000000000000000000000002).claimAllGas(address(this), address(this));
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
    function quoteClaimMaxGas() external payable virtual returns (uint256 quoteAmount) {
        try GasQuoterModuleA(payable(address(this))).quoteClaimMaxGasWithRevert() {}
        catch (bytes memory reason) {
            quoteAmount = parseRevertReason(reason);
        }
    }

    /**
     * @notice Quotes the amount of gas expected when claiming max gas.
     * This function will revert, including the amount in the error.
     * This _should_ only be called via [`quoteClaimMaxGas()`](#quoteclaimmaxgas).
     */
    function quoteClaimMaxGasWithRevert() external payable virtual {
        uint256 quoteAmount = IBlast(0x4300000000000000000000000000000000000002).claimMaxGas(address(this), address(this));
        revert Errors.RevertForAmount(quoteAmount);
    }

    /***************************************
    HELPER FUNCTIONS
    ***************************************/

    /**
     * @notice Parses a revert reason that should contain the numeric quote.
     * @param reason The error to parse.
     * @return amount The returned amount.
     */
    function parseRevertReason(bytes memory reason) internal pure returns (uint256 amount) {
        // revert if reason is not of expected format
        if(reason.length != 36) {
            // look for revert reason and bubble it up if present
            if(reason.length > 0) {
                // the easiest way to bubble the revert reason is using memory via assembly
                // solhint-disable-next-line no-inline-assembly
                assembly {
                    let reason_size := mload(reason)
                    revert(add(32, reason), reason_size)
                }
            } else {
                revert Errors.UnknownError();
            }
        }
        // parse reason, return amount
        // solhint-disable-next-line no-inline-assembly
        assembly {
            reason := add(reason, 0x04)
        }
        amount = abi.decode(reason, (uint256));
    }
}
