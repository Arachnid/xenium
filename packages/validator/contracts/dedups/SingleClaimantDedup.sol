//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "../BaseValidator.sol";
import "@openzeppelin/contracts/contracts/utils/Base64.sol";

/**
 * @dev An implementation of a Validator that only allows claims with unique clamaints. 
 */
abstract contract SingleClaimantDedup is BaseValidator {

    // claimant -> beneficiary
    mapping (address => address) public claimants;
    
    error AlreadyClaimed();

    function claim(address beneficiary, bytes calldata data, bytes calldata authsig, bytes calldata claimsig) public override virtual returns(address issuer, address claimant) {
        (issuer, claimant) = super.claim(beneficiary, data, authsig, claimsig);

        // if claimant was already used
        if(claimants[claimant] != address(0)) {
            revert AlreadyClaimed();
        }
        claimants[claimant] = beneficiary;
    }

    function metadata(address issuer, address claimant, bytes calldata claimData) public override virtual view returns(string memory) {
      string memory ret = super.metadata(issuer, claimant, claimData);
      if(bytes(ret).length > 0) {
        return ret;
      }
      if(claimants[claimant] != address(0)) {
        return string(abi.encodePacked(
                                       "data:application/json;base64,",
                                       Base64.encode("{\"valid\":false,\"error\":\"Code already claimed..\"}")
                                       ));
      }
      return "";
    }    
}
