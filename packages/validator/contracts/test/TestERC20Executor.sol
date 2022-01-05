//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "../ERC20Executor.sol";
import "@openzeppelin/contracts/contracts/utils/Base64.sol";
/**
 * @dev Test implementation of a ERC20Executor that just logs the fact it was called.
 */
contract TestERC20Executor is ERC20Executor {

    constructor(address _validator) ERC20Executor(_validator) { }

    /**
     * @dev Executes a claim that has been verified by the `ValidatorRegistry`. Implementers must check that this function
     *      was called by a registry they recognise, and that any conditions in claimData such as replay protection are met
     *      before acting on the request.
     * @param issuer The account that issued the claim.
     * @param beneficiary The account that the claim should benefit.
     * @param claimData Claim data provided by the issuer.
     * @param executorData Contextual information stored on the ValidatorRegistry for this issuer.
     */
    function executeClaim(address issuer, address beneficiary, bytes calldata claimData, bytes calldata executorData) public override {
        super.executeClaim(issuer, beneficiary, claimData, executorData);
    }

    
    
    /**
     * @dev Returns metadata explaining a claim.
     * @param issuer The address of the issuer.
     * @param claimData Claim data provided by the issuer.
     * @param executorData Contextual information stored on the ValidatorRegistry for this issuer.
     * @return A URL that resolves to JSON metadata as described in the spec.
     *         Callers must support at least 'data' and 'https' schemes.
     */
    function metadata(address issuer, bytes calldata claimData, bytes calldata executorData) public override virtual view returns(string memory) {
        string memory ret = super.metadata(issuer, claimData, executorData);
        if(bytes(ret).length > 0) {
            return ret;
        }
        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode("{\"valid\":true,\"data\":{\"title\":\"Emit an event\"}}")
        ));
    }
}
