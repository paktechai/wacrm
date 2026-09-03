import crypto from 'node:crypto';
import { readJson, sendJson } from './lib/http.mjs';
import { supabaseRest } from './lib/supabase-rest.mjs';
import {
  assertSandboxWebhookAssets,
  runtimeMode,
  webhookMode,
} from './lib/runtime-policy.mjs';

const APP_SECRET = process.env.META_APP_SECRET;
const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN;
if (!APP_SECRET || !VERIFY_TOKEN) throw new Error('Meta webhook environment is incomplete');

function validSignature(raw, signatureHeader) {
  if (!signatureHeader?.startsWith('sha256=')) return false;
  const supplied = signatureHeader.slice(7);
  const expected = crypto.createHmac('sha256', APP_SECRET).update(raw).digest('hex');
  return supplied.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

function deepFind(value, predicate, found = []) {
  if (!value || typeof value !== 'object') return found;
  if (predicate(value)) found.push(value);
  for (const child of Object.values(value)) deepFind(child, predicate, found);
  return found;
}

function asTime(value) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
}

async function processChange(subscriber, wabaId, change) {
  const field = String(change.field || 'unknown');
  const payload = change.value || {};
  if (field === 'smb_app_state_sync') {
    const contacts = deepFind(payload, (item) =>
      typeof (item.wa_id || item.waId) === 'string' || typeof item.phone_number === 'string'
    );
    for (const contact of contacts) {
      const waId = String(contact.wa_id || contact.waId || contact.phone_number || '').replace(/\D/g, '');
      if (!waId) continue;
      await supabaseRest('whatsapp_synced_contacts?on_conflict=account_id,waba_id,wa_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: {
          account_id: subscriber.account_id,
          waba_id: wabaId,
          wa_id: waId,
          display_name: contact.name || contact.profile?.name || null,
          state_payload: contact,
          synced_at: new Date().toISOString(),
        },
      });
    }
    return;
  }

  if (!['messages', 'history', 'smb_message_echoes'].includes(field)) return;
  const messages = deepFind(payload, (item) =>
    typeof (item.id || item.message_id) === 'string' &&
    (item.timestamp !== undefined || item.type !== undefined || item.from !== undefined)
  );
  for (const message of messages) {
    const messageId = String(message.id || message.message_id);
    const direction = field === 'smb_message_echoes' || message.direction === 'outbound'
      ? 'outbound' : field === 'messages' ? 'inbound' : 'unknown';
    await supabaseRest('whatsapp_synced_messages?on_conflict=account_id,waba_id,message_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: {
        account_id: subscriber.account_id,
        waba_id: wabaId,
        phone_number_id: payload.metadata?.phone_number_id || subscriber.phone_number_id,
        message_id: messageId,
        wa_id: String(message.from || message.to || message.wa_id || '') || null,
        direction,
        message_type: message.type || null,
        occurred_at: asTime(message.timestamp),
        source_field: field,
        payload: message,
        synced_at: new Date().toISOString(),
      },
    });
  }
}

async function normalizeEvent(eventKey, body) {
  try {
    for (const entry of body.entry || []) {
      const wabaId = String(entry.id || '');
      const rows = await supabaseRest(
        `whatsapp_subscribers?select=account_id,phone_number_id&waba_id=eq.${encodeURIComponent(wabaId)}&limit=1`
      );
      const subscriber = rows?.[0];
      if (!subscriber) continue;
      for (const change of entry.changes || []) await processChange(subscriber, wabaId, change);
    }
    await supabaseRest(`meta_webhook_events?event_key=eq.${encodeURIComponent(eventKey)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: { processed_at: new Date().toISOString(), processing_error: null },
    });
  } catch (error) {
    console.error('Meta webhook normalization failed', { eventKey, error });
    await supabaseRest(`meta_webhook_events?event_key=eq.${encodeURIComponent(eventKey)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: { processing_error: String(error.message).slice(0, 1000) },
    }).catch(console.error);
  }
}

export async function metaWebhook(req, res, url = new URL(req.url, 'http://localhost')) {
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end(challenge);
    }
    return sendJson(res, 403, { error: 'Webhook verification failed' });
  }

  const { raw, json } = await readJson(req, 1024 * 1024);
  if (!validSignature(raw, req.headers['x-hub-signature-256'])) {
    return sendJson(res, 401, { error: 'Invalid webhook signature' });
  }
  const activeRuntime = runtimeMode();
  const activeWebhookMode = webhookMode();
  if (activeRuntime === 'sandbox') assertSandboxWebhookAssets(json);

  const observedFields = [...new Set((json.entry || []).flatMap((entry) =>
    (entry.changes || []).map((change) => String(change.field || 'unknown'))
  ))];
  const logOnlyFields = new Set(['smb_app_state_sync', 'messages', 'history']);
  if (activeRuntime === 'sandbox' && !observedFields.some((field) => logOnlyFields.has(field))) {
    return sendJson(res, 200, { received: true, logged: false, reason: 'field_not_in_sandbox_allowlist' });
  }

  const eventKey = crypto.createHash('sha256').update(raw).digest('hex');
  const firstEntry = json.entry?.[0];
  const wabaId = firstEntry?.id ? String(firstEntry.id) : null;
  const subscribers = activeRuntime === 'production' && wabaId
    ? await supabaseRest(`whatsapp_subscribers?select=account_id&waba_id=eq.${encodeURIComponent(wabaId)}&limit=1`)
    : [];
  const inserted = await supabaseRest('meta_webhook_events?on_conflict=event_key', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: {
      event_key: eventKey,
      account_id: subscribers?.[0]?.account_id || null,
      waba_id: wabaId,
      field_name: observedFields.join(',').slice(0, 255) || null,
      payload: json,
    },
  });
  sendJson(res, 200, {
    received: true,
    logged: Boolean(inserted?.length),
    duplicate: !inserted?.length,
    mode: activeWebhookMode,
  });
  if (activeRuntime === 'production' && activeWebhookMode === 'normalize') {
    setImmediate(() => normalizeEvent(eventKey, json));
  }
}
