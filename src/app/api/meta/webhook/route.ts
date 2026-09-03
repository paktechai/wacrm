import { createHash, timingSafeEqual } from 'node:crypto';

import { createAdminClient } from '@/lib/supabase/admin';
import {
  assertSandboxWebhookPayload,
  metaErrorResponse,
  requireSandboxMode,
  verifyWebhookSignature,
} from '@/lib/meta/sandbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sameText(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  try {
    requireSandboxMode();
    const url = new URL(request.url);
    const mode = url.searchParams.get('hub.mode');
    const challenge = url.searchParams.get('hub.challenge');
    const supplied = url.searchParams.get('hub.verify_token') || '';
    const expected = process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() || '';
    if (
      mode !== 'subscribe' ||
      !challenge ||
      !expected ||
      !sameText(supplied, expected)
    ) {
      return Response.json(
        { error: 'Webhook verification failed' },
        { status: 403 }
      );
    }
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error) {
    return metaErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    requireSandboxMode();
    if ((process.env.META_WEBHOOK_MODE?.trim() || 'log_only') !== 'log_only') {
      return Response.json(
        { error: 'Sandbox webhook must remain in log_only mode' },
        { status: 503 }
      );
    }

    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody) > 1024 * 1024) {
      return Response.json({ error: 'Payload too large' }, { status: 413 });
    }
    if (
      !verifyWebhookSignature(
        rawBody,
        request.headers.get('x-hub-signature-256')
      )
    ) {
      return Response.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return Response.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    const wabaId = assertSandboxWebhookPayload(body);
    const entries = (
      body as {
        entry: Array<{ changes?: Array<{ field?: unknown }> }>;
      }
    ).entry;
    const observedFields = [
      ...new Set(
        entries.flatMap((entry) =>
          (entry.changes ?? []).map((change) =>
            String(change.field ?? 'unknown')
          )
        )
      ),
    ];
    const allowedFields = new Set([
      'smb_app_state_sync',
      'messages',
      'history',
    ]);
    if (!observedFields.some((field) => allowedFields.has(field))) {
      return Response.json({
        received: true,
        logged: false,
        mode: 'log_only',
        reason: 'field_not_in_sandbox_allowlist',
      });
    }

    const eventKey = createHash('sha256').update(rawBody).digest('hex');
    const { data, error } = await createAdminClient()
      .from('meta_webhook_events')
      .upsert(
        {
          event_key: eventKey,
          account_id: null,
          waba_id: wabaId,
          field_name: observedFields.join(',').slice(0, 255) || null,
          payload: body,
        },
        { onConflict: 'event_key', ignoreDuplicates: true }
      )
      .select('event_key');
    if (error) throw error;
    return Response.json({
      received: true,
      logged: Boolean(data?.length),
      duplicate: !data?.length,
      mode: 'log_only',
    });
  } catch (error) {
    return metaErrorResponse(error);
  }
}
