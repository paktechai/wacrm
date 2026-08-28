import type { Metadata } from 'next';
import { LegalArticle, PageIntro } from '@/components/marketing/site-shell';
import { WOVA8 } from '@/lib/brand';
import { marketingMetadata } from '@/lib/marketing-metadata';

export const metadata: Metadata = marketingMetadata(
  'Terms of Service',
  'Terms governing access to Wova8 websites and Wova8 CRM.',
  '/terms'
);

export default function TermsPage() {
  return (
    <>
      <PageIntro eyebrow="Legal" title="Terms of Service">
        These terms govern access to Wova8&apos;s website and Wova8 CRM. Last
        updated: 27 August 2026.
      </PageIntro>
      <LegalArticle>
        <h2>1. Agreement and authority</h2>
        <p>
          By accessing or using the service, you agree to these terms. If you
          use the service for an organization, you confirm that you are
          authorized to bind that organization and administer its workspace.
        </p>
        <h2>2. Accounts and authorized use</h2>
        <p>
          You must provide accurate account information, protect credentials,
          use appropriate access roles, and promptly report suspected
          unauthorized access. You are responsible for activity performed
          through your account and for ensuring that your users follow these
          terms.
        </p>
        <h2>3. Customer data and instructions</h2>
        <p>
          You retain responsibility for data submitted to your workspace and for
          the lawful basis, notices, permissions, and consents required to
          collect, message, automate, analyze, or otherwise process it. You
          authorize Wova8 to process that data as needed to provide, secure, and
          support the service.
        </p>
        <h2>4. Acceptable use</h2>
        <p>
          You may not use the service to break the law, infringe rights, send
          prohibited or deceptive communications, distribute malware, bypass
          safeguards, probe other accounts, interfere with infrastructure, or
          access data without authorization. Messaging activity must comply with
          recipient consent requirements and the policies of enabled channel
          providers.
        </p>
        <h2>5. Third-party services</h2>
        <p>
          Optional integrations are provided by third parties under their own
          terms, availability, and technical requirements. You are responsible
          for your provider accounts and credentials. Wova8 is not endorsed by
          or an official partner of a third party merely because its service can
          be connected.
        </p>
        <h2>6. AI-assisted features</h2>
        <p>
          AI outputs may be incomplete or inaccurate and must be reviewed before
          they are used in customer communication or business decisions. You
          control the configured provider and model and remain responsible for
          instructions, submitted data, and resulting actions.
        </p>
        <h2>7. Service operation</h2>
        <p>
          We work to operate the service reliably and securely, but
          uninterrupted or error-free availability is not guaranteed. Features
          may change as the product develops. Planned commercial terms, support
          commitments, and service levels apply only when agreed separately in
          writing.
        </p>
        <h2>8. Suspension and termination</h2>
        <p>
          Access may be restricted or suspended to protect users, comply with
          law, address security risk, or respond to a material breach. On
          termination, data handling follows the applicable agreement, product
          capabilities, retention obligations, and Privacy Policy.
        </p>
        <h2>9. Disclaimers and liability</h2>
        <p>
          To the extent permitted by law, the service is provided without
          implied warranties beyond those that cannot legally be excluded.
          Liability is limited as set out in any applicable written service
          agreement; nothing in these terms excludes liability that cannot
          lawfully be limited.
        </p>
        <h2>10. Contact and changes</h2>
        <p>
          Questions about these terms may be sent to{' '}
          <a
            className="text-violet-200 hover:text-white"
            href={`mailto:${WOVA8.emails.legal}`}
          >
            {WOVA8.emails.legal}
          </a>
          . We may update these terms and will identify the current version by
          its revision date.
        </p>
      </LegalArticle>
    </>
  );
}
