import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { buildClaim, NonceIssuer } from "@xenium-eth/xenium-js";
import { SigningKey } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { expect } from "chai";
import { parseMetadata } from "./utils";
import { IssuerWhitelistAuth, UniqueNonceDedup } from "../typechain";

interface Args {
    validator: UniqueNonceDedup & IssuerWhitelistAuth;
    issuerKey: SigningKey;
}

export function uniqueNonceDedup(getArgs: () => Args) {
    let issuer: NonceIssuer;
    let validator: UniqueNonceDedup & IssuerWhitelistAuth;
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

            it('allows the same nonce from two different issuers', async () => {
                const issuer1 = new NonceIssuer(validator.address, issuerKey, 0);
                const issuerKey2 = new SigningKey(ethers.utils.randomBytes(32));
                const claim1 = buildClaim(accounts[1].address, issuer1.makeClaimCode());
                await (await validator.claim(...claim1)).wait()

                const issuer2 = new NonceIssuer(validator.address, issuerKey2, 0);
                const issuerAddress2 = ethers.utils.computeAddress(issuerKey2.privateKey);
                await validator.addIssuers([issuerAddress2]);
                const claim2 = buildClaim(accounts[2].address, issuer2.makeClaimCode());
                const receipt = await (await validator.claim(...claim2)).wait();
                expect(receipt.status).to.equal(1);
            });
        });

        describe('nonce()', () => {
            it('correctly reports used nonces', async () => {
                expect(await validator.nonce(issuerAddress, 0)).to.be.false;
                const issuer = new NonceIssuer(validator.address, issuerKey, 0);
                const claim = buildClaim(accounts[1].address, issuer.makeClaimCode());
                await (await validator.claim(...claim)).wait();
                expect(await validator.nonce(issuerAddress, 0)).to.be.true;
            })
        });

        describe('isExecutable()', () => {
            it('returns false for a reused nonce', async () => {
                const issuer = new NonceIssuer(validator.address, issuerKey, 0);
                const claimCode = issuer.makeClaimCode();
                const claim = buildClaim(accounts[1].address, claimCode);
                await (await validator.claim(...claim)).wait();
                expect(await validator.isExecutable(issuerAddress, claimCode.claimant, claimCode.data)).to.equal(false);
            })
        });
    });
}