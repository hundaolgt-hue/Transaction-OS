/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['better-sqlite3', 'bcryptjs', 'nodemailer', 'pdfmake', 'pdfjs-dist'],
  // Files read at runtime that the bundler cannot see: the schema, the demo
  // snapshot restored on first boot, the logo used on PDF covers, and the
  // pdfmake fonts / pdf.js worker loaded by path.
  outputFileTracingIncludes: {
    '/**': [
      './src/lib/schema.sql',
      './seed/**/*',
      './public/brand/**/*',
      './node_modules/pdfmake/build/vfs_fonts.js',
      './node_modules/pdfjs-dist/legacy/build/**/*',
    ],
  },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};
export default nextConfig;
