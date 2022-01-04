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

    error NotAuthorisedError();
    error NotImplementedError();

    constructor(address _validator) {
        validator = _validator;
    }

    function executeClaim(address /*issuer*/, address /*beneficiary*/, bytes calldata /*claimData*/, bytes calldata /*executorData*/) public virtual override {
        if(msg.sender != validator) {
            revert NotAuthorisedError();
        }
    }

    function supportsInterface(bytes4 interfaceId) public view override(IERC165, ERC165) returns(bool) {
        return interfaceId == type(IExecutor).interfaceId || super.supportsInterface(interfaceId);
    }

    function metadata(address /*issuer*/, bytes calldata /*claimData*/, bytes calldata /*executorData*/) public override virtual view returns(string memory) {
        revert NotImplementedError();
    }
}
