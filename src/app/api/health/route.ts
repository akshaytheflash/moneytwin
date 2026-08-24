import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'moneytwin',
    version: '1.0.0',
    time: new Date().toISOString(),
  });
}
