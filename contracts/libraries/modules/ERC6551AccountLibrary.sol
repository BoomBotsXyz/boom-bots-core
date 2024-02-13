// SPDX-License-Identifier: none
pragma solidity 0.8.19;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC1271 } from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import { SignatureChecker } from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import { IERC6551Account } from "./../../interfaces/accounts/IERC6551Account.sol";
import { Calls } from "./../Calls.sol";
import { Errors } from "./../Errors.sol";


/**
 * @title ERC6551AccountLibrary
 * @author Blue Matter Technologies
 * @notice A library that assists with storing and retrieving the gas token.
 */
library ERC6551AccountLibrary {

    bytes32 constant private ERC6551_ACCOUNT_LIBRARY_STORAGE_POSITION = keccak256("boom.storage.erc6551");

    struct ERC6551AccountModuleStorage {
        uint256 state;
    }

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Returns the `ERC6551AccountModuleStorage` struct.
     * @return erc6551ams The `ERC6551AccountModuleStorage` struct.
     */
    function erc6551AccountModuleStorage() internal pure returns (ERC6551AccountModuleStorage storage erc6551ams) {
        bytes32 position = ERC6551_ACCOUNT_LIBRARY_STORAGE_POSITION;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            erc6551ams.slot := position
        }
    }

    /**
     * @notice Returns the owner of this account.
     * By default this is the owner of the affiliated NFT.
     * @return owner_ The owner of this account.
     */
    function owner() internal view returns (address owner_) {
        (uint256 chainId, address tokenContract, uint256 tokenId) = token();
        if (chainId != block.chainid) owner_ = address(0);
        else owner_ = IERC721(tokenContract).ownerOf(tokenId);
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
    function token() internal view returns (uint256 chainId, address tokenContract, uint256 tokenId) {
        bytes memory footer = new bytes(0x60);
        assembly {
            extcodecopy(address(), add(footer, 0x20), 0x4d, 0x60)
        }
        (chainId, tokenContract, tokenId) = abi.decode(footer, (uint256, address, uint256));
    }

    /**
     * @notice Returns a value that SHOULD be modified each time the account changes state.
     * @return state_ The current account state.
     */
    function state() internal view returns (uint256 state_) {
        ERC6551AccountModuleStorage storage erc6551ams = erc6551AccountModuleStorage();
        state_ = erc6551ams.state;
    }

    /**
     * @notice Checks if the signer is authorized to act on behalf of the account.
     * By default this is limited to only the nft owner.
     * @param signer The account to validate authorization.
     * @return isAuthorized True if the signer is authorized, false otherwise.
     */
    function isValidSigner(address signer) internal view returns (bool isAuthorized) {
        isAuthorized = signer == owner();
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
    function isValidSigner(address signer, bytes calldata context) internal view returns (bytes4 magicValue) {
        if (isValidSigner(signer)) {
            magicValue = IERC6551Account.isValidSigner.selector;
        } else {
            magicValue = bytes4(0);
        }
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
    function isValidSignature(bytes32 hash, bytes memory signature) internal view returns (bytes4 magicValue) {
        bool isValid = SignatureChecker.isValidSignatureNow(owner(), hash, signature);
        if (isValid) {
            magicValue = IERC1271.isValidSignature.selector;
        } else {
            magicValue = bytes4(0);
        }
    }

    /**
     * @notice Validates msg.sender is authorized to act on behalf of the account.
     * By default this is limited to only the nft owner.
     */
    function validateSender() internal view {
        if(!isValidSigner(msg.sender)) revert Errors.ERC6551InvalidSigner();
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
    ) internal returns (bytes memory result) {
        validateSender();
        if(operation != 0) revert Errors.OnlyCallsAllowed();
        result = Calls.functionCallWithValue(to, data, value);
        incrementState();
    }

    /**
     * @notice Updates the account state.
     */
    function incrementState() internal {
        ERC6551AccountModuleStorage storage erc6551ams = erc6551AccountModuleStorage();
        ++erc6551ams.state;
    }
}
