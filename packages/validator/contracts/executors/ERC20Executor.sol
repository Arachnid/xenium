//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "../BaseValidator.sol";
import "@openzeppelin/contracts/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/contracts/utils/Base64.sol";
import "@ensdomains/buffer/contracts/Buffer.sol";
import "solidity-cborutils/contracts/CBOR.sol";

/**
 * @dev A Validator mixin that sends ERC20 tokens from an allowance.
 */
abstract contract ERC20Executor is BaseValidator {
    using CBOR for Buffer.buffer;

    function tokenInfo(bytes calldata data) public virtual view returns(address token, uint256 amount);

    function claim(address beneficiary, bytes calldata data, bytes calldata authsig, bytes calldata claimsig) public override virtual returns(address issuer, address claimant) {
        (issuer, claimant) = super.claim(beneficiary, data, authsig, claimsig);
        (address token, uint256 amount) = tokenInfo(data);
        require(IERC20(token).transfer(beneficiary, amount), "Transfer failed");
    }

    function transfer(address token, address to, uint256 amount) external ownerOnly {
        IERC20(token).transfer(to, amount);
    }

    function isExecutable(address issuer, address claimant, bytes calldata data) public override virtual view returns(bool) {
        (address token, uint256 amount) = tokenInfo(data);
        return IERC20(token).balanceOf(address(this)) >= amount
            && super.isExecutable(issuer, claimant, data);
    }

    function metadata(address /*issuer*/, address /*claimant*/, bytes calldata claimData) public override virtual view returns(bytes memory) {
        Buffer.buffer memory buf;
        Buffer.init(buf, 256);

        (address token, uint256 amount) = tokenInfo(claimData);
        string memory symbol = IERC20Metadata(token).symbol();

        buf.startMap();
        buf.encodeString("title");
        buf.encodeString(string(abi.encodePacked("$", symbol, " token transfer")));
        buf.encodeString("token");
        buf.encodeBytes(abi.encodePacked(token));
        buf.encodeString("tokentype");
        buf.encodeUInt(20);
        buf.encodeString("amount");
        buf.encodeUInt(amount);
        buf.endSequence();
        return buf.buf;
    }
}
