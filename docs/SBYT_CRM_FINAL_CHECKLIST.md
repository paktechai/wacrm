# SBYT CRM — Final Verification Checklist

Last verified branch: `feat/sbyt-crm-finalization`

Verification baseline: `dd0943b7a46b0c57a4e8488659729758d36dace8`

Legend: ✅ verified/complete · 🟡 external launch dependency

## Product and SaaS foundation

- ✅ SBYT CRM branding, metadata, favicon, responsive auth shell
- ✅ Multi-tenant account/workspace model with tenant-scoped access
- ✅ Plans, subscriptions, lifecycle states and usage metering
- ✅ Seat/contact limits and server/database entitlement enforcement
- ✅ Super Admin tenant, plan, subscription, usage and audit controls
- ✅ Customer onboarding, plan and usage views

## Customer engagement and CRM

- ✅ Shared inbox foundation with realtime updates and mobile layout
- ✅ Inbox priority, snooze, SLA and conversation intelligence fields
- ✅ CRM tasks, follow-ups, appointments, lead score and lifecycle stages
- ✅ Existing contacts, tags, custom fields, pipelines, deals and broadcasts preserved
- ✅ Existing visual automations and flows preserved

## AI

- ✅ BYO OpenAI/Anthropic configuration and encrypted provider keys
- ✅ Knowledge-base retrieval and AI reply assistant
- ✅ Copilot summary, rewrite, translation, sentiment, intent, lead score and next-action workflows
- ✅ Autonomous Sales, Support, Receptionist and Lead Qualification agent profiles
- ✅ Autonomous agent CRM actions: create task, create appointment and update lead
- ✅ Agent tool policy is revalidated server-side before mutation
- ✅ Atomic AI reply-slot claim occurs before customer send and CRM tool side effects
- ✅ Duplicate/racing inbound webhook deliveries cannot duplicate autonomous CRM actions through the AI path
- ✅ Human handoff keeps autonomous CRM actions disabled for that turn
- ✅ Legacy AI auto-reply remains the fallback when no active default autonomous agent is configured

## Marketing, commerce and integrations

- ✅ Marketing segments, campaign experiment/A-B structure and attribution/CTWA-ready data model
- ✅ Commerce products, orders, order items and payment-link foundation
- ✅ Integration connection registry for Shopify, WooCommerce, Google Sheets, n8n, Zapier, HubSpot and custom webhooks
- ✅ Provider-neutral channel connection foundation
- ✅ First-party Website Chat channel with embeddable widget and shared-inbox conversation creation

## Mobile and enterprise

- ✅ Installable PWA/mobile-style foundation and offline-safe application shell
- ✅ Tenant audit log and platform audit log separation
- ✅ Data export and retention-control foundation
- ✅ TOTP MFA enrollment/challenge/verification UI
- ✅ Workspace MFA enforcement at both server API and database/RLS write layers when enabled

## Database and security verification

- ✅ Supabase migrations 001–039 and custom hardening migration 900 remain in place
- ✅ SBYT migrations 040–054 applied successfully
- ✅ Clean-database migration replay passed in GitHub Actions
- ✅ Resulting schema verification passed in GitHub Actions
- ✅ New SBYT tenant tables have RLS enabled
- ✅ Service-only audit/worker tables intentionally do not expose authenticated write policies
- ✅ npm dependency audit in CI reported 0 vulnerabilities
- ✅ Final Supabase security adviser review completed

Known adviser items intentionally retained or scheduled for launch hardening:

- `automation_pending_executions` and `platform_audit_log` use RLS without authenticated policies by design; they are service/server-only paths.
- Existing invitation, membership, presence and account-management SECURITY DEFINER RPCs remain callable only where required by current application flows and their internal authorization checks. They must not be blindly revoked merely to silence the adviser.
- `vector` remains installed in the public schema for the current pgvector knowledge-base implementation.
- Supabase leaked-password protection is currently disabled and should be enabled before public customer launch.

## Automated verification result

- ✅ `npm ci`
- ✅ ESLint completed with no errors
- ✅ TypeScript typecheck passed
- ✅ Vitest: **79 test files / 829 tests passed**
- ✅ Next.js production build passed
- ✅ Fresh PostgreSQL migration replay passed
- ✅ Fresh-schema verification passed

GitHub Actions verification:

- CI run `32572759799` — success
- Migration run `32572759802` — success

## External launch dependencies

These do not block internal CRM code verification, but they must be completed before public Meta-connected production launch:

- 🟡 `sbyt.app` / application subdomains fully propagated with HTTPS/SSL
- 🟡 Final `NEXT_PUBLIC_SITE_URL` and production domain environment configuration
- 🟡 Supabase Auth Site URL and allowed redirect URLs migrated to final SBYT origins
- 🟡 Live login, signup, password reset and invitation callback smoke tests on the SBYT domains
- 🟡 Meta Tech Provider / business app setup
- 🟡 Meta Embedded Signup App ID/configuration ID and App Review permissions
- 🟡 Live Embedded Signup: Meta login → business/WABA → phone number → webhook subscription → registration
- 🟡 Instagram and Messenger activation after Meta permissions/credentials
- 🟡 WhatsApp Calling activation where Meta account/product eligibility permits
- 🟡 Live-domain end-to-end WhatsApp webhook/send/template smoke test

## Pre-production security actions

- 🟡 Enable Supabase leaked-password protection before public customer signup
- 🟡 Privately rotate/regenerate any encryption secret that was ever exposed outside the deployment secret store before customer data is onboarded
- 🟡 Verify production service-role, Meta and WhatsApp secrets exist only in server-side environment variables
- 🟡 Confirm production backups/monitoring and retention policy values before customer launch

## Release decision

The internal SBYT CRM branch is code-, test-, build-, migration- and RLS-verified for the features that do not require live Meta/domain credentials. Keep `main` unchanged until the final release/merge decision. Meta- and live-domain-dependent activation should be completed and smoke-tested after the SBYT domains and Meta Tech Provider account are ready.
