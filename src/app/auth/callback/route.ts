import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isCrmHostname, normalizeHostname, WOVA8 } from '@/lib/brand';

export function getPublicOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedHostname = normalizeHostname(forwardedHost);
  if (forwardedHostname && isCrmHostname(forwardedHostname)) {
    const forwardedProto = request.headers
      .get('x-forwarded-proto')
      ?.split(',')[0]
      ?.trim()
      .toLowerCase();
    const proto = forwardedProto === 'http' ? 'http' : 'https';
    return `${proto}://${forwardedHost?.split(',')[0]?.trim()}`;
  }

  if (isCrmHostname(request.nextUrl.hostname)) {
    return request.nextUrl.origin;
  }

  return WOVA8.crmUrl;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const origin = getPublicOrigin(request);
  const code = searchParams.get('code');
  const requestedNext = searchParams.get('next');
  const next =
    requestedNext &&
    requestedNext.startsWith('/') &&
    !requestedNext.startsWith('//')
      ? requestedNext
      : '/dashboard';

  if (!code) {
    return NextResponse.redirect(new URL('/forgot-password', origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL('/forgot-password', origin));
  }

  return NextResponse.redirect(new URL(next, origin));
}
