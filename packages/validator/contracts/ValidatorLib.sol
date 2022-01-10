//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/contracts/utils/cryptography/ECDSA.sol";

library ValidatorLib {
  function validate(address validator, address beneficiary, bytes calldata data, bytes calldata authsig, bytes calldata claimsig) internal pure returns(address, address) {
        bytes32 claimhash = keccak256(abi.encodePacked(
            hex"1900",
            validator,
            hex"80",
            keccak256(authsig),
            beneficiary
        ));
        address claimant = ECDSA.recover(claimhash, claimsig);
        bytes32 authhash = keccak256(abi.encodePacked(
            hex"1900",
            validator,
            hex"00",
            keccak256(data),
            claimant
        ));
        address issuer = ECDSA.recover(authhash, authsig);
        return (issuer, claimant);
    }
}
