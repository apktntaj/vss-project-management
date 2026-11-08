/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build a self-contained server bundle (.next/standalone) so the Docker image only needs the
  // traced node_modules, not the full dependency tree. Wajib untuk image produksi yang ramping.
  output: 'standalone',
  async redirects() {
    // Cek LARTAS dan IT Inventory pindah ke Tools; tautan lama (bookmark/dokumen) tetap sampai.
    return [
      { source: '/lartas', destination: '/tools?tab=lartas', permanent: false },
      { source: '/it-inventory', destination: '/tools?tab=it-inventory', permanent: false },
    ]
  },
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
    // pdfjs-dist & tesseract.js dijalankan runtime dari node_modules (WASM/worker), bukan bundle webpack.
    serverComponentsExternalPackages: ['pdfjs-dist', 'tesseract.js'],
  },
}
export default nextConfig
