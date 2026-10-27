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
    'app.hunarpay.com',
    'hunarpay.com',
    'pay.hunarpay.com',
    '192.168.1.11:3001',
    '192.168.1.11:3000',
    '192.168.1.11',
    '192.168.29.248:3001',
    '192.168.29.248:3000',
    '192.168.29.248',
    'localhost:3001',
    'localhost:3000',
  ],
};

export default nextConfig;
