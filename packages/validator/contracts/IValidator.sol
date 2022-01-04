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
     */
    function claim(address beneficiary, bytes calldata data, bytes calldata authsig, bytes calldata claimsig) external;

    /**
     * @dev Returns metadata explaining a claim.
     * @param issuer The address of the issuer.
     * @param data Claim data provided by the issuer.
     * @return A URL that resolves to JSON metadata as described in the spec.
     *         Callers must support at least 'data' and 'https' schemes.
     */
    function metadata(address issuer, bytes calldata data) external view returns(string memory);
}
