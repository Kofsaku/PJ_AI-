import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';

export async function GET(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/companies/validate/${params.companyId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error validating company:', error);
    return NextResponse.json(
      { error: 'Failed to validate company' },
      { status: 500 }
    );
  }
}