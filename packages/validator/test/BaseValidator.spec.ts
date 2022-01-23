import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { buildClaim, NonceIssuer } from "@shibboleth/shibboleth-js";
import { SigningKey } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { expect } from "chai";
import { BaseValidator } from "../typechain";

interface Args {
    validator: BaseValidator;
    issuerKey: SigningKey;
}

export function baseValidator(getArgs: () => Args) {
    let issuer: NonceIssuer;
    let validator: BaseValidator;
    let issuerKey: SigningKey;
    let issuerAddress: string;
    let accounts: SignerWithAddress[];

    before(async () => {
        accounts = await ethers.getSigners();
        ({validator, issuerKey} = getArgs());
        issuerAddress = ethers.utils.computeAddress(issuerKey.privateKey);
        issuer = new NonceIssuer(validator.address, issuerKey, 0);
    });

    describe('BaseValidator', () => {
        describe('claim()', () => {
            it('should emit ClaimExecuted', async () => {
                const issuer = new NonceIssuer(validator.address, issuerKey, 0);
                const claim = buildClaim(accounts[1].address, issuer.makeClaimCode());
                const receipt = await (await validator.claim(...claim)).wait();
                if(receipt.events === undefined) return expect(receipt.events).to.not.be.undefined;
                expect(receipt.events[0].event).to.equal('ClaimExecuted');
                if(receipt.events[0].args === undefined) return expect(receipt.events[0].args).to.not.be.undefined;
                expect(receipt.events[0].args.claimId).to.equal(ethers.utils.keccak256(claim[2]));
                expect(receipt.events[0].args.issuer).to.equal(issuerAddress);
                expect(receipt.events[0].args.beneficiary).to.equal(accounts[1].address);
                expect(receipt.events[0].args.data).to.equal(ethers.utils.hexlify(claim[1]));
                expect(receipt.events[0].args.authsig).to.equal(ethers.utils.hexlify(claim[2]));
                expect(receipt.events[0].args.claimsig).to.equal(ethers.utils.hexlify(claim[3]));
            });
        });
    });
}