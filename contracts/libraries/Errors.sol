// SPDX-License-Identifier: none
pragma solidity 0.8.19;


/**
 * @title Errors
 * @author Blue Matter Technologies Ltd.
 * @notice A library of custom error types used in BOOM!.
 */
library Errors {

    // call errors
    /// @notice Thrown when a low level call reverts without a reason.
    error CallFailed();
    /// @notice Thrown when a low level delegatecall reverts without a reason.
    error DelegateCallFailed();
    /// @notice Thrown if the owner tries to execute an operation that is not a call.
    error OnlyCallsAllowed();
    /// @notice Thrown when using an address with no code.
    error NotAContract();

    // ownership & authentication errors
    /// @notice Thrown when calling a function reserved for the contract owner.
    error NotContractOwner();
    /// @notice Thrown when calling a function reserved for the pending contract owner.
    error NotPendingContractOwner();
    /// @notice Thrown when calling a function reserved for the owner of a erc6551 account.
    error ERC6551InvalidSigner();
    /// @notice Thrown when attempting a function reserved for the owner of the bot.
    //error NotOwnerOfBot();

    // generic input errors
    /// @notice Thrown when address zero is used where it should not be.
    error AddressZero();
    /// @notice Thrown when a nonzero address is used where the zero address is expected
    error AddressNotZero();
    /// @notice Thrown when an address is used where it should not be.
    //error AddressIllegal();
    /// @notice Thrown when the number of elements in an array is not what was expected.
    error LengthMismatch();
    /// @notice Thrown when receiving an array of length zero.
    error LengthZero();
    /// @notice Thrown when looking up a name that is unknown.
    error UnknownName();
    /// @notice Thrown when accessing an element that is out of range.
    error OutOfRange();

    // execution errors
    /// @notice Thrown when a call reenters illegally.
    error ReentrancyGuard();
    /// @notice Thrown when attempting to initialize a contract that has already been initialized.
    error AlreadyInitialized();

    // nft errors
    /// @notice Thrown when querying a bot that does not exist.
    error BotDoesNotExist();
    /// @notice Thrown when transferring a bot nft to the bot account.
    error OwnershipCycle();
    /// @notice Thrown when calling a function that is reserved for bots only.
    //error CallerIsNotABot();

    // bot creation errors
    /// @notice Thrown when attempting to create a bot from an account that is not whitelisted.
    error FactoryNotWhitelisted();
    /// @notice Thrown when call a contract that has been paused.
    error ContractPaused();

    // erc2535 errors
    /// @notice Thrown when installing a function that is already installed.
    error AddFunctionDuplicate();
    /// @notice Thrown when replacing a function with itself.
    error ReplaceFunctionSame();
    /// @notice Thrown when removing a function that has not currently installed.
    error RemoveFunctionDoesNotExist();
    /// @notice Thrown when removing a function that cannot be removed.
    error RemoveFunctionImmutable();
    /// @notice Thrown when calling a function that does not exist in this contract.
    error FunctionDoesNotExist();
    /// @notice Thrown when attempting to install a module that is not whitelisted.
    error ModuleNotWhitelisted();
}
