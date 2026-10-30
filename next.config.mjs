/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build a self-contained server bundle (.next/standalone) so the Docker image only needs the
  // traced node_modules, not the full dependency tree. Wajib untuk image produksi yang ramping.
  output: 'standalone',
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
    // pdfjs-dist & tesseract.js dijalankan runtime dari node_modules (WASM/worker), bukan bundle webpack.
    serverComponentsExternalPackages: ['pdfjs-dist', 'tesseract.js'],
  },
}
export default nextConfig
