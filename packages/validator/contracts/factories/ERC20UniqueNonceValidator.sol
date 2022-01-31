//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "../executors/ERC20Executor.sol";
import "../dedups/UniqueNonceDedup.sol";
import "../auths/IssuerWhitelistAuth.sol";
import "clones-with-immutable-args/ClonesWithImmutableArgs.sol";
import "clones-with-immutable-args/Clone.sol";

contract ERC20UniqueNonceValidator is UniqueNonceDedup, IssuerWhitelistAuth, ERC20Executor, Clone {
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

    function owner() external view delegatecallOnly returns(address) {
        return _getArgAddress(20);
    }

    function tokenInfo(bytes calldata /*data*/) public virtual override view delegatecallOnly returns(address token, uint256 amount) {
        return (_getArgAddress(40), _getArgUint256(60));
    }

    function isExecutable(address issuer, address claimant, bytes calldata data) public override(ERC20Executor, UniqueNonceDedup, BaseValidator) virtual view returns(bool) {
        return super.isExecutable(issuer, claimant, data);
    }

    function claim(address beneficiary, bytes calldata data, bytes calldata authsig, bytes calldata claimsig) public override(UniqueNonceDedup, ERC20Executor, BaseValidator) delegatecallOnly returns(address issuer, address claimant) {
        return super.claim(beneficiary, data, authsig, claimsig);
    }

    function metadata(address issuer, address claimant, bytes calldata claimData) public override(ERC20Executor, IValidator) virtual view returns(string memory) {
        return super.metadata(issuer, claimant, claimData);
    }
}

contract ERC20UniqueNonceValidatorFactory {
    using ClonesWithImmutableArgs for address;

    event Cloned(address indexed creator, uint256 indexed nonce, address instance, address owner, address token, uint256 amount);

    ERC20UniqueNonceValidator immutable public implementation;

    constructor() {
        implementation = new ERC20UniqueNonceValidator();
    }

    function create(uint256 nonce, address owner, address token, uint256 amount, address[] memory issuers) external returns(ERC20UniqueNonceValidator) {
        bytes memory data = abi.encodePacked(address(this), owner, token, amount);
        ERC20UniqueNonceValidator instance = ERC20UniqueNonceValidator(address(implementation).clone(data));
        instance.addIssuers(issuers);
        emit Cloned(msg.sender, nonce, address(instance), owner, token, amount);
        return instance;
    }
}
