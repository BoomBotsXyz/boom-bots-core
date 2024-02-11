// SPDX-License-Identifier: none
pragma solidity 0.8.19;


/**
 * @title IDataStore
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
interface IDataStore {

    /***************************************
    EVENTS
    ***************************************/

    /// @notice Emitted when a record is set.
    event NamedAddressSet(string indexed key, address indexed value);

    /// @notice Emitted when a module is whitelisted or blacklisted.
    event ModuleWhitelisted(address indexed module, bool wasWhitelisted);

    /// @notice Emitted when a swap fee is set.
    event SwapFeeSet(uint256 indexed swapType, address indexed tokenIn, address indexed tokenOut, uint256 feePercent, address feeReceiver);

    /// @notice Emitted when the flash loan fee for a token is set.
    event FlashLoanFeeSet(address indexed token, uint256 fee, address receiver);

    /***************************************
    NAMED ADDRESS FUNCTIONS
    ***************************************/

    /**
     * @notice The number of named addresses.
     * @return len The number of named addresses.
     */
    function lengthNamedAddresses() external view returns (uint256 len);

    /**
     * @notice Gets the address registered under a given name.
     * Reverts if the name is not in the mapping.
     * @param name The name to query.
     * @return addr The address registered under the name.
     */
    function getNamedAddress(string calldata name) external view returns (address addr);

    /**
     * @notice Gets the address registered under a given name.
     * Fails gracefully if the name is not in the mapping.
     * @param name The name to query.
     * @return success True if the key was found, false otherwise.
     * @return addr The address registered under the name.
     */
    function tryGetNamedAddress(string calldata name) external view returns (bool success, address addr);

    /**
     * @notice Gets the name and address of a given `index`.
     * @dev Iterable [1,length].
     * @param index The index to query.
     * @return name The name at that index.
     * @return addr The address at that index.
     */
    function getNamedAddressByIndex(uint256 index) external view returns (string memory name, address addr);

    struct SetNamedAddressParam {
        string name;
        address addr;
    }

    /**
     * @notice Sets keys and values.
     * Can only be called by the contract owner.
     * @param params The list of names and addresses to set.
     */
    function setNamedAddresses(SetNamedAddressParam[] memory params) external;

    /***************************************
    MODULE WHITELIST FUNCTIONS
    ***************************************/

    /**
     * @notice Returns true if the module has been whitelisted.
     * All addresses are whitelisted if address zero is whitelisted.
     * @param module The address of the module to query.
     * @return isWhitelisted True if the module has been whitelisted, false otherwise.
     */
    function moduleIsWhitelisted(address module) external view returns (bool isWhitelisted);

    /**
     * @notice Returns true if the module can be installed.
     * All addresses are whitelisted if address zero is whitelisted.
     * @param module The address of the module to query.
     * @return canBeInstalled True if the module can be installed, false otherwise.
     */
    function moduleCanBeInstalled(address module) external view returns (bool canBeInstalled);

    struct SetModuleWhitelistParam {
        address module;
        bool shouldWhitelist;
    }

    /**
     * @notice Adds or removes modules to the whitelist.
     * Can only be called by the contract owner.
     * @param params The list of modules and if they should be whitelisted or blacklisted.
     */
    function setModuleWhitelist(SetModuleWhitelistParam[] memory params) external;

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
    ) external view returns (
        uint256 feePercent,
        address feeReceiver
    );

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
    ) external view returns (
        uint256 feePercent,
        address feeReceiver
    );

    struct SetSwapFeeParam {
        uint256 swapType;
        address tokenIn;
        address tokenOut;
        uint256 feePercent;
        address feeReceiver;
    }

    /**
     * @notice Sets the swap fee for market orders placed against a limit order or grid order.
     * Can only be called by the contract owner.
     * @param params tokenIn, tokenOut, fee, receiver.
     */
    function setSwapFees(SetSwapFeeParam[] calldata params) external;

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
    ) external view returns (
        uint256 feePercent,
        address feeReceiver
    );

    /**
     * @notice Gets the stored flash loan fee for a token.
     * The default fee is stored at address zero.
     * @param token The loan currency.
     * @return feePercent The fee measured in parts per quintillion.
     * @return feeReceiver The receiver of fees.
     */
    function getStoredFlashLoanFee(
        address token
    ) external view returns (
        uint256 feePercent,
        address feeReceiver
    );

    struct SetFlashLoanFeeParam {
        address token;
        uint256 feePercent;
        address feeReceiver;
    }

    /**
     * @notice Sets the flash loan fee for multiple tokens.
     * Can only be called by the contract owner.
     * @param params token, fee, receiver.
     */
    function setFlashLoanFees(SetFlashLoanFeeParam[] calldata params) external;
}
