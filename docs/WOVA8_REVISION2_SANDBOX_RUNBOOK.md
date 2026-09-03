# Wova8 Revision 2 — Sandbox-first verification

## Non-negotiable lock

Use a separate Supabase test project and Meta Developer App test assets. The two approved live Wova8 numbers must not appear in any environment variable, fixture, webhook subscription, or onboarding attempt during this phase.

`META_RUNTIME_MODE=sandbox`, `META_WEBHOOK_MODE=log_only`, and `HUB_DISPATCH_MODE=simulate` are the three fail-closed switches. The server refuses live onboarding, rejects webhook payloads whose WABA ID differs from `META_SANDBOX_WABA_ID`, and prevents the Edge Function from calling GitHub.

After copying the IDs directly from Meta's **WhatsApp > API Setup** test panel, set `META_SANDBOX_ASSET_ACK=I_VERIFIED_META_TEST_ASSETS`. Optionally place both protected live WABA IDs and phone-number IDs in the comma-separated denylist variables. The process stops if a sandbox ID matches either denylist. Production remains locked unless a separate exact `META_LIVE_ACTIVATION_ACK` is deliberately supplied later.

## Meta test asset setup

1. In Meta App Dashboard, open **WhatsApp > API Setup**.
2. Copy only the generated **Test WABA ID**, **Test Phone Number ID**, and test access token into a local copy of `.env.sandbox.example`.
3. Add one recipient number allowed by Meta's test-number UI. Do not add or migrate either approved live business number.
4. Set the webhook callback to `/api/meta/webhook`, use the sandbox verify token, and subscribe only the test WABA.
5. Fresh mode performs a read-only lookup of the configured Test Phone Number. It does not subscribe an app or persist `whatsapp_subscribers`.
6. Provider migration and Business App coexistence are UI/state simulations only. A Meta Test Phone Number is not an existing provider-owned number or a WhatsApp Business App number, so those paths require a separate non-critical eligible number later.

## Local verification

Run:

```bash
npm run check
npm test
```

The tests mock Meta and Supabase network calls. They assert that:

- live completion is blocked before authentication or network access;
- sandbox onboarding performs a read-only Test WABA lookup;
- no subscriber or app-subscription mutation occurs;
- signed webhook replays only target `meta_webhook_events`;
- a non-sandbox WABA is rejected before any Supabase request;
- the browser bridge returns from sandbox handling before loading the Facebook SDK.

## First connected sandbox run

1. Apply the migration only to the separate Supabase test project.
2. Start the Node service with the sandbox environment.
3. Open the floating setup modal while signed in to the test tenant.
4. Run **Fresh** and confirm the UI reports `persisted: false`.
5. Send one message to the Meta Test Phone Number.
6. Inspect `public.meta_webhook_events`; replay the identical signed body and confirm the unique `event_key` prevents a second row.
7. Confirm both `public.whatsapp_synced_contacts` and `public.whatsapp_synced_messages` remain empty.
8. Invoke the Hub Edge Function with a published test card and confirm it returns `simulated: true` and `dispatched: false`.

Do not enable `production`, `normalize`, or `dispatch` until raw payloads are reviewed and a separate non-critical Meta-eligible number is approved for migration/coexistence testing.
