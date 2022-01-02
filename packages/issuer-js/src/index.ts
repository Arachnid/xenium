import { keccak256 as solidityKeccak256, pack as solidityPack } from '@ethersproject/solidity';
import { SigningKey } from '@ethersproject/signing-key';
import { BytesLike, concat } from '@ethersproject/bytes';
import { keccak256 } from '@ethersproject/keccak256';
import { randomBytes } from '@ethersproject/random';
import { computeAddress } from '@ethersproject/transactions';

export interface ClaimCode {
    validator: BytesLike;
    claimkey: BytesLike;
    authsig: BytesLike;
    data: BytesLike;
}

export abstract class AbstractIssuer {
    validator: BytesLike;
    privateKey: SigningKey;

    constructor(validator: BytesLike, privateKey: SigningKey) {
        this.validator = validator;
        this.privateKey = privateKey;
    }

    protected _makeClaimCode(data: BytesLike): ClaimCode {
        const claimkey = randomBytes(32);
        const claimantaddress = computeAddress(claimkey);
        const authhash = solidityKeccak256(
            ['bytes', 'address', 'bytes', 'bytes32', 'address'],
            ['0x1900', this.validator, '0x00', keccak256(data), claimantaddress]
        );
        const authsig = this.privateKey.signDigest(authhash);
        return {validator: this.validator, claimkey, authsig: concat([authsig.r, authsig._vs]), data};
    }
}

export class NonceIssuer extends AbstractIssuer {
    nonce: number;

    constructor(validator: BytesLike, privateKey: SigningKey, nonce: number) {
        super(validator, privateKey);
        this.nonce = nonce;
    }

    makeClaimCode(): ClaimCode {
        const data = solidityPack(['uint32'], [this.nonce++]);
        return this._makeClaimCode(data);
    }
}
