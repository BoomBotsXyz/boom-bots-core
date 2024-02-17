// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Blastable } from "./../utils/Blastable.sol";
import { Multicall } from "./../utils/Multicall.sol";
import { Errors } from "./../libraries/Errors.sol";
import { IPreBOOM } from "./../interfaces/tokens/IPreBOOM.sol";


/**
 * @title PreBOOM
 * @author Blue Matter Technologies
 * @notice The precursor token to BOOM!
 */
contract PreBOOM is IPreBOOM, ERC20, Blastable, Multicall {

    mapping(address => bool) internal _isMinter;

    modifier onlyMinter() {
        if(!_isMinter[msg.sender]) revert Errors.NotMinter();
        _;
    }

    /**
     * @notice Constructs the PreBOOM contract.
     * @param owner_ The contract owner.
     */
    constructor(address owner_) ERC20("Precursor BOOM!", "PreBOOM") {
        _transferOwnership(owner_);
    }

    /**
     * @notice Mints tokens.
     * Can only be called by an authorized minter.
     * @param receiver The address to receive new tokens.
     * @param amount The amount of tokens to mint.
     */
    function mint(address receiver, uint256 amount) external override onlyMinter {
        _mint(receiver, amount);
    }

    /**
     * @notice Returns true if the account is an authorized minter.
     * @param account The account to query.
     * @return status True if the account is a minter, false otherwise.
     */
    function isMinter(address account) external view override returns (bool status) {
        status = _isMinter[account];
    }

    /**
     * @notice Grants or revokes the minter role from a set of users.
     * Can only be called by the contract owner.
     * @param params The roles to set.
     */
    function setMinters(MinterParam[] calldata params) external onlyOwner override {
        for(uint256 i = 0; i < params.length; ++i) {
            _isMinter[params[i].account] = params[i].isMinter;
            emit MinterSet(params[i].account, params[i].isMinter);
        }
    }
}
