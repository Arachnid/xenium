import Cors from 'cors';
import initMiddleware from '../../../lib/init-middleware';
import { NextApiRequest, NextApiResponse } from "next"
import { getChainId } from 'web3modal';
import { SUBGRAPH_URLS } from '../../../config';
import { factories } from '../../../lib/factories';

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

    const { network, issuer } = req.query;
    const networkId = getChainId(network as string);
    const issuers = typeof issuer === 'string' ? [issuer] : issuer;
    const response = await fetch(
        SUBGRAPH_URLS[networkId],
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
            description: await factory.describe(networkId, entry.id),
        };
    })));
}
