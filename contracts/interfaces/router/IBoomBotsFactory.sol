// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IBoomBotsFactory
 * @author Blue Matter Technologies
 * @notice A factory for BOOM! Bots.
 *
 * Users can use [`createBot()`](#createbot) to create a new bot. The bot will be created based on settings stored in the factory by the contract owner. These settings can be viewed via [`getBotCreationSettings()`](#getbotcreationsettings).
 */
interface IBoomBotsFactory {

    /***************************************
    EVENTS
    ***************************************/

    /// @notice Emitted when a new BotCreationSettings is posted.
    event BotCreationSettingsPosted(uint256 indexed creationSettingsID);
    /// @notice Emitted when a new BotCreationSettings is paused or unpaused.
    event BotCreationSettingsPaused(uint256 indexed creationSettingsID, bool isPaused);

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    struct BotCreationSettings {
      address botImplementation;
      bytes[] initializationCalls;
      bool isPaused;
    }

    /**
     * @notice Gets the number of bot creation settings.
     * @return count The count.
     */
    function getBotCreationSettingsCount() external view returns (uint256 count);

    /**
     * @notice Gets the bot creation settings.
     * @return botNft The BoomBots contract.
     * @return botImplementation The bot implementation.
     * @return initializationCalls The calls to initialize the bot.
     * @return isPaused True if these creation settings are paused, false otherwise.
     */
    function getBotCreationSettings(uint256 creationSettingsID) external view returns (
        address botNft,
        address botImplementation,
        bytes[] memory initializationCalls,
        bool isPaused
    );

    /***************************************
    CREATE BOT FUNCTIONS
    ***************************************/

    /**
     * @notice Creates a new bot.
     * The new bot will be transferred to `msg.sender`.
     * @return botID The ID of the newly created bot.
     * @return botAddress The address of the newly created bot.
     */
    function createBot(uint256 creationSettingsID) external payable returns (uint256 botID, address botAddress);

    /**
     * @notice Creates a new bot.
     * The new bot will be transferred to `msg.sender`.
     * @param callDatas Extra data to pass to the bot after it is created.
     * @return botID The ID of the newly created bot.
     * @return botAddress The address of the newly created bot.
     */
    function createBot(uint256 creationSettingsID, bytes[] calldata callDatas) external payable returns (uint256 botID, address botAddress);

    /**
     * @notice Creates a new bot.
     * @param receiver The address to mint the new bot to.
     * @return botID The ID of the newly created bot.
     * @return botAddress The address of the newly created bot.
     */
    function createBot(uint256 creationSettingsID, address receiver) external payable returns (uint256 botID, address botAddress);

    /**
     * @notice Creates a new bot.
     * @param receiver The address to mint the new bot to.
     * @param callDatas Extra data to pass to the bot after it is created.
     * @return botID The ID of the newly created bot.
     * @return botAddress The address of the newly created bot.
     */
    function createBot(uint256 creationSettingsID, bytes[] calldata callDatas, address receiver) external payable returns (uint256 botID, address botAddress);

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
    ) external payable returns (
        uint256 creationSettingsID
    );

    /**
     * @notice Sets the pause state of the contract.
     * Allows or disallows creation of new bots.
     * Can only be called by the contract owner.
     * @param status True to pause, false to unpause.
     */
    function setPaused(uint256 creationSettingsID, bool status) external payable;
}
