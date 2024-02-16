// SPDX-License-Identifier: none
pragma solidity 0.8.19;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IBlast } from "./../interfaces/external/Blast/IBlast.sol";
import { IBlastableTarget } from "./../interfaces/utils/IBlastableTarget.sol";
import { BlastableBase } from "./BlastableBase.sol";
import { Errors } from "./../libraries/Errors.sol";
import { Calls } from "./../libraries/Calls.sol";


/**
 * @title BlastableTarget
 * @author Blue Matter Technologies
 * @notice An abstract contract that provides access to basic Blast functions.
 *
 * This primarily involves collecting ETH yield and gas rewards.
 *
 * Only inherit this contract if the inheriting contract is meant to be used in a proxy system. `Blastable` (not target) is a better alternative for most contracts.
 */
abstract contract BlastableTarget is IBlastableTarget, BlastableBase {

    /***************************************
    IMMUTABLE VARIABLES
    ***************************************/

    // the original address of this contract aka the implementation
    address private immutable __impl;
    // the gas collector
    address private immutable __implGasCollector;

    /**
     * @notice Constructs the BlastableTarget contract.
     * @param implGasCollector The implementation gas collector.
     */
    constructor(address implGasCollector) {
        __impl = address(this);
        __implGasCollector = implGasCollector;
    }

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Returns the address of the implementation contract.
     * return impl The implementation contract address.
     */
    function implementation() external view override returns (address impl) {
        impl = __impl;
    }

    /**
     * @notice Returns the address of the implementation gas collector.
     * return implGasCollector The implementation gas collector.
     */
    function _implGasCollector() external view override returns (address implGasCollector) {
        implGasCollector = __implGasCollector;
    }

    /***************************************
    MUTATOR FUNCTIONS
    ***************************************/

    /**
     * @notice Calls the Blast contract with arbitrary data.
     * Can only be called on the implementation contract, not a proxy.
     * Can only be called by the gas collector.
     * @param data The data to pass to the Blast contract.
     * @return result The result of the call.
     */
    function _implCallBlast(bytes calldata data) external payable override noDelegateCall onlyGasCollector returns (bytes memory result) {
        result = Calls.functionCall(blast(), data);
    }

    /**
     * @notice Claims max gas from the Blast contract (any maturity, get it now).
     * Can only be called on the implementation contract, not a proxy.
     * Can only be called by the gas collector.
     * @param receiver The receiver of the gas claimed.
     * @return amountClaimed The amount of gas claimed.
     */
    function _implClaimAllGas(address receiver) external payable override noDelegateCall onlyGasCollector returns (uint256 amountClaimed) {
        amountClaimed = IBlast(blast()).claimAllGas(address(this), receiver);
    }

    /**
     * @notice Claims max gas from the Blast contract (100% maturity, willing to wait).
     * Can only be called on the implementation contract, not a proxy.
     * Can only be called by the gas collector.
     * @param receiver The receiver of the gas claimed.
     * @return amountClaimed The amount of gas claimed.
     */
    function _implClaimMaxGas(address receiver) external payable override noDelegateCall onlyGasCollector returns (uint256 amountClaimed) {
        amountClaimed = IBlast(blast()).claimMaxGas(address(this), receiver);
    }

    /**
     * @notice Rescues tokens that may have been accidentally transferred in.
     * Can only be called on the implementation contract, not a proxy.
     * Can only be called by the gas collector.
     * @dev If the inheriting contract requires tokens in the contract, overwrite this with a revert.
     * @param receiver The receiver of the rescued tokens.
     * @param tokens The tokens to rescue. Can be ETH or ERC20s.
     */
    function _implSweep(address receiver, address[] calldata tokens) external payable override noDelegateCall onlyGasCollector {
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

    /***************************************
    MODIFIERS
    ***************************************/

    /// @dev Private method is used instead of inlining into modifier because modifiers are copied into each method,
    ///     and the use of immutable means the address bytes are copied in every place the modifier is used.
    function checkNotDelegateCall() private view {
        if(address(this) != __impl) revert Errors.NoDelegateCall();
    }

    /// @notice Prevents delegatecall into the modified method
    modifier noDelegateCall() {
        checkNotDelegateCall();
        _;
    }

    /// @notice Access control
    modifier onlyGasCollector() {
        if(msg.sender != __implGasCollector) revert Errors.NotGasCollector();
        _;
    }
}
