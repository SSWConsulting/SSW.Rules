import { NextResponse } from 'next/server';
import { createDynamicsService } from '@/lib/services/dynamics';
import { normalizeName, toSlug } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');

    const service = createDynamicsService();

    if (query) {
      const emp = await service.findEmployeeByGitHub(query, {
        includeCurrent: true,
        includePast: true,
      });

      if (emp) {
        return NextResponse.json({
          fullName: emp.fullName,
          slug: toSlug(emp.fullName || query),
          gitHubUrl: emp.gitHubUrl || `https://github.com/${query}`,
        });
      }

      const fullName = normalizeName(query) || '';
      return NextResponse.json({
        fullName,
        slug: toSlug(query),
        gitHubUrl: `https://github.com/${query}`,
      });
    }

    const employees = await service.getEmployees({ includeCurrent: true, includePast: true });
    return NextResponse.json({ value: employees });
  } catch (error: any) {
    const message = error?.message || 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}