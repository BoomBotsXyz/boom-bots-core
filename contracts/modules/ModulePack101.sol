// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { ERC2535Module } from "./ERC2535Module.sol";
import { ERC6551AccountModule } from "./ERC6551AccountModule.sol";
import { MulticallModule } from "./MulticallModule.sol";
import { ReentrancyGuardModule } from "./ReentrancyGuardModule.sol";
import { DataStoreModule } from "./DataStoreModule.sol";
import { ERC165Module } from "./ERC165Module.sol";
import { ERC721ReceiverModule } from "./ERC721ReceiverModule.sol";
import { ERC1155ReceiverModule } from "./ERC1155ReceiverModule.sol";
import { InscriptionModule } from "./InscriptionModule.sol";
import { BlastableTarget } from "./../utils/BlastableTarget.sol";
import { BlastableBase } from "./../utils/BlastableBase.sol";


/**
 * @title ModulePack101
 * @author Blue Matter Technologies
 * @notice
 */
// solhint-disable-next-line no-empty-blocks
contract ModulePack101 is
    ERC2535Module,
    ERC6551AccountModule,
    MulticallModule,
    ReentrancyGuardModule,
    DataStoreModule,
    ERC165Module,
    ERC721ReceiverModule,
    ERC1155ReceiverModule,
    InscriptionModule,
    BlastableTarget
{
    constructor(address implGasCollector) BlastableTarget(implGasCollector) {}

    /***************************************
    RECEIVE FUNCTIONS
    ***************************************/

    /**
     * @notice Allows this contract to receive the gas token.
     */
    receive() external payable virtual override (InscriptionModule, BlastableBase) {}
}
