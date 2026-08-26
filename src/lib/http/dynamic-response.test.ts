import { describe, expect, it } from 'vitest';
import {
  applyDynamicResponseHeaders,
  DYNAMIC_RESPONSE_HEADERS,
  mergeVary,
} from './dynamic-response';

describe('dynamic response cache policy', () => {
  it('prevents shared caching of authenticated document and RSC responses', () => {
    const headers = new Headers({ Vary: 'Accept-Language, RSC' });

    applyDynamicResponseHeaders(headers);

    expect(headers.get('Cache-Control')).toBe(
      'private, no-cache, no-store, must-revalidate, max-age=0'
    );
    expect(headers.get('Pragma')).toBe('no-cache');
    expect(headers.get('Expires')).toBe('0');
    expect(headers.get('Vary')).toContain('Accept-Language');
    expect(headers.get('Vary')).toContain('RSC');
    expect(headers.get('Vary')).toContain('Next-Router-State-Tree');
    expect(headers.get('Vary')).toContain('Next-Router-Prefetch');
    expect(headers.get('Vary')).toContain('Next-Router-Segment-Prefetch');
    expect(headers.get('Vary')).toContain('Next-Url');
  });

  it('deduplicates Vary entries case-insensitively', () => {
    const vary = mergeVary('rsc, Accept-Encoding, RSC');

    expect(
      vary
        .toLowerCase()
        .split(', ')
        .filter((v) => v === 'rsc')
    ).toHaveLength(1);
  });

  it('exports the same no-store policy for next.config', () => {
    expect(DYNAMIC_RESPONSE_HEADERS).toContainEqual({
      key: 'Cache-Control',
      value: 'private, no-cache, no-store, must-revalidate, max-age=0',
    });
  });
});
