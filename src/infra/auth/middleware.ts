import { NextRequest, NextResponse } from 'next/server';

export function authMiddleware(request: NextRequest) {
  return NextResponse.next();
}
