import { NextApiRequest, NextApiResponse } from "next";
import { NETWORKS } from "../../config";

interface Data {
    name: string,
    url: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Array<Data>>) {
    const hostname = req.headers.host;
    if(!hostname) {
        return res.status(404);
    }
    res.json(Object.entries(NETWORKS).map(([k, v]) => ({name: v.name, url: `https://${k}.${hostname}/`})));
}
