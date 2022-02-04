/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  rewrites: async () => {
    return {
      beforeFiles: [
        {
          source: '/:network/api/:path*',
          destination: '/api/:network/:path*'
        },
      ]
    };
  }
}
