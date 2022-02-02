//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "../BaseValidator.sol";
import "@openzeppelin/contracts/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/contracts/utils/Strings.sol";

/**
 * @dev A Validator mixin that sends ERC20 tokens from an allowance.
 */
abstract contract ERC20TransferExecutor is BaseValidator {
    using Strings for uint256;

    function tokenInfo(bytes calldata data) public virtual view returns(address token, address sender, uint256 amount);

    function claim(address beneficiary, bytes calldata data, bytes calldata authsig, bytes calldata claimsig) public override virtual returns(address issuer, address claimant) {
        (issuer, claimant) = super.claim(beneficiary, data, authsig, claimsig);
        (address token, address sender, uint256 amount) = tokenInfo(data);
        require(IERC20(token).transferFrom(sender, beneficiary, amount), "Transfer failed");
    }

    function isExecutable(address issuer, address claimant, bytes calldata data) public override virtual view returns(bool) {
        (address token, address sender, uint256 amount) = tokenInfo(data);
        uint256 allowance = IERC20(token).allowance(sender, address(this));
        return allowance >= amount && super.isExecutable(issuer, claimant, data);
    }

    function metadata(address /*issuer*/, address /*claimant*/, bytes calldata claimData) public override virtual view returns(string memory) {
        (address token,, uint256 amount) = tokenInfo(claimData);
        string memory symbol = IERC20Metadata(token).symbol();

        return string(abi.encodePacked(
            "{\"valid\":true,\"data\":{\"title\": \"$",
            symbol,
            " token transfer\", \"tokentype\":20,\"token\":\"",
            uint256(uint160(token)).toHexString(20),
            "\",\"amount\":\"",
            amount.toString(),
            "\"}}"
        ));
    }
}
