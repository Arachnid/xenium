# Xenium JS API
This package provides a TypeScript/Javascript API for the Xenium protocol, providing functionality for
issuing claim codes and converting them to valid claims that can be submitted onchain as transactions.
Typically your application will use one of these two sets of functionality rather than both together.

## Installation
```
yarn add @xenium-eth/xenium-js
```

## API

### Issuing Claim Codes

xenium-js exports an abstract class, `AbstractIssuer`, that facilitates generating claim codes. The constructor accepts the address of the validator that claims are issued for, and the `ethers.utils.SigningKey` to use to sign the claim codes. Subclasses should call `_makeClaimCode`, passing in the value of the data parameter. This returns a `ClaimCode`, which can be serialized to a string with `toString` and sent to a claimant - for example by appending it to the URL for a standardised claim site.

xenium-js also provides a concrete implementation, `NonceIssuer`, which supplies an incrementing nonce in the data field of each claim code; this is compatible with the `HighestNonceDedup` and `UniqueNonceDedup` components in the validator library. It is the responsibility of the caller to ensure that nonces are saved to permanent storage and never reused by the same validator between sessions.

Example usage:
```typescript
import { NonceIssuer } from "@xenium-eth/xenium-js";
import { ethers } from "ethers";

const validatorAddress = "0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead";
const issuerKey = new ethers.utils.SigningKey(ethers.utils.randomBytes(32));
const issuer = new NonceIssuer(validatorAddress, issuerKey, 0 /* starting nonce */);
const claimCode = issuer.makeClaimCode();
const claimURL = `https://xenium.link/#/${claimCode.toString()}`;
```

### Redeeming Claim Codes

xenium-js exports two methods, `buildClaim` and `executeClaim`.

`buildClaim` accepts a beneficiary address and a deserialized `ClaimCode` object, and outputs the four arguments to the `Validator.claim()` method described in the Xenium specification. Example usage:

```typescript
import { buildClaim, ClaimCode } from "@xenium-eth/xenium-js";
import { ethers } from "ethers";

const provider = ethers.getDefaultProvider();
const signer = provider.getSigner();

const validatorAddress = "0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead";
const beneficiaryAddress = "0xcafecafecafecafecafecafecafecafecafecafe";
const code = "JDIVTYSAJDIVTYSAJDIVTYSAJDIVTYSVP4UF4ASMM7R3NT4MJBFVVGLNYWMWG5TCBUPHDXPKDZ77JGF2O4MWX74IENMC345FJ4AE3IXZEGFEGFFRU7LYMMZKQIRZ5P7R5MOUYEKA67WKJ66RF63WWAH5SH5GKEOAA7";
const claimCode = ClaimCode.fromString(code);
const claim = buildClaim(beneficiaryAddress, claimCode);
const contract = new ethers.Contract(
  validatorAddress,
  ["function claim(address beneficiary, bytes data, bytes authsig, bytes claimsig)"],
  signer
]);
await contract.claim(...claim);
```

`executeClaim` simplifies the process of both building a claim from a claim code and executing it. It accepts an `ethers.Signer` object, a beneficiary address, and a serialized claim code string, and submits the claim:

```typescript
import { executeClaim } from "@xenium-eth/xenium-js";
import { ethers } from "ethers";

const provider = ethers.getDefaultProvider();
const signer = provider.getSigner();

const validatorAddress = "0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead";
const beneficiaryAddress = "0xcafecafecafecafecafecafecafecafecafecafe";
const code = "JDIVTYSAJDIVTYSAJDIVTYSAJDIVTYSVP4UF4ASMM7R3NT4MJBFVVGLNYWMWG5TCBUPHDXPKDZ77JGF2O4MWX74IENMC345FJ4AE3IXZEGFEGFFRU7LYMMZKQIRZ5P7R5MOUYEKA67WKJ66RF63WWAH5SH5GKEOAA7";
await executeClaim(signer, beneficiaryAddress, claimCode);
```
