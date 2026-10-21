/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  allowedDevOrigins: [
    '192.168.29.248:3001',
    '192.168.29.248:3000',
    '192.168.29.248',
    'localhost:3001',
    'localhost:3000',
  ],
};

export default nextConfig;
