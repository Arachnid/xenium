import { NodeUrls, Rinkeby } from "@usedapp/core";

export const INFURA_KEY = "f8f5536553f5466ba66ad3f0cb384b5e";
export const NETWORKS: NodeUrls = {
    [Rinkeby.chainId]: `https://rinkeby.infura.io/v3/${INFURA_KEY}`,
}
