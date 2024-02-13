// SPDX-License-Identifier: none
pragma solidity 0.8.19;

import { Calls } from "./../../libraries/Calls.sol";


contract MockBlast {

    mapping(address => bool) internal _isConfigured;

    function configureAutomaticYield() external {}

    function configureClaimableGas() external {
        _isConfigured[msg.sender] = true;
    }

    function claimAllGas(address contractAddress, address recipientOfGas) external returns (uint256) {
        if(contractAddress != msg.sender) return 0;
        if(!_isConfigured[msg.sender]) return 0;
        uint256 amount = 2255; // wei
        //Calls.sendValue(recipientOfGas, amount);
        return amount;
    }

    function claimMaxGas(address contractAddress, address recipientOfGas) external returns (uint256) {
        if(contractAddress != msg.sender) return 0;
        if(!_isConfigured[msg.sender]) return 0;
        uint256 amount = 1500; // wei
        //Calls.sendValue(recipientOfGas, amount);
        return amount;
    }

    receive() external payable {}
}
