import type { NextConfig } from 'next';
const config: NextConfig = { images: { unoptimized: true }, devIndicators: false, experimental: { useTypeScriptCli: false, workerThreads: true, webpackBuildWorker: false, cpus: 2 },
  webpack(config,{dev}) {
    if(dev) config.watchOptions={...config.watchOptions,ignored:['**/node_modules/**','**/.git/**','**/work/**','**/outputs/**','**/*.sqlite*']};
    return config;
  }
};
export default config;
