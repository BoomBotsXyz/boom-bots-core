// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.19;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import { IERC6551Account } from "./IERC6551Account.sol";
import { IERC6551Executable } from "./IERC6551Executable.sol";


/**
 * @title IERC6551AccountExtended
 * @notice An interface for ERC6551 accounts. Contains the required functionality plus some helpful functions not required by the ERC6551 standard.
*/
interface IERC6551AccountExtended is IERC165, IERC1271, IERC6551Account, IERC6551Executable {

    /**
     * @notice Thrown if a non-owner tries to execute an operation.
     */
    error ERC6551InvalidSigner();
    /**
     * @notice Thrown if the owner tries to execute an operation that is not a call.
     */
    error OnlyCallsAllowed();

    /**
     * @notice Returns the owner of this account.
     * By default this is the owner of the affiliated NFT.
     * @return owner_ The owner of this account.
     */
    function owner() external view returns (address owner_);

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
    function isValidSignature(bytes32 hash, bytes memory signature) external view returns (bytes4 magicValue);
}
