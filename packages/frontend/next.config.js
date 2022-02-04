/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  rewrites: async () => {
    return {
      beforeFiles: [
        {
          source: '/api/:path*{/}?',
          has: [
            {
              type: 'host',
              value: '(?<network>[^.]+)\.xenium.link',
            },
          ],
          destination: '/api/:network/:path*',
        },
        {
          source: '/:path*{/}',
          has: [
            {
              type: 'host',
              value: '(?<network>[^.]+)\.xenium.link',
            },
          ],
          destination: '/:network/:path*',
        },
      ]
    };
  }
}
