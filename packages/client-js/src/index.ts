import { BytesLike, concat } from "@ethersproject/bytes";
import { keccak256 as solidityKeccak256 } from '@ethersproject/solidity';
import { SigningKey } from '@ethersproject/signing-key';
import { keccak256 } from '@ethersproject/keccak256';
import { Signer } from "@ethersproject/abstract-signer";
import { Contract } from "@ethersproject/contracts";
import { Interface } from "@ethersproject/abi";
import { TransactionResponse } from "@ethersproject/abstract-provider";

const ValidatorInterface = new Interface([
    "function claim(address beneficiary, bytes data, bytes authsig, bytes claimsig)"
]);

export function buildClaim(validator: string, beneficiary: string, data: BytesLike, authsig: BytesLike, claimkey: BytesLike): [string, BytesLike, BytesLike, BytesLike] {
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

export function submitClaim(signer: Signer, validator: string, beneficiary: string, data: BytesLike, authsig: BytesLike, claimkey: BytesLike): Promise<TransactionResponse> {
  const claimdata = buildClaim(validator, beneficiary, data, authsig, claimkey);
  const contract = new Contract(validator, ValidatorInterface, signer);
  return contract.claim(...claimdata);
}
