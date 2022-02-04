import initMiddleware from './init-middleware';
import { factories, Factory } from './factories';
import { NetworkInfo, NETWORKS } from '../config';
import { useRouter } from 'next/router';
import { NextApiRequest } from 'next';

export function useNetwork(): NetworkInfo|undefined {
    const router = useRouter();
    return getNetwork(typeof window === 'undefined' ? undefined : window.location.hostname, router.query.network as string);
}

export function getNetwork(hostname: string|undefined, query: string|undefined): NetworkInfo|undefined {
    if(hostname) {
        const networkName = hostname.split('.')[0].toLowerCase();
        if(NETWORKS[networkName] !== undefined) {
            return NETWORKS[networkName];
        }
    }
    if(query) {
        return NETWORKS[query];
    }
    return undefined;
}

export { initMiddleware, factories };
export type { Factory };
