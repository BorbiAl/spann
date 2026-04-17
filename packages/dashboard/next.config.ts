import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@spann/shared'],
  experimental: {
    typedRoutes: true,
  },
};

export default config;
