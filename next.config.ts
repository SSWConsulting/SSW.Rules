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
  async redirects() {
    // Import Node.js modules inside the function to avoid issues with TinaCMS build
    const { readFileSync } = await import("fs");
    const { join } = await import("path");

    // Load redirect mapping from JSON file generated during content preparation
    // Contains redirects for both rules and categories
    const redirectMappingPath = join(process.cwd(), "redirects.json");
    let redirectMapping: Record<string, string> = {};

    try {
      const fileContent = readFileSync(redirectMappingPath, "utf-8");
      redirectMapping = JSON.parse(fileContent);
    } catch (error) {
      // If file doesn't exist yet (e.g., first build), return empty array
      console.warn("⚠️  redirects.json not found. Skipping redirects generation.");
      return [];
    }

    const encodePathSegment = (segment: string): string => {
      const encoded = encodeURI(segment);

      // Escape special characters that have meaning in path-to-regexp
      // These characters need to be escaped: ( ) + * ? [ ] { } |
      return encoded.replace(/[()+*?[\]{}|]/g, "\\$&");
    };

    // Transform the redirect mapping object into Next.js redirect format
    // redirectMapping is { "old-uri": "new-uri", ... }
    // Note: Next.js automatically prepends basePath to source and destination,
    // so we don't need to include it here
    return Object.entries(redirectMapping)
      .map(([source, destination]) => {
        if (source.toLowerCase() === destination) {
          return null;
        }

        return {
          source: `/${encodePathSegment(source)}`,
          destination: `/${destination}`,
          permanent: true, // 308 permanent redirect
        };
      })
      .filter((item): item is { source: string; destination: string; permanent: boolean } => item !== null);
  },
};

export default nextConfig;
