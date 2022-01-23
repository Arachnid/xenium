import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { buildClaim, NonceIssuer } from "@shibboleth/shibboleth-js";
import { SigningKey } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { expect } from "chai";
import { parseMetadata } from "./utils";
import { UniqueNonceDedup } from "../typechain";

interface Args {
    validator: UniqueNonceDedup;
    issuerKey: SigningKey;
}

export function uniqueNonceDedup(getArgs: () => Args) {
    let issuer: NonceIssuer;
    let validator: UniqueNonceDedup;
    let issuerKey: SigningKey;
    let issuerAddress: string;
    let accounts: SignerWithAddress[];

    before(async () => {
        accounts = await ethers.getSigners();
        ({validator, issuerKey} = getArgs());
        issuerAddress = ethers.utils.computeAddress(issuerKey.privateKey);
        issuer = new NonceIssuer(validator.address, issuerKey, 0);
    });

    describe('UniqueNonceDedup', () => {
        describe('claim()', () => {
            it('accepts old but unused nonces', async () => {
                const issuer = new NonceIssuer(validator.address, issuerKey, 0);
                const claim1 = buildClaim(accounts[1].address, issuer.makeClaimCode());
                const claim2 = buildClaim(accounts[2].address, issuer.makeClaimCode());
                await (await validator.claim(...claim2)).wait();
                const receipt = await (await validator.claim(...claim1)).wait();
                if(receipt.events === undefined) return expect(receipt.events).to.not.be.undefined;
                expect(receipt.events.map((e:any) => e.event)).to.contain('ClaimExecuted');
            });

            it('does not allow nonces to be reused', async () => {
                const issuer = new NonceIssuer(validator.address, issuerKey, 0);
                const claim = buildClaim(accounts[1].address, issuer.makeClaimCode());
                await (await validator.claim(...claim)).wait();
                await expect(validator.claim(...claim)).to.be.revertedWith('NonceAlreadyUsed');
            });
        });

        describe('nonce()', () => {
            it('correctly reports used nonces', async () => {
                expect(await validator.nonce(0)).to.be.false;
                const issuer = new NonceIssuer(validator.address, issuerKey, 0);
                const claim = buildClaim(accounts[1].address, issuer.makeClaimCode());
                await (await validator.claim(...claim)).wait();
                expect(await validator.nonce(0)).to.be.true;
            })
        });

        describe('metadata()', () => {
            it('returns an error for a reused nonce', async () => {
                const issuer = new NonceIssuer(validator.address, issuerKey, 0);
                const claimCode = issuer.makeClaimCode();
                const claim = buildClaim(accounts[1].address, claimCode);
                await (await validator.claim(...claim)).wait();
                const metadata = parseMetadata(await validator.metadata(issuerAddress, accounts[1].address, claimCode.data));
                expect(metadata.valid).to.be.false;
                expect(metadata.error).to.equal('Nonce already used.');
            })
        });
    });
}