import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@fxl-finders/shared-types',
    '@fxl-finders/shared-utils',
  ],
};

export default nextConfig;
