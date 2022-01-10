//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "./BaseExecutor.sol";
import "@openzeppelin/contracts/contracts/token/ERC20/IERC20.sol";
/* import "@openzeppelin/contracts/contracts/utils/introspection/ERC165.sol"; */
/* import "@openzeppelin/contracts/contracts/utils/Base64.sol"; */

/**
 * @dev An abstract implementation of an Executor that only allows claims that have a higher nonce than previously seen to execute.
 *      To use, subclass and override `executeClaim` and `metadata`, being sure to call `super` inside `executeClaim` before doing anything else.
 *      This executor expects the first 32 bytes of `claimData` to be the nonce; you may optionally use extra data for your own purposes.
 */
abstract contract ERC20Executor is BaseExecutor {
  event ClaimedERC20(address issuer, address from, address beneficiary, address token, uint256 amount, uint256 expiration);  
    // uint64 public nonce;

    error ClaimCodeExpired();

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
        (
         address from,
         address token,
         uint256 amount,
         uint256 expiration) = abi.decode(claimData, (address, address, uint256, uint256));

        if (block.timestamp > expiration) {
          revert ClaimCodeExpired();
        }
        IERC20(token).transferFrom(from, beneficiary, amount);
        
        emit ClaimedERC20(issuer, from, beneficiary, token, amount, expiration);
    }

    /**
     * @dev Returns metadata explaining a claim. Subclasses should call this first and return it if it is nonempty.
     * @param claimData Claim data provided by the issuer.
     * @return A URL that resolves to JSON metadata as described in the spec.
     *         Callers must support at least 'data' and 'https' schemes.
     */
    function metadata(address /*issuer*/, address /*claimant*/, bytes calldata claimData, bytes calldata /*executorData*/) public override virtual view returns(string memory) {
        /* uint64 claimNonce = abi.decode(claimData, (uint64)); */
        /* if(claimNonce < nonce) { */
        /*     return string(abi.encodePacked( */
        /*         "data:application/json;base64,", */
        /*         Base64.encode("{\"valid\":false,\"error\":\"Nonce too low.\"}") */
        /*     )); */
        /* } */
        return ""; 
    }
}
