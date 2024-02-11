// SPDX-License-Identifier: none
pragma solidity 0.8.19;

import { Multicall } from "@openzeppelin/contracts/utils/Multicall.sol";
import { Blastable } from "./../../utils/Blastable.sol";
import { Calls } from "./../../libraries/Calls.sol";
import { Errors } from "./../../libraries/Errors.sol";
import { IBlast } from "./../../interfaces/external/Blast/IBlast.sol";


/**
 * @title MockGasBurner
 * @notice An account that burns gas and performs gas math. Only used to help calculate Blast gas rewards.
*/
contract MockGasBurner is Multicall, Blastable {

    uint256 public x;

    /**
     * @notice Constructs the MockGasBurner contract.
     * @param _owner The owner of the contract.
     */
    constructor(address _owner) {
        _transferOwnership(_owner);
        x = 1;
    }

    /**
     * @notice Burns some gas.
     * @param numIters The number of iterations of the burn loop to run.
     */
    function burnGas(uint256 numIters) external {
        for(uint256 i; i < numIters; ) {
            unchecked {
                ++i;
                x = (x * 2) + i;
            }
        }
    }

    function x1() external view returns (uint256 amount) {
        try MockGasBurner(payable(address(this))).x1WithRevert() {}
        catch (bytes memory reason) {
            amount = parseRevertReason(reason);
        }
    }

    function x1WithRevert() external pure {
        revert();
    }

    function x2() external view returns (uint256 amount) {
        try MockGasBurner(payable(address(this))).x2WithRevert() {}
        catch (bytes memory reason) {
            amount = parseRevertReason(reason);
        }
    }

    function x2WithRevert() external pure {
        revert Errors.AmountZero();
    }

    function x3() external view returns (uint256 amount) {
        try MockGasBurner(payable(address(this))).x3WithRevert() {}
        catch (bytes memory reason) {
            amount = parseRevertReason(reason);
        }
    }

    function x3WithRevert() external pure {
        revert("generic error");
    }

    function x4() external view returns (uint256 amount) {
        try MockGasBurner(payable(address(this))).x4WithRevert() {}
        catch (bytes memory reason) {
            amount = parseRevertReason(reason);
        }
    }

    function x4WithRevert() external pure {
        revert Errors.RevertForAmount(5);
    }
}
