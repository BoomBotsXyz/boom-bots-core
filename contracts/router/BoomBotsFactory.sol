// SPDX-License-Identifier: none
pragma solidity 0.8.19;

import { Multicall } from "./../utils/Multicall.sol";
import { Calls } from "./../libraries/Calls.sol";
import { Errors } from "./../libraries/Errors.sol";
import { IBoomBots } from "./../interfaces/tokens/IBoomBots.sol";
import { IBoomBotsFactory } from "./../interfaces/router/IBoomBotsFactory.sol";
import { Blastable } from "./../utils/Blastable.sol";


/**
 * @title BoomBotsFactory
 * @author Blue Matter Technologies
 * @notice A factory for BOOM! Bots.
 *
 * Users can use [`createBot()`](#createbot) to create a new bot. The bot will be created based on settings stored in the factory by the contract owner. These settings can be viewed via [`getBotCreationSettings()`](#getbotcreationsettings).
 */
contract BoomBotsFactory is Multicall, Blastable, IBoomBotsFactory {

    /***************************************
    STATE VARIABLES
    ***************************************/

    address internal _botNft;

    mapping(uint256 => BotCreationSettings) internal _botCreationSettings;

    uint256 internal _botCreationSettingsCount;

    /**
     * @notice Constructs the factory contract.
     * @param owner_ The contract owner.
     * @param botNft The BoomBots contract.
     */
    constructor(
        address owner_,
        address botNft
    ) {
        _transferOwnership(owner_);
        _botNft = botNft;
    }

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Gets the number of bot creation settings.
     * @return count The count.
     */
    function getBotCreationSettingsCount() external view override returns (uint256 count) {
        return _botCreationSettingsCount;
    }

    /**
     * @notice Gets the bot creation settings.
     * @return botNft The BoomBots contract.
     * @return botImplementation The bot implementation.
     * @return initializationCalls The calls to initialize the bot.
     * @return isPaused True if these creation settings are paused, false otherwise.
     */
    function getBotCreationSettings(uint256 creationSettingsID) external view override returns (
        address botNft,
        address botImplementation,
        bytes[] memory initializationCalls,
        bool isPaused
    ) {
        if(creationSettingsID == 0 || creationSettingsID > _botCreationSettingsCount) revert Errors.OutOfRange();
        botNft = _botNft;
        BotCreationSettings memory creationSettings = _botCreationSettings[creationSettingsID];
        botImplementation = creationSettings.botImplementation;
        initializationCalls = creationSettings.initializationCalls;
        isPaused = creationSettings.isPaused;
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
    function createBot(uint256 creationSettingsID) external payable override returns (uint256 botID, address botAddress) {
        IBoomBots botNft = IBoomBots(_botNft);
        (botID, botAddress) = _createBot(botNft, creationSettingsID);
        _optionalSendToBot(botAddress);
        botNft.transferFrom(address(this), msg.sender, botID);
    }

    /**
     * @notice Creates a new bot.
     * The new bot will be transferred to `msg.sender`.
     * @param callDatas Extra data to pass to the bot after it is created.
     * @return botID The ID of the newly created bot.
     * @return botAddress The address of the newly created bot.
     */
    function createBot(uint256 creationSettingsID, bytes[] calldata callDatas) external payable override returns (uint256 botID, address botAddress) {
        IBoomBots botNft = IBoomBots(_botNft);
        (botID, botAddress) = _createBot(botNft, creationSettingsID);
        _multicallBot(botAddress, callDatas);
        _optionalSendToBot(botAddress);
        botNft.transferFrom(address(this), msg.sender, botID);
    }

    /**
     * @notice Creates a new bot.
     * @param receiver The address to mint the new bot to.
     * @return botID The ID of the newly created bot.
     * @return botAddress The address of the newly created bot.
     */
    function createBot(uint256 creationSettingsID, address receiver) external payable override returns (uint256 botID, address botAddress) {
        IBoomBots botNft = IBoomBots(_botNft);
        (botID, botAddress) = _createBot(botNft, creationSettingsID);
        _optionalSendToBot(botAddress);
        botNft.transferFrom(address(this), receiver, botID);
    }

    /**
     * @notice Creates a new bot.
     * @param receiver The address to mint the new bot to.
     * @param callDatas Extra data to pass to the bot after it is created.
     * @return botID The ID of the newly created bot.
     * @return botAddress The address of the newly created bot.
     */
    function createBot(uint256 creationSettingsID, bytes[] calldata callDatas, address receiver) external payable override returns (uint256 botID, address botAddress) {
        IBoomBots botNft = IBoomBots(_botNft);
        (botID, botAddress) = _createBot(botNft, creationSettingsID);
        _multicallBot(botAddress, callDatas);
        _optionalSendToBot(botAddress);
        botNft.transferFrom(address(this), receiver, botID);
    }

    /***************************************
    OWNER FUNCTIONS
    ***************************************/

    /**
     * @notice Posts a new BotCreationSettings.
     * Can only be called by the contract owner.
     * @param creationSettings The new creation settings to post.
     */
    function postBotCreationSettings(
        BotCreationSettings calldata creationSettings
    ) external payable override onlyOwner returns (
        uint256 creationSettingsID
    ) {
        // checks
        Calls.verifyHasCode(creationSettings.botImplementation);
        // post
        creationSettingsID = ++_botCreationSettingsCount;
        _botCreationSettings[creationSettingsID] = creationSettings;
        emit BotCreationSettingsPosted(creationSettingsID);
        emit BotCreationSettingsPaused(creationSettingsID, creationSettings.isPaused);
    }

    /**
     * @notice Sets the pause state of the contract.
     * Allows or disallows creation of new bots.
     * Can only be called by the contract owner.
     * @param status True to pause, false to unpause.
     */
    function setPaused(uint256 creationSettingsID, bool status) external payable override onlyOwner {
        // checks
        if(creationSettingsID == 0 || creationSettingsID > _botCreationSettingsCount) revert Errors.OutOfRange();
        // set
        _botCreationSettings[creationSettingsID].isPaused = status;
        emit BotCreationSettingsPaused(creationSettingsID, status);
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
    function _createBot(
        IBoomBots botNft,
        uint256 creationSettingsID
    ) internal returns (uint256 botID, address botAddress) {
        // checks
        if(creationSettingsID == 0 || creationSettingsID > _botCreationSettingsCount) revert Errors.OutOfRange();
        BotCreationSettings memory creationSettings = _botCreationSettings[creationSettingsID];
        if(creationSettings.isPaused) revert Errors.CreationSettingsPaused();
        // create bot
        (botID, botAddress) = botNft.createBot(creationSettings.botImplementation);
        // initialize
        for(uint256 i = 0; i < creationSettings.initializationCalls.length; ++i) {
            _callBot(botAddress, creationSettings.initializationCalls[i]);
        }
    }

    /**
     * @notice Calls a bot.
     * @param botAddress The address of the bot.
     * @param callData The data to pass to the bot.
     */
    function _callBot(address botAddress, bytes memory callData) internal {
        uint256 balance = address(this).balance;
        Calls.functionCallWithValue(botAddress, callData, balance);
    }

    /**
     * @notice Calls a bot multiple times.
     * @param botAddress The address of the bot.
     * @param callDatas The data to pass to the bot.
     */
    function _multicallBot(address botAddress, bytes[] calldata callDatas) internal {
        for(uint256 i = 0; i < callDatas.length; ++i) {
            _callBot(botAddress, callDatas[i]);
        }
    }

    /**
     * @notice Sends any contract balance to the bot.
     * @param botAddress The address of the bot.
     */
    function _optionalSendToBot(address botAddress) internal {
        uint256 balance = address(this).balance;
        if(balance > 0) {
            Calls.sendValue(botAddress, balance);
        }
    }
}
