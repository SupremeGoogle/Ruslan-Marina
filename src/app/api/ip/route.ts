import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Retrieve the IP from standard headers
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  
  let ip = '127.0.0.1'; // fallback

  if (forwardedFor) {
    ip = forwardedFor.split(',')[0].trim();
  } else if (realIp) {
    ip = realIp;
  }

  return NextResponse.json({ ip });
}
