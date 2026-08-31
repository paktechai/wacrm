import { describe, expect, it } from 'vitest';
import { ServerTiming } from './server-timing';

describe('ServerTiming', () => {
  it('records provider and total timings on the response', async () => {
    const timing = new ServerTiming();
    await timing.measure('provider', async () => 'ok');
    const response = timing.apply(Response.json({ ok: true }));

    expect(response.headers.get('server-timing')).toMatch(
      /^provider;dur=\d+\.\d, total;dur=\d+\.\d$/
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
