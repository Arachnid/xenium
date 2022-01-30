import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { buildClaim, NonceIssuer } from "@xenium-eth/xenium-js";
import { ethers } from 'hardhat';
import { ERC721TransferExecutor } from '../typechain/ERC721TransferExecutor';
import { TestERC721 } from '../typechain/TestERC721';
import { expect } from "chai";
import { SigningKey } from '@ethersproject/signing-key';
import { parseMetadata } from './utils';

interface Args {
    validator: ERC721TransferExecutor;
    token: TestERC721;
    issuerKey: SigningKey;
}

export function erc721TransferExecutor(getArgs: () => Args) {
    describe('ERC721TransferExecutor', () => {
        let issuer: NonceIssuer;
        let validator: ERC721TransferExecutor;
        let token: TestERC721;
        let issuerKey: SigningKey;
        let issuerAddress: string;
        let accounts: SignerWithAddress[];

        before(async () => {
            accounts = await ethers.getSigners();
            ({ validator, token, issuerKey } = getArgs());
            issuerAddress = ethers.utils.computeAddress(issuerKey.privateKey);
            issuer = new NonceIssuer(validator.address, issuerKey, 0);
        });

        describe('claim()', () => {
            it('transfers ERC721 tokens on claim', async () => {
                const claim = buildClaim(accounts[1].address, issuer.makeClaimCode());
                const tx = await validator.claim(...claim);
                const receipt = await tx.wait();
                expect(await token.ownerOf(1)).to.equal(accounts[1].address);
            });

            it('transfers token id #2 on the second claim', async () => {
                // first claim
                const claim1 = buildClaim(accounts[1].address, issuer.makeClaimCode());
                const tx1 = await validator.claim(...claim1);
                const receipt1 = await tx1.wait();

                // second claim
                const claim2 = buildClaim(accounts[2].address, issuer.makeClaimCode());
                const tx2 = await validator.claim(...claim2);
                const receipt2 = await tx2.wait();

                expect(await token.ownerOf(1)).to.equal(accounts[1].address);
                expect(await token.ownerOf(2)).to.equal(accounts[2].address);
            });
        });

        describe('metadata()', () => {
            it('returns an error if no approval given', async () => {
                await token.setApprovalForAll(validator.address, false);
                const metadata = parseMetadata(await validator.metadata(issuerAddress, accounts[1].address, issuer.makeClaimCode().data));
                expect(metadata.valid).to.be.false;
                expect(metadata.error).to.equal('Token not approved.');
            });

            it('returns token metadata for a valid claim', async () => {
                const metadata = parseMetadata(await validator.metadata(issuerAddress, accounts[1].address, issuer.makeClaimCode().data));
                expect(metadata.valid).to.be.true;
                expect(metadata.data.title).to.equal('$TEST token transfer');
                expect(metadata.data.tokentype).to.equal(721);
                expect(metadata.data.token).to.equal(token.address.toLowerCase());
                expect(metadata.data.tokenids[0]).to.equal('1');
            });

            it('updated token id in metadata after a valid claim', async () => {
                const claim = buildClaim(accounts[1].address, issuer.makeClaimCode());
                const tx = await validator.claim(...claim);
                const receipt = await tx.wait();
                const metadata = parseMetadata(await validator.metadata(issuerAddress, accounts[1].address, issuer.makeClaimCode().data));
                expect(metadata.valid).to.be.true;
                expect(metadata.data.title).to.equal('$TEST token transfer');
                expect(metadata.data.tokentype).to.equal(721);
                expect(metadata.data.token).to.equal(token.address.toLowerCase());
                expect(metadata.data.tokenids[0]).to.equal('2');
            });

            it('returns an error if all tokens have been claimed', async () => {
                // first claim
                const claim1 = buildClaim(accounts[1].address, issuer.makeClaimCode());
                const tx1 = await validator.claim(...claim1);
                const receipt1 = await tx1.wait();

                // second claim
                const claim2 = buildClaim(accounts[2].address, issuer.makeClaimCode());
                const tx2 = await validator.claim(...claim2);
                const receipt2 = await tx2.wait();

                const metadata = parseMetadata(await validator.metadata(issuerAddress, accounts[1].address, issuer.makeClaimCode().data));
                expect(metadata.valid).to.be.false;
                expect(metadata.error).to.equal('All tokens have been claimed.');
            });
        });
    });
}
