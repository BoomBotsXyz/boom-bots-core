// SPDX-License-Identifier: none
pragma solidity 0.8.19;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IBlast } from "./../interfaces/external/Blast/IBlast.sol";
import { IBlastable } from "./../interfaces/utils/IBlastable.sol";
import { BlastableBase } from "./BlastableBase.sol";
import { Ownable2Step } from "./Ownable2Step.sol";
import { Errors } from "./../libraries/Errors.sol";
import { Calls } from "./../libraries/Calls.sol";
import { BlastableLibrary } from "./../libraries/BlastableLibrary.sol";


/**
 * @title Blastable
 * @author Blue Matter Technologies
 * @notice An abstract contract that provides access to basic Blast functions.
 *
 * This primarily involves collecting ETH yield and gas rewards. These functions are restricted to only the contract owner. Builds on top of BlastableBase and Ownable2Step.
 *
 * This contract also provides [`sweep()`](#sweep) to rescue misplaced tokens.
 *
 * Only inherit this contract if the inheriting contract is a singleton (eg a token contract, router, or factory). Do NOT inherit this contract if you are expecting to `delegatecall` into it - use BlastableTarget instead.
 */
abstract contract Blastable is IBlastable, Ownable2Step, BlastableBase {

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
        for(uint256 i = 0; i < tokens.length; ) {
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
}
