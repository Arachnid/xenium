import { keccak256 as solidityKeccak256, pack as solidityPack } from '@ethersproject/solidity';
import { arrayify, BytesLike, concat, hexlify } from '@ethersproject/bytes';
import { randomBytes } from '@ethersproject/random';
import { SigningKey } from '@ethersproject/signing-key';
import { computeAddress, recoverAddress } from '@ethersproject/transactions';
import { NonceIssuer } from '../src';
import { keccak256 } from '@ethersproject/keccak256';

const TEST_ADDRESS = "0x0123456789012345678901234567890123456789";

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
    it('issues valid claim codes', () => {
        const privateKey = new SigningKey(randomBytes(32));
        const issuer = new NonceIssuer(TEST_ADDRESS, privateKey, 0);
        for(let i = 0; i < 5; i++) {
            expect(issuer.nonce).toEqual(i);
            const claimCode = issuer.makeClaimCode();
            
            expect(claimCode.validator).toEqual(TEST_ADDRESS);
            expect(hexlify(claimCode.data)).toEqual(solidityPack(['uint32'], [i]));
            
            const claimantaddress = computeAddress(claimCode.claimkey);
            const authhash = solidityKeccak256(
                ['bytes', 'address', 'bytes', 'bytes32', 'address'],
                ['0x1900', TEST_ADDRESS, '0x00', keccak256(claimCode.data), claimantaddress]
            );
            const signeraddress = recoverAddress(authhash, expandSignature(claimCode.authsig));
            expect(hexlify(signeraddress)).toEqual(hexlify(computeAddress(privateKey.privateKey)));
        }
    });
});
