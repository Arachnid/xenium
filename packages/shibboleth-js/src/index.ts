import { Base32 } from '@ethersproject/basex';
import { defaultAbiCoder } from '@ethersproject/abi';
import { Signer } from '@ethersproject/abstract-signer';
import { Contract } from '@ethersproject/contracts';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { keccak256 as solidityKeccak256 } from '@ethersproject/solidity';
import { SigningKey } from '@ethersproject/signing-key';
import { arrayify, BytesLike, concat, hexlify } from '@ethersproject/bytes';
import { keccak256 } from '@ethersproject/keccak256';
import { randomBytes } from '@ethersproject/random';
import { computeAddress } from '@ethersproject/transactions';
import { Interface } from "@ethersproject/abi";
import { Logger } from '@ethersproject/logger';

const logger = new Logger("shibboleth-js/0.1.0");

function rleZeroes(data: Uint8Array): Uint8Array {
    const bytes = [];
    let count = 0;
    for(let i = 0; i < data.length; i++) {
        const ch = data[i];
        if(ch == 0) {
            count += 1;
            if(count == 256) {
                bytes.push(0);
                bytes.push(count - 1);
                count = 0;
            }
        } else {
            if(count > 0) {
                bytes.push(0);
                bytes.push(count - 1);
                count = 0;
            }
            bytes.push(ch);
        }
    }
    return Uint8Array.from(bytes);
}

function unrleZeroes(data: Uint8Array): Uint8Array {
    const bytes = [];
    for(let i = 0; i < data.length; i++) {
        const ch = data[i];
        if(ch == 0) {
            bytes.push(...new Array(data[++i]).fill(0));
        } else {
            bytes.push(ch);
        }
    }
    return Uint8Array.from(bytes);
}

export class ClaimCode {
    readonly validator: string;
    readonly claimkey: Uint8Array;
    readonly authsig: Uint8Array;
    readonly data: Uint8Array;

    constructor(validator: string, claimkey: BytesLike, authsig: BytesLike, data: BytesLike) {
        this.validator = validator;
        this.claimkey = arrayify(claimkey);
        this.authsig = arrayify(authsig);
        this.data = arrayify(data);
    }

    static fromString(str: string): ClaimCode {
        const dataArray = Base32.decode(str.toLowerCase());
        if(dataArray.length < 116) {
            return logger.throwError("Claim code too short", Logger.errors.INVALID_ARGUMENT, {length: dataArray.length});
        }
        const validator = hexlify(dataArray.slice(0, 20));
        const claimkey = dataArray.slice(20, 52);
        const authsig = dataArray.slice(52, 116);
        const data = unrleZeroes(dataArray.slice(116));
        return new ClaimCode(validator, claimkey, authsig, data);
    }

    toString(): string {
        return Base32.encode(concat([this.validator, this.claimkey, this.authsig, rleZeroes(this.data)])).toUpperCase();
    }
}

export abstract class AbstractIssuer {
    validator: string;
    privateKey: SigningKey;

    constructor(validator: string, privateKey: SigningKey) {
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
        return new ClaimCode(this.validator, claimkey, concat([authsig.r, authsig._vs]), data);
    }
}

export class NonceIssuer extends AbstractIssuer {
    nonce: number;

    constructor(validator: string, privateKey: SigningKey, nonce: number) {
        super(validator, privateKey);
        this.nonce = nonce;
    }

    makeClaimCode(): ClaimCode {
        const data = defaultAbiCoder.encode(['uint64'], [this.nonce++]);
        return this._makeClaimCode(data);
    }
}

const ValidatorInterface = new Interface([
    "function claim(address beneficiary, bytes data, bytes authsig, bytes claimsig)"
]);

export function buildClaim(beneficiary: string, {validator, claimkey, authsig, data}: ClaimCode): [string, BytesLike, BytesLike, BytesLike] {
    const authsighash = keccak256(authsig);
    const signer = new SigningKey(claimkey);
    const claimhash = solidityKeccak256(
      ['bytes', 'address', 'bytes', 'bytes32', 'address'],
      ['0x1900', validator, '0x80', authsighash, beneficiary]
    );
    const claimsig = signer.signDigest(claimhash);
    return [
      beneficiary,
      data,
      authsig,
      concat([claimsig.r, claimsig._vs]),
    ];
}

export function submitClaim(signer: Signer, beneficiary: string, claimcode: ClaimCode): Promise<TransactionResponse> {
  const claimdata = buildClaim(beneficiary, claimcode);
  const contract = new Contract(claimcode.validator, ValidatorInterface, signer);
  return contract.claim(...claimdata);
}
