import { NextResponse } from 'next/server';
import { createGitHubService } from '@/lib/services/github';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ruleUri = searchParams.get('ruleUri') || '';

    if (!ruleUri) {
      return NextResponse.json({ error: 'Missing ruleUri parameter' }, { status: 400 });
    }

    const service = await createGitHubService();
    const authors = await service.getRuleAuthors(ruleUri);
    return NextResponse.json({ authors });
  } catch (error: any) {
    const message = error?.message || 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


