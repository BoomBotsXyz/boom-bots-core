// SPDX-License-Identifier: none
pragma solidity 0.8.19;

import { MockGasBurner } from "./MockGasBurner.sol";


/**
 * @title MockGasBurner2
 * @notice An account that burns gas and performs gas math. Only used to help calculate Blast gas rewards.
*/
contract MockGasBurner2 is MockGasBurner {

    address internal _blast;

    /**
     * @notice Constructs the MockGasBurner2 contract.
     * @param _owner The owner of the contract.
     */
    constructor(address _owner) MockGasBurner(_owner) {}

    function setBlast(address newBlast) external {
        _blast = newBlast;
    }

    /**
     * @notice Returns the address of the Blast contract.
     * @return blast_ The address of the Blast contract.
     */
    function blast() public view virtual override returns (address blast_) {
        blast_ = _blast;
    }
}
