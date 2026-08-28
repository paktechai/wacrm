# Wova8 rebrand and domain-migration preparation — delivery report

Prepared: 2026-08-27  
Branch: `feat/wova8-rebrand-prep`  
Baseline: `ca9824b`  
Status: code and runbooks prepared locally; no DNS, Hostinger, Supabase Auth, Meta, credential, schema, or tenant-data change performed.

## A. Rebrand completed

Central brand/domain configuration now lives in `src/lib/brand.ts`, with tests in `src/lib/brand.test.ts`. Company, product, public URL, CRM URL, legacy CRM URL, public routes, and contact-email structure no longer need scattered production literals.

Exact changed surfaces:

- Application identity: `package.json`, `.env.local.example`, `src/app/layout.tsx`, `src/app/manifest.ts`, `src/app/icon.tsx`, `public/offline.html`, `public/sw.js`, `public/wova8-pwa-icon.svg`, and the compatibility path `public/sbyt-pwa-icon.svg` (now serves the Wova8 image).
- CRM/auth presentation: auth login/signup/reset/forgot pages, `src/components/auth/auth-shell.tsx`, `src/components/brand/brand-mark.tsx`, `src/components/layout/sidebar.tsx`, CRM, onboarding, billing, commerce, admin, audit, plan editor, MFA, and Embedded Signup readiness surfaces.
- AI and messaging identity: Copilot/draft routes, AI prompts/types/auto-reply/autonomous-agent text, WhatsApp configuration/verification, send/broadcast billing imports, and new-order prefix.
- Integration identity: `public/wova8-chat-widget.js` and new dashboard embed snippets. `public/sbyt-chat-widget.js` is a compatibility loader into the Wova8 widget.
- Internal contracts: Wova8 billing feature/metric exports and types are canonical; legacy SBYT aliases remain deprecated compatibility exports.
- Enterprise export: user-visible download filename is `wova8-crm-export-*`; stable schema ID remains unchanged.
- Verification: `.github/workflows/branch-verify.yml`, middleware tests, brand tests, and public-artifact tests.

## B. Website prepared

Public routes:

| Route              | Purpose                                             |
| ------------------ | --------------------------------------------------- |
| `/` on `wova8.com` | Wova8 company home                                  |
| `/product`         | Wova8 CRM product page                              |
| `/contact`         | Product, privacy, and legal contact structure       |
| `/privacy`         | Website/CRM/integrations/privacy policy             |
| `/terms`           | SaaS/CRM terms                                      |
| `/data-deletion`   | Stable Meta-suitable deletion-request instructions  |
| `/robots.txt`      | Public allowlist and authenticated-route exclusions |
| `/sitemap.xml`     | Canonical Wova8 public URLs only                    |
| `/opengraph-image` | Wova8 social preview                                |

`/product` is intentionally used instead of `/crm` because `/crm` is an existing authenticated CRM workspace module. This avoids a route collision and keeps the functional module protected.

The public site contains no fabricated metrics, customers, testimonials, reviews, certifications, partner badges, or Meta/WhatsApp partnership claims.

## C. CRM prepared

- Root routing is host-aware: `crm.wova8.com` and `crm.sbyt.app` redirect to the existing protected dashboard; `wova8.com` renders the company home.
- Public company/legal pages bypass the Supabase auth round trip, while every workspace route keeps existing authentication and role enforcement.
- Invitation links use the validated canonical CRM origin rather than reflected Host headers.
- Auth callbacks preserve recognized new or legacy CRM proxy hosts and fall back to the configured canonical CRM origin.
- Provider/model/API-key behavior, Meta credentials, WhatsApp credentials, encryption, tenant isolation, RLS, and permissions are unchanged.
- Legacy sessions remain valid on `crm.sbyt.app`. Browser security correctly requires a separate login cookie on `crm.wova8.com`; cookie scope was not weakened.

## D. Domain migration prepared

The exact procedure is in `docs/WOVA8_CUTOVER_RUNBOOK.md`. Required application build-time environment:

```dotenv
NEXT_PUBLIC_COMPANY_URL=https://wova8.com
NEXT_PUBLIC_SITE_URL=https://crm.wova8.com
ALLOWED_INVITE_HOSTS=crm.wova8.com,crm.sbyt.app
```

Set `NEXT_PUBLIC_*` before `npm run build`; restarting an already-built Next.js bundle is insufficient. Prefer `WOVA8_SUPER_ADMIN_EMAILS`, with the deployed legacy variable retained as a fallback during migration.

## E. DNS records required

| Host        | Type    | Required value                          | Cutover TTL |
| ----------- | ------- | --------------------------------------- | ----------- |
| `@`         | `A`     | Hostinger VPS public IPv4               | 300         |
| `crm`       | `A`     | Hostinger VPS public IPv4               | 300         |
| `www`       | `CNAME` | `wova8.com`                             | 300         |
| `@` / `crm` | `AAAA`  | VPS public IPv6 only if actually routed | 300         |

The VPS IP is not available through the connector in this session and is deliberately not guessed. Preserve existing MX, SPF, DKIM, DMARC, verification, and unrelated TXT records.

## F. External dashboard changes required at cutover

### Hostinger / VPS

- Deploy the approved commit from the configured SSH Git remote into a separate release directory.
- Build with Wova8 environment, start on a candidate port, then add proxy server names for `wova8.com`, `www.wova8.com`, and `crm.wova8.com`.
- Preserve the `crm.sbyt.app` server block, TLS, old release, and DNS for rollback.
- Forward Host/proto/forwarded headers, preserve `private, no-store` and RSC-aware `Vary`, and issue valid TLS for all new hosts.

### Supabase

- Add `https://crm.wova8.com/auth/callback` to Additional Redirect URLs.
- Retain `https://crm.sbyt.app/auth/callback` during rollback coverage.
- After the new origin is healthy, set Site URL to `https://crm.wova8.com`.
- Do not alter users, identities, RLS, database objects, JWT settings, keys, or tenant data.

### Meta Developers / WhatsApp Manager

Use `docs/WOVA8_META_READINESS.md`: public website `https://wova8.com`, App Domains `wova8.com` and `crm.wova8.com`, privacy/terms/deletion/contact URLs, and webhook `https://crm.wova8.com/api/whatsapp/webhook`. Do not create assets, switch Live mode, request permissions/review, claim partner status, add a production number, or reconnect a disabled WABA without separate approval.

### Mail

Provision and test `support@wova8.com`, `privacy@wova8.com`, and `legal@wova8.com` before public launch/Meta submission. No mailbox was created in this preparation.

## G. Regression tests

- Wova8 domain, middleware, and public-artifact tests: **43/43 passed**.
- Full Vitest suite: **961/963 passed** across 96 files.
- The two failures are the pre-existing UTC date-fixture assertions in `src/lib/dashboard/date-utils.test.ts` (`mondayIndex`); they are unrelated to the rebrand.
- TypeScript: passed.
- ESLint: 0 errors; existing warnings remain outside rebrand scope.
- Next.js production build: passed; 87 static pages generated.
- Built HTTP probes:
  - `wova8.com/`, `/product`, and `/privacy`: 200 `text/html`.
  - `crm.wova8.com/`: 307 to `/dashboard`.
  - logged-out `crm.wova8.com/dashboard`: 307 to login.
  - RSC `/product`: 200 `text/x-component`.
  - dynamic responses: `private, no-cache, no-store` with RSC-aware `Vary`.
  - product canonical: `https://wova8.com/product`; title: `Wova8 CRM`.

## H. Remaining SBYT references

Every remaining reference is intentional:

- Supabase migrations 040–054 and `docs/SBYT_CRM_FINAL_CHECKLIST.md`: immutable migration history and dated production evidence.
- Database read-only audit: one old-brand account name and one historical `SBYT Foundation` system-plan name. Neither is rewritten without a classified, approved business-data migration.
- `crm.sbyt.app`: legacy/rollback origin in centralized config, tests, environment example, audit, and runbook.
- `SBYT_SUPER_ADMIN_EMAILS`: temporary fallback preventing platform-admin lockout.
- `SBYT_FEATURES`, `SBYT_METRICS`, and legacy types: deprecated source-compatibility aliases.
- `sbyt-crm-export-v1`: stable machine schema ID; visible filename is Wova8.
- `/sbyt-chat-widget.js`, `data-sbyt-key`, `sbyt-chat:*`, and `/sbyt-pwa-icon.svg`: legacy public integration/cache paths. They now load/present Wova8 content.
- `SBYT_APP` in the WhatsApp registration test: arbitrary non-production fixture.
- `feat/sbyt-crm-finalization` in CI: existing production branch remains verified during migration.
- Old-brand mentions inside the new audit/runbook: explanatory migration and rollback evidence only.

There is no unexplained customer-facing old-brand label in the prepared rendered pages.

## I. AI/builder footprint audit

Repository and rendered-source searches found no “Made/Generated/Built with AI” badge, builder watermark, template watermark, lorem ipsum, fake company/testimonial text, Lovable/Bolt/v0/Webflow/Framer badge, staging badge, or debug banner. No production browser source-map option was enabled. Legitimate Wova8 CRM features named AI Agents, Copilot, and AI-assisted operations remain because they are real product functions. Legally required dependency notices were not removed.

## J. Risks and blockers

- Hostinger account-side DNS/VPS tools were unavailable, so the VPS IP, current DNS zone, proxy file, firewall, and TLS state require manual read-only confirmation before cutover.
- Wova8 mailboxes are prepared as identity values but not provisioned/tested.
- The legal entity name, registered address, governing law, commercial SLA, and jurisdiction were not provided. The public legal pages are operational baseline copy and should receive business/legal review before commercial launch.
- Supabase Site URL/redirects and Meta dashboard fields remain unchanged by design.
- Visual browser screenshot automation was not available in this environment; the built pages were validated through production compilation and HTTP/rendered-source probes.
- The two unrelated timezone tests should be fixed separately, without coupling that work to the domain migration.

## K. Rollback plan

Keep the known-good commit/process, `crm.sbyt.app` DNS/proxy/TLS, old environment backup, old Supabase callback, and prior Meta values. On a failed cutover: direct traffic back to the captured old records/process, restore `NEXT_PUBLIC_SITE_URL=https://crm.sbyt.app` and rebuild/deploy the known-good commit, reset Supabase Site URL while temporarily retaining both callbacks, restore any changed Meta callback values, and re-run login/session/webhook/messaging/AI checks. No database restore is required because this preparation performs no schema or tenant-data migration.

## Approval gate

No live cutover or production publication has occurred. Review this report and the two runbooks before approving a Git push/deployment or any external dashboard change.
