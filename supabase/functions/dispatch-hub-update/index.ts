declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return bytesToHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)));
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalJson(object[key])}`
  ).join(',')}}`;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

Deno.serve(async (request: Request) => {
  try {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    const supplied = request.headers.get('x-wova8-webhook-secret') || '';
    if (!constantTimeEqual(supplied, env('HUB_WEBHOOK_SECRET'))) {
      return new Response('Unauthorized', { status: 401 });
    }
    const event = await request.json();
    if (event.schema !== 'public' || event.table !== 'hub_apps' || !['INSERT', 'UPDATE'].includes(event.type)) {
      return new Response('Ignored', { status: 202 });
    }
    const row = event.record;
    if (row?.publication_status !== 'published') return new Response('Ignored', { status: 202 });

    const record = {
      id: String(row.id),
      slug: String(row.slug),
      name: String(row.name),
      description: String(row.description),
      url: String(row.url),
      icon: row.icon ? String(row.icon) : null,
      category: String(row.category),
      sort_order: Number(row.sort_order || 1000),
      updated_at: String(row.updated_at),
    };
    const payload = canonicalJson(record);
    const signature = await hmacHex(env('HUB_DISPATCH_SIGNING_SECRET'), payload);
    const dispatchMode = Deno.env.get('HUB_DISPATCH_MODE') || 'simulate';
    if (!['simulate', 'dispatch'].includes(dispatchMode)) {
      throw new Error('HUB_DISPATCH_MODE must be simulate or dispatch');
    }
    if (dispatchMode === 'simulate') {
      return Response.json({
        simulated: true,
        dispatched: false,
        eventType: 'supabase-hub-app-published',
        record,
        signature,
      });
    }
    const response = await fetch(
      `https://api.github.com/repos/${env('GITHUB_OWNER')}/${env('GITHUB_REPO')}/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env('GITHUB_DISPATCH_TOKEN')}`,
          Accept: 'application/vnd.github+json',
          'content-type': 'application/json',
          'x-github-api-version': '2022-11-28',
          'user-agent': 'wova8-hub-sync',
        },
        body: JSON.stringify({
          event_type: 'supabase-hub-app-published',
          client_payload: { environment: 'production', record, signature },
        }),
      },
    );
    if (!response.ok) throw new Error(`GitHub dispatch failed: ${response.status} ${await response.text()}`);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Dispatch failed' }, { status: 500 });
  }
});
