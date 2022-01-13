//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/contracts/token/ERC20/ERC20.sol";

contract ERC20Mock is ERC20 {

    // =================================================================================================================
    //                                         ERC20 Token Mock
    // =================================================================================================================
    // Mint tokens to deployer
    constructor() ERC20("Mock Token", "MOCK") {
        _mint(msg.sender, 10**24);
    }
    
    // Faucet function to get free tokens
    function faucet(address to, uint amount) external {
        _mint(to, amount);
    }    
}
