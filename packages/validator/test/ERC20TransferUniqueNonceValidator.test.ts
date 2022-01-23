import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";
import { ethers } from "hardhat";
import { buildClaim, NonceIssuer } from "@shibboleth/shibboleth-js";
import { SigningKey } from "@ethersproject/signing-key";
import { TestToken } from "../typechain/TestToken";
import { ERC20TransferUniqueNonceValidator } from "../typechain/ERC20TransferUniqueNonceValidator";
import { erc20TransferExecutor } from "./ERC20TransferExecutor.spec";
import { getClone, parseMetadata } from "./utils";
import { issuerWhitelistAuth } from "./IssuerWhitelistAuth.spec";
import { uniqueNonceDedup } from "./UniqueNonceDedup.spec";
import { baseValidator } from "./BaseValidator.spec";

describe('ERC20TransferUniqueNonceValidator', () => {
    let accounts: SignerWithAddress[];
    let issuerKey: SigningKey;
    let issuerAddress: string;
    let snapshot: number;
    let token: TestToken;
    let factory: Contract;
    let validator: ERC20TransferUniqueNonceValidator;

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

    erc20TransferExecutor(() => ({issuerKey, token, validator}));

    issuerWhitelistAuth(() => ({issuerKey, validator}));

    uniqueNonceDedup(() => ({issuerKey, validator}));

    baseValidator(() => ({issuerKey, validator}));
});
