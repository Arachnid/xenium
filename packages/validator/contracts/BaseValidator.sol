//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/contracts/utils/Base64.sol";
import "./ValidatorLib.sol";
import "./IValidator.sol";

abstract contract BaseValidator is IValidator, ERC165 {
    error UnauthorisedIssuer(address issuer);

    function isIssuer(address issuer) internal virtual view returns(bool);

    function claim(address beneficiary, bytes calldata data, bytes calldata authsig, bytes calldata claimsig) public override virtual returns(address issuer, address claimant) {
        (issuer, claimant) = ValidatorLib.validate(address(this), beneficiary, data, authsig, claimsig);
        if(!isIssuer(issuer)) {
            revert UnauthorisedIssuer(issuer);
        }
        emit ClaimExecuted(keccak256(authsig), issuer, beneficiary, data, authsig, claimsig);
    }

    function isExecutable(address issuer, address /*claimant*/, bytes calldata /*data*/) public virtual view returns(bool) {
        return isIssuer(issuer);
    }
}
