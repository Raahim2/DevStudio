import { NextResponse } from 'next/server';

export async function GET() {
  try {
    return NextResponse.json({ model: 'gemini-2.5-flash' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch model' }, { status: 500 });
  }
}