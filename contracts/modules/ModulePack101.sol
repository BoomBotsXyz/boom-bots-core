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
import { Blastable } from "./../utils/Blastable.sol";


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
    Blastable
{

    /**
     * @notice Constructs the ModulePack101 contract.
     * @param blast_ The address of the blast gas reward contract.
     * @param governor_ The address of the gas governor.
     */
    constructor(
        address blast_,
        address governor_
    ) Blastable(blast_, governor_) {}

    /***************************************
    RECEIVE FUNCTIONS
    ***************************************/

    /**
     * @notice Allows this contract to receive the gas token.
     */
    receive() external payable virtual override (InscriptionModule, Blastable) {}
}
