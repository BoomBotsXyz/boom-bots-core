// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { IERC6551AccountModule } from "./../interfaces/modules/IERC6551AccountModule.sol";
import { ERC6551AccountLibrary } from "./../libraries/modules/ERC6551AccountLibrary.sol";
import { ReentrancyGuardLibrary } from "./../libraries/modules/ReentrancyGuardLibrary.sol";


/**
 * @title ERC6551AccountModule
 * @author Blue Matter Technologies
 * @notice
 */
contract ERC6551AccountModule is IERC6551AccountModule {

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Returns the owner of this account.
     * By default this is the owner of the affiliated NFT.
     * @return owner_ The owner of this account.
     */
    function owner() external view override returns (address owner_) {
        ReentrancyGuardLibrary.reentrancyGuardCheck();
        owner_ = ERC6551AccountLibrary.owner();
    }

    /**
     * @notice Returns the identifier of the non-fungible token which owns the account.
     *
     * The return value of this function MUST be constant - it MUST NOT change over time.
     *
     * @return chainId       The EIP-155 ID of the chain the token exists on
     * @return tokenContract The contract address of the token
     * @return tokenId       The ID of the token
     */
    function token() external view override returns (uint256 chainId, address tokenContract, uint256 tokenId) {
        ReentrancyGuardLibrary.reentrancyGuardCheck();
        (chainId, tokenContract, tokenId) = ERC6551AccountLibrary.token();
    }

    /**
     * @notice Returns a value that SHOULD be modified each time the account changes state.
     * @return state_ The current account state.
     */
    function state() external view override returns (uint256 state_) {
        ReentrancyGuardLibrary.reentrancyGuardCheck();
        state_ = ERC6551AccountLibrary.state();
    }

    /**
     * @notice Checks if the signer is authorized to act on behalf of the account.
     * By default this is limited to only the nft owner.
     * @param signer The account to validate authorization.
     * @return isAuthorized True if the signer is authorized, false otherwise.
     */
    function isValidSigner(address signer) external view override returns (bool isAuthorized) {
        ReentrancyGuardLibrary.reentrancyGuardCheck();
        isAuthorized = ERC6551AccountLibrary.isValidSigner(signer);
    }

    /**
     * @notice Returns a magic value indicating whether a given signer is authorized to act on behalf
     * of the account.
     *
     * MUST return the bytes4 magic value `0x523e3260` if the given signer is valid.
     *
     * By default, the holder of the non-fungible token the account is bound to MUST be considered
     * a valid signer.
     *
     * Accounts MAY implement additional authorization logic which invalidates the holder as a
     * signer or grants signing permissions to other non-holder accounts.
     *
     * @param  signer     The address to check signing authorization for
     * @param  context    Additional data used to determine whether the signer is valid
     * @return magicValue Magic value indicating whether the signer is valid
     */
    function isValidSigner(address signer, bytes calldata context) external view override returns (bytes4 magicValue) {
        ReentrancyGuardLibrary.reentrancyGuardCheck();
        magicValue = ERC6551AccountLibrary.isValidSigner(signer, context);
    }

    /**
     * @notice Checks if a signature is valid for a given signer and data hash. If the signer is a smart contract, the
     * signature is validated against that smart contract using ERC1271, otherwise it's validated using `ECDSA.recover`.
     *
     * NOTE: Unlike ECDSA signatures, contract signatures are revocable, and the outcome of this function can thus
     * change through time. It could return true at block N and false at block N+1 (or the opposite).
     *
     * @param hash The data hash to validate.
     * @param signature The signature to validate.
     * @return magicValue Magic value indicating whether the signer is valid.
     */
    function isValidSignature(bytes32 hash, bytes memory signature) external view returns (bytes4 magicValue) {
        ReentrancyGuardLibrary.reentrancyGuardCheck();
        magicValue = ERC6551AccountLibrary.isValidSignature(hash, signature);
    }

    /***************************************
    MUTATOR FUNCTIONS
    ***************************************/

    /**
     * @notice Executes a low-level operation if the caller is a valid signer on the account.
     *
     * Reverts and bubbles up error if operation fails.
     *
     * Accounts implementing this interface MUST accept the following operation parameter values:
     * - 0 = CALL
     * - 1 = DELEGATECALL
     * - 2 = CREATE
     * - 3 = CREATE2
     *
     * Accounts implementing this interface MAY support additional operations or restrict a signer's
     * ability to execute certain operations.
     *
     * @param to        The target address of the operation
     * @param value     The Ether value to be sent to the target
     * @param data      The encoded operation calldata
     * @param operation A value indicating the type of operation to perform
     * @return result The result of the operation
     */
    function execute(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation
    ) external payable override returns (bytes memory result) {
        ReentrancyGuardLibrary.reentrancyGuardCheck();
        ReentrancyGuardLibrary.reentrancyGuardSetNotEnterable();
        result = ERC6551AccountLibrary.execute(to, value, data, operation);
        ReentrancyGuardLibrary.reentrancyGuardSetEnterable();
    }
}
