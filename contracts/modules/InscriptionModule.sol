// SPDX-License-Identifier: none
pragma solidity 0.8.19;

import { IInscriptionModule } from "./../interfaces/modules/IInscriptionModule.sol";


/**
 * @title InscriptionModule
 * @author Blue Matter Technologies
 * @notice A module that allows messages to be inscribed onto a bot.
 *
 * Inscriptions are messages that are stored onchain but not executed onchain. To inscribe a message is to write it in transaction data. The message can be retrieved and validated any time after it is written.
 *
 * Bitcoin inscriptions and ethscriptions do not invoke smart contract logic. BOOM! inscriptions are written onto bots, which are smart contracts, so smart contract logic must be executed, even if just to return.
 *
 * To inscribe a message, you must send a transaction directly from an EOA to the bot. Do not use multicall. Do not use an intermediate contract. Hex encode the message and append it to the sighash `0xde52f07d` (`inscribe()`). Install this module on your bot at the same sighash.
 */
contract InscriptionModule is IInscriptionModule {

    /**
     * @notice Inscribe a message onto this bot.
     * The message is in the calldata.
     */
    fallback () external payable override {}

    /**
     * @notice Allows this contract to receive the gas token.
     */
    receive () external payable override {}
}
