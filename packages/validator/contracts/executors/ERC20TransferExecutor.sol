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

    function tokenInfo(bytes calldata data) internal virtual view returns(address token, address sender, uint256 amount);

    function claim(address beneficiary, bytes calldata data, bytes calldata authsig, bytes calldata claimsig) public override virtual returns(address issuer, address claimant) {
        (issuer, claimant) = super.claim(beneficiary, data, authsig, claimsig);
        (address token, address sender, uint256 amount) = tokenInfo(data);
        require(IERC20(token).transferFrom(sender, beneficiary, amount), "Transfer failed");
    }

    function metadata(address issuer, address claimant, bytes calldata claimData) public override virtual view returns(string memory) {
        string memory ret = super.metadata(issuer, claimant, claimData);
        if(bytes(ret).length > 0) {
            return ret;
        }

        (address token, address sender, uint256 amount) = tokenInfo(claimData);
        uint256 allowance = IERC20(token).allowance(sender, address(this));
        string memory symbol = IERC20Metadata(token).symbol();
        if(allowance < amount) {
            return string(abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode("{\"valid\":false,\"error\":\"Insufficient balance.\"}")
            ));
        }

        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(abi.encodePacked(
                "{\"valid\":true,\"data\":{\"title\": \"$",
                symbol,
                " token transfer\", \"tokentype\":20,\"token\":\"",
                uint256(uint160(token)).toHexString(20),
                "\",\"amount\":\"",
                amount.toString(),
                "\"}}"
            ))
        ));
    }
}
