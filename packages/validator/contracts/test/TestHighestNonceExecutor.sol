//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "../HighestNonceExecutor.sol";
/**
 * @dev Test implementation of a HighestNonceExecutor that just logs the fact it was called.
 */
contract TestHighestNonceExecutor is HighestNonceExecutor {
    event Claimed(address issuer, address beneficiary, bytes claimData);

    constructor(address _validator) HighestNonceExecutor(_validator) { }

    /**
     * @dev Executes a claim that has been verified by the `ValidatorRegistry`. Implementers must check that this function
     *      was called by a registry they recognise, and that any conditions in claimData such as replay protection are met
     *      before acting on the request.
     * @param issuer The account that issued the claim.
     * @param claimant The account that is entitled to make the claim.
     * @param beneficiary The account that the claim should benefit.
     * @param claimData Claim data provided by the issuer.
     */
    function executeClaim(address issuer, address claimant, address beneficiary, bytes calldata claimData) public override {
        super.executeClaim(issuer, claimant, beneficiary, claimData);
        emit Claimed(issuer, beneficiary, claimData);
    }

    /**
     * @dev Returns metadata explaining a claim.
     * @param issuer The address of the issuer.
     * @param claimant The account that is entitled to make the claim.
     * @param claimData Claim data provided by the issuer.
     * @return A URL that resolves to JSON metadata as described in the spec.
     *         Callers must support at least 'data' and 'https' schemes.
     */
    function metadata(address issuer, address claimant, bytes calldata claimData) public override virtual view returns(string memory) {
        string memory ret = super.metadata(issuer, claimant, claimData);
        if(bytes(ret).length > 0) {
            return ret;
        }
        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode("{\"valid\":true,\"data\":{\"title\":\"Emit an event\"}}")
        ));
    }
}
