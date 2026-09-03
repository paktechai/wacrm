# Wova8 Revision 2 — Next Activation Session

## Frozen baseline

- Approved code baseline: `9a7454b24b6dc5881a56f8e34055255b389c463c`
- Branch: `feat/relationship-os-feature-pack-1`
- Bundle: `Wova8_Revision2_Sandbox_First_Bundle.zip`
- Bundle SHA-256: `bf2e13662d79cb7769dea3aa6bd01129d3aa8716036fab903a9680447e75f842`
- Safety tests: 7/7 passed
- GitHub CI run 50: passed
- GitHub migration run 41: passed
- Supabase migration: `wova8_meta_automation_sandbox_first`
- Hostinger deployment: intentionally pending
- Production/Main/Live Meta assets: untouched

The baseline SHA above identifies the reviewed code. This documentation commit will create a newer branch SHA without changing the reviewed runtime behavior.

## Hostinger preview environment contract

Configure these variables only on `darkorange-turkey-566165.hostingersite.com`. Do not copy them to `crm.wova8.com`.

```dotenv
META_RUNTIME_MODE=sandbox
META_WEBHOOK_MODE=log_only
HUB_DISPATCH_MODE=simulate

PORT=3000
PUBLIC_APP_ORIGIN=https://darkorange-turkey-566165.hostingersite.com

SUPABASE_URL=https://evzhrljwcgnegptygzft.supabase.co
SUPABASE_PUBLISHABLE_KEY=<PREVIEW_SAFE_PUBLISHABLE_KEY>
SUPABASE_SERVICE_ROLE_KEY=<HOSTINGER_SERVER_ONLY_SERVICE_ROLE_KEY>

META_APP_ID=<META_DEVELOPER_TEST_APP_ID>
META_APP_SECRET=<META_DEVELOPER_TEST_APP_SECRET>
META_GRAPH_VERSION=v25.0
META_SANDBOX_WABA_ID=<META_TEST_WABA_ID>
META_SANDBOX_PHONE_NUMBER_ID=<META_TEST_PHONE_NUMBER_ID>
META_SANDBOX_ACCESS_TOKEN=<META_TEST_ACCESS_TOKEN>
META_SANDBOX_ASSET_ACK=I_VERIFIED_META_TEST_ASSETS

META_PROTECTED_WABA_IDS=<LIVE_WABA_ID_1>,<LIVE_WABA_ID_2>
META_PROTECTED_PHONE_NUMBER_IDS=<LIVE_PHONE_NUMBER_ID_1>,<LIVE_PHONE_NUMBER_ID_2>

META_EMBEDDED_SIGNUP_CONFIG_ID_FRESH=
META_EMBEDDED_SIGNUP_CONFIG_ID_MIGRATION=
META_EMBEDDED_SIGNUP_CONFIG_ID_COEXISTENCE=

META_WEBHOOK_VERIFY_TOKEN=<RANDOM_32_BYTE_OR_LONGER_SECRET>
META_ONBOARDING_STATE_SECRET=<RANDOM_32_BYTE_OR_LONGER_SECRET>
META_TOKEN_ENCRYPTION_KEY_B64=<BASE64_ENCODED_32_RANDOM_BYTES>
META_TOKEN_KEY_VERSION=1

HUB_WEBHOOK_SECRET=<RANDOM_32_BYTE_OR_LONGER_SECRET>
HUB_DISPATCH_SIGNING_SECRET=<RANDOM_32_BYTE_OR_LONGER_SECRET>
```

Do not define `META_LIVE_ACTIVATION_ACK`. The three Embedded Signup configuration IDs remain empty during the Meta Test WABA phase. Never place either live WABA or live phone-number ID in a sandbox variable.

## Hostinger preview activation

1. Verify the deployment archive was produced from the approved baseline and its SHA-256 matches the tracking record.
2. Inspect the Hostinger target and confirm it is exactly `darkorange-turkey-566165.hostingersite.com`.
3. Add the environment contract above to the preview Node.js application only.
4. Upload/deploy once, without modifying DNS or `crm.wova8.com`.
5. Confirm the process starts with all three fail-closed switches printed as `sandbox`, `log_only`, and `simulate`.
6. Verify `GET /health` returns `200` and reports sandbox/log-only state.
7. Verify `GET /api/meta/config` exposes only non-secret sandbox configuration.
8. Verify `POST /api/meta/onboarding/complete` returns `403` before attempting authentication or Meta access.
9. Verify `POST /api/meta/onboarding/sandbox-complete` can inspect only the configured Test WABA/Test Phone and returns `persisted: false`.

## Webhook verification and raw-ingestion gate

1. Register the preview callback URL: `https://darkorange-turkey-566165.hostingersite.com/api/meta/webhook`.
2. Use `META_WEBHOOK_VERIFY_TOKEN` for the Meta verification challenge.
3. Send a signed event from `META_SANDBOX_WABA_ID`.
4. Confirm one row is created in `public.meta_webhook_events`.
5. Replay the identical payload and confirm no second logical event is created.
6. Confirm `public.whatsapp_subscribers`, `public.whatsapp_synced_contacts`, and `public.whatsapp_synced_messages` remain unchanged.
7. Send a payload with any other WABA ID and confirm HTTP `403` before a Supabase write.

Keep `META_WEBHOOK_MODE=log_only` throughout sandbox review. The current fail-closed policy deliberately rejects `normalize` while `META_RUNTIME_MODE=sandbox`; there is no environment-only switch for sandbox mutation. After raw payloads are reviewed, normalization requires a separately reviewed code change and a non-critical eligible test number. Do not use either protected live number for that gate.

## Hub relay gate

- Keep `HUB_DISPATCH_MODE=simulate`.
- Do not configure a production GitHub dispatch token during the first sandbox run.
- Confirm a published `hub_apps` test event returns `simulated: true` and does not start the workflow.
- Enable `dispatch` only in a separately approved production activation after canonical signature verification succeeds.

## Stop conditions

Stop immediately if the target hostname is `crm.wova8.com`, a sandbox ID matches a protected ID, a live WABA appears in logs, the webhook tries to normalize data, the Hub relay attempts a GitHub dispatch, or any deployment proposes changing DNS, Supabase schema, Meta/WhatsApp configuration, `main`, or production.

Relationship Intelligence, Pulse, Commitment Radar, Live Signals, and Durable Memory QA remains pending until a safe test conversation exists.
