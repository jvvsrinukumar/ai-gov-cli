export function healthRouteTs(): string {
    return `import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({ status: 'ok' }, { status: 200 });
}
`;
}
