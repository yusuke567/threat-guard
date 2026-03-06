/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@threat-guard/shared'],
  async rewrites() {
    const apiUrl = process.env.API_INTERNAL_URL || 'https://api-production-7376b.up.railway.app';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
