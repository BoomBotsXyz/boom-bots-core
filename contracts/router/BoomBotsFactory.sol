// SPDX-License-Identifier: none
pragma solidity 0.8.19;

import { Multicall } from "@openzeppelin/contracts/utils/Multicall.sol";
import { Calls } from "./../libraries/Calls.sol";
import { Errors } from "./../libraries/Errors.sol";
import { IBoomBots } from "./../interfaces/tokens/IBoomBots.sol";
import { IBoomBotsFactory } from "./../interfaces/router/IBoomBotsFactory.sol";
import { Ownable2Step } from "./../utils/Ownable2Step.sol";


/**
 * @title BoomBotsFactory
 * @author Blue Matter Tehcnologies
 * @notice A factory for BOOM! Bots.
 *
 * Users can use [`createBot()`](#createbot) to create a new bot. The bot will be created based on settings stored in the factory by the contract owner. These settings can be viewed via [`getBotCreationSettings()`](#getbotcreationsettings).
 */
contract BoomBotsFactory is Multicall, Ownable2Step, IBoomBotsFactory {

    address internal _botNft;
    address internal _botImplementation;
    bytes internal _botInitializationCode1;
    bytes internal _botInitializationCode2;
    bool internal _isPaused;

    /**
     * @notice Constructs the factory contract.
     * @param owner_ The contract owner.
     * @param botNft The BoomBots contract.
     * @param botImplementation The bot implementation.
     * @param botInitializationCode1 The first part of the bot initialization code.
     * @param botInitializationCode2 The second part of the bot initialization code.
     */
    constructor(
        address owner_,
        address botNft,
        address botImplementation,
        bytes memory botInitializationCode1,
        bytes memory botInitializationCode2
    ) {
        _transferOwnership(owner_);
        _botNft = botNft;
        _setBotImplementationAddress(botImplementation);
        _setBotInitializationCode(botInitializationCode1, botInitializationCode2);
    }

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Gets the bot creation settings.
     * @return botNft The BoomBots contract.
     * @return botImplementation The bot implementation.
     * @return botInitializationCode1 The first part of the bot initialization code.
     * @return botInitializationCode2 The second part of the bot initialization code.
     */
    function getBotCreationSettings() external view override returns (
        address botNft,
        address botImplementation,
        bytes memory botInitializationCode1,
        bytes memory botInitializationCode2
    ) {
        botNft = _botNft;
        botImplementation = _botImplementation;
        botInitializationCode1 = _botInitializationCode1;
        botInitializationCode2 = _botInitializationCode2;
    }

    /**
     * @notice Returns true if creation of new bots via this factory is paused.
     * @return isPaused_ True if creation is paused, false otherwise.
     */
    function isPaused() external view override returns (bool isPaused_) {
        return _isPaused;
    }

    /***************************************
    CREATE BOT FUNCTIONS
    ***************************************/

    /**
     * @notice Creates a new bot.
     * The new bot will be transferred to `msg.sender`.
     * @return botID The ID of the newly created bot.
     * @return botAddress The address of the newly created bot.
     */
    function createBot() external payable override returns (uint256 botID, address botAddress) {
        IBoomBots botNft = IBoomBots(_botNft);
        (botID, botAddress) = _createBot(botNft);
        botNft.transferFrom(address(this), msg.sender, botID);
    }

    /**
     * @notice Creates a new bot.
     * The new bot will be transferred to `msg.sender`.
     * @param callData Extra data to pass to the bot after it is created.
     * @return botID The ID of the newly created bot.
     * @return botAddress The address of the newly created bot.
     */
    function createBot(bytes calldata callData) external payable override returns (uint256 botID, address botAddress) {
        IBoomBots botNft = IBoomBots(_botNft);
        (botID, botAddress) = _createBot(botNft);
        _callBot(botAddress, callData);
        botNft.transferFrom(address(this), msg.sender, botID);
    }

    /***************************************
    OWNER FUNCTIONS
    ***************************************/

    /**
     * @notice Sets the bot implementation.
     * Can only be called by the contract owner.
     * @param botImplementation The address of the bot implementation.
     */
    function setBotImplementationAddress(address botImplementation) external payable override onlyOwner {
        _setBotImplementationAddress(botImplementation);
    }

    /**
     * @notice Sets the bot initialization code.
     * Can only be called by the contract owner.
     * @param botInitializationCode1 The first part of the bot initialization code.
     * @param botInitializationCode2 The second part of the bot initialization code.
     */
    function setBotInitializationCode(bytes memory botInitializationCode1, bytes memory botInitializationCode2) external payable override onlyOwner {
        _setBotInitializationCode(botInitializationCode1, botInitializationCode2);
    }

    /**
     * @notice Sets the pause state of the contract.
     * Allows or disallows creation of new bots.
     * Can only be called by the contract owner.
     * @param status True to pause, false to unpause.
     */
    function setPaused(bool status) external payable override onlyOwner {
        _isPaused = status;
        emit PauseSet(status);
    }

    /***************************************
    HELPER FUNCTIONS
    ***************************************/

    /**
     * @notice Creates a new bot.
     * @param botNft The bot nft contract.
     * @return botID The ID of the newly created bot.
     * @return botAddress The address of the newly created bot.
     */
    function _createBot(IBoomBots botNft) internal returns (uint256 botID, address botAddress) {
        if(_isPaused) revert Errors.ContractPaused();
        (botID, botAddress) = botNft.createBot(_botImplementation);
        _callBot(botAddress, _botInitializationCode1);
        _callBot(botAddress, _botInitializationCode2);
    }

    /**
     * @notice Calls a bot.
     * @param botAddress The address of the bot.
     * @param callData The data to pass to the bot.
     */
    function _callBot(address botAddress, bytes memory callData) internal {
        if(callData.length == 0) return;
        Calls.functionCall(botAddress, callData);
    }

    /**
     * @notice Sets the bot implementation.
     * @param botImplementation The address of the bot implementation.
     */
    function _setBotImplementationAddress(address botImplementation) internal {
        uint256 contractSize;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            contractSize := extcodesize(botImplementation)
        }
        if(contractSize == 0) revert Errors.NotAContract();
        _botImplementation = botImplementation;
        emit BotImplementationSet(botImplementation);
    }

    /**
     * @notice Sets the bot initialization code.
     * Can only be called by the contract owner.
     * @param botInitializationCode1 The first part of the bot initialization code.
     * @param botInitializationCode2 The second part of the bot initialization code.
     */
    function _setBotInitializationCode(bytes memory botInitializationCode1, bytes memory botInitializationCode2) internal {
        _botInitializationCode1 = botInitializationCode1;
        _botInitializationCode2 = botInitializationCode2;
        emit BotInitializationCodeSet(botInitializationCode1, botInitializationCode2);
    }
}
