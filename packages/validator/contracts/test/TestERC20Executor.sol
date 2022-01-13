//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "../ERC20Executor.sol";
import "../SingleClaimantExecutor.sol";
import "@openzeppelin/contracts/contracts/utils/Base64.sol";
/**
 * @dev Test implementation of a ERC20Executor that just logs the fact it was called.
 */
contract TestERC20Executor is SingleClaimantExecutor, ERC20Executor {

    constructor(address _validator) SingleClaimantExecutor(_validator) ERC20Executor(_validator) { }

    /**
     * @dev Executes a claim that has been verified by the `ValidatorRegistry`. Implementers must check that this function
     *      was called by a registry they recognise, and that any conditions in claimData such as replay protection are met
     *      before acting on the request.
     * @param issuer The account that issued the claim.
     * @param claimant The account that is entitled to make the claim.
     * @param beneficiary The account that the claim should benefit.
     * @param claimData Claim data provided by the issuer.
     */
    function executeClaim(address issuer, address claimant, address beneficiary, bytes calldata claimData) public override(SingleClaimantExecutor, ERC20Executor)  {
        super.executeClaim(issuer, claimant, beneficiary, claimData);
    }

    
    
    /**
     * @dev Returns metadata explaining a claim.
     * @param issuer The address of the issuer.
     * @param claimant The account that is entitled to make the claim.
     * @param claimData Claim data provided by the issuer.
     * @return A URL that resolves to JSON metadata as described in the spec.
     *         Callers must support at least 'data' and 'https' schemes.
     */
    function metadata(address issuer, address claimant, bytes calldata claimData) public override(SingleClaimantExecutor, ERC20Executor) view returns(string memory) {
        string memory ret = SingleClaimantExecutor.metadata(issuer, claimant, claimData);
        if(bytes(ret).length > 0) {
            return ret;
        }
        ret = ERC20Executor.metadata(issuer, claimant, claimData);
        if(bytes(ret).length > 0) {
            return ret;
        }        
        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode("{\"valid\":true,\"data\":{\"title\":\"Emit an event\"}}")
        ));
    }
}
