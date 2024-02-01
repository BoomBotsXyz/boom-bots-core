// SPDX-License-Identifier: none
pragma solidity 0.8.19;

import { IERC721ReceiverModule } from "./../interfaces/modules/IERC721ReceiverModule.sol";
import { ERC6551AccountLibrary } from "./../libraries/modules/ERC6551AccountLibrary.sol";
import { Errors } from "./../libraries/Errors.sol";


/**
 * @title ERC721ReceiverModule
 * @author Blue Matter Tehcnologies
 * @notice A module that allows a contract to receive an ERC721 token.
 */
contract ERC721ReceiverModule is IERC721ReceiverModule {

    /**
     * @notice This function is called whenever an ERC721 is transferred to this contract via `safeTransferFrom`.
     * This function accepts all ERC721s.
     * @param operator The account that initiated the transfer.
     * @param from The account that the token is being transferred from.
     * @param tokenId The id of the token being transferred.
     * @param data Arbitrary data.
     * @return magicValue The magic value to confirm success.
     */
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external payable override returns (bytes4 magicValue) {
        (uint256 chainId, address tokenContract, uint256 _tokenId) = ERC6551AccountLibrary.token();
        if (msg.sender == tokenContract && tokenId == _tokenId && chainId == block.chainid) {
            revert Errors.OwnershipCycle();
        }
        magicValue = this.onERC721Received.selector;
    }
}
