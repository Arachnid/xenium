//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "./SingleClaimantExecutor.sol";
import "@openzeppelin/contracts/contracts/token/ERC20/IERC20.sol";

/**
 * @dev An abstract implementation of an Executor that only allows claims that have a higher nonce than previously seen to execute.
 *      To use, subclass and override `executeClaim` and `metadata`, being sure to call `super` inside `executeClaim` before doing anything else.
 *      This executor expects the first 32 bytes of `claimData` to be the nonce; you may optionally use extra data for your own purposes.
 */
abstract contract ERC20Executor is BaseExecutor {
    event ClaimedERC20(address issuer, address from, address beneficiary, address token, uint256 amount);
    
    error ClaimCodeExpired();    
    
    constructor(address _validator) { }
  
    /**
     * @dev Executes a claim that has been verified by the `ValidatorRegistry`. Implementers must check that this function
     *      was called by a registry they recognise, and that any conditions in claimData such as replay protection are met
     *      before acting on the request.
     * @param _issuer The account that issued the claim.
     * @param _claimant The account that is entitled to make the claim.
     * @param _beneficiary The account that the claim should benefit.
     * @param _claimData Claim data provided by the issuer.
     */
    function executeClaim(address _issuer, address _claimant, address _beneficiary, bytes calldata _claimData) public virtual override {
        super.executeClaim(_issuer, _claimant, _beneficiary, _claimData);
        (
         address token,
         uint256 amount,
         uint256 expiration) = abi.decode(configData, (address, uint256, uint256));

        if (block.timestamp > expiration) {
          revert ClaimCodeExpired();
        }
        IERC20(token).transferFrom(owner, _beneficiary, amount);
        
        emit ClaimedERC20(_issuer, owner, _beneficiary, token, amount);
    }

    /**
     * @dev Returns metadata explaining a claim. Subclasses should call this first and return it if it is nonempty.
     * @return A URL that resolves to JSON metadata as described in the spec.
     *         Callers must support at least 'data' and 'https' schemes.
     */
    function metadata(address /*_issuer*/, address /*_claimant*/, bytes calldata /*_claimData*/) public override virtual view returns(string memory) {
        (
         /*address token*/,
         /*uint256 amount*/,
         uint256 expiration) = abi.decode(configData, (address, uint256, uint256));
        if (block.timestamp > expiration) {
            return string(abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode("{\"valid\":false,\"error\":\"Code has expired.\"}")
            ));
        }
        return ""; 
    }
}
