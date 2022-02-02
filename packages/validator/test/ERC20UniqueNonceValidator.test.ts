import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";
import { ethers } from "hardhat";
import { buildClaim, NonceIssuer } from "@xenium-eth/xenium-js";
import { SigningKey } from "@ethersproject/signing-key";
import { TestToken } from "../typechain/TestToken";
import { ERC20UniqueNonceValidator } from "../typechain/ERC20UniqueNonceValidator";
import { erc20Executor } from "./ERC20Executor.spec";
import { getClone, parseMetadata } from "./utils";
import { issuerWhitelistAuth } from "./IssuerWhitelistAuth.spec";
import { uniqueNonceDedup } from "./UniqueNonceDedup.spec";
import { baseValidator } from "./BaseValidator.spec";

describe('ERC20UniqueNonceValidator', () => {
    let accounts: SignerWithAddress[];
    let issuerKey: SigningKey;
    let issuerAddress: string;
    let snapshot: number;
    let token: TestToken;
    let factory: Contract;
    let validator: ERC20UniqueNonceValidator;

    before(async () => {
        accounts = await ethers.getSigners();
        issuerKey = new ethers.utils.SigningKey(ethers.utils.randomBytes(32));
        issuerAddress = ethers.utils.computeAddress(issuerKey.privateKey);
        const TestToken = await ethers.getContractFactory("TestToken");
        token = await TestToken.deploy();
        await token.deployed();
        const ERC20UniqueNonceValidatorFactory = await ethers.getContractFactory("ERC20UniqueNonceValidatorFactory");
        const ERC20UniqueNonceValidator = await ethers.getContractFactory("ERC20UniqueNonceValidator");
        factory = await ERC20UniqueNonceValidatorFactory.deploy();
        await factory.deployed();
        validator = await getClone(factory.create(0, accounts[0].address, token.address, 1, [issuerAddress]), ERC20UniqueNonceValidator);
        await token.transfer(validator.address, '100000000000000000');
    });

    beforeEach(async () => {
        snapshot = await ethers.provider.send("evm_snapshot", []);
    });

    afterEach(async () => {
        await ethers.provider.send("evm_revert", [snapshot]);
    });

    it('gas usage report', async () => {
        const tx = await factory.create(0, accounts[0].address, token.address, 1, [issuerAddress])
        const receipt = await tx.wait();
        console.log(`Clone: ${receipt.gasUsed}`);

        const issuer = new NonceIssuer(validator.address, issuerKey, 0);
        const claim = buildClaim(accounts[1].address, issuer.makeClaimCode());
        const tx2 = await validator.claim(...claim);
        const receipt2 = await tx2.wait();
        console.log(`Claim: ${receipt2.gasUsed}`);
    });

    erc20Executor(() => ({issuerKey, token, validator}));

    issuerWhitelistAuth(() => ({issuerKey, validator}));

    uniqueNonceDedup(() => ({issuerKey, validator}));

    baseValidator(() => ({issuerKey, validator}));
});
