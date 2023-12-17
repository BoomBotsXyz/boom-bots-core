// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import { IERC6551Account } from "./../interfaces/IERC6551Account.sol";
import { IERC6551AccountExtended } from "./../interfaces/IERC6551AccountExtended.sol";


/**
 * @title ERC6551Account
 * @notice The base contract for ERC6551 accounts. May be deployed and used as-is or extended.
*/
contract ERC6551Account is IERC6551AccountExtended, ERC721Holder {

    uint256 internal _state;

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Returns the owner of this account.
     * By default this is the owner of the affiliated NFT.
     * @return owner_ The owner of this account.
     */
    function owner() public view virtual override returns (address owner_) {
        (uint256 chainId, address tokenContract, uint256 tokenId) = token();
        if (chainId != block.chainid) return address(0);
        return IERC721(tokenContract).ownerOf(tokenId);
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
    function token() public view virtual override returns (uint256 chainId, address tokenContract, uint256 tokenId) {
        bytes memory footer = new bytes(0x60);
        assembly {
            extcodecopy(address(), add(footer, 0x20), 0x4d, 0x60)
        }
        return abi.decode(footer, (uint256, address, uint256));
    }

    /**
     * @notice Returns a value that SHOULD be modified each time the account changes state.
     * @return state_ The current account state.
     */
    function state() external view virtual override returns (uint256 state_) {
        return _state;
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
    function isValidSigner(address signer, bytes calldata context) external view virtual override returns (bytes4 magicValue) {
        if (_isValidSigner(signer)) {
            return IERC6551Account.isValidSigner.selector;
        }
        return bytes4(0);
    }

    /**
     * @dev Checks if a signature is valid for a given signer and data hash. If the signer is a smart contract, the
     * signature is validated against that smart contract using ERC1271, otherwise it's validated using `ECDSA.recover`.
     *
     * NOTE: Unlike ECDSA signatures, contract signatures are revocable, and the outcome of this function can thus
     * change through time. It could return true at block N and false at block N+1 (or the opposite).
     *
     * @param hash The data hash to validate.
     * @param signature The signature to validate.
     * @return magicValue Magic value indicating whether the signer is valid.
     */
    function isValidSignature(bytes32 hash, bytes memory signature) external view virtual override returns (bytes4 magicValue) {
        bool isValid = SignatureChecker.isValidSignatureNow(owner(), hash, signature);
        if (isValid) {
            return IERC1271.isValidSignature.selector;
        }
        return bytes4(0);
    }

    /**
     * @notice Returns true if this contract implements the interface defined by `interfaceId`.
     * @param interfaceId The id of the interface to query.
     * @return status True if supported, false otherwise.
     */
    function supportsInterface(bytes4 interfaceId) external view virtual override returns (bool status) {
        return (
            (interfaceId == 0x01ffc9a7) || // erc165
            (interfaceId == 0x6faff5f1) || // erc6551 account
            (interfaceId == 0x51945447)    // erc6551 executable
        );
    }

    /***************************************
    MUTATOR FUNCTIONS
    ***************************************/

    /**
     * @notice Allows the account to receive Ether.
     *
     * Accounts MUST implement a `receive` function.
     *
     * Accounts MAY perform arbitrary logic to restrict conditions
     * under which Ether can be received.
     */
    receive() external payable virtual override {}

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
    ) external payable virtual override returns (bytes memory result) {
        if(!_isValidSigner(msg.sender)) revert ERC6551InvalidSigner();
        if(operation != 0) revert OnlyCallsAllowed();

        ++_state;
        bool success;
        (success, result) = to.call{value: value}(data);
        if(!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    /***************************************
    HELPER FUNCTIONS
    ***************************************/

    /**
     * @dev Checks if the signer is authorized to act on behalf of the account.
     * By default this is limited to only the nft owner.
     * @param signer The account to validate authorization.
     * @return isAuthorized True if the signer is authorized, false otherwise.
     */
    function _isValidSigner(address signer) internal view virtual returns (bool isAuthorized) {
        return signer == owner();
    }
}
