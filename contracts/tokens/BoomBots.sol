// SPDX-License-Identifier: none
pragma solidity 0.8.19;

import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { Multicall } from "./../utils/Multicall.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC721Enumerable } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import { Errors } from "./../libraries/Errors.sol";
import { IERC6551Registry } from "./../interfaces/erc6551/IERC6551Registry.sol";
import { IBoomBots } from "./../interfaces/tokens/IBoomBots.sol";
import { Blastable } from "./../utils/Blastable.sol";


/**
 * @title BoomBots
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
contract BoomBots is IBoomBots, ERC721Enumerable, Blastable, Multicall {

    mapping(address => bool) internal _factoryIsWhitelisted;

    struct BotInfo {
        address botAddress;
        address implementationAddress;
    }
    mapping(uint256 => BotInfo) internal _botInfo;
    mapping(address => uint256) internal _botAddressToID;

    address internal _erc6551Registry;

    // uri data

    string internal _tokenURIbase;
    string internal _contractURI;

    /**
     * @notice Constructs the BoomBots contract.
     * @param owner_ The contract owner.
     */
    constructor(
        address erc6551Registry_,
        address owner_
    ) ERC721("BOOM! Bot Ownership Tokens", "BBOT") {
        _transferOwnership(owner_);
        _erc6551Registry = erc6551Registry_;
    }

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
    function getBotInfo(uint256 botID) external view override returns (
        address botAddress,
        address implementationAddress
    ) {
        _requireMinted(botID);
        BotInfo memory botinfo = _botInfo[botID];
        botAddress = botinfo.botAddress;
        implementationAddress = botinfo.implementationAddress;
    }

    /**
     * @notice Returns the ID of a bot given its address.
     * Returns ID 0 if the address is not a bot.
     * @param botAddress The address of the bot to query.
     * @return botID The ID of the bot.
     */
    function getBotID(address botAddress) external view override returns (uint256 botID) {
        botID = _botAddressToID[botAddress];
    }

    /**
     * @notice Given the address of the bot, returns if it is a known bot.
     * @param botAddress The address of the bot to query.
     * @return isBot True if is a known bot, false otherwise.
     */
    function isAddressBot(address botAddress) external view override returns (bool isBot) {
        uint256 botID = _botAddressToID[botAddress];
        isBot = botID > 0;
    }

    /**
     * @notice Returns true if the bot exists.
     * @param botID The ID of the bot to query.
     * @return status True if the bot exists, false otherwise.
     */
    function exists(uint256 botID) external view override returns (bool status) {
        status = _exists(botID);
    }

    /**
     * @notice Returns the address of the ERC6551 registry.
     * @return registry_ The address of the registry.
     */
    function getERC6551Registry() external view override returns (address registry_) {
        registry_ = _erc6551Registry;
    }

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
    ) external payable override returns (
        uint256 botID,
        address botAddress
    ) {
        // msg.sender must be whitelisted
        if(!(_factoryIsWhitelisted[address(0)]||_factoryIsWhitelisted[msg.sender])) revert Errors.FactoryNotWhitelisted();
        // calculate botID. autoincrement from 1
        botID = totalSupply() + 1;
        // mint nft
        _mint(msg.sender, botID);
        // combine many sources of randomness for address salt
        uint256 chainid = block.chainid;
        bytes32 salt = keccak256(abi.encode(botID, implementation, chainid, block.number, block.timestamp, blockhash(block.number), tx.origin, gasleft()));
        // use erc6551 to create and register the account
        botAddress = IERC6551Registry(_erc6551Registry).createAccount(
            implementation,
            salt,
            chainid,
            address(this),
            botID
        );
        // store bot info
        _botInfo[botID].botAddress = botAddress;
        _botInfo[botID].implementationAddress = implementation;
        _botAddressToID[botAddress] = botID;
    }

    /***************************************
    WHITELIST FUNCTIONS
    ***************************************/

    /**
     * @notice Returns true if the factory has been whitelisted.
     * All addresses are whitelisted if address zero is whitelisted.
     * @param factory The address of the factory to query.
     * @return isWhitelisted True if the factory has been whitelisted, false otherwise.
     */
    function factoryIsWhitelisted(address factory) external view override returns (bool isWhitelisted) {
        isWhitelisted = _factoryIsWhitelisted[factory];
    }

    /**
     * @notice Adds or removes factories to the whitelist.
     * Can only be called by the contract owner.
     * @param params The list of factories and if they should be whitelisted or blacklisted.
     */
    function setWhitelist(SetWhitelistParam[] memory params) external payable override onlyOwner {
        for(uint256 i = 0; i < params.length; ) {
            address factory = params[i].factory;
            bool shouldWhitelist = params[i].shouldWhitelist;
            _factoryIsWhitelisted[factory] = shouldWhitelist;
            emit FactoryWhitelisted(factory, shouldWhitelist);
            unchecked { ++i; }
        }
    }

    /***************************************
    METADATA FUNCTIONS
    ***************************************/

    /**
     * @notice Returns the Uniform Resource Identifier (URI) for `botID` token.
     * Reverts if the token does not exist.
     * @param botID The ID of the pool to query.
     * @return uri The token uri.
     */
    function tokenURI(uint256 botID) public view override returns (string memory uri) {
        _requireMinted(botID);
        uri = string(abi.encodePacked(_tokenURIbase, Strings.toString(botID)));
    }

    /**
     * @notice Returns the base URI for computing tokenURI.
     * @return uri The base URI.
     */
    function baseURI() external view override returns (string memory uri) {
        uri = _tokenURIbase;
    }

    /**
     * @notice Sets the base URI for computing tokenURI.
     * Can only be called by the contract owner.
     * @param uri The new base URI.
     */
    function setBaseURI(string calldata uri) external payable override onlyOwner {
        _tokenURIbase = uri;
        emit BaseURISet(uri);
    }

    /**
     * @notice Returns the contract URI.
     * @return uri The contract URI.
     */
    function contractURI() external view override returns (string memory uri) {
        uri = _contractURI;
    }

    /**
     * @notice Sets the contract URI.
     * Can only be called by the contract owner.
     * @param uri The new contract URI.
     */
    function setContractURI(string calldata uri) external payable override onlyOwner {
        _contractURI = uri;
        emit ContractURISet(uri);
    }

    /***************************************
    ERC721 HELPER FUNCTIONS
    ***************************************/

    /**
     * @notice Reverts if the `botID` has not been minted yet.
     * @param botID The ID of the bot to query.
     */
    function _requireMinted(uint256 botID) internal view virtual override {
        if(!_exists(botID)) revert Errors.BotDoesNotExist();
    }
}
