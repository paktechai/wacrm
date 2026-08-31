type TimingEntry = { name: string; durationMs: number };

/** Small per-request timer used by AI routes to expose actionable latency. */
export class ServerTiming {
  private readonly startedAt = performance.now();
  private readonly entries: TimingEntry[] = [];

  async measure<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const startedAt = performance.now();
    try {
      return await operation();
    } finally {
      this.entries.push({ name, durationMs: performance.now() - startedAt });
    }
  }

  headerValue(): string {
    const totalMs = performance.now() - this.startedAt;
    return [...this.entries, { name: 'total', durationMs: totalMs }]
      .map(({ name, durationMs }) => `${name};dur=${durationMs.toFixed(1)}`)
      .join(', ');
  }

  apply(response: Response): Response {
    response.headers.set('Server-Timing', this.headerValue());
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }
}
