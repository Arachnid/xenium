import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { buildClaim, NonceIssuer } from "@xenium-eth/xenium-js";
import { SigningKey } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { expect } from "chai";
import { IssuerWhitelistAuth } from "../typechain/IssuerWhitelistAuth";
import { parseMetadata } from "./utils";

interface Args {
    validator: IssuerWhitelistAuth;
    issuerKey: SigningKey;
}

export function issuerWhitelistAuth(getArgs: () => Args) {
    let issuer: NonceIssuer;
    let validator: IssuerWhitelistAuth;
    let issuerKey: SigningKey;
    let issuerAddress: string;
    let accounts: SignerWithAddress[];

    before(async () => {
        accounts = await ethers.getSigners();
        ({validator, issuerKey} = getArgs());
        issuerAddress = ethers.utils.computeAddress(issuerKey.privateKey);
        issuer = new NonceIssuer(validator.address, issuerKey, 0);
    });

    describe('IssuerWhitelistAuth', () => {
        describe('claim()', () => {
            it('allows whitelisted issuers to make claims', async () => {
                const issuer = new NonceIssuer(validator.address, issuerKey, 0);
                const claim = buildClaim(accounts[1].address, issuer.makeClaimCode());
                const tx = await validator.claim(...claim);
                const receipt = await tx.wait();
                if(receipt.events === undefined) return expect(receipt.events).to.not.be.undefined;
                expect(receipt.events.map((e:any) => e.event)).to.contain('ClaimExecuted');
            });

            it('prohibits non-whitelisted issuers from making claims', async () => {
                const nonIssuerKey = new ethers.utils.SigningKey(ethers.utils.randomBytes(32));
                const nonIssuer = new NonceIssuer(validator.address, nonIssuerKey, 0);
                const claim = buildClaim(accounts[1].address, nonIssuer.makeClaimCode());
                await expect(validator.claim(...claim)).to.be.revertedWith('UnauthorisedIssuer');
            });
        });

        describe('addIssuer()', () => {
            it('allows the owner to add issuers', async () => {
                const receipt = await (await validator.addIssuers([accounts[0].address])).wait();
                if(receipt.events === undefined) return expect(receipt.events).to.not.be.undefined;
                expect(receipt.events.length).to.equal(1);
                expect(receipt.events[0].event).to.equal('IssuersAdded');
                if(receipt.events[0].args === undefined) return expect(receipt.events[0].args).to.not.be.undefined;
                expect(receipt.events[0].args.issuers).to.deep.equal([accounts[0].address]);
            });

            it('does not allow non-owners to add issuers', async () => {
                await expect(validator.connect(accounts[1]).addIssuers([accounts[1].address])).to.be.revertedWith('NotAuthorised');
            });
        });

        describe('removeIssuer()', () => {
            it('allows the owner to remove issuers', async () => {
                const receipt = await (await validator.removeIssuers([issuerAddress])).wait();
                if(receipt.events === undefined) return expect(receipt.events).to.not.be.undefined;
                expect(receipt.events.length).to.equal(1);
                expect(receipt.events[0].event).to.equal('IssuersRemoved');
                if(receipt.events[0].args === undefined) return expect(receipt.events[0].args).to.not.be.undefined;
                expect(receipt.events[0].args.issuers).to.deep.equal([issuerAddress]);
            });

            it('does not allow non-owners to remove issuers', async () => {
                await expect(validator.connect(accounts[1]).removeIssuers([issuerAddress])).to.be.revertedWith('NotAuthorised');
            });
        });
    });
}