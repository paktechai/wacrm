# Wova8 domain cutover and rollback runbook

Status: Wova8 production cutover complete; legacy-host retirement in progress.
Target public site: `https://wova8.com`
Target CRM: `https://crm.wova8.com`
Retired legacy CRM: `https://crm.sbyt.app` (do not use as an application origin)

## Preconditions and evidence capture

1. Record the current live Git commit, deployment timestamp, Hostinger/VPS public IPv4/IPv6 values, DNS records, TLS state, environment revision, Supabase Auth URL settings, and Meta callback values. Do not print secrets into the record.
2. Confirm the approved Wova8 commit is present on the intended deployment branch. The VPS repository is already cloned and its `origin` uses SSH; verify `git status --short`, `git remote -v`, and the exact target commit before deployment. A clean `main` is not proof that the Wova8 feature commit has been merged.
3. Export/backup the current VPS environment file and reverse-proxy configuration to an access-restricted location. Never commit either file.
4. Confirm `crm.wova8.com` is healthy: login page, authenticated dashboard, auth callback, inbound webhook verification, and an API unauthorized response.
5. Lower only the relevant DNS TTLs to 300 seconds at least one prior TTL window before cutover. Do not remove or replace MX, SPF, DKIM, DMARC, domain verification, or unrelated TXT records.

## DNS records

The target value cannot be finalized until the VPS public address is read from Hostinger. Use the exact address already serving the approved reverse proxy; do not invent an IP.

| Host        | Type    | Value                         | TTL                | Purpose                                                         |
| ----------- | ------- | ----------------------------- | ------------------ | --------------------------------------------------------------- |
| `@`         | `A`     | `<HOSTINGER_VPS_PUBLIC_IPV4>` | 300 during cutover | Wova8 public website                                            |
| `crm`       | `A`     | `<HOSTINGER_VPS_PUBLIC_IPV4>` | 300 during cutover | Wova8 CRM                                                       |
| `www`       | `CNAME` | `wova8.com`                   | 300 during cutover | Public-site alias                                               |
| `@` / `crm` | `AAAA`  | `<HOSTINGER_VPS_PUBLIC_IPV6>` | 300                | Add only if IPv6 is configured and the proxy/firewall serves it |

After a stable observation period, increase the application-record TTLs to the normal operational value. Preserve all mail and verification records exactly.

## VPS and reverse proxy

1. Add `wova8.com`, `www.wova8.com`, and `crm.wova8.com` as server names routed to the same Next.js origin process.
2. Remove the retired `crm.sbyt.app` mapping only after the canonical Wova8 CRM passes all verification gates and four Git rollback commits are recorded.
3. Ensure the proxy forwards at least `Host`, `X-Forwarded-Host`, `X-Forwarded-Proto`, `X-Forwarded-For`, and upgrade headers required by the runtime.
4. Do not cache `/api/*`, authenticated pages, redirects, or RSC/Flight responses. Preserve the application&apos;s `private, no-store` and `Vary` headers. Static fingerprinted `/_next/static/*` assets may use their framework-provided caching.
5. Validate configuration syntax before reload. Reload gracefully; do not stop the known-good process until the new process is healthy.
6. Provision TLS for `wova8.com`, `www.wova8.com`, and `crm.wova8.com`. Confirm the certificate chain and hostname coverage before directing traffic.

## Application deployment and environment

Deploy the exact approved commit into a separate release directory. Set the following non-secret migration variables **before** `npm run build` because Next.js inlines `NEXT_PUBLIC_*` values into the production build. Install from the lockfile, run tests/build, and start the candidate release on a separate local port using the existing process manager:

```dotenv
NEXT_PUBLIC_COMPANY_URL=https://wova8.com
NEXT_PUBLIC_SITE_URL=https://crm.wova8.com
ALLOWED_INVITE_HOSTS=crm.wova8.com
```

Prefer `WOVA8_SUPER_ADMIN_EMAILS` for the existing bootstrap list, copying the value securely from the legacy variable if it is still needed. The code retains `SBYT_SUPER_ADMIN_EMAILS` as a transition fallback. Do not rotate or edit Supabase, encryption, Meta, WhatsApp, AI-provider, webhook, cron, or API-key secrets for this domain migration.

## Supabase Auth dashboard

Project: `evzhrljwcgnegptygzft`.

1. Set Site URL to `https://crm.wova8.com` only when the new CRM origin and TLS are healthy.
2. Add `https://crm.wova8.com/auth/callback` to Additional Redirect URLs.
3. Remove `https://crm.sbyt.app/**` from Additional Redirect URLs after confirming no active flow depends on it.
4. Verify any email-confirmation, password-recovery, invitation, and OAuth-provider flows use an approved CRM URL.
5. Do not change JWT settings, RLS, users, identities, service keys, database schema, or tenant data.
6. External OAuth providers that point to Supabase&apos;s project callback (`https://evzhrljwcgnegptygzft.supabase.co/auth/v1/callback`) keep that value unless their own configuration explicitly requires a website/app origin.

Sessions remain host-scoped to `crm.wova8.com`. Do not broaden cookie domains or weaken SameSite/Secure behavior.

## Cutover order

1. Build and start the approved candidate release with the Wova8 environment on a separate local port; probe it locally with explicit Wova8 Host headers.
2. Route the Wova8 hosts to the verified release and validate forwarded host/protocol headers.
3. Add Wova8 DNS records and wait for public resolution.
4. Issue/verify TLS and probe both Wova8 hosts with cache-busting query strings.
5. Add the new Supabase redirect URL, then update Site URL.
6. Run the health and regression gates below before removing the legacy host mapping.
7. Only after the domain foundation passes, update the approved Meta configuration using `WOVA8_META_READINESS.md`.
8. Keep four known-good Git commits as rollback points; do not depend on the retired hostname.

## Verification gates

### HTTP, document, and cache

- `https://wova8.com/` returns a rendered HTML document and Wova8 company home.
- `/product`, `/contact`, `/privacy`, `/terms`, and `/data-deletion` return 200 and correct canonical metadata.
- `https://crm.wova8.com/` redirects to the protected dashboard route; a logged-out dashboard request redirects to login.
- A normal document has `Content-Type: text/html`; an RSC request has `Content-Type: text/x-component`.
- Authenticated pages, API responses, and redirects have `private, no-store`; no proxy serves RSC payload as a top-level document.
- `robots.txt`, `sitemap.xml`, manifest, icon, Open Graph image, offline page, and new widget asset load successfully.

### Authentication and CRM

1. Fully logged-out login opens Dashboard on the first attempt.
2. Email verification and password reset return to the new CRM host.
3. Expired-session refresh preserves cookies; normal and hard refresh render normally.
4. Logout completes and protected routes remain protected.
5. Verify dashboard, contacts, conversations, inbox, smart inbox, search/filter, assignment, notifications, tags, deals/pipelines, broadcasts, automations, flows, settings, integrations, and account roles.

### Messaging and AI

1. Send one inbound WhatsApp test webhook and confirm signature verification, tenant routing, conversation/message persistence, automation behavior, and logs.
2. Send one allowed outbound message and confirm status callbacks.
3. Run AI Playground, Copilot Summary/Analyze/Next action, Rewrite, Translate, Draft, and permitted Auto-reply checks without changing provider/model/key configuration.
4. Refresh Usage and confirm calls/tokens and per-model totals remain tenant-scoped and exactly counted.

## Rollback

Trigger rollback for failed TLS, login/callback failure, repeated 5xx, tenant/auth regression, webhook loss, raw RSC documents, or material messaging failure.

1. Keep users on `crm.wova8.com` and select one of the four recorded known-good Git commits.
2. Deploy that commit with `NEXT_PUBLIC_SITE_URL=https://crm.wova8.com`.
3. Restore the last known-good Wova8 reverse-proxy configuration and gracefully reload it.
4. Keep Supabase Site URL on `https://crm.wova8.com` and verify the exact Wova8 callback URL.
5. Restore prior Meta callback/domain values if Meta changes had begun. Do not rotate credentials or reconnect disabled assets as part of rollback.
6. Confirm `crm.wova8.com` login, session refresh, inbound/outbound messaging, AI provider call, and webhook processing.
7. Preserve logs and timestamps, document the failure, and wait for a new approved cutover.

Rollback does not require a database restore because this preparation includes no schema or business-data migration.
