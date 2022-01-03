import { defaultAbiCoder } from "@ethersproject/abi";
import { Signer } from "@ethersproject/abstract-signer";
import { Contract } from "@ethersproject/contracts";
import { TransactionResponse } from "@ethersproject/abstract-provider";
import { keccak256 as solidityKeccak256 } from '@ethersproject/solidity';
import { SigningKey } from '@ethersproject/signing-key';
import { BytesLike, concat } from '@ethersproject/bytes';
import { keccak256 } from '@ethersproject/keccak256';
import { randomBytes } from '@ethersproject/random';
import { computeAddress } from '@ethersproject/transactions';
import { Interface } from "@ethersproject/abi";

export interface ClaimCode {
    validator: string;
    claimkey: BytesLike;
    authsig: BytesLike;
    data: BytesLike;
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
        return {validator: this.validator, claimkey, authsig: concat([authsig.r, authsig._vs]), data};
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
