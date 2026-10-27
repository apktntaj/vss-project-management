/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build a self-contained server bundle (.next/standalone) so the Docker image only needs the
  // traced node_modules, not the full dependency tree. Wajib untuk image produksi yang ramping.
  output: 'standalone',
  experimental: { serverActions: { bodySizeLimit: '10mb' } },
}
export default nextConfig
