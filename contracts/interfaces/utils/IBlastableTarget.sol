// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IBlastableTarget
 * @author Blue Matter Technologies
 * @notice An abstract contract that provides access to basic Blast functions.
 *
 * This primarily involves collecting ETH yield and gas rewards.
 *
 * Only inherit this contract if the inheriting contract is meant to be used in a proxy system. `Blastable` (not target) is a better alternative for most contracts.
 */
interface IBlastableTarget {

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Returns the address of the implementation contract.
     * return impl The implementation contract address.
     */
    function implementation() external view returns (address impl);

    /**
     * @notice Returns the address of the implementation gas collector.
     * return implGasCollector The implementation gas collector.
     */
    function _implGasCollector() external view returns (address implGasCollector);

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
    function _implCallBlast(bytes calldata data) external payable returns (bytes memory result);

    /**
     * @notice Claims max gas from the Blast contract (any maturity, get it now).
     * Can only be called on the implementation contract, not a proxy.
     * Can only be called by the gas collector.
     * @param receiver The receiver of the gas claimed.
     * @return amountClaimed The amount of gas claimed.
     */
    function _implClaimAllGas(address receiver) external payable returns (uint256 amountClaimed);

    /**
     * @notice Claims max gas from the Blast contract (100% maturity, willing to wait).
     * Can only be called on the implementation contract, not a proxy.
     * Can only be called by the gas collector.
     * @param receiver The receiver of the gas claimed.
     * @return amountClaimed The amount of gas claimed.
     */
    function _implClaimMaxGas(address receiver) external payable returns (uint256 amountClaimed);

    /**
     * @notice Rescues tokens that may have been accidentally transferred in.
     * Can only be called on the implementation contract, not a proxy.
     * Can only be called by the gas collector.
     * @dev If the inheriting contract requires tokens in the contract, overwrite this with a revert.
     * @param receiver The receiver of the rescued tokens.
     * @param tokens The tokens to rescue. Can be ETH or ERC20s.
     */
    function _implSweep(address receiver, address[] calldata tokens) external payable;
}
