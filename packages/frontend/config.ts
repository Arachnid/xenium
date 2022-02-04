import { NodeUrls, Rinkeby } from "@usedapp/core";

export const INFURA_KEY = "f8f5536553f5466ba66ad3f0cb384b5e";

export interface NetworkInfo {
    chainId: number;
    provider: string;
    subgraph: string;
}

export const NETWORKS: {[key: string]: NetworkInfo} = {
    'rinkeby': {
        chainId: Rinkeby.chainId,
        provider: `https://rinkeby.infura.io/v3/${INFURA_KEY}`,
        subgraph: 'https://api.thegraph.com/subgraphs/name/arachnid/xeniumrinkeby'
    }
}
