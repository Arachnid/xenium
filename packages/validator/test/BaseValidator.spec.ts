import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { buildClaim, NonceIssuer } from "@xenium-eth/xenium-js";
import { SigningKey } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { expect } from "chai";
import { BaseValidator } from "../typechain";
import cbor from "cbor";

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
        describe('isExecutable()', () => {
            it('should return true if the issuer is authorised', async () => {
                const claimCode = issuer.makeClaimCode();
                expect(await validator.isExecutable(issuerAddress, claimCode.claimant, claimCode.data)).to.equal(true);
            });

            it('should return false if the issuer is not authorised', async () => {
                const nonIssuerKey = new ethers.utils.SigningKey(ethers.utils.randomBytes(32));
                const nonIssuer = new NonceIssuer(validator.address, nonIssuerKey, 0);
                const claimCode = nonIssuer.makeClaimCode();
                expect(await validator.isExecutable(ethers.utils.computeAddress(nonIssuerKey.privateKey), claimCode.claimant, claimCode.data)).to.equal(false);
            });
        });

        describe('claim()', () => {
            it('should emit ClaimExecuted', async () => {
                const claim = buildClaim(accounts[1].address, issuer.makeClaimCode());
                const receipt = await (await validator.claim(...claim)).wait();
                if(receipt.events === undefined) return expect(receipt.events).to.not.be.undefined;
                expect(receipt.events[0].event).to.equal('ClaimExecuted');
                if(receipt.events[0].args === undefined) return expect(receipt.events[0].args).to.not.be.undefined;
                expect(receipt.events[0].args.claimId).to.equal(ethers.utils.keccak256(claim[2]));
                expect(receipt.events[0].args.issuer).to.equal(issuerAddress);
                expect(receipt.events[0].args.beneficiary).to.equal(accounts[1].address);
            });
        });
    });
}