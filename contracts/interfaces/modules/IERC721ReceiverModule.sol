// SPDX-License-Identifier: none
pragma solidity 0.8.19;


/**
 * @title IERC721ReceiverModule
 * @author Blue Matter Technologies
 * @notice A module that allows a contract to receive an ERC721 token.
 */
interface IERC721ReceiverModule {

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
    ) external payable returns (bytes4 magicValue);
}
