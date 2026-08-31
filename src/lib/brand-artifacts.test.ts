import { describe, expect, it } from 'vitest';
import manifest from '@/app/manifest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';

describe('Wova8 public identity artifacts', () => {
  it('publishes only the intended public routes in the sitemap', () => {
    expect(sitemap().map((entry) => entry.url)).toEqual([
      'https://wova8.com/',
      'https://wova8.com/product',
      'https://wova8.com/contact',
      'https://wova8.com/privacy',
      'https://wova8.com/terms',
      'https://wova8.com/data-deletion',
    ]);
  });

  it('keeps the internal CRM route out of search results', () => {
    const policy = robots();
    const rule = Array.isArray(policy.rules) ? policy.rules[0] : policy.rules;

    expect(rule?.allow).toContain('/product');
    expect(rule?.disallow).toContain('/crm');
    expect(policy.sitemap).toBe('https://wova8.com/sitemap.xml');
  });

  it('uses Wova8 CRM for the installable application', () => {
    const appManifest = manifest();

    expect(appManifest.name).toBe('Wova8 CRM');
    expect(appManifest.short_name).toBe('Wova8 CRM');
    expect(appManifest.icons?.[0]?.src).toBe('/wova8-pwa-icon.svg');
  });
});
