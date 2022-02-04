import initMiddleware from './init-middleware';
import { factories, Factory } from './factories';
import { NetworkInfo, NETWORKS } from '../config';
import { useRouter } from 'next/router';
import { NextApiRequest } from 'next';

export function useNetwork(): NetworkInfo|undefined {
    const router = useRouter();
    return router.query.network === undefined ? undefined : NETWORKS[router.query.network as string];
}

export { initMiddleware, factories };
export type { Factory };
