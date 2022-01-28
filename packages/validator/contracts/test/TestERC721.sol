//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/contracts/token/ERC721/ERC721.sol";

contract TestERC721 is ERC721 {
  constructor() ERC721("Test NFT", "TEST") {
        for (uint i = 0; i < 10; i++) {
            super._mint(msg.sender, i);
        }
    }
}
