import { defaultAbiCoder } from '@ethersproject/abi';
import { keccak256 as solidityKeccak256 } from '@ethersproject/solidity';
import { arrayify, BytesLike, concat, hexlify } from '@ethersproject/bytes';
import { randomBytes } from '@ethersproject/random';
import { SigningKey } from '@ethersproject/signing-key';
import { computeAddress, recoverAddress } from '@ethersproject/transactions';
import { NonceIssuer, buildClaim, ClaimCode } from '../src';
import { keccak256 } from '@ethersproject/keccak256';

const TEST_ADDRESS = "0x0123456789012345678901234567890123456789";
const TEST_ADDRESS_2 = "0xabcdef0123abcdef0123abcdef0123abcdef0123";

// Expand an EIP 2098 type signature to a 65-byte one.
function expandSignature(sig: BytesLike) {
    const bytes = arrayify(sig);
    let v: number = 27;
    if(bytes[32] & 0x80) {
        v = 28;
        bytes[32] &= 0x7f;
    }
    return concat([bytes, [v]]);
}

describe('NonceIssuer', () => {
    it('issues valid claim and config codes', () => {
        const privateKey = new SigningKey(randomBytes(32));
        const issuer = new NonceIssuer(TEST_ADDRESS, privateKey, 0);
        for(let i = 0; i < 5; i++) {
            expect(issuer.nonce).toEqual(i);
            const claimCode = issuer.makeClaimCode();
            
            expect(claimCode.validator).toEqual(TEST_ADDRESS);
            expect(hexlify(claimCode.data)).toEqual(hexlify(defaultAbiCoder.encode(['uint64'], [i])));
            
            const claimantaddress = computeAddress(keccak256(claimCode.claimseed));
            const authhash = solidityKeccak256(
                ['bytes', 'address', 'bytes', 'bytes32', 'address'],
                ['0x1900', TEST_ADDRESS, '0x00', keccak256(claimCode.data), claimantaddress]
            );
            const signeraddress = recoverAddress(authhash, expandSignature(claimCode.authsig));
            expect(hexlify(signeraddress)).toEqual(hexlify(computeAddress(privateKey.privateKey)));
        }
    });
});

describe('buildClaim', () => {
    it('converts a claim code to a valid claim', () => {
        // Create a new issuer
        const issuerkey = new SigningKey(randomBytes(32));
        const issueraddress = computeAddress(issuerkey.privateKey);
        const issuer = new NonceIssuer(TEST_ADDRESS, issuerkey, 0);

        // Get a claim code
        const claimCodeString = issuer.makeClaimCode().toString();
        const claimCode = ClaimCode.fromString(claimCodeString);

        // Figure out the address for the ephemeral claimant key
        const claimantaddress = computeAddress(keccak256(claimCode.claimseed));

        // Convert the claim code into a claim benefiting TEST_ADDRESS_2
        const claimArgs = buildClaim(TEST_ADDRESS_2, claimCode);

        // Check the beneficiary and data are correct
        expect(hexlify(claimArgs[0])).toEqual(TEST_ADDRESS_2);
        expect(hexlify(claimArgs[1])).toEqual(hexlify(claimCode.data));
        
        // Check the claim signature is correct
        const claimhash = solidityKeccak256(
            ['bytes', 'address', 'bytes', 'bytes32', 'address'],
            ['0x1900', TEST_ADDRESS, '0x80', keccak256(claimArgs[2]), TEST_ADDRESS_2]
        );
        const claimsigneraddress = recoverAddress(claimhash, expandSignature(claimArgs[3]));
        expect(hexlify(claimsigneraddress)).toEqual(hexlify(claimantaddress));

        // Check the authorisation signature is correct
        const authhash = solidityKeccak256(
            ['bytes', 'address', 'bytes', 'bytes32', 'address'],
            ['0x1900', TEST_ADDRESS, '0x00', keccak256(claimArgs[1]), claimsigneraddress]
        );
        const authsigneraddress = recoverAddress(authhash, expandSignature(claimArgs[2]));
        expect(hexlify(authsigneraddress)).toEqual(hexlify(issueraddress));
    });
});
