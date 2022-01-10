//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "./BaseExecutor.sol";
import "@openzeppelin/contracts/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/contracts/utils/Base64.sol";

/**
 * @dev An abstract implementation of an Executor that only allows claims with unique clamaints. 
 *      To use, subclass and override `executeClaim` and `metadata`, being sure to call `super` inside `executeClaim` before doing anything else.
 */
abstract contract SingleClaimantExecutor is BaseExecutor {

    // claimant -> beneficiary
    mapping (address => address) public claimants;
    
    error AlreadyClaimed();

    constructor(address _validator) BaseExecutor(_validator) { }

    /**
     * @dev Executes a claim that has been verified by the `ValidatorRegistry`. Implementers must check that this function
     *      was called by a registry they recognise, and that any conditions in claimData such as replay protection are met
     *      before acting on the request.
     * @param issuer The account that issued the claim.
     * @param claimant The account that is entitled to make the claim.
     * @param beneficiary The account that the claim should benefit.
     * @param claimData Claim data provided by the issuer.
     * @param executorData Contextual information stored on the ValidatorRegistry for this issuer.
     */
    function executeClaim(address issuer, address claimant, address beneficiary, bytes calldata claimData, bytes calldata executorData) public virtual override {
        super.executeClaim(issuer, claimant, beneficiary, claimData, executorData);

        // if claimant was already used
        if(claimants[claimant] != address(0)) {
            revert AlreadyClaimed();
        }
        claimants[claimant] = beneficiary;
    }

    /**
     * @dev Returns metadata explaining a claim. Subclasses should call this first and return it if it is nonempty.
     * @param claimant The account that is entitled to make the claim.
     * @return A URL that resolves to JSON metadata as described in the spec.
     *         Callers must support at least 'data' and 'https' schemes.
     */
    function metadata(address /*issuer*/, address claimant, bytes calldata /*claimData*/, bytes calldata /*executorData*/) public override virtual view returns(string memory) {
      if(claimants[claimant] != address(0)) {
        return string(abi.encodePacked(
                                       "data:application/json;base64,",
                                       Base64.encode("{\"valid\":false,\"error\":\"Code already claimed..\"}")
                                       ));
      }
      return "";
    }    
}
