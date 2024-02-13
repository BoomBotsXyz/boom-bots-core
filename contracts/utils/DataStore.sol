// SPDX-License-Identifier: none
pragma solidity 0.8.19;

import { Multicall } from "@openzeppelin/contracts/utils/Multicall.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Errors } from "./../libraries/Errors.sol";
import { Calls } from "./../libraries/Calls.sol";
import { IDataStore } from "./../interfaces/utils/IDataStore.sol";
import { Blastable } from "./../utils/Blastable.sol";


/**
 * @title DataStore
 * @author Blue Matter Technologies
 * @notice The DataStore is built to store and retrieve certain pieces of information in the BOOM! Bots protocol.
 *
 * The DataStore is a standalone singleton contract. Bots can call this contract to retrieve information.
 *
 * The DataStore should not be used to store ALL information about the protocol, only pieces that do not have a home anywhere else.
 *
 * The DataStore holds three types of information.
 *
 * The first is a store of important addresses. These are stored in a mapping from a string value. For example, we may store the address of "weth".
 *
 * The second is a store of whitelisted modules. The owner of a bot may install modules. While the protocol is running in safe mode, only whitelisted modules may be installed.
 *
 * The third is a store of fees. The protocol charges a fee on swaps and flash loans, which are then paid out as dividends. The fee percentage and receiver are stored here. The application of the fee is applied differently based on the type. Read the respective modules for more details.
 */
contract DataStore is IDataStore, Multicall, Blastable {

    /***************************************
    GLOBAL VARIABLES
    ***************************************/

    // named addresses data

    struct NamedAddressEntry {
        uint256 index;
        address addr;
    }
    // contract name => contract address
    mapping(string => NamedAddressEntry) internal _namedAddresses;
    // index => key
    mapping(uint256 => string) internal _namesByIndex;
    // number of named addresses
    uint256 internal _lengthNamedAddresses;

    // module whitelist data

    mapping(address => bool) internal _moduleIsWhitelisted;

    // fee data

    // fees are measured as a fraction. the denominator has 18 zeros = 1 quintillion = 1 exawei
    uint256 internal constant MAX_PPQT = 1_000_000_000_000_000_000;

    // swaps

    struct FeeInfo {
        uint256 feePercent;
        address feeReceiver;
    }

    // swap type => tokenIn => tokenOut => swap fee
    mapping(uint256 => mapping(address => mapping(address => FeeInfo))) internal _swapFees;

    // flash loans

    // token => flash loan fee
    mapping(address => FeeInfo) internal _flashLoanFees;

    /**
     * @notice Constructs the DataStore contract.
     * @param owner_ The contract owner.
     */
    constructor(
        address owner_
    ) {
        _transferOwnership(owner_);
    }

    /***************************************
    NAMED ADDRESS FUNCTIONS
    ***************************************/

    /**
     * @notice The number of named addresses.
     * @return len The number of named addresses.
     */
    function lengthNamedAddresses() external view override returns (uint256 len) {
        len = _lengthNamedAddresses;
    }

    /**
     * @notice Gets the address registered under a given name.
     * Reverts if the name is not in the mapping.
     * @param name The name to query.
     * @return addr The address registered under the name.
     */
    function getNamedAddress(string calldata name) external view override returns (address addr) {
        NamedAddressEntry memory entry = _namedAddresses[name];
        if(entry.index == 0) revert Errors.UnknownName();
        addr = entry.addr;
    }

    /**
     * @notice Gets the address registered under a given name.
     * Fails gracefully if the name is not in the mapping.
     * @param name The name to query.
     * @return success True if the name was found, false otherwise.
     * @return addr The address registered under the name.
     */
    function tryGetNamedAddress(string calldata name) external view override returns (bool success, address addr) {
        NamedAddressEntry memory entry = _namedAddresses[name];
        if(entry.index == 0) {
            success = false;
        } else {
          success = true;
          addr = entry.addr;
        }
    }

    /**
     * @notice Gets the name and address of a given `index`.
     * @dev Iterable [1,length].
     * @param index The index to query.
     * @return name The name at that index.
     * @return addr The address at that index.
     */
    function getNamedAddressByIndex(uint256 index) external view override returns (string memory name, address addr) {
        if(index == 0 || index > _lengthNamedAddresses) revert Errors.OutOfRange();
        name = _namesByIndex[index];
        addr = _namedAddresses[name].addr;
    }

    /**
     * @notice Sets keys and values.
     * Can only be called by the contract owner.
     * @param params The list of names and addresses to set.
     */
    function setNamedAddresses(SetNamedAddressParam[] memory params) external override onlyOwner {
        for(uint256 i; i < params.length; ) {
            address addr = params[i].addr;
            if(addr == address(0)) revert Errors.AddressZero();
            string memory name = params[i].name;
            NamedAddressEntry memory entry = _namedAddresses[name];
            // add new record
            if(entry.index == 0) {
                entry.index = ++_lengthNamedAddresses; // autoincrement from 1
                _namesByIndex[entry.index] = name;
            }
            // store record
            entry.addr = addr;
            _namedAddresses[name] = entry;
            emit NamedAddressSet(name, addr);
            unchecked { ++i; }
        }
    }

    /***************************************
    MODULE WHITELIST FUNCTIONS
    ***************************************/

    /**
     * @notice Returns true if the module has been whitelisted.
     * All addresses are whitelisted if address zero is whitelisted.
     * @param module The address of the module to query.
     * @return isWhitelisted True if the module has been whitelisted, false otherwise.
     */
    function moduleIsWhitelisted(address module) external view override returns (bool isWhitelisted) {
        isWhitelisted = _moduleIsWhitelisted[module];
    }

    /**
     * @notice Returns true if the module can be installed.
     * All addresses are whitelisted if address zero is whitelisted.
     * @param module The address of the module to query.
     * @return canBeInstalled True if the module can be installed, false otherwise.
     */
    function moduleCanBeInstalled(address module) external view override returns (bool canBeInstalled) {
        canBeInstalled = _moduleIsWhitelisted[module]||_moduleIsWhitelisted[address(0)];
    }

    /**
     * @notice Adds or removes modules to the whitelist.
     * Can only be called by the contract owner.
     * @param params The list of modules and if they should be whitelisted or blacklisted.
     */
    function setModuleWhitelist(SetModuleWhitelistParam[] memory params) external override onlyOwner {
        for(uint256 i; i < params.length; ) {
            address module = params[i].module;
            bool shouldWhitelist = params[i].shouldWhitelist;
            _moduleIsWhitelisted[module] = shouldWhitelist;
            emit ModuleWhitelisted(module, shouldWhitelist);
            unchecked { ++i; }
        }
    }

    /***************************************
    SWAP FEE FUNCTIONS
    ***************************************/

    /**
     * @notice Gets the fees for a trade.
     * @param swapType The type of trade being made.
     * @param tokenIn The token that market takers sell.
     * @param tokenOut The token that market takers buy.
     * @return feePercent The fee of the token in measured in parts per quintillion.
     * @return feeReceiver The receiver of fees paid in token in.
     */
    function getSwapFee(
        uint256 swapType,
        address tokenIn,
        address tokenOut
    ) external view override returns (
        uint256 feePercent,
        address feeReceiver
    ) {
        FeeInfo memory swapfeeOverride = _swapFees[swapType][tokenIn][tokenOut];
        FeeInfo storage swapfeeDefault = _swapFees[swapType][address(0)][address(0)];

        // determine percentage
        if(swapfeeOverride.feePercent == 0) {
            feePercent = swapfeeDefault.feePercent;
        } else {
            feePercent = swapfeeOverride.feePercent;
        }
        // if the pair returns an 'invalid amount too high', that's an explicit zero fee
        if(feePercent >= MAX_PPQT) feePercent = 0;

        // determine receiver
        feeReceiver = swapfeeOverride.feeReceiver;
        if(feeReceiver == address(0)) feeReceiver = swapfeeDefault.feeReceiver;
        if(feeReceiver == address(0)) feeReceiver = address(this);
    }

    /**
     * @notice Gets the stored swap fee for a market order placed against a limit order or grid order.
     * The default fee is stored at [address zero, address zero].
     * @param swapType The type of trade being made.
     * @param tokenIn The token that market takers sell.
     * @param tokenOut The token that market takers buy.
     * @return feePercent The fee of the token in measured in parts per quintillion.
     * @return feeReceiver The receiver of fees paid in token in.
     */
    function getStoredSwapFee(
        uint256 swapType,
        address tokenIn,
        address tokenOut
    ) external view override returns (
        uint256 feePercent,
        address feeReceiver
    ) {
        FeeInfo memory swapfee = _swapFees[swapType][tokenIn][tokenOut];
        feePercent = swapfee.feePercent;
        feeReceiver = swapfee.feeReceiver;
    }

    /**
     * @notice Sets the swap fee for market orders placed against a limit order or grid order.
     * Can only be called by the contract owner.
     * @param params tokenIn, tokenOut, fee, receiver.
     */
    function setSwapFees(SetSwapFeeParam[] calldata params) external override onlyOwner {
        for(uint256 i; i < params.length; ) {
            uint256 swapType = params[i].swapType;
            address tokenIn = params[i].tokenIn;
            address tokenOut = params[i].tokenOut;
            uint256 feePercent = params[i].feePercent;
            address feeReceiver = params[i].feeReceiver;
            _swapFees[swapType][tokenIn][tokenOut].feePercent = feePercent;
            _swapFees[swapType][tokenIn][tokenOut].feeReceiver = feeReceiver;
            emit SwapFeeSet(swapType, tokenIn, tokenOut, feePercent, feeReceiver);
            unchecked { ++i; }
        }
    }

    /***************************************
    FLASH LOAN FEE FUNCTIONS
    ***************************************/

    /**
     * @notice Gets the flash loan fee for a token.
     * The default fee is stored at address zero.
     * @param token The loan currency.
     * @return feePercent The fee measured in parts per quintillion.
     * @return feeReceiver The receiver of fees.
     */
    function getFlashLoanFee(
        address token
    ) external view override returns (
        uint256 feePercent,
        address feeReceiver
    ) {
        FeeInfo memory flashLoanFeeOverride = _flashLoanFees[token];
        FeeInfo storage flashLoanFeeDefault = _flashLoanFees[address(0)];

        // determine percentage
        if(flashLoanFeeOverride.feePercent == 0) {
            feePercent = flashLoanFeeDefault.feePercent;
        } else {
            feePercent = flashLoanFeeOverride.feePercent;
        }
        // if the token returns an 'invalid amount too high', that's an explicit zero fee
        if(feePercent >= MAX_PPQT) feePercent = 0;
        // determine receiver
        feeReceiver = flashLoanFeeOverride.feeReceiver;
        if(feeReceiver == address(0)) feeReceiver = flashLoanFeeDefault.feeReceiver;
        if(feeReceiver == address(0)) feeReceiver = address(this);
    }

    /**
     * @notice Gets the stored flash loan fee for a token.
     * The default fee is stored at address zero.
     * @param token The loan currency.
     * @return feePercent The fee measured in parts per quintillion.
     * @return feeReceiver The receiver of fees.
     */
    function getStoredFlashLoanFee(
        address token
    ) external view override returns (
        uint256 feePercent,
        address feeReceiver
    ) {
        feePercent = _flashLoanFees[token].feePercent;
        feeReceiver = _flashLoanFees[token].feeReceiver;
    }

    /**
     * @notice Sets the flash loan fee for multiple tokens.
     * Can only be called by the contract owner.
     * @param params token, fee, receiver.
     */
    function setFlashLoanFees(SetFlashLoanFeeParam[] calldata params) external override onlyOwner {
        for(uint256 i; i < params.length; ) {
            address token = params[i].token;
            uint256 feePercent = params[i].feePercent;
            address feeReceiver = params[i].feeReceiver;
            _flashLoanFees[token].feePercent = feePercent;
            _flashLoanFees[token].feeReceiver = feeReceiver;
            emit FlashLoanFeeSet(token, feePercent, feeReceiver);
            unchecked { ++i; }
        }
    }
}
