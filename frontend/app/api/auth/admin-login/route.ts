import { NextRequest, NextResponse } from 'next/server';

const ADMIN_EMAIL = 'admin@gmail.com';
const ADMIN_PASSWORD = 'password';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      const adminData = {
        id: 'admin-001',
        email: ADMIN_EMAIL,
        name: 'Administrator',
        role: 'admin',
        token: Buffer.from(`${ADMIN_EMAIL}:${Date.now()}`).toString('base64')
      };

      return NextResponse.json(adminData, { status: 200 });
    } else {
      return NextResponse.json(
        { error: 'Invalid admin credentials' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}