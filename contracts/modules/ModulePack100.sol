// SPDX-License-Identifier: none
pragma solidity 0.8.19;

import { ERC2535Module } from "./ERC2535Module.sol";
import { ERC6551AccountModule } from "./ERC6551AccountModule.sol";
import { MulticallModule } from "./MulticallModule.sol";
import { ReentrancyGuardModule } from "./ReentrancyGuardModule.sol";
import { DataStoreModule } from "./DataStoreModule.sol";
import { ERC165Module } from "./ERC165Module.sol";
import { ERC721ReceiverModule } from "./ERC721ReceiverModule.sol";
import { ERC1155ReceiverModule } from "./ERC1155ReceiverModule.sol";
import { InscriptionModule } from "./InscriptionModule.sol";


/**
 * @title ModulePack100
 * @author Blue Matter Technologies
 * @notice
 */
// solhint-disable-next-line no-empty-blocks
contract ModulePack100 is
  ERC2535Module,
  ERC6551AccountModule,
  MulticallModule,
  ReentrancyGuardModule,
  DataStoreModule,
  ERC165Module,
  ERC721ReceiverModule,
  ERC1155ReceiverModule,
  InscriptionModule
  {}
