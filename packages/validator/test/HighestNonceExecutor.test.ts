import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Contract } from "ethers";
import { defaultAbiCoder } from "ethers/lib/utils";
import { ethers } from "hardhat";

function parseMetadata(datauri: string) {
    expect(datauri).to.match(/^data:application\/json;base64,/);
    return JSON.parse(atob(datauri.split(',')[1]));
}

describe('HighestNonceExecutor', () => {
    let signers: SignerWithAddress[];
    let snapshot: number;
    let executor: Contract;

    before(async () => {
        signers = await ethers.getSigners();
        const TestHighestNonceExecutor = await ethers.getContractFactory("TestHighestNonceExecutor");
        executor = await TestHighestNonceExecutor.deploy(signers[0].address);
        await executor.deployed();
    });

    beforeEach(async () => {
        snapshot = await ethers.provider.send("evm_snapshot", []);
    });

    afterEach(async () => {
        await ethers.provider.send("evm_revert", [snapshot]);
    })

    describe('executeClaim()', () => {
        it('emits an event and updates the nonce', async () => {
            const claimData = defaultAbiCoder.encode(['uint64'], [0]);
            const executorData = '0x';
            const tx = await executor.executeClaim(signers[0].address, signers[1].address, claimData, executorData);
            const receipt = await tx.wait();
            expect(receipt.events.length).to.equal(1);
            expect(receipt.events[0].event).to.equal('Claimed');
            const args = receipt.events[0].args;
            expect(args.issuer).to.equal(signers[0].address);
            expect(args.beneficiary).to.equal(signers[1].address);
            expect(args.claimData).to.equal(claimData);
            expect(args.executorData).to.equal(executorData);
        });

        it('only allows calls from the validator', async () => {
            const claimData = defaultAbiCoder.encode(['uint64'], [0]);
            const executorData = '0x';
            await expect(executor.connect(signers[1]).executeClaim(signers[0].address, signers[1].address, claimData, executorData)).to.be.reverted;
        });

        it('allows skipping nonces', async () => {
            const claimData = defaultAbiCoder.encode(['uint64'], [1]);
            const executorData = '0x';
            const tx = await executor.executeClaim(signers[0].address, signers[1].address, claimData, executorData);
            const receipt = await tx.wait();
            expect(receipt.events.length).to.equal(1);
            expect(receipt.events[0].event).to.equal('Claimed');
        });

        it('reverts if the nonce is too low', async () => {
            const claimData = defaultAbiCoder.encode(['uint64'], [0]);
            const executorData = '0x';
            const tx = await executor.executeClaim(signers[0].address, signers[1].address, claimData, executorData);
            const receipt = await tx.wait();
            expect(receipt.events.length).to.equal(1);
            expect(receipt.events[0].event).to.equal('Claimed');
            await expect(executor.executeClaim(signers[0].address, signers[1].address, claimData, executorData)).to.be.reverted;
        });

        it('reverts if no nonce is provided', async () => {
            const claimData = '0x';
            const executorData = '0x';
            await expect(executor.executeClaim(signers[0].address, signers[1].address, claimData, executorData)).to.be.reverted;
        });
    });

    describe('metadata()', () => {
        it('returns valid metadata', async () => {
            const claimData = defaultAbiCoder.encode(['uint64'], [0]);
            const executorData = '0x';
            const metadata = parseMetadata(await executor.metadata(signers[0].address, claimData, executorData));
            expect(metadata.valid).to.be.true;
        });

        it('returns an error in the metadata if the nonce is too low', async () => {
            const claimData = defaultAbiCoder.encode(['uint64'], [0]);
            const executorData = '0x';
            const tx = await executor.executeClaim(signers[0].address, signers[1].address, claimData, executorData);
            await tx.wait();
            const metadata = parseMetadata(await executor.metadata(signers[0].address, claimData, executorData));
            expect(metadata.valid).to.be.false;
        });
    });
});
