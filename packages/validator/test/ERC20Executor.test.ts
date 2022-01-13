import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Contract, BigNumber } from "ethers";
import { defaultAbiCoder } from "ethers/lib/utils";
import { ethers } from "hardhat";

function parseMetadata(datauri: string) {
    expect(datauri).to.match(/^data:application\/json;base64,/);
    return JSON.parse(atob(datauri.split(',')[1]));
}

const DECEMBER_31_2325 = 11234234223 // Thursday, December 31, 2325 8:37:03 PM
const JULY_30_2015 = 1438251133 // Thursday, July 30, 2015 10:12:13 AM

describe('ERC20Executor', () => {
    let signers: SignerWithAddress[];
    let snapshot: number;
    let executor: Contract;
    let token: Contract;
    let owner: SignerWithAddress;
    let issuer: SignerWithAddress;
    let beneficiary: SignerWithAddress;
    let claimant: SignerWithAddress;
    let claimData: string;
    let claimAmount: BigNumber;
    let balance: BigNumber;

    before(async () => {
        signers = await ethers.getSigners();
        owner = signers[0];
        issuer = signers[1];
        beneficiary = signers[2]
        claimant = signers[3]

        claimData = defaultAbiCoder.encode(['uint64'], [0]);

        const ERC20Executor = await ethers.getContractFactory("TestERC20Executor");
        executor = await ERC20Executor.deploy(owner.address);
        await executor.deployed();


        // deploy mock token to owner
        const MockToken = await ethers.getContractFactory("ERC20Mock");
        token = await MockToken.deploy();

        balance = await token.balanceOf(owner.address);
        await token.approve(executor.address, balance);

        // configure executor
        claimAmount = balance.div("100");
        const expiration = DECEMBER_31_2325
        const configData = defaultAbiCoder.encode(
            ['address', 'uint256', 'uint256'], [token.address, claimAmount, expiration]
        );
        await executor.configure(issuer.address, owner.address, configData);
    });

    beforeEach(async () => {
        snapshot = await ethers.provider.send("evm_snapshot", []);
    });

    afterEach(async () => {
        await ethers.provider.send("evm_revert", [snapshot]);
    })

    describe('executeClaim()', () => {
        it('emits an event and tranfers tokens', async () => {
            const tx = await executor.executeClaim(issuer.address, claimant.address, beneficiary.address, claimData);
            const receipt = await tx.wait();
            expect(receipt.events.length).to.equal(3);
            expect(receipt.events[2].event).to.equal('ClaimedERC20');
            const args = receipt.events[2].args;
            expect(args.issuer).to.equal(issuer.address);
            expect(args.from).to.equal(owner.address);
            expect(args.beneficiary).to.equal(beneficiary.address);
            expect(args.token).to.equal(token.address);
            expect(args.amount).to.equal(claimAmount);

            await expect(await token.balanceOf(owner.address)).to.be.equal(balance.sub(claimAmount));
            await expect(await token.balanceOf(beneficiary.address)).to.be.equal(claimAmount);
        });

        it('claimant can be claimed only once', async () => {
            // first claim should pass
            await executor.executeClaim(issuer.address, claimant.address, beneficiary.address, claimData);

            // second claim should revert
            await expect(executor.executeClaim(issuer.address, claimant.address, beneficiary.address, claimData)).to.be.reverted;
        });

        it('only allows calls from the validator', async () => {
            await expect(executor.connect(beneficiary).executeClaim(issuer.address, claimant.address, beneficiary.address, claimData)).to.be.reverted;
        });

        it('reverts if the deadline has passed', async () => {
            const expiration = JULY_30_2015;
            const configData = defaultAbiCoder.encode(
                ['address', 'uint256', 'uint256'], [token.address, claimAmount, expiration]
            );
            await executor.configure(issuer.address, owner.address, configData);
            await expect(executor.executeClaim(issuer.address, claimant.address, beneficiary.address, claimData)).to.be.reverted;
        });
    });

    describe('metadata()', () => {
        it('returns valid metadata', async () => {
            const metadata = parseMetadata(await executor.metadata(issuer.address, claimant.address, claimData));
            expect(metadata.valid).to.be.true;
        });

        it('returns an error in the metadata if the claimant was already used', async () => {
            const tx = await executor.executeClaim(issuer.address, claimant.address, beneficiary.address, claimData);
            await tx.wait();
            const metadata = parseMetadata(await executor.metadata(issuer.address, claimant.address, claimData));
            expect(metadata.valid).to.be.false;
        });

        it('returns an error in the metadata if deadline has passed', async () => {
            const expiration = JULY_30_2015;
            const configData = defaultAbiCoder.encode(
                ['address', 'uint256', 'uint256'], [token.address, claimAmount, expiration]
            );
            await executor.configure(issuer.address, owner.address, configData);
            const metadata = parseMetadata(await executor.metadata(issuer.address, claimant.address, claimData));
            expect(metadata.valid).to.be.false;
        });
    });
});
