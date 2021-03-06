import Cors from 'cors';
import initMiddleware from '../../../lib/init-middleware';
import { NextApiRequest, NextApiResponse } from "next"
import { factories } from '../../../lib/factories';
import { NETWORKS } from '../../../config';

type Data = {
    address: string,
    description: string,
};

const cors = initMiddleware(Cors({
    methods: ['GET', 'OPTIONS'],
    origin: '*',
}));

const VALIDATOR_QUERY = `
query Validators($issuers: [String!]!) {
    validators(where:{issuers_contains:$issuers}) {
        id
        factory
    }
}
`;

export default async function handler(req: NextApiRequest, res: NextApiResponse<Array<Data>>) {
    await cors(req, res);

    const { issuer, network: networkName } = req.query;
    const network = networkName === undefined ? undefined : NETWORKS[networkName as string];
    if(!network) {
        return res.status(404);
    }

    const issuers = typeof issuer === 'string' ? [issuer] : issuer;
    const response = await fetch(
        network.subgraph,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                query: VALIDATOR_QUERY,
                variables: { issuers }
            })
        }
    );
    const result = await response.json();
    res.json(await Promise.all(result.data.validators.map(async (entry: {factory: string, id: string}) => {
        const factory = factories[entry.factory];
        return {
            address: entry.id,
            description: await factory.describe(network.chainId, entry.id),
        };
    })));
}
