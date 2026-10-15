/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  transpilePackages: ['@aurora/core'],
  images: { unoptimized: true },
  poweredByHeader: false,
};
export default nextConfig;
