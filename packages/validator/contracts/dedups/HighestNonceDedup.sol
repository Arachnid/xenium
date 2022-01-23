//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "../BaseValidator.sol";
import "@openzeppelin/contracts/contracts/utils/Base64.sol";

/**
 * @dev An implementation of a Validator that requires a nonce in the first 32 bytes of the data field, and
 *      only allows claims that have a higher nonce than previously seen to execute.
 */
abstract contract HighestNonceDedup is BaseValidator {
    mapping(address=>uint256) public nonce;

    error NonceTooLow();

    function claim(address beneficiary, bytes calldata data, bytes calldata authsig, bytes calldata claimsig) public override virtual returns(address issuer, address claimant) {
        (issuer, claimant) = super.claim(beneficiary, data, authsig, claimsig);
        uint64 claimNonce = abi.decode(data, (uint64));
        if(claimNonce < nonce[issuer]) {
            revert NonceTooLow();
        }
        nonce[issuer] = claimNonce + 1;
    }

    function metadata(address issuer, address claimant, bytes calldata claimData) public override virtual view returns(string memory) {
        string memory ret = super.metadata(issuer, claimant, claimData);
        if(bytes(ret).length > 0) {
            return ret;
        }

        uint64 claimNonce = abi.decode(claimData, (uint64));
        if(claimNonce < nonce[issuer]) {
            return string(abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode("{\"valid\":false,\"error\":\"Nonce too low.\"}")
            ));
        }
        return "";
    }
}
