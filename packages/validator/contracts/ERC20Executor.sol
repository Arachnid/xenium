//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "./SingleClaimantExecutor.sol";
import "@openzeppelin/contracts/contracts/token/ERC20/IERC20.sol";

/**
 * @dev An abstract implementation of an Executor that only allows claims that have a higher nonce than previously seen to execute.
 *      To use, subclass and override `executeClaim` and `metadata`, being sure to call `super` inside `executeClaim` before doing anything else.
 *      This executor expects the first 32 bytes of `claimData` to be the nonce; you may optionally use extra data for your own purposes.
 */
abstract contract ERC20Executor is SingleClaimantExecutor {
    event ClaimedERC20(address issuer, address from, address beneficiary, address token, uint256 amount, uint256 expiration);
    
    error ClaimCodeExpired();

    constructor(address _validator) SingleClaimantExecutor(_validator) { }
  
    /**
     * @dev Executes a claim that has been verified by the `ValidatorRegistry`. Implementers must check that this function
     *      was called by a registry they recognise, and that any conditions in claimData such as replay protection are met
     *      before acting on the request.
     * @param issuer The account that issued the claim.
     * @param claimant The account that is entitled to make the claim.
     * @param beneficiary The account that the claim should benefit.
     * @param claimData Claim data provided by the issuer.
     */
    function executeClaim(address issuer, address claimant, address beneficiary, bytes calldata claimData) public virtual override {
        super.executeClaim(issuer, claimant, beneficiary, claimData);
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
        (
         /*address from*/,
         /*address token*/,
         /*uint256 amount*/,
         uint256 expiration) = abi.decode(claimData, (address, address, uint256, uint256));
        if (block.timestamp > expiration) {
            return string(abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode("{\"valid\":false,\"error\":\"Code has expired.\"}")
            ));
        }
        return ""; 
    }
}
