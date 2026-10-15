/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
  transpilePackages: ['@aurora/core'],
  images: { unoptimized: true },
  poweredByHeader: false,
};
export default nextConfig;
