/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@threat-guard/shared'],
  async rewrites() {
    const apiUrl = process.env.API_INTERNAL_URL || 'http://localhost:3001';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
