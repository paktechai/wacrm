import type { Metadata } from 'next';
import { CheckCircle2, Mail, ShieldCheck, Trash2 } from 'lucide-react';
import { LegalArticle, PageIntro } from '@/components/marketing/site-shell';
import { WOVA8 } from '@/lib/brand';
import { marketingMetadata } from '@/lib/marketing-metadata';

export const metadata: Metadata = marketingMetadata(
  'Data Deletion Instructions',
  'How to request deletion of data associated with Wova8 CRM or a connected service.',
  '/data-deletion'
);

export default function DataDeletionPage() {
  return (
    <>
      <PageIntro
        eyebrow="Privacy request"
        title="Request deletion of your data."
      >
        Wova8 provides a verified request process for personal data associated
        with a Wova8 CRM account or connected application.
      </PageIntro>
      <section className="mx-auto grid max-w-4xl gap-4 px-5 pb-8 sm:grid-cols-3 sm:px-8">
        {[
          [Mail, 'Send request'],
          [ShieldCheck, 'Verify identity'],
          [Trash2, 'Delete or explain retention'],
        ].map(([Icon, label]) => {
          const StepIcon = Icon as typeof Mail;
          return (
            <div
              key={String(label)}
              className="rounded-2xl border border-white/8 bg-white/[0.035] p-5"
            >
              <StepIcon className="size-5 text-violet-300" />
              <p className="mt-4 text-sm font-semibold text-white">
                {String(label)}
              </p>
            </div>
          );
        })}
      </section>
      <LegalArticle>
        <h2>How to submit a request</h2>
        <ol>
          <li>
            Email{' '}
            <a
              className="text-violet-200 hover:text-white"
              href={`mailto:${WOVA8.emails.privacy}?subject=Data%20deletion%20request`}
            >
              {WOVA8.emails.privacy}
            </a>{' '}
            with the subject “Data deletion request”.
          </li>
          <li>
            Use the email address associated with your account where possible.
          </li>
          <li>
            Include your full name, workspace or organization name, the relevant
            phone number or account identifier, and whether you want an
            individual record, connected-channel data, or the full account
            deleted.
          </li>
          <li>
            Do not send passwords, API keys, access tokens, identity documents,
            or other secrets in the first email. We will explain any
            verification step that is actually required.
          </li>
        </ol>
        <h2>What happens next</h2>
        <p>
          We will acknowledge the request, verify that the requester is
          authorized, identify the systems involved, and either complete
          deletion or explain any data that must temporarily be retained for
          legal, security, fraud-prevention, backup, or dispute-resolution
          reasons. We will communicate the applicable completion timeframe after
          verification.
        </p>
        <h2>Workspace data controlled by a customer</h2>
        <p>
          If your information appears in a business&apos;s Wova8 CRM workspace,
          contact that business first. It normally controls the customer record
          and can determine whether it should be corrected or deleted. Wova8
          will assist the workspace owner with a verified request when required.
        </p>
        <h2>Connected Meta or WhatsApp data</h2>
        <p>
          For a request associated with a connected Meta or WhatsApp account,
          include the relevant business/workspace identifier and phone number.
          Wova8 can remove data it controls or processes for the workspace, but
          deletion from a third-party platform may also require action in that
          provider&apos;s account or support channel.
        </p>
        <h2>Account administrators</h2>
        <p>
          Authorized administrators should first use the product&apos;s
          available deletion and disconnection controls. If full workspace
          deletion is required, contact the privacy address above from the
          owner&apos;s account. We will not act on an unverified request that
          could expose or destroy another tenant&apos;s data.
        </p>
        <p className="mt-8 flex items-start gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-400/5 p-5">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-300" />
          <span>
            Deletion requests are handled with tenant and identity checks
            intact. Authentication or protected-route security is not bypassed
            to fulfill a request.
          </span>
        </p>
      </LegalArticle>
    </>
  );
}
