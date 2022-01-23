//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "../executors/ERC20TransferExecutor.sol";
import "../dedups/UniqueNonceDedup.sol";
import "../auths/IssuerWhitelistAuth.sol";
import "clones-with-immutable-args/ClonesWithImmutableArgs.sol";
import "clones-with-immutable-args/Clone.sol";

contract ERC20TransferUniqueNonceValidator is UniqueNonceDedup, IssuerWhitelistAuth, ERC20TransferExecutor, Clone {
    address immutable template;

    error DelegatecallOnly();

    constructor() {
        template = address(this);
    }

    modifier delegatecallOnly() {
        if(address(this) == template) {
            revert DelegatecallOnly();
        }
        _;
    }

    function isOwner(address _owner) public virtual override view delegatecallOnly returns(bool) {
        return _owner == _getArgAddress(0) || _owner == _getArgAddress(20);
    }

    function owner() external view returns(address) {
        return _getArgAddress(20);
    }

    function tokenInfo(bytes calldata /*data*/) public virtual override view returns(address token, address sender, uint256 amount) {
        return (_getArgAddress(40), _getArgAddress(60), _getArgUint256(80));
    }

    function claim(address beneficiary, bytes calldata data, bytes calldata authsig, bytes calldata claimsig) public override(UniqueNonceDedup, ERC20TransferExecutor, BaseValidator) delegatecallOnly returns(address issuer, address claimant) {
        return super.claim(beneficiary, data, authsig, claimsig);
    }

    function metadata(address issuer, address claimant, bytes calldata claimData) public override(UniqueNonceDedup, ERC20TransferExecutor, BaseValidator) virtual view returns(string memory) {
        return super.metadata(issuer, claimant, claimData);
    }
}

contract ERC20TransferUniqueNonceValidatorFactory {
    using ClonesWithImmutableArgs for address;

    event Cloned(address creator, uint256 nonce, address instance);

    ERC20TransferUniqueNonceValidator immutable public implementation;

    constructor() {
        implementation = new ERC20TransferUniqueNonceValidator();
    }

    function create(uint256 nonce, address owner, address token, address sender, uint256 amount, address[] memory issuers) external returns(ERC20TransferUniqueNonceValidator) {
        bytes memory data = abi.encodePacked(address(this), owner, token, sender, amount);
        ERC20TransferUniqueNonceValidator instance = ERC20TransferUniqueNonceValidator(address(implementation).clone(data));
        instance.addIssuers(issuers);
        emit Cloned(msg.sender, nonce, address(instance));
        return instance;
    }
}
