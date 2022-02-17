import initMiddleware from './init-middleware';
import { factories, Factory } from './factories';
import { NetworkInfo, NETWORKS } from '../config';
import { useRouter } from 'next/router';
import { ethers } from 'ethers';

export function useNetwork(): NetworkInfo|undefined {
    const router = useRouter();
    return router.query.network === undefined ? undefined : NETWORKS[router.query.network as string];
}

export interface ClaimMetadata {
    title: string;
    description?: string;
    image?: string;
    claimtype?: string;
    resource?: Uint8Array;
    tokenids?: ethers.BigNumberish[];
    amount?: ethers.BigNumberish;
    properties?: Array<{name: string, value: string|number}>;
}

export { initMiddleware, factories };
export type { Factory };
