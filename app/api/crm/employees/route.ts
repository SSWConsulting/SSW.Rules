import { NextResponse } from 'next/server';
import { createDynamicsService } from '@/lib/services/dynamics';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const service = createDynamicsService();
    const employees = await service.getEmployees({ includeCurrent: true, includePast: true });
    return NextResponse.json({ value: employees });
  } catch (error: any) {
    const message = error?.message || 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

