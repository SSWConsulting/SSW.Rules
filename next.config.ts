import type { NextConfig } from "next";

const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

// Remove all slashes and add a leading slash if not empty
const normalizedBasePath = rawBasePath.replace(/\//g, "");
const basePath = normalizedBasePath ? `/${normalizedBasePath}` : "";

const nextConfig: NextConfig = {
  output: "standalone", // Required for the Docker setup
  basePath: basePath,
  assetPrefix: basePath,
  env: {
    BUILD_TIMESTAMP: process.env.BUILD_TIMESTAMP,
    VERSION_DEPLOYED: process.env.VERSION_DEPLOYED,
    DEPLOYMENT_URL: process.env.DEPLOYMENT_URL,
    BUILD_DATE: process.env.BUILD_DATE,
    COMMIT_HASH: process.env.COMMIT_HASH,
  },

  // Exclude Application Insights from server-side bundling to avoid dynamic require issues
  // This tells Next.js to use the Node.js runtime version instead of bundling it
  serverExternalPackages: [
    'applicationinsights',
    'diagnostic-channel',
    'diagnostic-channel-publishers',
  ],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.tina.io",
        port: "",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        port: "",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        port: "",
      },
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
        port: "",
      },
      {
        protocol: "https",
        hostname: "adamcogan.com",
        port: "",
      },
      {
        protocol: "https",
        hostname: "github-production-user-asset-*",
        port: "",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
      },
      {
        protocol: "https",
        hostname: "tv.ssw.com",
        port: "",
      },
    ],
  },

  async headers() {
    const headers = [
      {
        key: "X-Frame-Options",
        value: "SAMEORIGIN",
      },
      {
        key: "Content-Security-Policy",
        value: "frame-ancestors 'self'",
      },
    ];
    return [
      {
        source: "/(.*)",
        headers,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/admin",
        destination: "/admin/index.html",
      },
      { source: "/_next/:path*", destination: "/_next/:path*" },
      { source: "/.well-known/:path*", destination: "/.well-known/:path*" },
    ];
  },
};

export default nextConfig;
