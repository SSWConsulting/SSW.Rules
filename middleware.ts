// middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from './lib/auth0'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Support auth routes with or without basePath prefix
  if (pathname.startsWith('/auth') || (pathname.startsWith(`${process.env.NEXT_PUBLIC_BASE_PATH}/auth`))) {
    return auth0.middleware(request)
  }

  // Only run in development mode
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.next()
  }

  // Check if this is an image request that might be from TinaCMS
  // Only proxy content images from /uploads/rules/ to avoid interfering with site assets
  const isTinaCMSImage = /^\/uploads\/rules\/.*\.(jpg|jpeg|png|gif|webp|svg)$/i.test(pathname)

  // Check if this is a downloadable file request from /uploads/rules/
  const isDownloadableFile = /^\/uploads\/rules\/.*\.(pdf|txt|zip|mp4|mp3|ics|doc|docx|ppt|pptx|xls|xlsx|sql|cs|json|xml|csv)$/i.test(pathname)

  if ((isTinaCMSImage || isDownloadableFile) && process.env.LOCAL_CONTENT_RELATIVE_PATH) {
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
    '/auth/:path*'
  ],
}