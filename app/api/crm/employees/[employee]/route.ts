import { NextRequest, NextResponse } from 'next/server';
import { createDynamicsService } from '@/lib/services/dynamics';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ employee: string }> }
) {
  try {
    const { employee: employeeParam } = await params;
    const nameParam = employeeParam ? decodeURIComponent(employeeParam) : '';
    if (!nameParam) {
      return NextResponse.json({ error: 'Employee name is required' }, { status: 400 });
    }

    const dynamics = createDynamicsService();
    const employee = await dynamics.findEmployeeFromName(nameParam);

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    return NextResponse.json({ employee });
  } catch (error) {
    console.error('CRM employee lookup failed', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
