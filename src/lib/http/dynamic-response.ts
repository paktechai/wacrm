const DYNAMIC_CACHE_CONTROL =
  'private, no-cache, no-store, must-revalidate, max-age=0';

const NEXT_RSC_VARY_HEADERS = [
  'RSC',
  'Next-Router-State-Tree',
  'Next-Router-Prefetch',
  'Next-Router-Segment-Prefetch',
  'Next-Url',
  'Accept-Encoding',
] as const;

export const DYNAMIC_RESPONSE_HEADERS = [
  { key: 'Cache-Control', value: DYNAMIC_CACHE_CONTROL },
  { key: 'Pragma', value: 'no-cache' },
  { key: 'Expires', value: '0' },
  { key: 'Vary', value: NEXT_RSC_VARY_HEADERS.join(', ') },
] as const;

export function mergeVary(existing: string | null): string {
  const values = new Map<string, string>();

  for (const value of [
    ...(existing?.split(',') ?? []),
    ...NEXT_RSC_VARY_HEADERS,
  ]) {
    const trimmed = value.trim();
    if (trimmed) values.set(trimmed.toLowerCase(), trimmed);
  }

  return [...values.values()].join(', ');
}

export function applyDynamicResponseHeaders(headers: Headers): void {
  headers.set('Cache-Control', DYNAMIC_CACHE_CONTROL);
  headers.set('Pragma', 'no-cache');
  headers.set('Expires', '0');
  headers.set('Vary', mergeVary(headers.get('Vary')));
}
