//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "./IExecutor.sol";
import "@openzeppelin/contracts/contracts/utils/introspection/ERC165.sol";

/**
 * @dev An abstract implementation of an Executor that only allows claims that have a higher nonce than previously seen to execute.
 *      To use, subclass and override `executeClaim` and `metadata`, being sure to call `super` inside `executeClaim` before doing anything else.
 *      This executor expects the first 4 bytes of `claimData` to be the nonce; you may optionally use extra data for your own purposes.
 */
abstract contract BaseExecutor is IExecutor, ERC165 {
    address public immutable validator;
    address public issuer;
    address public owner;
    bytes public configData;        
        
    error NotAuthorisedError();
    error NotConfiguredError();    
    error NotImplementedError();

    constructor(address _validator) {
        validator = _validator;
    }

    modifier validatorOnly {
        if(msg.sender != validator) {
            revert NotAuthorisedError();
        }
        _;
    }
    
    modifier issuerOnly(address _issuer) {
      if (issuer == address(0)) {
        revert NotConfiguredError();
      }
      
      if(issuer != _issuer) {
        revert NotAuthorisedError();
      }
      _;
    }

    modifier ownerOnly(address _owner) {
      if (owner == address(0)) {
        revert NotConfiguredError();
      }
      
      if(owner != _owner) {
        revert NotAuthorisedError();
      }
      _;
    }
    
    function executeClaim(address _issuer, address /*claimant*/, address /*beneficiary*/, bytes calldata /*claimData*/) public virtual override validatorOnly issuerOnly(_issuer) {
    }

    function supportsInterface(bytes4 interfaceId) public view override(IERC165, ERC165) returns(bool) {
        return interfaceId == type(IExecutor).interfaceId || super.supportsInterface(interfaceId);
    }

    function metadata(address /*issuer*/, address /*claimant*/, bytes calldata /*claimData*/) public override virtual view returns(string memory) {
        revert NotImplementedError();
    }

    function configure(address _issuer, address _owner, bytes calldata _data) public virtual override validatorOnly {
      issuer = _issuer;
      owner = _owner;
      configData = _data;
    }
}
