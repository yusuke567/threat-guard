/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@threat-guard/shared'],
  async rewrites() {
    const apiUrl = process.env.API_INTERNAL_URL || 'https://threat-guard-production.up.railway.app';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${apiUrl}/uploads/:path*`,
      },
      {
        source: '/screenshots/:path*',
        destination: `${apiUrl}/screenshots/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
