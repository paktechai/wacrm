import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// --- Scenario knobs the mock reads -----------------------------------------
// `mockUser`         — what getUser() resolves to (a refreshed session ⇒ user,
//                      or null for the logged-out path).
// `refreshedCookies` — cookies Supabase writes via setAll() during getUser(),
//                      i.e. the freshly *rotated* auth token. The whole point
//                      of the test is that these must survive onto whatever
//                      response the middleware returns — including redirects.
let mockUser: { id: string } | null = null;
let mockAccountRole: string | null = 'owner';
let mockProfileError: { message: string } | null = null;
let refreshedCookies: Array<{
  name: string;
  value: string;
  options: Record<string, unknown>;
}> = [];
let refreshedHeaders: Record<string, string> = {};

vi.mock('@supabase/ssr', () => ({
  createServerClient: (
    _url: string,
    _key: string,
    opts: {
      cookies: {
        setAll: (
          c: typeof refreshedCookies,
          headers: Record<string, string>
        ) => void;
      };
    }
  ) => ({
    auth: {
      // Mirrors real auth-js: an expired access token is transparently
      // refreshed inside getUser(), which rotates the refresh token and
      // pushes the new cookies through setAll() before resolving.
      getUser: async () => {
        if (refreshedCookies.length || Object.keys(refreshedHeaders).length) {
          opts.cookies.setAll(refreshedCookies, refreshedHeaders);
        }
        return { data: { user: mockUser } };
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: mockAccountRole ? { account_role: mockAccountRole } : null,
            error: mockProfileError,
          }),
        }),
      }),
    }),
  }),
}));

// Imported after the mock is registered.
const { middleware } = await import('./middleware');

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  mockUser = null;
  mockAccountRole = 'owner';
  mockProfileError = null;
  refreshedCookies = [];
  refreshedHeaders = {};
});

afterEach(() => vi.clearAllMocks());

const ROTATED = {
  name: 'sb-test-auth-token',
  value: 'rotated-refresh-token',
  options: { path: '/', httpOnly: true },
};

describe('middleware — public Wova8 website', () => {
  it.each([
    '/',
    '/product',
    '/contact',
    '/privacy',
    '/terms',
    '/data-deletion',
  ])('renders %s without waiting for Supabase auth', async (path) => {
    refreshedCookies = [ROTATED];

    const res = await middleware(new NextRequest(`https://wova8.com${path}`));

    expect(res.headers.get('location')).toBeNull();
    expect(res.cookies.get(ROTATED.name)).toBeUndefined();
    expect(res.headers.get('Cache-Control')).toContain('no-store');
  });
});

describe('middleware — refreshed auth cookies survive redirects', () => {
  it('carries the rotated token when redirecting a signed-in user off /login', async () => {
    mockUser = { id: 'user-1' };
    refreshedCookies = [ROTATED];

    const res = await middleware(new NextRequest('https://app.test/login'));

    // Redirect to /dashboard…
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/dashboard');
    // …and the rotated cookie MUST ride along, otherwise the browser keeps
    // replaying the now-consumed refresh token and the session wedges until
    // the user manually clears cookies.
    expect(res.cookies.get(ROTATED.name)?.value).toBe(ROTATED.value);
  });

  it('carries the rotated token when redirecting an unauth user to /login', async () => {
    mockUser = null;
    // Even on the logged-out path getUser() may emit cookie writes (e.g.
    // clearing a dead session); those must not be dropped on the redirect.
    refreshedCookies = [{ ...ROTATED, value: 'cleared' }];

    const res = await middleware(new NextRequest('https://app.test/dashboard'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
    expect(res.cookies.get(ROTATED.name)?.value).toBe('cleared');
  });

  it('redirects a signed-in user with an invite token to /join/<token>', async () => {
    mockUser = { id: 'user-1' };
    refreshedCookies = [ROTATED];

    const res = await middleware(
      new NextRequest('https://app.test/login?invite=abc123')
    );

    expect(res.headers.get('location')).toContain('/join/abc123');
    expect(res.cookies.get(ROTATED.name)?.value).toBe(ROTATED.value);
  });

  it('passes through (no redirect) for a signed-in user on a protected page', async () => {
    mockUser = { id: 'user-1' };
    refreshedCookies = [ROTATED];

    const res = await middleware(new NextRequest('https://app.test/dashboard'));

    // No redirect — the normal NextResponse.next() already carries cookies.
    expect(res.headers.get('location')).toBeNull();
    expect(res.cookies.get(ROTATED.name)?.value).toBe(ROTATED.value);
  });

  it('preserves Supabase refresh headers on a redirect', async () => {
    mockUser = { id: 'user-1' };
    refreshedCookies = [ROTATED];
    refreshedHeaders = {
      'Cache-Control':
        'private, no-cache, no-store, must-revalidate, max-age=0',
      Expires: '0',
      Pragma: 'no-cache',
    };

    const res = await middleware(new NextRequest('https://app.test/login'));

    expect(res.status).toBe(307);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    expect(res.headers.get('Expires')).toBe('0');
    expect(res.headers.get('Pragma')).toBe('no-cache');
    expect(res.cookies.get(ROTATED.name)?.value).toBe(ROTATED.value);
  });

  it('marks logged-out protected-route redirects private and RSC-aware', async () => {
    const res = await middleware(
      new NextRequest('https://app.test/dashboard', {
        headers: { RSC: '1', 'Next-Router-Prefetch': '1' },
      })
    );

    expect(res.status).toBe(307);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    expect(res.headers.get('Vary')).toContain('RSC');
    expect(res.headers.get('Vary')).toContain('Next-Router-Prefetch');
  });

  it('keeps consecutive authenticated dashboard loads on the dashboard', async () => {
    mockUser = { id: 'user-1' };

    const hardRefresh = await middleware(
      new NextRequest('https://app.test/dashboard')
    );
    const rscRefresh = await middleware(
      new NextRequest('https://app.test/dashboard?_rsc=refresh-test', {
        headers: { RSC: '1', 'Next-Router-State-Tree': '[""]' },
      })
    );

    for (const res of [hardRefresh, rscRefresh]) {
      expect(res.headers.get('location')).toBeNull();
      expect(res.headers.get('Cache-Control')).toContain('no-store');
    }
  });

  it('redirects repeated authenticated login-page requests in one step', async () => {
    mockUser = { id: 'user-1' };

    const first = await middleware(new NextRequest('https://app.test/login'));
    const second = await middleware(new NextRequest('https://app.test/login'));

    for (const res of [first, second]) {
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('https://app.test/dashboard');
      expect(res.headers.get('Cache-Control')).toContain('no-store');
    }
  });
});

describe('middleware — account management permissions', () => {
  it.each([
    '/settings',
    '/settings/profile',
    '/billing',
    '/integrations',
    '/enterprise/security',
    '/marketing',
    '/broadcasts/new',
    '/automations/new',
    '/flows',
    '/agents',
    '/commerce',
    '/onboarding',
    '/admin',
  ])(
    'redirects an agent away from %s without ending the session',
    async (path) => {
      mockUser = { id: 'agent-1' };
      mockAccountRole = 'agent';
      refreshedCookies = [ROTATED];

      const res = await middleware(new NextRequest(`https://app.test${path}`));

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('https://app.test/dashboard');
      expect(res.cookies.get(ROTATED.name)?.value).toBe(ROTATED.value);
    }
  );

  it.each(['owner', 'admin'])(
    'keeps management pages available to an %s',
    async (role) => {
      mockUser = { id: 'manager-1' };
      mockAccountRole = role;

      const res = await middleware(
        new NextRequest('https://app.test/settings')
      );

      expect(res.headers.get('location')).toBeNull();
    }
  );

  it('returns 403 for an agent calling a management API', async () => {
    mockUser = { id: 'agent-1' };
    mockAccountRole = 'agent';
    refreshedCookies = [ROTATED];

    const res = await middleware(
      new NextRequest('https://app.test/api/account/api-keys')
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Admin access is required' });
    expect(res.cookies.get(ROTATED.name)?.value).toBe(ROTATED.value);
  });

  it('returns 401 for an unauthenticated management API request', async () => {
    const res = await middleware(
      new NextRequest('https://app.test/api/integrations')
    );

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('fails closed when the authoritative account role cannot be loaded', async () => {
    mockUser = { id: 'agent-1' };
    mockAccountRole = 'owner';
    mockProfileError = { message: 'profile unavailable' };

    const res = await middleware(new NextRequest('https://app.test/billing'));

    expect(res.headers.get('location')).toBe('https://app.test/dashboard');
  });

  it('protects dashboard modules omitted by the previous auth allowlist', async () => {
    for (const path of ['/smart-inbox', '/intelligence']) {
      const res = await middleware(
        new NextRequest(`https://app.test${path}`)
      );

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('https://app.test/login');
    }
  });

  it("does not intercept a cron endpoint's own authentication", async () => {
    const res = await middleware(
      new NextRequest('https://app.test/api/flows/cron')
    );

    expect(res.headers.get('location')).toBeNull();
  });
});
