import { NextResponse } from 'next/server';
import { createGitHubService } from '@/lib/services/github';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const author = searchParams.get('author') || '';
    const cursor = searchParams.get('cursor') || undefined;
    const direction = (searchParams.get('direction') as 'after' | 'before') || 'after';

    if (!author) {
      return NextResponse.json({ error: 'Missing author parameter' }, { status: 400 });
    }

    const service = createGitHubService();
    const data = await service.searchPullRequestsByAuthor(author, cursor, direction);
    return NextResponse.json(data);
  } catch (error: any) {
    const message = error?.message || 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


