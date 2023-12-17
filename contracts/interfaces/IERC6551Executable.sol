// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.19;


/**
 * @title IERC6551Executable
 * @notice The base interface for ERC6551 accounts that allow signers to execute arbitrary operations on behalf of the account.
 * This interface was defined in the ERC6551 standard.
 * @dev the ERC-165 identifier for this interface is `0x51945447`
*/
interface IERC6551Executable {

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
     * @param to        The target address of the operation.
     * @param value     The Ether value to be sent to the target.
     * @param data      The encoded operation calldata.
     * @param operation A value indicating the type of operation to perform.
     * @return result The result of the operation.
     */
    function execute(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation
    ) external payable returns (bytes memory result);
}
