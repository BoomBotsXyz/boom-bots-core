// SPDX-License-Identifier: none
pragma solidity 0.8.19;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IBlast } from "./../interfaces/external/Blast/IBlast.sol";
import { IBlastable } from "./../interfaces/utils/IBlastable.sol";
import { Ownable2Step } from "./Ownable2Step.sol";
import { Errors } from "./../libraries/Errors.sol";
import { Calls } from "./../libraries/Calls.sol";


/**
 * @title Blastable
 * @author Blue Matter Technologies
 * @notice An abstract contract that provides access to basic Blast functions.
 *
 * This primarily involves collecting ETH yield and gas rewards. These functions are restricted to only the contract owner.
 *
 * This contract also provides [`sweep()`](#sweep) to rescue misplaced tokens.
 */
abstract contract Blastable is Ownable2Step, IBlastable {

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
    MUTATOR FUNCTIONS
    ***************************************/

    /**
     * @notice Calls the Blast contract with arbitrary data.
     * Can only be called by the contract owner.
     * @param data The data to pass to the Blast contract.
     * @return result The result of the call.
     */
    function callBlast(bytes calldata data) external payable virtual override onlyOwner returns (bytes memory result) {
        result = Calls.functionCall(blast(), data);
    }

    /**
     * @notice Claims max gas from the Blast contract (100% maturity, willing to wait).
     * Can only be called by the contract owner.
     * @param receiver The receiver of the gas claimed.
     * @return amountClaimed The amount of gas claimed.
     */
    function claimMaxGas(address receiver) external payable virtual override onlyOwner returns (uint256 amountClaimed) {
        amountClaimed = IBlast(blast()).claimMaxGas(address(this), receiver);
    }

    /**
     * @notice Claims max gas from the Blast contract (any maturity, get it now).
     * Can only be called by the contract owner.
     * @param receiver The receiver of the gas claimed.
     * @return amountClaimed The amount of gas claimed.
     */
    function claimAllGas(address receiver) external payable virtual override onlyOwner returns (uint256 amountClaimed) {
        amountClaimed = IBlast(blast()).claimAllGas(address(this), receiver);
    }

    /***************************************
    TOKEN BALANCE FUNCTIONS
    ***************************************/

    /**
     * @notice Rescues tokens that may have been accidentally transferred in.
     * Can only be called by the contract owner.
     * @dev If the inheriting contract requires tokens in the contract, overwrite this with a revert.
     * @param receiver The receiver of the rescued tokens.
     * @param tokens The tokens to rescue. Can be ETH or ERC20s.
     */
    function sweep(address receiver, address[] calldata tokens) external payable virtual override onlyOwner {
        for(uint256 i; i < tokens.length; ) {
            address token = tokens[i];
            if(token == address(0)) {
                Calls.sendValue(payable(receiver), address(this).balance);
            } else {
                IERC20 tkn = IERC20(token);
                SafeERC20.safeTransfer(tkn, receiver, tkn.balanceOf(address(this)));
            }
            unchecked { ++i; }
        }
    }

    /**
     * @notice Allows this contract to receive the gas token.
     */
    receive() external payable virtual override {}

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
        try Blastable(payable(address(this))).quoteClaimAllGasWithRevert() {}
        catch (bytes memory reason) {
            quoteAmount = parseRevertReason(reason);
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
        try Blastable(payable(address(this))).quoteClaimMaxGasWithRevert() {}
        catch (bytes memory reason) {
            quoteAmount = parseRevertReason(reason);
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
