// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Calls } from "./../../libraries/Calls.sol";
import { Errors } from "./../../libraries/Errors.sol";
import { IBoomBotAccount } from "./../../interfaces/accounts/IBoomBotAccount.sol";
import { BoomBotAccount } from "./../../accounts/BoomBotAccount.sol";
import { IBlast } from "./../../interfaces/external/Blast/IBlast.sol";
import { ERC2535Library } from "./../../libraries/modules/ERC2535Library.sol";
import { ReentrancyGuardLibrary } from "./../../libraries/modules/ReentrancyGuardLibrary.sol";
import { DataStoreLibrary } from "./../../libraries/modules/DataStoreLibrary.sol";


/**
 * @title MockBlastableAccount
 * @author Blue Matter Technologies
 * @notice An account that is used to test other contracts.
 *
 * Should NOT be used in production.
 */
contract MockBlastableAccount is BoomBotAccount {

    address internal _blast;

    constructor(address implGasCollector, address blast_) BoomBotAccount(implGasCollector) {
        _blast = blast_;
    }

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Returns the address of the Blast contract.
     * @return blast_ The address of the Blast contract.
     */
    function blast() public view virtual override returns (address blast_) {
        blast_ = _blast;
    }

    /**
     * @notice Sets the address of the Blast contract.
     * @param blast_ The address to set.
     */
    function setBlast(address blast_) external {
        _blast = blast_;
    }
}
