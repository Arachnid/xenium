// SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {
    constructor() ERC20("Test", "TEST") {
        _mint(msg.sender, 1e20);
    }
}