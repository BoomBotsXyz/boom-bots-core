// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Multicall } from "./../utils/Multicall.sol";
import { Calls } from "./../libraries/Calls.sol";
import { Errors } from "./../libraries/Errors.sol";
import { IBoomBots } from "./../interfaces/tokens/IBoomBots.sol";
import { IBoomBotsFactory02 } from "./../interfaces/router/IBoomBotsFactory02.sol";
import { Blastable } from "./../utils/Blastable.sol";
import { Ownable2Step } from "./../utils/Ownable2Step.sol";


/**
 * @title BoomBotsFactory02
 * @author Blue Matter Technologies
 * @notice A factory for BOOM! Bots.
 *
 * Users can use [`createBot()`](#createbot) to create a new bot. The bot will be created based on settings stored in the factory by the contract owner. These settings can be viewed via [`getBotCreationSettings()`](#getbotcreationsettings).
 */
contract BoomBotsFactory02 is Multicall, Blastable, Ownable2Step, IBoomBotsFactory02 {

    /***************************************
    STATE VARIABLES
    ***************************************/

    address internal _botNft;

    mapping(uint256 => BotCreationSettings) internal _botCreationSettings;

    uint256 internal _botCreationSettingsCount;
    
    /**
     * @notice Constructs the factory contract.
     * @param owner_ The owner of the contract.
     * @param blast_ The address of the blast gas reward contract.
     * @param governor_ The address of the gas governor.
     * @param botNft The BoomBots contract.
     */
    constructor(
        address owner_,
        address blast_,
        address governor_,
        address botNft
    ) Blastable(blast_, governor_) {
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
     * @return giveTokenList The list of tokens to give to newly created bots.
     * @return giveTokenAmounts The amount of each token to give.
     */
    function getBotCreationSettings(uint256 creationSettingsID) external view override returns (
        address botNft,
        address botImplementation,
        bytes[] memory initializationCalls,
        bool isPaused,
        address[] memory giveTokenList,
        uint256[] memory giveTokenAmounts
    ) {
        if(creationSettingsID == 0 || creationSettingsID > _botCreationSettingsCount) revert Errors.OutOfRange();
        botNft = _botNft;
        BotCreationSettings memory creationSettings = _botCreationSettings[creationSettingsID];
        botImplementation = creationSettings.botImplementation;
        initializationCalls = creationSettings.initializationCalls;
        isPaused = creationSettings.isPaused;
        giveTokenList = creationSettings.giveTokenList;
        giveTokenAmounts = creationSettings.giveTokenAmounts;
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
        if(creationSettings.giveTokenList.length != creationSettings.giveTokenAmounts.length) revert Errors.LengthMismatch();
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
        // give tokens
        uint256 len = creationSettings.giveTokenList.length;
        for(uint256 i = 0; i < len; ++i) {
            _sendToken(creationSettings.giveTokenList[i], creationSettings.giveTokenAmounts[i], botAddress);
        }
    }

    /**
     * @notice Calls a bot.
     * @param botAddress The address of the bot.
     * @param callData The data to pass to the bot.
     */
    function _callBot(address botAddress, bytes memory callData) internal {
        Calls.functionCall(botAddress, callData);
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
     * @notice Sends some token. Supports the gas token and erc20s.
     * @param token The address of token to send.
     * @param amount The maximum amount to send. Will send less if insufficient funds.
     * @param receiver The receiver of the funds.
     */
    function _sendToken(address token, uint256 amount, address receiver) internal {
        // send eth
        if(token == address(0)) {
            uint256 bal = address(this).balance;
            bal = _min(bal, amount);
            if(bal > 0) Calls.sendValue(receiver, bal);
        }
        // send erc20
        else {
            uint256 bal = IERC20(token).balanceOf(address(this));
            bal = _min(bal, amount);
            if(bal > 0) SafeERC20.safeTransfer(IERC20(token), receiver, bal);
        }
    }

    /**
     * @notice Returns the minimum of two numbers.
     * @param a The first number.
     * @param b The second number.
     * @return c The minimum.
     */
    function _min(uint256 a, uint256 b) internal pure returns (uint256 c) {
        c = (a < b ? a : b);
    }
}
