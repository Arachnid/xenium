//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "../executors/ERC721TransferExecutor.sol";
import "../dedups/UniqueNonceDedup.sol";
import "../auths/IssuerWhitelistAuth.sol";
import "clones-with-immutable-args/ClonesWithImmutableArgs.sol";
import "clones-with-immutable-args/Clone.sol";

contract ERC721TransferUniqueNonceValidator is UniqueNonceDedup, IssuerWhitelistAuth, ERC721TransferExecutor, Clone {
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

    function tokenInfo(bytes calldata /*data*/) public virtual override view returns(address token, address sender, uint256[] memory tokenids) {
      uint64 arraylength = _getArgUint64(80);
      tokenids = _getArgUint256Array(88, arraylength);    
      return (_getArgAddress(40), _getArgAddress(60), tokenids);
    }
    
    function claim(address beneficiary, bytes calldata data, bytes calldata authsig, bytes calldata claimsig) public override(UniqueNonceDedup, ERC721TransferExecutor, BaseValidator) delegatecallOnly returns(address issuer, address claimant) {
        return super.claim(beneficiary, data, authsig, claimsig);
    }

    function metadata(address issuer, address claimant, bytes calldata claimData) public override(UniqueNonceDedup, ERC721TransferExecutor, BaseValidator) virtual view returns(string memory) {
        return super.metadata(issuer, claimant, claimData);
    }
}

contract ERC721TransferUniqueNonceValidatorFactory {
    using ClonesWithImmutableArgs for address;

    event Cloned(address indexed creator, uint256 indexed nonce, address instance, address owner, address token, address sender);

    ERC721TransferUniqueNonceValidator immutable public implementation;

    constructor() {
        implementation = new ERC721TransferUniqueNonceValidator();
    }

    function create(uint256 nonce, address owner, address token, address sender, uint256[] memory tokenids, address[] memory issuers) external returns(ERC721TransferUniqueNonceValidator) {
      bytes memory data = abi.encodePacked(address(this), owner, token, sender, uint64(tokenids.length), tokenids);
        ERC721TransferUniqueNonceValidator instance = ERC721TransferUniqueNonceValidator(address(implementation).clone(data));
        instance.addIssuers(issuers);
        emit Cloned(msg.sender, nonce, address(instance), owner, token, sender);
        return instance;
    }
}
