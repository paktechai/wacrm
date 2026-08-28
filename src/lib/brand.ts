const DEFAULT_COMPANY_URL = 'https://wova8.com';
const DEFAULT_CRM_URL = 'https://crm.wova8.com';

function canonicalUrl(value: string | undefined, fallback: string): string {
  const candidate = value?.trim() || fallback;

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return fallback;
    return url.origin;
  } catch {
    return fallback;
  }
}

export const WOVA8 = Object.freeze({
  companyName: 'Wova8',
  productName: 'Wova8 CRM',
  description:
    'Customer communication, relationship management, automation, and AI-assisted business operations in one secure workspace.',
  companyUrl: canonicalUrl(
    process.env.NEXT_PUBLIC_COMPANY_URL,
    DEFAULT_COMPANY_URL
  ),
  crmUrl: canonicalUrl(process.env.NEXT_PUBLIC_SITE_URL, DEFAULT_CRM_URL),
  legacyCrmUrl: 'https://crm.sbyt.app',
  emails: Object.freeze({
    support: 'support@wova8.com',
    privacy: 'privacy@wova8.com',
    legal: 'legal@wova8.com',
  }),
});

export const PUBLIC_ROUTES = Object.freeze([
  '/',
  '/product',
  '/contact',
  '/privacy',
  '/terms',
  '/data-deletion',
] as const);

function hostnameOf(value: string): string | null {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function normalizeHostname(value: string | null | undefined): string {
  if (!value) return '';
  const first = value.split(',')[0]?.trim().toLowerCase() ?? '';

  try {
    return new URL(`http://${first}`).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function crmHostnames(): readonly string[] {
  return Array.from(
    new Set(
      [WOVA8.crmUrl, WOVA8.legacyCrmUrl]
        .map(hostnameOf)
        .filter((host): host is string => Boolean(host))
    )
  );
}

export function isCrmHostname(value: string | null | undefined): boolean {
  return crmHostnames().includes(normalizeHostname(value));
}

export function publicUrl(path = '/'): string {
  return new URL(path, `${WOVA8.companyUrl}/`).toString();
}

export function crmUrl(path = '/'): string {
  return new URL(path, `${WOVA8.crmUrl}/`).toString();
}
