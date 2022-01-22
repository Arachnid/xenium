import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Contract, ContractFactory, ContractTransaction } from "ethers";
import { ethers } from "hardhat";
import { buildClaim, NonceIssuer } from "@shibboleth/shibboleth-js";
import { SigningKey } from "@ethersproject/signing-key";

function parseMetadata(datauri: string) {
    expect(datauri).to.match(/^data:application\/json;base64,/);
    return JSON.parse(atob(datauri.split(',')[1]));
}

async function getClone(call: Promise<ContractTransaction>, factory: ContractFactory) {
    const tx = await call;
    const receipt = await tx.wait();
    let address = null;
    if(receipt.events) {
        for(const event of receipt.events) {
            if(event.event === "Cloned") {
                address = event?.args?.instance;
                break;
            }
        }
    }
    if(address !== null) {
        return factory.attach(address);
    }
    throw new Error("Not a clone creation transaction");
}

describe('ERC20TransferUniqueNonceValidator', () => {
    let accounts: SignerWithAddress[];
    let issuerKey: SigningKey;
    let issuerAddress: string;
    let snapshot: number;
    let token: Contract;
    let factory: Contract;
    let validator: Contract;

    before(async () => {
        accounts = await ethers.getSigners();
        issuerKey = new ethers.utils.SigningKey(ethers.utils.randomBytes(32));
        issuerAddress = ethers.utils.computeAddress(issuerKey.privateKey);
        const TestToken = await ethers.getContractFactory("TestToken");
        token = await TestToken.deploy();
        await token.deployed();
        const ERC20TransferUniqueNonceValidatorFactory = await ethers.getContractFactory("ERC20TransferUniqueNonceValidatorFactory");
        const ERC20TransferUniqueNonceValidator = await ethers.getContractFactory("ERC20TransferUniqueNonceValidator");
        factory = await ERC20TransferUniqueNonceValidatorFactory.deploy();
        await factory.deployed();
        validator = await getClone(factory.create(0, accounts[0].address, token.address, accounts[0].address, 1, [issuerAddress]), ERC20TransferUniqueNonceValidator);
        await token.approve(validator.address, '100000000000000000');
    });

    beforeEach(async () => {
        snapshot = await ethers.provider.send("evm_snapshot", []);
    });

    afterEach(async () => {
        await ethers.provider.send("evm_revert", [snapshot]);
    });

    it('gas usage report', async () => {
        const tx = await factory.create(0, accounts[0].address, token.address, accounts[0].address, 1, [issuerAddress])
        const receipt = await tx.wait();
        console.log(`Clone: ${receipt.gasUsed}`);

        const issuer = new NonceIssuer(validator.address, issuerKey, 0);
        const claim = buildClaim(accounts[1].address, issuer.makeClaimCode());
        const tx2 = await validator.claim(...claim);
        const receipt2 = await tx2.wait();
        console.log(`Claim: ${receipt2.gasUsed}`);
    });

    describe('ERC20TransferExecutor', () => {
        let issuer: NonceIssuer;

        before(() => {
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

        describe('metadata()', () => {
            it('returns an error if the allowance is insufficient', async () => {
                await token.approve(validator.address, 0);
                const metadata = parseMetadata(await validator.metadata(issuerAddress, accounts[1].address, issuer.makeClaimCode().data));
                expect(metadata.valid).to.be.false;
                expect(metadata.error).to.equal('Insufficient balance.');
            });

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

    describe('IssuerWhitelistAuth', () => {
        describe('claim()', () => {
            it('allows whitelisted issuers to make claims', async () => {
                const issuer = new NonceIssuer(validator.address, issuerKey, 0);
                const claim = buildClaim(accounts[1].address, issuer.makeClaimCode());
                const tx = await validator.claim(...claim);
                const receipt = await tx.wait();
                expect(receipt.events.map((e:any) => e.event)).to.contain('ClaimExecuted');
            });

            it('prohibits non-whitelisted issuers from making claims', async () => {
                const nonIssuerKey = new ethers.utils.SigningKey(ethers.utils.randomBytes(32));
                const nonIssuer = new NonceIssuer(validator.address, nonIssuerKey, 0);
                const claim = buildClaim(accounts[1].address, nonIssuer.makeClaimCode());
                await expect(validator.claim(...claim)).to.be.revertedWith('UnauthorisedIssuer');
            });
        });

        describe('metadata()', () => {
            it('returns an error for an invalid issuer', async () => {
                const nonIssuerKey = new ethers.utils.SigningKey(ethers.utils.randomBytes(32));
                const nonIssuerAddress = ethers.utils.computeAddress(nonIssuerKey.privateKey);
                const nonIssuer = new NonceIssuer(validator.address, nonIssuerKey, 0);
                const claimCode = nonIssuer.makeClaimCode();
                const metadata = parseMetadata(await validator.metadata(nonIssuerAddress, accounts[1].address, claimCode.data));
                expect(metadata.valid).to.be.false;
                expect(metadata.error).to.equal('Invalid issuer.');
            });
        });

        describe('addIssuer()', () => {
            it('allows the owner to add issuers', async () => {
                const receipt = await (await validator.addIssuers([accounts[0].address])).wait();
                expect(receipt.events.length).to.equal(1);
                expect(receipt.events[0].event).to.equal('IssuersAdded');
                expect(receipt.events[0].args.issuers).to.deep.equal([accounts[0].address]);
            });

            it('does not allow non-owners to add issuers', async () => {
                await expect(validator.connect(accounts[1]).addIssuers([accounts[1].address])).to.be.revertedWith('NotAuthorised');
            });
        });

        describe('removeIssuer()', () => {
            it('allows the owner to remove issuers', async () => {
                const receipt = await (await validator.removeIssuers([issuerAddress])).wait();
                expect(receipt.events.length).to.equal(1);
                expect(receipt.events[0].event).to.equal('IssuersRemoved');
                expect(receipt.events[0].args.issuers).to.deep.equal([issuerAddress]);
            });

            it('does not allow non-owners to remove issuers', async () => {
                await expect(validator.connect(accounts[1]).removeIssuers([issuerAddress])).to.be.revertedWith('NotAuthorised');
            });
        });
    });

    describe('UniqueNonceDedup', () => {
        describe('claim()', () => {
            it('accepts old but unused nonces', async () => {
                const issuer = new NonceIssuer(validator.address, issuerKey, 0);
                const claim1 = buildClaim(accounts[1].address, issuer.makeClaimCode());
                const claim2 = buildClaim(accounts[2].address, issuer.makeClaimCode());
                await (await validator.claim(...claim2)).wait();
                const receipt = await (await validator.claim(...claim1)).wait();
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

    describe('BaseValidator', () => {
        describe('claim()', () => {
            it('should emit ClaimExecuted', async () => {
                const issuer = new NonceIssuer(validator.address, issuerKey, 0);
                const claim = buildClaim(accounts[1].address, issuer.makeClaimCode());
                const receipt = await (await validator.claim(...claim)).wait();
                expect(receipt.events[0].event).to.equal('ClaimExecuted');
                expect(receipt.events[0].args.claimId).to.equal(ethers.utils.keccak256(claim[2]));
                expect(receipt.events[0].args.issuer).to.equal(issuerAddress);
                expect(receipt.events[0].args.beneficiary).to.equal(accounts[1].address);
                expect(receipt.events[0].args.data).to.equal(ethers.utils.hexlify(claim[1]));
                expect(receipt.events[0].args.authsig).to.equal(ethers.utils.hexlify(claim[2]));
                expect(receipt.events[0].args.claimsig).to.equal(ethers.utils.hexlify(claim[3]));
            });
        });
    });
});
