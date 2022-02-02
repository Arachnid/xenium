import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { buildClaim, NonceIssuer } from "@xenium-eth/xenium-js";
import { ethers } from 'hardhat';
import { ERC20Executor } from '../typechain/ERC20Executor';
import { TestToken } from '../typechain/TestToken';
import { expect } from "chai";
import { SigningKey } from '@ethersproject/signing-key';
import { parseMetadata } from './utils';

interface Args {
    validator: ERC20Executor;
    token: TestToken;
    issuerKey: SigningKey;
}

export function erc20Executor(getArgs: ()=>Args) {
    describe('ERC20Executor', () => {
        let issuer: NonceIssuer;
        let validator: ERC20Executor;
        let token: TestToken;
        let issuerKey: SigningKey;
        let issuerAddress: string;
        let accounts: SignerWithAddress[];

        before(async () => {
            accounts = await ethers.getSigners();
            ({validator, token, issuerKey} = getArgs());
            issuerAddress = ethers.utils.computeAddress(issuerKey.privateKey);
            issuer = new NonceIssuer(validator.address, issuerKey, 0);
        });

        describe('claim()', () => {
            it('transfers ERC20 tokens on claim', async() => {
                const claim = buildClaim(accounts[1].address, issuer.makeClaimCode());
                const tx = await validator.claim(...claim);
                const receipt = await tx.wait();
                expect(await token.balanceOf(accounts[1].address)).to.equal(1);
            });
        });

        describe('isExecutable()', () => {
            it('returns false if the balance is insufficient', async () => {
                await validator.transfer(token.address, accounts[0].address, await token.balanceOf(validator.address));
                const claimCode = issuer.makeClaimCode();
                expect(await validator.isExecutable(issuerAddress, claimCode.claimant, claimCode.data)).to.equal(false);
            });
        });

        describe('metadata()', () => {
            it('returns token metadata for a valid claim', async () => {
                const metadata = parseMetadata(await validator.metadata(issuerAddress, accounts[1].address, issuer.makeClaimCode().data));
                expect(metadata.valid).to.be.true;
                expect(metadata.data.title).to.equal('$TEST token transfer');
                expect(metadata.data.tokentype).to.equal(20);
                expect(metadata.data.token).to.equal(token.address.toLowerCase());
                expect(metadata.data.amount).to.equal('1');
            });
        });
    });
}
