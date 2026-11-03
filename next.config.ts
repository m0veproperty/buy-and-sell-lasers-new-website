import type { NextConfig } from 'next';
const config: NextConfig = { output: 'export', images: { unoptimized: true }, devIndicators: false, experimental: { useTypeScriptCli: false, workerThreads: true, webpackBuildWorker: false, cpus: 2 } };
export default config;
