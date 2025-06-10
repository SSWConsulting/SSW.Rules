import type { NextConfig } from 'next'
 
const nextConfig: NextConfig = {
  output: 'export',  // Ajout pour l'export statique
  trailingSlash: true,  // Recommandé pour Azure Static Web Apps
  images: {
    unoptimized: true,  // Nécessaire pour l'export statique
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
  async headers() {
    // ces headers sont aussi définis dans le layout racine car GitHub pages ne supporte pas les headers
    const headers = [
      {
        key: 'X-Frame-Options',
        value: 'SAMEORIGIN',
      },
      {
        key: 'Content-Security-Policy',
        value: "frame-ancestors 'self'",
      },
    ];
    return [
      {
        source: '/(.*)',
        headers,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/admin',
        destination: '/admin/index.html',
      },
      { source: '/_next/:path*', destination: '/_next/:path*' },
      { source: '/.well-known/:path*', destination: '/.well-known/:path*' },
    ];
  },
};

export default nextConfig