// Helper method to wait for a middleware to execute before continuing

import { NextApiRequest, NextApiResponse } from "next"

// And to throw an error when an error happens in a middleware
export default function initMiddleware(middleware: (req: NextApiRequest, res: NextApiResponse, next: (err?: any) => any) => void) {
  return (req: NextApiRequest, res: NextApiResponse) =>
    new Promise((resolve, reject) => {
      middleware(req, res, (result) => {
        if (result instanceof Error) {
          return reject(result)
        }
        return resolve(result)
      })
    })
}
