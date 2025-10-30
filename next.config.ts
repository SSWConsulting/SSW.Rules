import type { NextConfig } from 'next'

const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

// Remove all slashes and add a leading slash if not empty
const normalizedBasePath = rawBasePath.replace(/\//g, '');
const basePath = normalizedBasePath ? `/${normalizedBasePath}` : '';
 
const nextConfig: NextConfig = {
  output: 'standalone', // Required for the Docker setup
  basePath: basePath,
  assetPrefix: basePath,
  env: {
    BUILD_TIMESTAMP: process.env.BUILD_TIMESTAMP,
    VERSION_DEPLOYED: process.env.VERSION_DEPLOYED,
    DEPLOYMENT_URL: process.env.DEPLOYMENT_URL,
    BUILD_DATE: process.env.BUILD_DATE,
    COMMIT_HASH: process.env.COMMIT_HASH,
  },
  
  images: {
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
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        port: '',
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        port: '',
      },
      {
        protocol: 'https',
        hostname: 'adamcogan.com',
        port: '',
      },
      {
        protocol: 'https',
        hostname: 'github-production-user-asset-*',
        port: '',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
      },
    ],
  },
  
  async headers() {
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
  experimental: {
    // This concurrency is used to speed up the static generation of the app.
    // Without it, the static generation of the app will take a 52 minutes.
    // With it, the static generation of the app will take a 11 minutes.
    staticGenerationRetryCount: 2,
    staticGenerationMaxConcurrency: 50,
    staticGenerationMinPagesPerWorker: 25,
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
  async redirects() {
    // Import Node.js modules inside the function to avoid issues with TinaCMS build
    const { readFileSync } = await import('fs')
    const { join } = await import('path')

    // Load redirect mapping from JSON file generated during content preparation
    // Contains redirects for both rules and categories
    const redirectMappingPath = join(process.cwd(), 'redirects.json')
    let redirectMapping: Record<string, string> = {}

    try {
      const fileContent = readFileSync(redirectMappingPath, 'utf-8')
      redirectMapping = JSON.parse(fileContent)
    } catch (error) {
      // If file doesn't exist yet (e.g., first build), return empty array
      console.warn('⚠️  redirects.json not found. Skipping redirects generation.')
      return []
    }

    // Escape special characters that have meaning in path-to-regexp
    // These characters need to be escaped: ( ) + * ? [ ] { } |
    const escapePathSegment = (path: string): string => {
      return path.replace(/[()+*?[\]{}|]/g, '\\$&')
    }

    // Transform the redirect mapping object into Next.js redirect format
    // redirectMapping is { "old-uri": "new-uri", ... }
    return Object.entries(redirectMapping).map(([source, destination]) => ({
      source: `${basePath}/${escapePathSegment(source)}`,
      destination: `${basePath}/${destination}`,
      permanent: true, // 308 permanent redirect
    }));
  },
};

export default nextConfig