import { NextRequest, NextResponse } from 'next/server'
import { readFile, stat } from 'fs/promises'
import { join } from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  if (process.env.NODE_ENV !== 'development') {
    return new NextResponse('Not Found', { status: 404 })
  }

  const contentPath = process.env.LOCAL_CONTENT_RELATIVE_PATH
  if (!contentPath) {
    return new NextResponse('Content path not configured', { status: 500 })
  }

  try {
    const { path } = await params
    
    const imagePath = '/' + path.join('/')
    
    // Adjust the path since env var is relative to tina config (subfolder)
    // but this API runs from project root
    const adjustedContentPath = contentPath.replace('../../', '../')
    const contentRepoPath = join(process.cwd(), adjustedContentPath)
    const fullImagePath = join(contentRepoPath, 'public', imagePath)

    // Security check: ensure the resolved path is within the content repo
    if (!fullImagePath.startsWith(contentRepoPath)) {
      return new NextResponse('Forbidden', { status: 403 })
    }

    const fileStat = await stat(fullImagePath)
    if (!fileStat.isFile()) {
      return new NextResponse('Not Found', { status: 404 })
    }

    const fileBuffer = await readFile(fullImagePath)
    
    const getContentType = (path: string): string => {
      const ext = path.toLowerCase().split('.').pop()
      switch (ext) {
        case 'jpg':
        case 'jpeg':
          return 'image/jpeg'
        case 'png':
          return 'image/png'
        case 'gif':
          return 'image/gif'
        case 'webp':
          return 'image/webp'
        case 'svg':
          return 'image/svg+xml'
        default:
          return 'application/octet-stream'
      }
    }
    
    const mimeType = getContentType(fullImagePath)

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': fileStat.size.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable', // Cache for development
      },
    })

  } catch (error) {
    console.error('Error serving local image:', error)
    
    if (error.code === 'ENOENT') {
      return new NextResponse('Not Found', { status: 404 })
    }
    
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}