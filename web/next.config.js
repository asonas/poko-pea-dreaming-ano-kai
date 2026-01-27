/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transformers.jsのWebAssemblyサポート
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "sharp$": false,
      "onnxruntime-node$": false,
    };
    return config;
  },
  
  // サーバーレス関数のタイムアウト設定（Vercel Pro以上で有効）
  experimental: {
    serverComponentsExternalPackages: ['@xenova/transformers'],
  },
};

module.exports = nextConfig;
