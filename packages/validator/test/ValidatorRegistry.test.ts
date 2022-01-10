import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Contract } from "ethers";
import { arrayify, computeAddress, defaultAbiCoder, hexlify, randomBytes, SigningKey } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { buildClaim, NonceIssuer } from "@shibboleth/shibboleth-js";

function parseMetadata(datauri: string) {
    expect(datauri).to.match(/^data:application\/json;base64,/);
    return JSON.parse(atob(datauri.split(',')[1]));
}

describe('ValidatorRegistry', () => {
    let signers: SignerWithAddress[];
    let snapshot: number;
    let executor: Contract;
    let validator: Contract;
    let issuerkey: SigningKey;
    let issuer: NonceIssuer;
    let issueraddress: string;

    before(async () => {
        signers = await ethers.getSigners();

        const ValidatorRegistry = await ethers.getContractFactory("ValidatorRegistry");
        validator = await ValidatorRegistry.deploy();
        await validator.deployed();

        const TestHighestNonceExecutor = await ethers.getContractFactory("TestHighestNonceExecutor");
        executor = await TestHighestNonceExecutor.deploy(validator.address);
        await executor.deployed();

        issuerkey = new SigningKey(randomBytes(32));
        issueraddress = computeAddress(issuerkey.privateKey);
    });

    beforeEach(async () => {
        issuer = new NonceIssuer(validator.address, issuerkey, 0);
        snapshot = await ethers.provider.send("evm_snapshot", []);
    });

    afterEach(async () => {
        await ethers.provider.send("evm_revert", [snapshot]);
    });

    describe('claim()', () => {
        it('fails if no data is provided', async () => {
            const claim = buildClaim(signers[1].address, issuer.makeClaimCode());
            await expect(validator.claim(claim[0], '0x', claim[2], claim[3])).to.be.revertedWith('InvalidRequest');
        });

        it('fails if the request type is not 00 or 01', async () => {
            const claim = buildClaim(signers[1].address, issuer.makeClaimCode(2));
            await expect(validator.claim(...claim)).to.be.revertedWith('InvalidClaimType');
        });

        describe('config requests', () => {
            it('accepts a request to set the owner', async () => {
                const claim = buildClaim(signers[1].address, issuer.makeConfigCode());
                const tx = await validator.claim(...claim);
                const receipt = await tx.wait();
                const events = receipt.events;

                expect(events[0].event).to.equal('OwnershipUpdated');
                expect(events[0].args.issuer).to.equal(issueraddress);
                expect(events[0].args.owner).to.equal(signers[1].address);

                expect(events[1].event).to.equal('ClaimExecuted');
                expect(events[1].args.issuer).to.equal(issueraddress);
                expect(events[1].args.beneficiary).to.equal(signers[1].address);
                expect(events[1].args.data).to.equal(hexlify(claim[1]));
                expect(events[1].args.authsig).to.equal(hexlify(claim[2]));
                expect(events[1].args.claimsig).to.equal(hexlify(claim[3]));
            });

            it('allows nonces to be skipped', async () => {
                buildClaim(signers[1].address, issuer.makeConfigCode());
                const claim = buildClaim(signers[1].address, issuer.makeConfigCode());
                const tx = await validator.claim(...claim);
                const receipt = await tx.wait();
                const events = receipt.events;

                expect(events[0].event).to.equal('OwnershipUpdated');
                expect(events[0].args.issuer).to.equal(issueraddress);
                expect(events[0].args.owner).to.equal(signers[1].address);
            });

            it('rejects requests with invalid nonces', async () => {
                const claim = buildClaim(signers[1].address, issuer.makeConfigCode());
                const tx = await validator.claim(...claim);
                const receipt = await tx.wait();
                const events = receipt.events;

                expect(events[0].event).to.equal('OwnershipUpdated');
                expect(events[0].args.issuer).to.equal(issueraddress);
                expect(events[0].args.owner).to.equal(signers[1].address);

                await expect(validator.claim(...claim)).to.be.revertedWith('NonceTooLow');
            });

            it('fails if the data is too short', async () => {
                const claim = buildClaim(signers[1].address, issuer.makeConfigCode());
                await expect(validator.claim(claim[0], arrayify(claim[1]).slice(0, -2), claim[2], claim[3])).to.be.revertedWith('InvalidRequest');
            });
        });

        describe('claim requests', () => {
            it('rejects claim requests with no executor set', async () => {
                const claim = buildClaim(signers[1].address, issuer.makeClaimCode());

                await expect(validator.claim(...claim)).to.be.revertedWith('NotConfigured');
            });

            it('forwards valid claims to the executor', async () => {
                // Configure the executor for this issuer
                const conf = buildClaim(signers[0].address, issuer.makeConfigCode());
                const tx = await validator.claim(...conf);
                await tx.wait();
                const tx2 = await validator.configure(issueraddress, executor.address, '0x');
                await tx2.wait();

                const claim = buildClaim(signers[1].address, issuer.makeClaimCode());
                const tx3 = await validator.claim(...claim);
                const receipt = await tx3.wait();
                const events = receipt.events;

                const claimed = executor.interface.parseLog(events[0]);
                expect(claimed.name).to.equal('Claimed');
                expect(claimed.args.issuer).to.equal(issueraddress);
                expect(claimed.args.beneficiary).to.equal(signers[1].address);
                expect(claimed.args.claimData).to.equal(hexlify(arrayify(claim[1]).slice(1)));
                expect(claimed.args.executorData).to.equal('0x');

                expect(events[1].event).to.equal('ClaimExecuted');
                expect(events[1].args.issuer).to.equal(issueraddress);
                expect(events[1].args.beneficiary).to.equal(signers[1].address);
                expect(events[1].args.data).to.equal(hexlify(claim[1]));
                expect(events[1].args.authsig).to.equal(hexlify(claim[2]));
                expect(events[1].args.claimsig).to.equal(hexlify(claim[3]));
            });
        });
    });

    describe('configuring', () => {
        it('allows the owner to set an executor and extra data', async () => {
            const conf = buildClaim(signers[0].address, issuer.makeConfigCode());
            const tx = await validator.claim(...conf);
            await tx.wait();

            const tx2 = await validator.configure(issueraddress, executor.address, '0x');
            const receipt = await tx2.wait();
            const events = receipt.events;

            expect(events[0].event).to.equal('ConfigurationUpdated');
            expect(events[0].args.issuer).to.equal(issueraddress);
            expect(events[0].args.executor).to.equal(executor.address);
            expect(events[0].args.data).to.equal('0x');
        });

        it('does not allow non-owners to call configure', async () => {
            const conf = buildClaim(signers[0].address, issuer.makeConfigCode());
            const tx = await validator.claim(...conf);
            await tx.wait();

            await expect(validator.connect(signers[1]).configure(issueraddress, executor.address, '0x')).to.be.revertedWith('NotAuthorised');
        });
    });


    describe('metadata', () => {
        it('returns the executor metadata for a claim request', async () => {
            const conf = buildClaim(signers[0].address, issuer.makeConfigCode());
            const tx = await validator.claim(...conf);
            await tx.wait();
            const tx2 = await validator.configure(issueraddress, executor.address, '0x');
            await tx2.wait();
            
            const claimcode = issuer.makeClaimCode();

            const metadata = parseMetadata(await validator.metadata(issueraddress, claimcode.claimant, claimcode.data));
            expect(metadata.valid).to.be.true;
            expect(metadata.data.title).to.equal('Emit an event');
        });

        it('returns an error if no executor is set', async () => {
            const claimcode = issuer.makeClaimCode();
            const metadata = parseMetadata(await validator.metadata(issueraddress, claimcode.claimant, claimcode.data));
            expect(metadata.valid).to.be.false;
            expect(metadata.error).to.equal('No executor configured for this issuer');
        });

        it('returns metadata for a configuration request', async () => {
            const configcode = issuer.makeConfigCode();
            const metadata = parseMetadata(await validator.metadata(issueraddress, configcode.claimant, configcode.data));
            expect(metadata.valid).to.be.true;
            expect(metadata.data.title).to.equal(`Set owner for issuer ${issueraddress.toLowerCase()}`);
        });

        it('returns an error if the configuration nonce is too low', async () => {
            const configcode = issuer.makeConfigCode();
            const conf = buildClaim(signers[0].address, configcode);
            const tx = await validator.claim(...conf);
            await tx.wait();

            const metadata = parseMetadata(await validator.metadata(issueraddress, configcode.claimant, conf[1]));
            expect(metadata.valid).to.be.false;
            expect(metadata.error).to.equal('Nonce too low');
        });

        it('returns an error for an unknown request type', async () => {
            const code = issuer.makeClaimCode(1);
            const metadata = parseMetadata(await validator.metadata(issueraddress, code.claimant, code.data));
            expect(metadata.valid).to.be.false;
            expect(metadata.error).to.equal('Unknown command type');
        });
    });
});
