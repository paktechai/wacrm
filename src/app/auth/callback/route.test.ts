import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { getPublicOrigin } from './route';

describe('Wova8 auth callback origin', () => {
  it('does not trust the retired legacy CRM proxy host', () => {
    const request = new NextRequest('http://127.0.0.1:3000/auth/callback', {
      headers: {
        'x-forwarded-host': 'crm.sbyt.app',
        'x-forwarded-proto': 'https',
      },
    });

    expect(getPublicOrigin(request)).toBe('https://crm.wova8.com');
  });

  it('uses the canonical CRM origin for an unrecognized host', () => {
    const request = new NextRequest('https://attacker.example/auth/callback');

    expect(getPublicOrigin(request)).toBe('https://crm.wova8.com');
  });

  it('never reflects an unsafe forwarded protocol', () => {
    const request = new NextRequest('http://127.0.0.1:3000/auth/callback', {
      headers: {
        'x-forwarded-host': 'crm.wova8.com',
        'x-forwarded-proto': 'javascript',
      },
    });

    expect(getPublicOrigin(request)).toBe('https://crm.wova8.com');
  });
});
