// middleware.ts
import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Only run in development mode
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.next()
  }

  const { pathname } = request.nextUrl

  // Check if this is an image request that might be from TinaCMS
  // Adjust this pattern based on your TinaCMS image paths
  // For example, if your TinaCMS images are in /uploads/ or /images/
  const isTinaCMSImage = /^\/(?:uploads|images)\/.*\.(jpg|jpeg|png|gif|webp|svg)$/i.test(pathname)
  
  if (isTinaCMSImage && process.env.LOCAL_CONTENT_RELATIVE_PATH) {
    // Proxy to our API route to serve from content repo
    const url = request.nextUrl.clone()
    url.pathname = `/api/local-images${pathname}`
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
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
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}