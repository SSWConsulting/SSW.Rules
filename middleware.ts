import * as appInsights from "applicationinsights";
import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "./lib/auth0";
import redirectMappingRaw from "./redirects.json";

export const runtime = "nodejs";

const redirectMap = new Map<string, string>(
  Object.entries(redirectMappingRaw as Record<string, string>).filter(([source, destination]) => source.toLowerCase() !== destination.toLowerCase())
);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/auth") || pathname.startsWith(`${process.env.NEXT_PUBLIC_BASE_PATH}/auth`)) {
    return auth0.middleware(request);
  }

  const slug = pathname.replace(/^\//, "");
  const destination = redirectMap.get(slug);

  if (destination) {
    try {
      if (appInsights.defaultClient) {
        appInsights.defaultClient.trackEvent({
          name: "uri-redirect-hit",
          properties: {
            sourceUri: slug,
            destinationUri: destination,
            timestamp: new Date().toISOString(),
            userAgent: request.headers.get("user-agent") ?? "",
            referer: request.headers.get("referer") ?? "",
          },
        });
      }
    } catch {}

    const url = request.nextUrl.clone();
    url.pathname = `/${destination}`;
    return NextResponse.redirect(url, 308);
  }

  // Only run in development mode
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.next();
  }

  // Check if this is an image request that might be from TinaCMS
  // Only proxy content images from /uploads/rules/ to avoid interfering with site assets
  const isTinaCMSImage = /^\/uploads\/rules\/.*\.(jpg|jpeg|png|gif|webp|svg)$/i.test(pathname);

  // Check if this is a downloadable file request from /uploads/rules/
  const isDownloadableFile = /^\/uploads\/rules\/.*\.(pdf|txt|zip|mp4|mp3|ics|doc|docx|ppt|pptx|xls|xlsx|sql|cs|json|xml|csv)$/i.test(pathname);

  if ((isTinaCMSImage || isDownloadableFile) && process.env.LOCAL_CONTENT_RELATIVE_PATH) {
    // Proxy to our API route to serve from content repo
    const url = request.nextUrl.clone();
    url.pathname = `/api/local-images${pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
    "/auth/:path*",
  ],
};
