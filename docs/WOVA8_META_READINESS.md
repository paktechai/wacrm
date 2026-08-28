# Wova8 Meta and WhatsApp readiness map

Status: values prepared for review; nothing in this document authorizes a Meta dashboard change or asset creation.

## Public identity

| Meta field / review evidence | Prepared value                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------ |
| Company website              | `https://wova8.com`                                                            |
| Product application          | `https://crm.wova8.com`                                                        |
| Privacy Policy               | `https://wova8.com/privacy`                                                    |
| Terms of Service             | `https://wova8.com/terms`                                                      |
| User Data Deletion           | `https://wova8.com/data-deletion`                                              |
| Contact                      | `https://wova8.com/contact`                                                    |
| Support email                | `support@wova8.com` (mailbox must be provisioned and tested before submission) |
| Privacy email                | `privacy@wova8.com` (mailbox must be provisioned and tested before submission) |

## Meta Developers values to review after domain validation

| Configuration                        | Prepared value / action                                                                                                          |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| App display identity                 | Wova8 / Wova8 CRM, consistently with the verified business identity                                                              |
| App Domains                          | `wova8.com`, `crm.wova8.com`                                                                                                     |
| Website URL                          | `https://wova8.com`                                                                                                              |
| Valid OAuth Redirect URI             | `https://crm.wova8.com/auth/callback` if the app&apos;s Meta login/Embedded Signup configuration routes through the CRM callback |
| JavaScript SDK allowed domain/origin | `https://crm.wova8.com` where the relevant Meta product requests an origin                                                       |
| WhatsApp webhook callback            | `https://crm.wova8.com/api/whatsapp/webhook`                                                                                     |
| Webhook verify token                 | Preserve the existing server-side secret; never copy it into source or this document                                             |
| App secret / access tokens           | Preserve server-side encrypted/configured values; never expose them to the browser                                               |
| Embedded Signup configuration        | Create or update only after the verified domains, public pages, business identity, and permissions are ready                     |

Meta field names differ by product and dashboard version. Enter a URL only where the selected Meta product actually requests it; do not create decorative infrastructure or duplicate apps.

## Review narrative

Wova8 is a software company. Wova8 CRM is its current customer-operations product. The CRM supports contacts, conversations, inbox collaboration, assignments, notifications, tags, deals and pipelines, broadcasts, automations, flows, AI-assisted functions, analytics, and WhatsApp Business Platform as an integrated communication channel. WhatsApp does not define the entire company or product.

Do not claim Wova8 is a Meta Partner, WhatsApp Partner, Meta Business Partner, Solution Partner, or Tech Provider unless Meta has formally granted the relevant status.

## Required readiness checks before submission

- Both domains resolve publicly over valid HTTPS and present the same Wova8 identity.
- Privacy, Terms, Data Deletion, Contact, and product pages are reachable without login and contain no placeholders.
- The three Wova8 email mailboxes used publicly are provisioned, can receive mail, and have appropriate SPF/DKIM/DMARC configuration.
- Supabase accepts the new CRM callback without removing the legacy rollback callback.
- The webhook endpoint verifies Meta signatures and remains tenant-scoped.
- Embedded Signup configuration uses the intended Meta app, WABA, permissions, and business portfolio; no disabled asset is reused to bypass enforcement.
- Requested permissions match implemented product behavior and supporting review instructions/screens are accurate.
- No fake partner badge, certification, customer, metric, testimonial, or misleading trademark treatment is displayed.

## Explicitly deferred

Do not create a Business Portfolio, WABA, test WABA, production number connection, App Review request, advanced-permission request, Live-mode switch, Tech Provider claim, or disabled-WABA reconnection as part of the software preparation. Those actions require separate authorization after the domain foundation is stable.
