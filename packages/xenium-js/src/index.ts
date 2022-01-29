import { defaultAbiCoder } from '@ethersproject/abi';
import { Signer } from '@ethersproject/abstract-signer';
import { Contract } from '@ethersproject/contracts';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { keccak256 as solidityKeccak256 } from '@ethersproject/solidity';
import { SigningKey } from '@ethersproject/signing-key';
import { arrayify, BytesLike, concat, hexlify, hexDataSlice } from '@ethersproject/bytes';
import { keccak256 } from '@ethersproject/keccak256';
import { randomBytes } from '@ethersproject/random';
import { computeAddress, recoverAddress } from '@ethersproject/transactions';
import { Interface } from "@ethersproject/abi";
import { Logger } from '@ethersproject/logger';

const logger = new Logger("shibboleth-js/0.1.0");

const BASE32_AlPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(data: Uint8Array): string {
    let count = 0;
    let result = new Uint8Array((data.length + 4) / 5 * 8);
    if (data.length > 0) {
        let buffer = data[0];
        let next = 1;
        let bitsLeft = 8;
        while (bitsLeft > 0 || next < data.length) {
            if (bitsLeft < 5) {
                if (next < data.length) {
                    buffer <<= 8;
                    buffer |= data[next++] & 0xFF;
                    bitsLeft += 8;
                } else {
                    let pad = 5 - bitsLeft;
                    buffer <<= pad;
                    bitsLeft += pad;
                }
            }
            let index = 0x1F & (buffer >> (bitsLeft - 5));
            bitsLeft -= 5;
            result[count++] = BASE32_AlPHABET.charCodeAt(index);
        }
    }
    return Buffer.from(result.slice(0, count)).toString();
}

function base32Decode(data: string): Uint8Array | undefined {
    let buffer = 0;
    let bitsLeft = 0;
    let count = 0;
    let result = new Uint8Array((data.length + 7) / 8 * 5);
    for (let i = 0; i < data.length; i++) {
        let ch = data[i];
        if (ch == ' ' || ch == '\t' || ch == '\r' || ch == '\n' || ch == '-') {
            continue;
        }
        buffer <<= 5;

        // Deal with commonly mistyped characters
        if (ch == '0') {
            ch = 'O';
        } else if (ch == '1') {
            ch = 'L';
        } else if (ch == '8') {
            ch = 'B';
        }

        // Look up one base32 digit
        let byte = 0;
        if ((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z')) {
            byte = (ch.charCodeAt(0) & 0x1F) - 1;
        } else if (ch >= '2' && ch <= '7') {
            byte = ch.charCodeAt(0) - 24;
        } else {
            return undefined;
        }

        buffer |= byte;
        bitsLeft += 5;
        if (bitsLeft >= 8) {
            result[count++] = buffer >> (bitsLeft - 8);
            bitsLeft -= 8;
        }
    }
    return result.slice(0, count);
}

function rleZeros(data: Uint8Array): Uint8Array {
    const bytes = [];
    let count = 0;
    for (let i = 0; i < data.length; i++) {
        const ch = data[i];
        if (ch == 0) {
            count += 1;
            if (count == 256) {
                bytes.push(0, count - 1);
                count = 0;
            }
        } else {
            if (count > 0) {
                bytes.push(0, count - 1);
                count = 0;
            }
            bytes.push(ch);
        }
    }
    if (count > 0) {
        bytes.push(0, count - 1);
    }
    return Uint8Array.from(bytes);
}

function unrleZeros(data: Uint8Array): Uint8Array {
    const bytes = [];
    for (let i = 0; i < data.length; i++) {
        const ch = data[i];
        if (ch == 0) {
            bytes.push(...new Array(data[++i] + 1).fill(0));
        } else {
            bytes.push(ch);
        }
    }
    return Uint8Array.from(bytes);
}

export class ClaimCode {
    readonly validator: string;
    readonly claimseed: Uint8Array;
    readonly claimkey: Uint8Array;
    readonly claimant: string;
    readonly authsig: Uint8Array;
    readonly data: Uint8Array;
    readonly issuer: string;

    constructor(validator: string, claimseed: BytesLike, authsig: BytesLike, data: BytesLike) {
        this.validator = validator;
        this.claimseed = arrayify(claimseed);
        this.claimkey = arrayify(keccak256(claimseed));
        this.claimant = computeAddress(this.claimkey);
        this.authsig = arrayify(authsig);
        this.data = arrayify(data);
        this.issuer = this._recoverIssuer();
    }

    static fromString(str: string): ClaimCode {
        const dataArray = base32Decode(str);
        if(dataArray === undefined) {
            return logger.throwError("Invalid base32 encoded data", Logger.errors.INVALID_ARGUMENT, { str });
        }
        if (dataArray.length < 100) {
            return logger.throwError("Claim code too short", Logger.errors.INVALID_ARGUMENT, { length: dataArray.length });
        }
        const validator = hexlify(dataArray.slice(0, 20));
        const claimseed = dataArray.slice(20, 36);
        const authsig = dataArray.slice(36, 100);
        const data = unrleZeros(dataArray.slice(100));
        return new ClaimCode(validator, claimseed, authsig, data);
    }

    toString(): string {
        return base32Encode(concat([this.validator, this.claimseed, this.authsig, rleZeros(this.data)]));
    }

    _recoverIssuer(): string {
        const authhash: BytesLike = solidityKeccak256(
            ['bytes', 'address', 'bytes', 'bytes32', 'address'],
            ['0x1900', this.validator, '0x00', keccak256(this.data), this.claimant]
        );
        const r = hexDataSlice(this.authsig, 0, 32);
        const _vs = hexDataSlice(this.authsig, 32);
        const issuer = recoverAddress(authhash, { r, _vs });
        return issuer;
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
        const claimseed = randomBytes(16);
        const claimkey = keccak256(claimseed);
        const claimantaddress = computeAddress(claimkey);
        const authhash = solidityKeccak256(
            ['bytes', 'address', 'bytes', 'bytes32', 'address'],
            ['0x1900', this.validator, '0x00', keccak256(data), claimantaddress]
        );
        const authsig = this.privateKey.signDigest(authhash);
        return new ClaimCode(this.validator, claimseed, concat([authsig.r, authsig._vs]), data);
    }
}

/**
 * Implements an issuer with a request type byte (config or claim) and a nonce field.
 * Intended to be used in conjunction with the ValidatorRegistry and an executor that supports nonces.
 */
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

export function buildClaim(beneficiary: string, {validator, claimseed, authsig, data}: ClaimCode): [string, BytesLike, BytesLike, BytesLike] {
    const authsighash = keccak256(authsig);
    const claimkey = keccak256(claimseed);
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
