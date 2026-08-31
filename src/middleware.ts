import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  canEditSettings,
  isAccountRole,
  isAdminApiRoute,
  isAdminWorkspaceRoute,
  isWorkspaceRoute,
} from '@/lib/auth/roles';
import { applyDynamicResponseHeaders } from '@/lib/http/dynamic-response';
import { PUBLIC_ROUTES } from '@/lib/brand';

const PUBLIC_WEBSITE_PATHS = new Set<string>([
  ...PUBLIC_ROUTES,
  '/robots.txt',
  '/sitemap.xml',
  '/opengraph-image',
  '/manifest.webmanifest',
]);

export async function middleware(request: NextRequest) {
  // Public company/legal pages do not need an auth round trip. Skipping
  // Supabase here keeps the Wova8 shell independent of tenant/session data;
  // the root page still redirects CRM hosts to the protected dashboard.
  if (PUBLIC_WEBSITE_PATHS.has(request.nextUrl.pathname)) {
    const publicResponse = NextResponse.next({ request });
    applyDynamicResponseHeaders(publicResponse.headers);
    return publicResponse;
  }

  let supabaseResponse = NextResponse.next({ request });
  const refreshedHeaders = new Headers();

  const applyAuthHeaders = <T extends NextResponse>(response: T): T => {
    refreshedHeaders.forEach((value, key) => response.headers.set(key, value));
    applyDynamicResponseHeaders(response.headers);
    return response;
  };

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
          Object.entries(headers).forEach(([key, value]) => {
            refreshedHeaders.set(key, value);
          });
          applyAuthHeaders(supabaseResponse);
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // getUser() transparently refreshes an expired access token, which
  // ROTATES the refresh token and writes the new cookies onto
  // `supabaseResponse` via setAll() above. Any response we return in
  // place of `supabaseResponse` (every redirect / JSON branch below)
  // is a fresh object that does NOT carry those Set-Cookie headers, so
  // the rotated token never reaches the browser. The next request then
  // replays the old, now-consumed refresh token, the refresh fails, and
  // the session wedges — the user gets a broken reload after idling and
  // can only recover by manually clearing cookies (issue #288). Copy the
  // refreshed cookies AND Supabase's anti-cache headers onto whatever response
  // we hand back so neither the browser nor a CDN can replay stale auth state.
  const withRefreshedAuth = <T extends NextResponse>(response: T): T => {
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });
    return applyAuthHeaders(response);
  };

  // Auth pages - redirect to dashboard if already logged in.
  // Exception: when an invite token is in the query string we
  // send the already-signed-in user to /join/<token> instead so
  // they can accept the invitation in one click. Without this,
  // a forwarded invite link to someone who's already signed in
  // would silently drop them on /dashboard.
  if (
    user &&
    (request.nextUrl.pathname === '/login' ||
      request.nextUrl.pathname === '/signup' ||
      request.nextUrl.pathname === '/forgot-password')
  ) {
    const url = request.nextUrl.clone();
    const inviteToken = request.nextUrl.searchParams.get('invite');
    if (
      inviteToken &&
      (request.nextUrl.pathname === '/login' ||
        request.nextUrl.pathname === '/signup')
    ) {
      url.pathname = `/join/${encodeURIComponent(inviteToken)}`;
      url.search = '';
    } else {
      url.pathname = '/dashboard';
      url.search = '';
    }
    return withRefreshedAuth(NextResponse.redirect(url));
  }

  const pathname = request.nextUrl.pathname;
  const restrictedPage = isAdminWorkspaceRoute(pathname);
  const restrictedApi = isAdminApiRoute(pathname);

  // Every dashboard route requires an authenticated session, including
  // newer modules that were missing from the old hard-coded allowlist.
  if (!user && isWorkspaceRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return withRefreshedAuth(NextResponse.redirect(url));
  }

  // API routes that need auth (not webhooks or independently secured cron).
  if (
    !user &&
    (restrictedApi ||
      (pathname.startsWith('/api/whatsapp/') && !pathname.includes('/webhook')))
  ) {
    return withRefreshedAuth(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    );
  }

  if (user && (restrictedPage || restrictedApi)) {
    // account_role lives on the server-owned profile row, not editable
    // user_metadata. Resolve it only for management surfaces; ordinary
    // inbox/contact navigation does not pay for this extra lookup.
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('account_role')
      .eq('user_id', user.id)
      .maybeSingle();

    const allowed =
      !error &&
      isAccountRole(profile?.account_role) &&
      canEditSettings(profile.account_role);

    if (!allowed) {
      if (restrictedApi) {
        return withRefreshedAuth(
          NextResponse.json(
            { error: 'Admin access is required' },
            { status: 403 }
          )
        );
      }

      // Deny the page without signing out the user. Carry rotated Supabase
      // cookies onto the redirect so a valid agent session stays alive.
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      url.search = '';
      return withRefreshedAuth(NextResponse.redirect(url));
    }
  }

  return applyAuthHeaders(supabaseResponse);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
