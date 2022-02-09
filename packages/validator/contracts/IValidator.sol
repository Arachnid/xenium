//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/contracts/utils/introspection/IERC165.sol";

/**
 * @dev Interface for a Shibboleth validator.
 *      Shibboleth validators are responsible for verifying and acting on single-use claim codes issued by offchain authorities.
 */
interface IValidator is IERC165 {
    /**
     * @dev Executes a claim transaction as specified in https://gist.github.com/Arachnid/df9c7e3738ee76bf171c46ef38e4f18b
     * @param beneficiary The address that the claim should benefit.
     * @param data Claim data provided by the issuer.
     * @param authsig A signature over the authorisation message, produced by the issuer.
     * @param claimsig A signature over the claim message, produced by the client.
     * @return issuer The address of the issuer for this claim.
     * @return claimant The address of the claimant for this claim.
     */
    function claim(address beneficiary, bytes calldata data, bytes calldata authsig, bytes calldata claimsig) external returns(address issuer, address claimant);

    /**
     * @dev Indicates if a claim can be executed or not.
     * @param issuer The address of the issuer.
     * @param claimant The account that is entitled to make the claim.
     * @param data Claim data provided by the issuer.
     * @return True iff a call to claim() would succeed, false otherwise.
     */
    function isExecutable(address issuer, address claimant, bytes calldata data) external view returns(bool);

    /**
     * @dev Returns metadata explaining a claim.
     * @param issuer The address of the issuer.
     * @param claimant The account that is entitled to make the claim.
     * @param data Claim data provided by the issuer.
     * @return CBOR-encoded metadata as described in the spec.
     */
    function metadata(address issuer, address claimant, bytes calldata data) external view returns(bytes memory);
    
    event ClaimExecuted(bytes32 indexed claimId, address indexed issuer, address beneficiary, bytes metadata);
}
