import { NextResponse } from 'next/server';

export function ok(data: unknown) {
  return NextResponse.json(data);
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function serverError(err: unknown) {
  const message = err instanceof Error ? err.message : 'Unexpected server error';
  console.error('[moneytwin]', message);
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError('Request body must be valid JSON');
  }
}

export class ApiError extends Error {}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ApiError(message);
}
