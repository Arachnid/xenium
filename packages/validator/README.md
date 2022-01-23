# Xenium Validators

This package contains a set of smart contracts that act as building blocks for constructing a validator that meets your specific application requirements.

A validator has three main components:
 - An Executor, which is responsible for actually executing the claim.
 - An Auth, which is responsible for determining whether an issuer is allowed to issue claims for this validator.
 - A Dedup, which is responsible for preventing duplicate claims from being submitted.

A variety of implementations of each component are provided.

## Building a Validator

First, select one Dedup, one Auth, and one Executor. Define a new contract that inherits from each of these. For example, assuming you chose the `UniqueNonceDedup`, the `IssuerWhitelistAuth` and the `ERC20TransferExecutor`, your contract declaration would look like this:

```solidity
contract MyValidator is UniqueNonceDedup, IssuerWhitelistAuth, ERC20TransferExecutor {
}
```

The order of the parent contracts matters; the executor *must* always be last in the list.

Next, you will need to provide overridden implementations of `claim` and `metadata`. If you have no custom logic of your own for these functions, they can simply call `super`:

```solidity
contract MyValidator is UniqueNonceDedup, IssuerWhitelistAuth, ERC20TransferExecutor {
    function claim(address beneficiary, bytes calldata data, bytes calldata authsig, bytes calldata claimsig) public override(UniqueNonceDedup, ERC20TransferExecutor, BaseValidator) delegatecallOnly returns(address issuer, address claimant) {
        return super.claim(beneficiary, data, authsig, claimsig);
    }

    function metadata(address issuer, address claimant, bytes calldata claimData) public override(UniqueNonceDedup, ERC20TransferExecutor, BaseValidator) virtual view returns(string memory) {
        return super.metadata(issuer, claimant, claimData);
    }
}
```

Finally, you will need to implement any functions required by the components you selected. For example, `IssuerWhitelistAuth` expects an `isOwner` function, and `ERC20TransferExecutor` expects a `tokenInfo` function. Consult the documentation for each component to determine what functions are expected and how to implement them.

## Components

### Dedups

#### [HighestNonceDedup](contracts/dedups/HighestNonceDedup.sol)

Requires that each claim's `data` field have a 32 byte `nonce` as the first element. For a claim to be valid, the `nonce` of that claim must be higher than any `nonce` on a previously processed claim.

This dedup is useful for ensuring that claims are submitted in the order they were generated - which is useful in situations where there is value in being the most recent claimant. For example, this could be used to implement a token that is transferred to whoever claimed most recently, or in applications where you want to ensure that users cannot issue themselves several claim codes and save some of them for later use.

#### [SingleClaimantDedup](contracts/dedups/SingleClaimantDedup.sol)

This is the simplest dedup to use; it makes no assumptions about the data field at all, and instead just maintains a map of `claimant` addresses it has seen before. Since the Xenium specification requires the claimant private key - and hence its address - to be unique for each claim code, this is sufficient to ensure codes cannot be reused.

This dedup is less gas-efficient than nonce-based dedups, as it requires initializing a new storage slot on each claim.

#### [UniqueNonceDedup](contracts/dedups/UniqueNonceDedup.sol)

Requires that each claim's `data` field have a 32 byte `nonce` as the first element. For a claim to be valid, the `nonce` of that claim must not have been seen on a previously processed claim.

This dedup is less restrictive than `HighestNonceDedup`, because it does not enforce ordering. It is slightly less gas-efficient, though not by a significant amount. It is most useful when you want to have a relaxed policy about the order in which claims are submitted, and your issuer can insert a nonce and thus realise the gas savings over `SingleClaimantDedup`.

### Auths

#### [IssuerWhitelistAuth](contracts/auths/IssuerWhitelistAuth.sol)

This is the only auth strategy currently implemented. It exposes `addIssuers` and `removeIssuers` functions, which can only be called by contract owners. Any issuer added with these functions is permitted to issue claim codes.

`IssuerWhitelistAuth` expects inheriting contracts to implement the function `isOwner(address owner) public virtual view returns(bool)`, which must return `true` if the specified address is a contract owner.

### Executors

#### [ERC20TransferExecutor](contracts/executors/ERC20TransferExecutor.sol)

Transfers ERC20 tokens to the beneficiary on submission of a successful claim. Tokens are held in an external account and sent using `transferFrom`, rather than being held by the executor itself.

`ERC20TransferExecutor` expects inheriting contracts to implement the following function:

```solidity
function tokenInfo(bytes calldata data) public virtual view returns(address token, address sender, uint256 amount);
```

`data` is the data field from the claim being processed, and the return values are the address of the ERC20 `token` to transfer, the `sender` of that token, and the `amount` of tokens to transfer. The `sender` must have called `approve` on `token` prior to any claims being submitted.

### Factories

The factories directory contains factory contracts for commonly useful combinations of dedups, auths, and executors. Each is constructed as a factory that produces minimal clones of the relevant issuer, with most parameters made immutable, for maximum gas efficiency. Typical cost to instantiate a contract is only about 120k gas.

|                       | HighestNonceDedup | SingleClaimantDedup | UniqueNonceDedup |
|-----------------------|-------------------|---------------------|------------------|
| ERC20TransferExecutor |                   |                     | [ERC20TransferUniqueNonceValidator](contracts/factories/ERC20TransferUniqueNonceValidator.sol) |
