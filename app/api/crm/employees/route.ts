import { unstable_cache } from 'next/cache';
import { NextResponse } from 'next/server';
import { createDynamicsService } from '@/lib/services/dynamics';
import { normalizeName, toSlug } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// The full list only changes when someone joins or leaves SSW, so don't hit Dynamics on every request
const getCachedEmployees = unstable_cache(
  () => createDynamicsService().getEmployees({ includeCurrent: true, includePast: true }),
  ['crm-employees'],
  { revalidate: 3600, tags: ['crm-employees'] }
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');

    if (query) {
      const service = createDynamicsService();
      const emp = await service.findEmployeeByGitHub(query, {
        includeCurrent: true,
        includePast: true,
      });

      if (emp) {
        return NextResponse.json({
          found: true,
          fullName: emp.fullName,
          slug: toSlug(emp.fullName || query),
          gitHubUrl: emp.gitHubUrl || `https://github.com/${query}`,
        });
      }

      const fullName = normalizeName(query) || '';
      return NextResponse.json({
        found: false,
        fullName,
        slug: toSlug(query),
        gitHubUrl: `https://github.com/${query}`,
      });
    }

    const employees = await getCachedEmployees();
    return NextResponse.json({ value: employees });
  } catch (error: any) {
    const message = error?.message || 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
