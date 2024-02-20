// SPDX-License-Identifier: none
pragma solidity 0.8.24;


/**
 * @title IPreBOOM
 * @author Blue Matter Technologies
 * @notice The precursor token to BOOM!
 */
interface IPreBOOM {

    event MinterSet(address indexed account, bool isMinter);

    /**
     * @notice Mints tokens.
     * Can only be called by an authorized minter.
     * @param receiver The address to receive new tokens.
     * @param amount The amount of tokens to mint.
     */
    function mint(address receiver, uint256 amount) external;

    /**
     * @notice Returns true if the account is an authorized minter.
     * @param account The account to query.
     * @return status True if the account is a minter, false otherwise.
     */
    function isMinter(address account) external view returns (bool status);

    struct MinterParam {
        address account;
        bool isMinter;
    }

    /**
     * @notice Grants or revokes the minter role from a set of users.
     * Can only be called by the contract owner.
     * @param params The roles to set.
     */
    function setMinters(MinterParam[] calldata params) external;
}
