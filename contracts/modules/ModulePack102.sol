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
import { ERC6551AccountLibrary } from "./../libraries/modules/ERC6551AccountLibrary.sol";
import { IBlast } from "./../interfaces/external/Blast/IBlast.sol";
import { Errors } from "./../libraries/Errors.sol";
import { BlastableLibrary } from "./../libraries/BlastableLibrary.sol";
import { IModulePack102 } from "./../interfaces/modules/IModulePack102.sol";


/**
 * @title ModulePack102
 * @author Blue Matter Technologies
 * @notice
 */
contract ModulePack102 is
    ERC2535Module,
    ERC6551AccountModule,
    MulticallModule,
    ReentrancyGuardModule,
    DataStoreModule,
    ERC165Module,
    ERC721ReceiverModule,
    ERC1155ReceiverModule,
    InscriptionModule,
    Blastable,
    IModulePack102
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
    CLAIM FUNCTIONS
    ***************************************/

    /**
     * @notice Claims all gas from the blast gas reward contract.
     * Can only be called by the TBA owner.
     * @return amountClaimed The amount of gas claimed.
     */
    function claimAllGas() external payable override returns (uint256 amountClaimed) {
        ERC6551AccountLibrary.validateSender();
        amountClaimed = IBlast(blast()).claimAllGas(address(this), address(this));
    }

    /**
     * @notice Claims max gas from the blast gas reward contract.
     * Can only be called by the TBA owner.
     * @return amountClaimed The amount of gas claimed.
     */
    function claimMaxGas() external payable override returns (uint256 amountClaimed) {
        ERC6551AccountLibrary.validateSender();
        amountClaimed = IBlast(blast()).claimMaxGas(address(this), address(this));
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
    function quoteClaimAllGas() external payable override virtual returns (uint256 quoteAmount) {
        try ModulePack102(payable(address(this))).quoteClaimAllGasWithRevert() {}
        catch (bytes memory reason) {
            quoteAmount = BlastableLibrary.parseRevertReasonForAmount(reason);
        }
    }

    /**
     * @notice Quotes the amount of gas expected when claiming all gas.
     * This function will revert, including the amount in the error.
     * This _should_ only be called via [`quoteClaimAllGas()`](#quoteclaimallgas).
     */
    function quoteClaimAllGasWithRevert() external payable override virtual {
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
    function quoteClaimMaxGas() external payable override virtual returns (uint256 quoteAmount) {
        try ModulePack102(payable(address(this))).quoteClaimMaxGasWithRevert() {}
        catch (bytes memory reason) {
            quoteAmount = BlastableLibrary.parseRevertReasonForAmount(reason);
        }
    }

    /**
     * @notice Quotes the amount of gas expected when claiming max gas.
     * This function will revert, including the amount in the error.
     * This _should_ only be called via [`quoteClaimMaxGas()`](#quoteclaimmaxgas).
     */
    function quoteClaimMaxGasWithRevert() external payable override virtual {
        uint256 quoteAmount = IBlast(blast()).claimMaxGas(address(this), address(this));
        revert Errors.RevertForAmount(quoteAmount);
    }

    /***************************************
    RECEIVE FUNCTIONS
    ***************************************/

    /**
     * @notice Allows this contract to receive the gas token.
     */
    receive() external payable virtual override (InscriptionModule, Blastable) {}
}
