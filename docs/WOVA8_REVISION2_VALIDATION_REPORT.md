# Wova8 Revision 2 sandbox validation report

Date: 2026-09-03 UTC

## Scope

The source implementation remains sandbox-only. On 2026-09-03, the additive Revision 2 schema migration was applied to the connected `Wova8 CRM` Supabase project after a read-only compatibility check. No Hostinger deployment, GitHub dispatch, Meta configuration change, DNS change, production request, customer-row mutation, or live WhatsApp asset operation was performed.

## Enforced safety behavior

- `META_RUNTIME_MODE` defaults to `sandbox`.
- Live onboarding completion returns HTTP 403 before authentication or network access.
- Sandbox onboarding accepts only the server-configured Meta Test WABA and Test Phone Number.
- Optional protected-live-ID denylists stop startup/use when a test ID matches a protected ID.
- Sandbox onboarding performs only a read-only `/{test-waba-id}/phone_numbers` lookup.
- It does not call `/{waba-id}/subscribed_apps` and does not write `whatsapp_subscribers`.
- Sandbox webhooks accept only the configured Test WABA.
- `smb_app_state_sync`, `messages`, and `history` are stored idempotently in `meta_webhook_events`.
- Sandbox webhook normalization is impossible: `META_WEBHOOK_MODE=normalize` is rejected.
- Hub dispatch defaults to simulation and cannot call GitHub until deliberately switched to dispatch mode.
- GitHub Actions ignores repository dispatch payloads that do not declare the production environment.

## Automated result

`npm run check`: PASS

`npm test`: PASS — 7 tests, 0 failures

The suite covers Test WABA read-only verification, live completion blocking, webhook signature/idempotency, zero normalized-table writes, non-sandbox WABA rejection, browser SDK bypass in sandbox, protected-ID denial, and Hub no-dispatch behavior.

Workflow YAML parse: PASS

SQL static security assertions: PASS — unique event key, forced RLS on all Revision 2 tables, token column excluded from authenticated grants, service-role-only mutations, and Wova8's existing `profiles`/`is_account_member` tenant contract are present.

Connected Supabase verification: PASS — all six tables exist and are empty; both enums and required indexes exist; RLS is enabled and forced; authenticated users cannot select encrypted tokens, read raw webhook events, or insert subscriber records; service role retains webhook ingestion access.

## Known Meta test boundary

The Meta Test WABA/Test Phone Number safely exercises Cloud API calls and webhook delivery. It cannot represent an existing solution-provider-owned phone number or a WhatsApp Business App phone number. Therefore provider migration and Business App coexistence are limited to Wova8 UI, state-consumption, and backend-policy simulation until a separate non-critical eligible number is approved. The two protected live Wova8 numbers remain out of scope.
