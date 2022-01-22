// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "../BaseValidator.sol";
import "@openzeppelin/contracts/contracts/utils/Base64.sol";

/**
 * Abstract implementation of a validator that maintains a whitelist of allowed issuers.
 */
abstract contract IssuerWhitelistAuth is BaseValidator {
    mapping(address=>bool) public issuers;

    event IssuersAdded(address[] issuers);
    event IssuersRemoved(address[] issuers);

    error NotAuthorised();

    function isOwner(address owner) public virtual view returns(bool);

    modifier ownerOnly {
        if(!isOwner(msg.sender)) {
            revert NotAuthorised();
        }
        _;
    }

    function isIssuer(address issuer) internal override virtual view returns(bool) {
        return issuers[issuer];
    }

    function addIssuers(address[] memory _issuers) external ownerOnly {
        for(uint256 i = 0; i < _issuers.length; i++) {
            issuers[_issuers[i]] = true;
        }
        emit IssuersAdded(_issuers);
    }

    function removeIssuers(address[] calldata _issuers) external ownerOnly {
        for(uint256 i = 0; i < _issuers.length; i++) {
            issuers[_issuers[i]] = false;
        }
        emit IssuersRemoved(_issuers);
    }
}
