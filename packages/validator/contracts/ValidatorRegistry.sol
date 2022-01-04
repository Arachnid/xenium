//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "./IExecutor.sol";
import "./IValidator.sol";
import "./ValidatorLib.sol";

import "@openzeppelin/contracts/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/contracts/utils/introspection/ERC165.sol";

contract ValidatorRegistry is IValidator, ERC165 {
    using Strings for *;

    bytes1 constant CLAIM_REQUEST = 0x00;
    bytes1 constant CONFIG_REQUEST = 0x80;

    error InvalidClaimType(uint8 claimType);
    error InvalidRequest();
    error NotAuthorised();
    error NonceTooLow();
    error NotConfigured();

    event OwnershipUpdated(address indexed issuer, address indexed owner);
    event ConfigurationUpdated(address indexed issuer, address indexed executor, bytes data);
    event ClaimExecuted(address indexed issuer, address indexed beneficiary, bytes data, bytes authsig, bytes claimsig);

    struct Ownership {
        uint64 nonce;
        address owner;
    }

    struct Configuration {
        IExecutor executor;
        bytes data;
    }

    mapping(address=>Ownership) public owners;
    mapping(address=>Configuration) public configs;

    /**
     * @dev Executes a claim transaction as specified in https://gist.github.com/Arachnid/df9c7e3738ee76bf171c46ef38e4f18b
     * @param beneficiary The address that the claim should benefit.
     * @param data Claim data provided by the issuer.
     * @param authsig A signature over the authorisation message, produced by the issuer.
     * @param claimsig A signature over the claim message, produced by the client.
     */
    function claim(address beneficiary, bytes calldata data, bytes calldata authsig, bytes calldata claimsig) external {
        if(data.length == 0) {
            revert InvalidRequest();
        }
        address issuer = ValidatorLib.validate(address(this), beneficiary, data, authsig, claimsig);
        if(data[0] == CLAIM_REQUEST) {
            doClaim(issuer, beneficiary, data);
        } else if(data[0] == CONFIG_REQUEST) {
            doConfigure(issuer, beneficiary, data);
        } else {
            revert InvalidClaimType(uint8(data[0]));
        }
        emit ClaimExecuted(issuer, beneficiary, data, authsig, claimsig);
    }

    /**
     * @dev Returns metadata explaining a claim.
     * @param issuer The address of the issuer.
     * @param data Claim data provided by the issuer.
     * @return A URL that resolves to JSON metadata as described in the spec.
     *         Callers must support at least 'data' and 'https' schemes.
     */
    function metadata(address issuer, bytes calldata data) external view returns(string memory) {
        if(data.length == 0 || (data[0] == CONFIG_REQUEST && data.length != 33)) {
            return string(abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode("{\"valid\":false,\"error\":\"Invalid request\"}")
            ));
        } else if(data[0] == CLAIM_REQUEST) {
            Configuration memory config = configs[issuer];
            if(address(config.executor) == address(0)) {
                return string(abi.encodePacked(
                    "data:application/json;base64,",
                    Base64.encode("{\"valid\":false,\"error\":\"No executor configured for this issuer\"}")
                ));
            }
            return config.executor.metadata(issuer, data[1:], config.data);
        } else if(data[0] == CONFIG_REQUEST) {
            Ownership memory owner = owners[issuer];
            uint64 nonce = abi.decode(data[1:], (uint64));
            if(nonce < owner.nonce) {
                return string(abi.encodePacked(
                    "data:application/json;base64,",
                    Base64.encode("{\"valid\":false,\"error\":\"Nonce too low\"}")
                ));
            }
            return string(abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode(abi.encodePacked(
                    "{\"valid\":true,\"data\":{\"title\":\"Set owner for issuer ",
                    uint256(uint160(issuer)).toHexString(20),
                    "\"}}"
                ))
            ));
        }
        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode("{\"valid\":false,\"error\":\"Unknown command type\"}")
        ));
    }

    /**
     * @dev Updates the configuration for an issuer.
     * @param issuer The issuer to update the configuration for.
     * @param executor The address of the executor contract to use.
     * @param data Data to pass to `executor.executeClaim` as `executorData` each time a claim is made.
     */
    function configure(address issuer, address executor, bytes calldata data) external {
        if(owners[issuer].owner != msg.sender) {
            revert NotAuthorised();
        }
        configs[issuer] = Configuration(IExecutor(executor), data);
        emit ConfigurationUpdated(issuer, executor, data);
    }

    function supportsInterface(bytes4 interfaceId) public view override(IERC165, ERC165) returns(bool) {
        return interfaceId == type(IValidator).interfaceId || super.supportsInterface(interfaceId);
    }

    function doClaim(address issuer, address beneficiary, bytes calldata data) internal {
        Configuration memory config = configs[issuer];
        if(address(config.executor) == address(0)) {
            revert NotConfigured();
        }
        config.executor.executeClaim(issuer, beneficiary, data[1:], config.data);
    }

    function doConfigure(address issuer, address beneficiary, bytes calldata data) internal {
        if(data.length != 33) {
            revert InvalidRequest();
        }

        uint64 nonce = abi.decode(data[1:], (uint64));
        Ownership memory owner = owners[issuer];

         if(nonce < owner.nonce) {
            revert NonceTooLow();
        }

        owner = Ownership(nonce + 1, beneficiary);
        owners[issuer] = owner;
        emit OwnershipUpdated(issuer, beneficiary);
    }
}