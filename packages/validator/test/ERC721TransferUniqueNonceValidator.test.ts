import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";
import { ethers } from "hardhat";
import { buildClaim, NonceIssuer } from "@xenium-eth/xenium-js";
import { SigningKey } from "@ethersproject/signing-key";
import { TestERC721 } from "../typechain/TestERC721";
import { ERC721TransferUniqueNonceValidator } from "../typechain/ERC721TransferUniqueNonceValidator";
import { erc721TransferExecutor } from "./ERC721TransferExecutor.spec";
import { getClone, parseMetadata } from "./utils";
import { issuerWhitelistAuth } from "./IssuerWhitelistAuth.spec";
import { uniqueNonceDedup } from "./UniqueNonceDedup.spec";
import { baseValidator } from "./BaseValidator.spec";
import { defaultAbiCoder } from '@ethersproject/abi';

describe('ERC721TransferUniqueNonceValidator', () => {
    let accounts: SignerWithAddress[];
    let issuerKey: SigningKey;
    let issuerAddress: string;
    let snapshot: number;
    let token: TestERC721;
    let factory: Contract;
    let validator: ERC721TransferUniqueNonceValidator;

    before(async () => {
        accounts = await ethers.getSigners();
        issuerKey = new ethers.utils.SigningKey(ethers.utils.randomBytes(32));
        issuerAddress = ethers.utils.computeAddress(issuerKey.privateKey);
        const TestERC721 = await ethers.getContractFactory("TestERC721");
        token = await TestERC721.deploy();
        await token.deployed();
        const ERC721TransferUniqueNonceValidatorFactory = await ethers.getContractFactory("ERC721TransferUniqueNonceValidatorFactory");
        const ERC721TransferUniqueNonceValidator = await ethers.getContractFactory("ERC721TransferUniqueNonceValidator");
        factory = await ERC721TransferUniqueNonceValidatorFactory.deploy();
        await factory.deployed();
        validator = await getClone(factory.create(0, accounts[0].address, token.address, accounts[0].address, [1, 2], [issuerAddress]), ERC721TransferUniqueNonceValidator);
        await token.setApprovalForAll(validator.address, true);
    });

    beforeEach(async () => {
        snapshot = await ethers.provider.send("evm_snapshot", []);
    });

    afterEach(async () => {
        await ethers.provider.send("evm_revert", [snapshot]);
    });

    it('gas usage report', async () => {
        const tx = await factory.create(0, accounts[0].address, token.address, accounts[0].address, [1, 2], [issuerAddress])
        const receipt = await tx.wait();
        console.log(`Clone: ${receipt.gasUsed}`);

        const issuer = new NonceIssuer(validator.address, issuerKey, 0);
        const claim = buildClaim(accounts[1].address, issuer.makeClaimCode());
        const tx2 = await validator.claim(...claim);
        const receipt2 = await tx2.wait();
        console.log(`Claim: ${receipt2.gasUsed}`);
    });

    erc721TransferExecutor(() => ({ issuerKey, token, validator }));

    issuerWhitelistAuth(() => ({ issuerKey, validator }));

    uniqueNonceDedup(() => ({ issuerKey, validator }));

    baseValidator(() => ({ issuerKey, validator }));
});
