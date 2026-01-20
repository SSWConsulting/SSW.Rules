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
        // Images
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
        // Documents
        case 'pdf':
          return 'application/pdf'
        case 'doc':
          return 'application/msword'
        case 'docx':
          return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        case 'ppt':
          return 'application/vnd.ms-powerpoint'
        case 'pptx':
          return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        case 'xls':
          return 'application/vnd.ms-excel'
        case 'xlsx':
          return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        // Code/Text files
        case 'txt':
          return 'text/plain'
        case 'sql':
          return 'application/sql'
        case 'cs':
          return 'text/x-csharp'
        case 'json':
          return 'application/json'
        case 'xml':
          return 'application/xml'
        case 'csv':
          return 'text/csv'
        // Media
        case 'mp3':
          return 'audio/mpeg'
        case 'mp4':
          return 'video/mp4'
        // Other
        case 'zip':
          return 'application/zip'
        case 'ics':
          return 'text/calendar'
        default:
          return 'application/octet-stream'
      }
    }

    const isDownloadableFile = (path: string): boolean => {
      const ext = path.toLowerCase().split('.').pop() || ''
      const downloadableExts = new Set(['pdf', 'txt', 'zip', 'mp4', 'mp3', 'ics', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'sql', 'cs', 'json', 'xml', 'csv'])
      return downloadableExts.has(ext)
    }
    
    const mimeType = getContentType(fullImagePath)
    const filename = fullImagePath.split(/[/\\]/).pop() || 'download'
    const shouldDownload = isDownloadableFile(fullImagePath)

    const headers: Record<string, string> = {
      'Content-Type': mimeType,
      'Content-Length': fileStat.size.toString(),
      'Cache-Control': 'public, max-age=31536000, immutable',
    }

    // Add Content-Disposition header for downloadable files
    if (shouldDownload) {
      headers['Content-Disposition'] = `attachment; filename="${filename}"`
    }

    return new NextResponse(new Uint8Array(fileBuffer), { headers })

  } catch (error) {
    console.error('Error serving local image:', error)
    
    if (error.code === 'ENOENT') {
      return new NextResponse('Not Found', { status: 404 })
    }
    
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}