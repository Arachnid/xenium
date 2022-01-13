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
    bytes1 constant OWNERSHIP_REQUEST = 0x80;

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

    mapping(address=>Ownership) public owners;
    mapping(address=>IExecutor) public executors;

    /**
     * @dev Executes a claim transaction as specified in https://gist.github.com/Arachnid/df9c7e3738ee76bf171c46ef38e4f18b
     * @param beneficiary The address that the claim should benefit.
     * @param data Claim data provided by the issuer.
     * @param authsig A signature over the authorisation message, produced by the issuer.
     * @param claimsig A signature over the claim message, produced by the client.
     */
    function claim(address beneficiary, bytes calldata data, bytes calldata authsig, bytes calldata claimsig) public returns(address) {
        if(data.length == 0) {
            revert InvalidRequest();
        }
        (address issuer, address claimant) = ValidatorLib.validate(address(this), beneficiary, data, authsig, claimsig);
        if(data[0] == CLAIM_REQUEST) {
          doClaim(issuer, claimant, beneficiary, data);
        } else if(data[0] == OWNERSHIP_REQUEST) {
          doSetOwner(issuer, claimant, beneficiary, data);
        } else {
            revert InvalidClaimType(uint8(data[0]));
        }
        emit ClaimExecuted(issuer, beneficiary, data, authsig, claimsig);
        return issuer;
    }

    /**
     * @dev Returns metadata explaining a claim.
     * @param issuer The address of the issuer.
     * @param claimant The account that is entitled to make the claim.
     * @param data Claim data provided by the issuer.
     * @return A URL that resolves to JSON metadata as described in the spec.
     *         Callers must support at least 'data' and 'https' schemes.
     */
    function metadata(address issuer, address claimant, bytes calldata data) external view returns(string memory) {
        if(data.length == 0 || (data[0] == OWNERSHIP_REQUEST && data.length != 33)) {
            return string(abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode("{\"valid\":false,\"error\":\"Invalid request\"}")
            ));
        } else if(data[0] == CLAIM_REQUEST) {
            IExecutor executor = executors[issuer];
            if(address(executor) == address(0)) {
                return string(abi.encodePacked(
                    "data:application/json;base64,",
                    Base64.encode("{\"valid\":false,\"error\":\"No executor configured for this issuer\"}")
                ));
            }
            return executor.metadata(issuer, claimant, data[1:]);
        } else if(data[0] == OWNERSHIP_REQUEST) {
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
     * @param data Data to pass to the executor's `configure` method.
     */
    function configure(address issuer, address executor, bytes calldata data) public {
        if(owners[issuer].owner != msg.sender) {
            revert NotAuthorised();
        }
        executors[issuer] = IExecutor(executor);
        IExecutor(executor).configure(issuer, owners[issuer].owner, data);
        emit ConfigurationUpdated(issuer, executor, data);
    }

    /**
     * @dev Claims ownership of an issuer and configures it in one transaction.
     * @param owner The (new) owner of the issuer.
     * @param claimData The data field from the claim being submitted.
     * @param authsig The authorisation signature from the claim.
     * @param claimsig The claim signature from the claim.
     * @param executor The address of the executor contract to use.
     * @param configData Data to pass to the executor's `configure` method.
     */
    function claimAndConfigure(address owner, bytes calldata claimData, bytes calldata authsig, bytes calldata claimsig, address executor, bytes calldata configData) external {
        address issuer = claim(owner, claimData, authsig, claimsig);
        configure(issuer, executor, configData);
    }

    function supportsInterface(bytes4 interfaceId) public view override(IERC165, ERC165) returns(bool) {
        return interfaceId == type(IValidator).interfaceId || super.supportsInterface(interfaceId);
    }

    function doClaim(address issuer, address claimant, address beneficiary, bytes calldata data) internal {
        IExecutor executor = executors[issuer];
        if(address(executor) == address(0)) {
            revert NotConfigured();
        }
        executor.executeClaim(issuer, claimant, beneficiary, data[1:]);
    }

    function doSetOwner(address issuer, address /*claimant*/, address beneficiary, bytes calldata data) internal {
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
