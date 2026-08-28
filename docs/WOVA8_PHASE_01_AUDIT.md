# Wova8 migration — Phase 01 current-state audit

Audit date: 2026-08-27  
Source baseline: `origin/feat/sbyt-crm-finalization` at `ca9824b`  
Preparation branch: `feat/wova8-rebrand-prep`

## Locked safety boundary

- Prepare `https://wova8.com` for the company site and `https://crm.wova8.com` for Wova8 CRM.
- Keep `https://crm.sbyt.app` operational and recoverable until an explicitly approved cutover.
- Do not change live DNS, Hostinger domain bindings, Meta assets, Supabase Auth settings, credentials, schema, tenant data, or provider configuration during preparation.
- Preserve authentication, tenant isolation, API-key behavior, webhook verification, existing migrations, and stable integration identifiers.

## Repository and deployment baseline

| Area              | Current state                                                                               | Migration treatment                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Application       | Next.js 16.2.12 / React 19.2.4                                                              | Retain stack and current protected-route behavior.                                           |
| Production source | GitHub branch `feat/sbyt-crm-finalization`                                                  | Prepare on an isolated feature branch; do not publish without approval.                      |
| Current CRM       | `crm.sbyt.app` serves the deployed application                                              | Keep as an allowed legacy application origin during transition.                              |
| New company site  | `wova8.com`                                                                                 | Prepare public pages in the same deployable application; domain activation remains external. |
| New CRM origin    | `crm.wova8.com`                                                                             | Add as the canonical application origin in centralized configuration.                        |
| Supabase          | Project `evzhrljwcgnegptygzft`                                                              | Read-only audit only in this phase; no data or Auth configuration writes.                    |
| Hostinger         | Current app remains live; account-side website/domain tools are unavailable in this session | Record exact dashboard changes for the approved cutover; make no guessed changes.            |
| Meta              | Existing WhatsApp/Meta integration code and credentials                                     | Prepare URL inventory only; do not create or alter Meta assets.                              |

## Source inventory

The repository search covered tracked and untracked source/configuration files, excluding `.git`, `node_modules`, and generated lock-file content. Exact old-brand/domain matches occur in the following groups.

### Replace: user-facing product and company identity

- App identity and install assets: `package.json`, `src/app/layout.tsx`, `src/app/manifest.ts`, `src/app/icon.tsx`, `public/offline.html`, `public/sbyt-pwa-icon.svg`, `public/sw.js`.
- Authentication: `src/components/auth/auth-shell.tsx`, login, signup, forgot-password, and reset-password pages.
- CRM navigation and screens: sidebar, CRM, onboarding, billing, commerce, admin, admin audit, and plan editor pages.
- AI visible behavior and prompts: Copilot prompts, draft route, autonomous-agent prompt, and AI type comments.
- Meta/WhatsApp readiness messages: WhatsApp config, registration verification, and Embedded Signup readiness UI.
- Enterprise identity: MFA authenticator label and enterprise/admin copy.
- Widget presentation: `public/sbyt-chat-widget.js` and dashboard integration embed instructions.
- Documentation/package presentation: `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, and package metadata where the text represents this product rather than upstream history.

### Replace through centralized configuration

- `.env.local.example`: canonical application URL, company URL, invite allowlist, platform-admin documentation, and Meta readiness comments.
- `src/app/auth/callback/route.ts`: public application-origin resolution.
- `src/app/api/account/invitations/route.ts`: invite base URL and unsafe legacy fallback.
- `src/app/api/whatsapp/embedded-signup/status/route.ts`: exposed site URL.
- `src/app/(dashboard)/integrations/page.tsx`: widget script URL and SSR fallback origin.
- Metadata, canonical URLs, sitemap, robots, Open Graph, PWA manifest, and public/contact/legal links.

### Preserve with a compatibility path

- `SBYT_SUPER_ADMIN_EMAILS`: deployed legacy environment name. New code will prefer `WOVA8_SUPER_ADMIN_EMAILS` and retain the old name as a temporary fallback so access is not lost during deployment.
- `SBYT_FEATURES`, `SBYT_METRICS`, `SbytFeature`, and `SbytMetric`: internal TypeScript contracts. New Wova8 exports can be introduced while legacy aliases remain available until callers are migrated.
- `sbyt-crm-export-v1`: stable machine-readable enterprise export schema. Preserve the schema identifier for consumers while changing user-visible filenames/labels.
- `data-sbyt-key`, `sbyt-chat`, and `/sbyt-chat-widget.js`: public embed compatibility surface. Add Wova8 equivalents and continue accepting the legacy attribute/storage/asset path during migration.
- Current `crm.sbyt.app`: retain in redirect/host allowlists and external Supabase/Meta configuration until post-cutover validation is complete.
- Existing `SBYT-` order-number prefix: stored business identifier compatibility should be preserved for existing orders; new orders can use the Wova8 prefix without rewriting history.

### Preserve unchanged as history

- Supabase migrations `040_sbyt_saas_foundation.sql` through `054_sbyt_enterprise_mfa_feature_contract.sql`, including migration comments, exception strings, seeded `SBYT Foundation` plan name, and database comments. Applied migrations are immutable historical records.
- `docs/SBYT_CRM_FINAL_CHECKLIST.md`: dated verification evidence for the previous production identity/domain.
- Historical changelog entries and upstream `wacrm.tech` references that document the original upstream project rather than the Wova8 product.
- Test fixture value `SBYT_APP` in `src/lib/whatsapp/registration.test.ts`; it is an arbitrary Meta App ID fixture, not branding shown to users.

## URL, callback, origin, and cache audit

| Surface                 | Current behavior                                                                    | Required preparation                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Canonical app URL       | `NEXT_PUBLIC_SITE_URL=https://crm.sbyt.app` example                                 | Change deployment target value to `https://crm.wova8.com`; retain the old origin in the transition allowlist.   |
| Company URL             | Not centrally configured                                                            | Add `NEXT_PUBLIC_COMPANY_URL=https://wova8.com`.                                                                |
| Auth callback           | Prefers `NEXT_PUBLIC_SITE_URL`, then request origin                                 | Route through validated centralized application URL; add both CRM origins to Supabase redirects during cutover. |
| Password recovery       | Uses the browser origin for `/auth/callback`                                        | Works per active host; both hosts must remain approved in Supabase during migration.                            |
| Invitations             | Uses configured URL/forwarded host, then `https://wacrm.tech`                       | Remove upstream fallback; use validated Wova8 CRM configuration and a strict transition host allowlist.         |
| Embedded Signup status  | Returns `NEXT_PUBLIC_SITE_URL`                                                      | Return canonical configured Wova8 CRM URL after environment change.                                             |
| Webhooks                | Relative server routes, notably `/api/whatsapp/webhook`                             | No code-path change; Meta callback URL changes only during the approved external cutover.                       |
| CSP                     | Report-only; permits self, Supabase, Meta Graph, and required media sources         | No new external runtime dependency is required for Wova8 public pages.                                          |
| Protected content cache | `private, no-store` with RSC-aware `Vary`                                           | Preserve unchanged.                                                                                             |
| Cookies                 | Supabase SSR cookies are host scoped; no hard-coded `.sbyt.app` cookie domain found | Expect a new login/session on `crm.wova8.com`; do not broaden cookie scope or weaken auth.                      |
| Cron/API routes         | Relative paths; no old absolute production origin found                             | No domain-specific source change required.                                                                      |

## Supabase read-only findings

No Supabase rows were modified. A read-only text-location audit found:

- `accounts.name`: 1 old-brand match (the preserved tenant/account identity; update only under separately approved business-data migration).
- `saas_plans.name/description`: 1 old-brand match (the historical `SBYT Foundation` system plan; preserve for migration compatibility unless a dedicated data migration is approved).
- `webhook_endpoints.url`: 0 old-domain matches.
- `webchat_widgets.name`: 0 old-brand matches.
- `integration_connections.name`: 0 old-brand matches.

Supabase hosted Auth Site URL and Additional Redirect URL values are external dashboard configuration and cannot be inferred from `supabase/config.toml`; that file is local development/CI configuration. The cutover runbook must explicitly add `https://crm.wova8.com/auth/callback` while retaining the current callback until rollback risk has passed.

## External configuration not writable from this session

The Hostinger account connector available here does not expose the account's website/domain/DNS controls. Therefore no claims are made about current Wova8 DNS records, proxy bindings, or TLS issuance, and no external changes will be attempted. The delivery runbook will list the exact records, bindings, verification probes, and rollback steps for manual execution.

## Phase 01 conclusion

The migration is safe to prepare without production behavior changes. The implementation must be domain-aware, retain explicit compatibility aliases, avoid rewriting historical migrations or stored identifiers, and defer all DNS, Supabase Auth dashboard, Hostinger binding, and Meta dashboard changes to the approved cutover window.
