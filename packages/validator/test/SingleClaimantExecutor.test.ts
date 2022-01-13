import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Contract } from "ethers";
import { defaultAbiCoder } from "ethers/lib/utils";
import { ethers } from "hardhat";

function parseMetadata(datauri: string) {
    expect(datauri).to.match(/^data:application\/json;base64,/);
    return JSON.parse(atob(datauri.split(',')[1]));
}

describe('SingleClaimantExecutor', () => {
    let signers: SignerWithAddress[];
    let snapshot: number;
    let executor: Contract;

    before(async () => {
        signers = await ethers.getSigners();
        const TestSingleClaimantExecutor = await ethers.getContractFactory("TestSingleClaimantExecutor");
        executor = await TestSingleClaimantExecutor.deploy(signers[0].address);
        await executor.deployed();
    });

    beforeEach(async () => {
        snapshot = await ethers.provider.send("evm_snapshot", []);
    });

    afterEach(async () => {
        await ethers.provider.send("evm_revert", [snapshot]);
    })

    describe('executeClaim()', () => {
        it('emits an event and saves the claimant', async () => {
            const claimData = defaultAbiCoder.encode(['uint64'], [0]);
            const claimant = signers[3].address
            const tx = await executor.executeClaim(signers[0].address, claimant, signers[1].address, claimData);
            const receipt = await tx.wait();
            expect(receipt.events.length).to.equal(1);
            expect(receipt.events[0].event).to.equal('Claimed');
            const args = receipt.events[0].args;
            expect(args.issuer).to.equal(signers[0].address);
            expect(args.beneficiary).to.equal(signers[1].address);
            expect(args.claimData).to.equal(claimData);

            // claimant is saved to beneficiary
            expect(await executor.claimants(claimant)).to.equal(signers[1].address);
        });

        it('only allows calls from the validator', async () => {
            const claimData = defaultAbiCoder.encode(['uint64'], [0]);
            const claimant = signers[3].address
            await expect(executor.connect(signers[1]).executeClaim(signers[0].address, claimant, signers[1].address, claimData)).to.be.reverted;
        });

        it('reverts if claimant was used', async () => {
            const claimData = defaultAbiCoder.encode(['uint64'], [0]);
            const claimant = signers[3].address
            const tx = await executor.executeClaim(signers[0].address, claimant, signers[1].address, claimData);
            const claimData2 = defaultAbiCoder.encode(['uint64'], [1]);
            await expect(executor.executeClaim(signers[0].address, claimant, signers[1].address, claimData2)).to.be.reverted;
        });
    });

    describe('metadata()', () => {
        it('returns valid metadata', async () => {
            const claimData = '0x';
            const claimant = signers[3].address
            const metadata = parseMetadata(await executor.metadata(signers[0].address, claimant, claimData));
            expect(metadata.valid).to.be.true;
        });

        it('returns an error in the metadata if the claimant was already used', async () => {
            const claimData = '0x';
            const claimant = signers[3].address
            const tx = await executor.executeClaim(signers[0].address, claimant, signers[1].address, claimData);
            await tx.wait();
            const metadata = parseMetadata(await executor.metadata(signers[0].address, claimant, claimData));
            expect(metadata.valid).to.be.false;
        });
    });
});
