// SPDX-License-Identifier: none
pragma solidity 0.8.19;


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

    /// @notice Emitted when the bot implementation is set.
    event BotImplementationSet(address indexed botImplementation);
    /// @notice Emitted when the bot initialization code is set.
    event BotInitializationCodeSet(bytes botInitializationCode1, bytes botInitializationCode2);
    /// @notice Emitted when the pause state is set.
    event PauseSet(bool status);

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
    function getBotCreationSettings() external view returns (
        address botNft,
        address botImplementation,
        bytes memory botInitializationCode1,
        bytes memory botInitializationCode2
    );

    /**
     * @notice Returns true if creation of new bots via this factory is paused.
     * @return isPaused_ True if creation is paused, false otherwise.
     */
    function isPaused() external view returns (bool isPaused_);

    /***************************************
    CREATE BOT FUNCTIONS
    ***************************************/

    /**
     * @notice Creates a new bot.
     * The new bot will be transferred to `msg.sender`.
     * @return botID The ID of the newly created bot.
     * @return botAddress The address of the newly created bot.
     */
    function createBot() external payable returns (uint256 botID, address botAddress);

    /**
     * @notice Creates a new bot.
     * The new bot will be transferred to `msg.sender`.
     * @param callData Extra data to pass to the bot after it is created.
     * @return botID The ID of the newly created bot.
     * @return botAddress The address of the newly created bot.
     */
    function createBot(bytes calldata callData) external payable returns (uint256 botID, address botAddress);

    /***************************************
    OWNER FUNCTIONS
    ***************************************/

    /**
     * @notice Sets the bot implementation.
     * Can only be called by the contract owner.
     * @param botImplementation The address of the bot implementation.
     */
    function setBotImplementationAddress(address botImplementation) external payable;

    /**
     * @notice Sets the bot initialization code.
     * Can only be called by the contract owner.
     * @param botInitializationCode1 The first part of the bot initialization code.
     * @param botInitializationCode2 The second part of the bot initialization code.
     */
    function setBotInitializationCode(bytes memory botInitializationCode1, bytes memory botInitializationCode2) external payable;

    /**
     * @notice Sets the pause state of the contract.
     * Allows or disallows creation of new bots.
     * Can only be called by the contract owner.
     * @param status True to pause, false to unpause.
     */
    function setPaused(bool status) external payable;
}
