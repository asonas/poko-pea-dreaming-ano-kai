const path = require('node:path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transformers.jsのWebAssemblyサポート
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, 'src'),
      'sharp$': false,
      'onnxruntime-node$': false,
    };
    return config;
  },

  // サーバーレス関数のタイムアウト設定（Vercel Pro以上で有効）
  serverExternalPackages: ['@huggingface/transformers'],
};

module.exports = nextConfig;
