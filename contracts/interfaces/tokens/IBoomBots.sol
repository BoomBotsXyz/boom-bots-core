// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { IERC721Enumerable } from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";


/**
 * @title IBoomBots
 * @author Blue Matter Technologies
 * @notice The BoomBots ERC721 token contract. Creates new bots and manages ownership of bots in the Boom Bots protocol.
 *
 * Each bot is represented as an NFT. The owner of the NFT is the owner of the bot. Transferring the NFT means transferring the bot and its contents.
 *
 * Each bot is also a smart contract account. The account is created at the same time the bot is created. Ownership of the account is delegated to the owner of the NFT using ERC6551 Token Bound Accounts.
 *
 * Bots can be created via [`createBot()`](#createbot). Only whitelisted accounts may create bots - these may be any address, but are designed to be smart contracts called factories. This ERC721 contract manages the creation and registration of bots. The factory contract handles any additional logic - verifying implementation, initializing the bot, etc. A user that wants to create a bot should call a factory contract, which in turn calls this contract.
 *
 * The list of factories can be queried via [`factoryIsWhitelisted()`](#factoryiswhitelisted) and maintained by the contract owner via [`setWhitelist()`](#setwhitelist).
 *
 * BoomBots are ERC721s with the enumerable extension. Additional information about each bot can be queried via [`getBotInfo()`](#getbotinfo) and [`exists()`](#exists).
 */
interface IBoomBots is IERC721Enumerable {

    /// @notice Emitted when a factory is whitelisted or blacklisted.
    event FactoryWhitelisted(address indexed factory, bool wasWhitelisted);
    /// @notice Emitted when the base URI is set.
    event BaseURISet(string baseURI);
    /// @notice Emitted when the contract URI is set.
    event ContractURISet(string contractURI);

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Returns the address of a bot.
     * Reverts if the bot does not exist.
     * @param botID The ID of the bot to query.
     * @return botAddress The address of the bot account.
     * @return implementationAddress The address of the bot implementation.
     */
    function getBotInfo(uint256 botID) external view returns (
        address botAddress,
        address implementationAddress
    );

    /**
     * @notice Returns the ID of a bot given its address.
     * Returns ID 0 if the address is not a bot.
     * @param botAddress The address of the bot to query.
     * @return botID The ID of the bot.
     */
    function getBotID(address botAddress) external view returns (uint256 botID);

    /**
     * @notice Given the address of the bot, returns if it is a known bot.
     * @param botAddress The address of the bot to query.
     * @return isBot True if is a known bot, false otherwise.
     */
    function isAddressBot(address botAddress) external view returns (bool isBot);

    /**
     * @notice Returns true if the bot exists.
     * @param botID The ID of the bot to query.
     * @return status True if the bot exists, false otherwise.
     */
    function exists(uint256 botID) external view returns (bool status);

    /**
     * @notice Returns the address of the ERC6551 registry.
     * @return registry_ The address of the registry.
     */
    function getERC6551Registry() external view returns (address registry_);

    /***************************************
    CREATE BOT FUNCTIONS
    ***************************************/

    /**
     * @notice Creates a new bot.
     * @dev The new bot will be minted to `msg.sender`. This function is designed to be called from another contract to perform additional setup.
     * @param implementation The address of the implementation to use in the new bot.
     * @return botID The ID of the newly created bot.
     * @return botAddress The address of the newly created bot.
     */
    function createBot(
        address implementation
    ) external payable returns (
        uint256 botID,
        address botAddress
    );

    /***************************************
    WHITELIST FUNCTIONS
    ***************************************/

    /**
     * @notice Returns true if the factory has been whitelisted.
     * All addresses are whitelisted if address zero is whitelisted.
     * @param factory The address of the factory to query.
     * @return isWhitelisted True if the factory has been whitelisted, false otherwise.
     */
    function factoryIsWhitelisted(address factory) external view returns (bool isWhitelisted);

    struct SetWhitelistParam {
        address factory;
        bool shouldWhitelist;
    }

    /**
     * @notice Adds or removes factories to the whitelist.
     * Can only be called by the contract owner.
     * @param params The list of factories and if they should be whitelisted or blacklisted.
     */
    function setWhitelist(SetWhitelistParam[] memory params) external payable;

    /***************************************
    METADATA FUNCTIONS
    ***************************************/

    /**
     * @notice Returns the base URI for computing tokenURI.
     * @return uri The base URI.
     */
    function baseURI() external view returns (string memory uri);

    /**
     * @notice Sets the base URI for computing tokenURI.
     * Can only be called by the contract owner.
     * @param uri The new base URI.
     */
    function setBaseURI(string calldata uri) external payable;

    /**
     * @notice Returns the contract URI.
     * @return uri The contract URI.
     */
    function contractURI() external view returns (string memory uri);

    /**
     * @notice Sets the contract URI.
     * Can only be called by the contract owner.
     * @param uri The new contract URI.
     */
    function setContractURI(string calldata uri) external payable;
}
