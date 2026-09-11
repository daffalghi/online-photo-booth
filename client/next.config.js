const BACKEND_URL = process.env.INTERNAL_BACKEND_URL || 'http://127.0.0.1:3001';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // disable to prevent double effect runs breaking WebRTC
  skipTrailingSlashRedirect: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${BACKEND_URL}/uploads/:path*`,
      },
      {
        source: '/renders/:path*',
        destination: `${BACKEND_URL}/renders/:path*`,
      },
      {
        source: '/socket.io',
        destination: `${BACKEND_URL}/socket.io/`,
      },
      {
        source: '/socket.io/:path*',
        destination: `${BACKEND_URL}/socket.io/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;


