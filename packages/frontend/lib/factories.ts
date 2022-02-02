import { ERC20UniqueNonceValidator__factory, IERC20Metadata__factory } from '@xenium-eth/validator';
import { ethers } from 'ethers';
import { INFURA_KEY } from '../config';

export interface Factory {
    describe: (network: ethers.providers.Networkish, address:string) => Promise<string>;
}

export const factories: {[address: string]: Factory} = {
    // ERC20UniqueNonceValidatorFactory
    "0x4c6e8825E9c914D512D61E65EBC25431D816212c": {
        describe: async (network, address) => {
            const provider = new ethers.providers.InfuraProvider(network, INFURA_KEY);
            const validator = ERC20UniqueNonceValidator__factory.connect(address, provider);
            const { token, amount } = await validator.tokenInfo("0x");
            const tokenContract = IERC20Metadata__factory.connect(token, provider);
            const [decimals, symbol] = await Promise.all([tokenContract.decimals(), tokenContract.symbol()]);
            const scaledAmount = ethers.utils.formatUnits(amount, decimals);
            return `Transfer ${scaledAmount} ${symbol} per claim`;
        }
    }
};
