//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "./ERC20TransferExecutor.sol";
import "./HighestNonceDedup.sol";
import "./IssuerWhitelistAuth.sol";
import "./ClonesWithImmutableArgs.sol";
import "./Clone.sol";

contract ERC20TransferUniqueNonceValidator is ERC20TransferExecutor, HighestNonceDedup, IssuerWhitelistAuth, Clone {
    function isOwner(address owner) public virtual override view returns(bool) {
        return owner == _getArgAddress(0);
    }

    function tokenInfo(bytes calldata /*data*/) internal virtual override view returns(address token, address sender, uint256 amount) {
        return (_getArgAddress(20), _getArgAddress(40), _getArgUint256(60));
    }

    function claim(address beneficiary, bytes calldata data, bytes calldata authsig, bytes calldata claimsig) public override(ERC20TransferExecutor, HighestNonceDedup, BaseValidator) returns(address issuer, address claimant) {
        return super.claim(beneficiary, data, authsig, claimsig);
    }

    function metadata(address issuer, address claimant, bytes calldata claimData) public override(ERC20TransferExecutor, HighestNonceDedup, BaseValidator) virtual view returns(string memory) {
        return super.metadata(issuer, claimant, claimData);
    }
}

contract ERC20TransferUniqueNonceValidatorFactory {
    using ClonesWithImmutableArgs for address;

    ERC20TransferUniqueNonceValidator immutable public implementation;

    constructor() {
        implementation = new ERC20TransferUniqueNonceValidator();
    }

    function create(address owner, address token, address sender, uint256 amount) external returns(ERC20TransferUniqueNonceValidator) {
        bytes memory data = abi.encodePacked(owner, token, sender, amount);
        return ERC20TransferUniqueNonceValidator(address(implementation).clone(data));
    }
}
