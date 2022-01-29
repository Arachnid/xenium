import {
  Cloned
} from "../generated/ERC20TransferUniqueNonceValidatorFactory/ERC20TransferUniqueNonceValidatorFactory"
import {
  ClaimExecuted,
  IssuersAdded, IssuersRemoved
} from "../generated/templates/ERC20TransferUniqueNonceValidator/ERC20TransferUniqueNonceValidator";
import { Claim, ERC20TransferUniqueNonceValidator, Issuer } from "../generated/schema"
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
  const issuers = entity.issuers;
  for(let i = 0; i < event.params.issuers.length; i++) {
    const issuerAddress = event.params.issuers[i].toHex();
    if(!issuers.includes(issuerAddress)) {
      const issuer = new Issuer(issuerAddress);
      issuer.save();
      issuers.push(issuer.id);
    }
  }
  entity.issuers = issuers;
  entity.save();
}

export function handleIssuersRemoved(event: IssuersRemoved): void {
  const entity = ERC20TransferUniqueNonceValidator.load(event.address.toHex()) as ERC20TransferUniqueNonceValidator;
  const issuers: string[] = [];
  for(let i = 0; i < entity.issuers.length; i++) {
    const issuer = entity.issuers[i];
    if(!event.params.issuers.includes(Address.fromString(issuer))) {
      issuers.push(issuer);
    }
  }
  entity.issuers = issuers;
  entity.save();
}

export function handleClaimExecuted(event: ClaimExecuted): void {
  const issuer = new Issuer(event.params.issuer.toHex());
  issuer.save();

  const entity = new Claim(event.params.claimId.toHex());
  entity.validator = event.address.toHex();
  entity.issuer = issuer.id;
  entity.beneficiary = event.params.beneficiary;
  entity.data = event.params.data;
  entity.authsig = event.params.authsig;
  entity.claimsig = event.params.claimsig;
  entity.save();
}
