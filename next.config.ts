import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  basePath: process.env.GITHUB_PAGES ? '/kujou-high-school' : '',
  assetPrefix: process.env.GITHUB_PAGES ? '/kujou-high-school/' : '',
  images: { unoptimized: true },
  webpack: (config) => {
    // Allow Phaser to bundle properly
    config.module.rules.push({
      test: /\.js$/,
      include: /node_modules\/phaser/,
      use: { loader: 'babel-loader', options: { presets: ['@babel/preset-env'] } }
    });
    return config;
  },
};

export default nextConfig;
