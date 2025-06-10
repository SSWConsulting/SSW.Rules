import type { NextConfig } from 'next'
 
const nextConfig: NextConfig = {
  output: 'export', 
  trailingSlash: true, 
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.tina.io',
        port: '',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
      }
    ],
  },
  //TODO: uncomment when using app service instead of static webapp
  // async headers() {
  //   const headers = [
  //     {
  //       key: 'X-Frame-Options',
  //       value: 'SAMEORIGIN',
  //     },
  //     {
  //       key: 'Content-Security-Policy',
  //       value: "frame-ancestors 'self'",
  //     },
  //   ];
  //   return [
  //     {
  //       source: '/(.*)',
  //       headers,
  //     },
  //   ];
  // },
  // async rewrites() {
  //   return [
  //     {
  //       source: '/admin',
  //       destination: '/admin/index.html',
  //     },
  //     { source: '/_next/:path*', destination: '/_next/:path*' },
  //     { source: '/.well-known/:path*', destination: '/.well-known/:path*' },
  //   ];
  // },
};

export default nextConfig