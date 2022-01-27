import {
  Cloned
} from "../generated/ERC20TransferUniqueNonceValidatorFactory/ERC20TransferUniqueNonceValidatorFactory"
import {
  ClaimExecuted,
  IssuersAdded, IssuersRemoved
} from "../generated/templates/ERC20TransferUniqueNonceValidator/ERC20TransferUniqueNonceValidator";
import { Claim, ERC20TransferUniqueNonceValidator } from "../generated/schema"
import { ERC20TransferUniqueNonceValidator as ERC20TransferUniqueNonceValidator_template } from "../generated/templates";
import { Address, Bytes } from "@graphprotocol/graph-ts";

export function handleCloned(event: Cloned): void {
  const entity = new ERC20TransferUniqueNonceValidator(event.params.instance.toHex());
  entity.factory = event.address;
  entity.owner = event.params.owner;
  entity.issuers = [];
  entity.token = event.params.token;
  entity.sender = event.params.sender;
  entity.amount = event.params.amount;
  entity.save()

  ERC20TransferUniqueNonceValidator_template.create(event.params.instance);
}

export function handleIssuersAdded(event: IssuersAdded): void {
  const entity = ERC20TransferUniqueNonceValidator.load(event.address.toHex()) as ERC20TransferUniqueNonceValidator;
  for(let i = 0; i < event.params.issuers.length; i++) {
    const issuer = event.params.issuers[i];
    if(!entity.issuers.includes(issuer)) {
      entity.issuers.push(issuer);
    }
  }
  entity.save();
}

export function handleIssuersRemoved(event: IssuersRemoved): void {
  const entity = ERC20TransferUniqueNonceValidator.load(event.address.toHex()) as ERC20TransferUniqueNonceValidator;
  const issuers: Bytes[] = [];
  for(let i = 0; i < entity.issuers.length; i++) {
    const issuer = entity.issuers[i] as Address;
    if(!event.params.issuers.includes(issuer)) {
      issuers.push(issuer);
    }
  }
  entity.issuers = issuers;
  entity.save();
}

export function handleClaimExecuted(event: ClaimExecuted): void {
  const entity = new Claim(event.params.claimId.toHex());
  entity.validator = event.address.toHex();
  entity.issuer = event.params.issuer;
  entity.beneficiary = event.params.beneficiary;
  entity.data = event.params.data;
  entity.authsig = event.params.authsig;
  entity.claimsig = event.params.claimsig;
  entity.save();
}
