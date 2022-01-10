import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Contract } from "ethers";
import { defaultAbiCoder } from "ethers/lib/utils";
import { ethers } from "hardhat";

describe('ERC20Executor', () => {
    let signers: SignerWithAddress[];
    let snapshot: number;
    let executor: Contract;
    let token: Contract;
    let balance: number;

    before(async () => {
        signers = await ethers.getSigners();
        const ERC20Executor = await ethers.getContractFactory("TestERC20Executor");
        executor = await ERC20Executor.deploy(signers[0].address);
        await executor.deployed();

        // deploy mock token to owner
        const MockToken = await ethers.getContractFactory("ERC20Mock");
        token = await MockToken.deploy();

        balance = await token.balanceOf(signers[0].address);
        await token.approve(executor.address, balance);
    });

    beforeEach(async () => {
        snapshot = await ethers.provider.send("evm_snapshot", []);
    });

    afterEach(async () => {
        await ethers.provider.send("evm_revert", [snapshot]);
    })

    describe('executeClaim()', () => {
        it('emits an event and tranfers tokens', async () => {
            const amount = balance
            const expiration = 11234234223
            const claimData = defaultAbiCoder.encode(
                ['address', 'address', 'uint256', 'uint256'], [signers[0].address, token.address, amount, expiration]
            );
            const executorData = '0x';
            const claimant = signers[3].address
            const tx = await executor.executeClaim(signers[0].address, claimant, signers[1].address, claimData, executorData);
            const receipt = await tx.wait();
            expect(receipt.events.length).to.equal(3);
            expect(receipt.events[2].event).to.equal('ClaimedERC20');
            const args = receipt.events[2].args;
            expect(args.issuer).to.equal(signers[0].address);
            expect(args.from).to.equal(signers[0].address);
            expect(args.beneficiary).to.equal(signers[1].address);
            expect(args.token).to.equal(token.address);
            expect(args.amount).to.equal(amount);
            expect(args.expiration).to.equal(expiration);

            await expect(await token.balanceOf(signers[0].address)).to.be.equal(0);
            await expect(await token.balanceOf(signers[1].address)).to.be.equal(balance);
        });

        it('only allows calls from the validator', async () => {
            const amount = balance
            const expiration = 11234234223
            const claimData = defaultAbiCoder.encode(
                ['address', 'address', 'uint256', 'uint256'], [signers[0].address, token.address, amount, expiration]
            );
            const executorData = '0x';
            const claimant = signers[3].address
            await expect(executor.connect(signers[1]).executeClaim(signers[0].address, claimant, signers[1].address, claimData, executorData)).to.be.reverted;
        });

        it('reverts if the deadline has passed', async () => {
            const amount = balance
            const expiration = 1438251133
            const claimData = defaultAbiCoder.encode(
                ['address', 'address', 'uint256', 'uint256'], [signers[0].address, token.address, amount, expiration]
            );
            const executorData = '0x';
            const claimant = signers[3].address
            await expect(executor.executeClaim(signers[0].address, claimant, signers[1].address, claimData, executorData)).to.be.reverted;
        });
    });
});
