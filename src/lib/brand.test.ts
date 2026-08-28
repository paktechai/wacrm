import { afterEach, describe, expect, it, vi } from 'vitest';

const originalCompanyUrl = process.env.NEXT_PUBLIC_COMPANY_URL;
const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  vi.resetModules();
  if (originalCompanyUrl === undefined)
    delete process.env.NEXT_PUBLIC_COMPANY_URL;
  else process.env.NEXT_PUBLIC_COMPANY_URL = originalCompanyUrl;
  if (originalSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
});

describe('Wova8 brand and domain configuration', () => {
  it('uses the locked Wova8 production domains by default', async () => {
    delete process.env.NEXT_PUBLIC_COMPANY_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;

    const { WOVA8 } = await import('./brand');

    expect(WOVA8.companyName).toBe('Wova8');
    expect(WOVA8.productName).toBe('Wova8 CRM');
    expect(WOVA8.companyUrl).toBe('https://wova8.com');
    expect(WOVA8.crmUrl).toBe('https://crm.wova8.com');
  });

  it('accepts configured origins without path or trailing slash', async () => {
    process.env.NEXT_PUBLIC_COMPANY_URL = 'https://preview.wova8.com/company/';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://staging-crm.wova8.com/path';

    const { WOVA8 } = await import('./brand');

    expect(WOVA8.companyUrl).toBe('https://preview.wova8.com');
    expect(WOVA8.crmUrl).toBe('https://staging-crm.wova8.com');
  });

  it('recognizes the new and legacy CRM hosts during migration', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const { isCrmHostname } = await import('./brand');

    expect(isCrmHostname('crm.wova8.com')).toBe(true);
    expect(isCrmHostname('crm.sbyt.app:443')).toBe(true);
    expect(isCrmHostname('wova8.com')).toBe(false);
  });
});
