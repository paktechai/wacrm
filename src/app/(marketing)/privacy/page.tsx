import type { Metadata } from 'next';
import { LegalArticle, PageIntro } from '@/components/marketing/site-shell';
import { WOVA8 } from '@/lib/brand';
import { marketingMetadata } from '@/lib/marketing-metadata';

export const metadata: Metadata = marketingMetadata(
  'Privacy Policy',
  'How Wova8 handles personal data across its website and Wova8 CRM.',
  '/privacy'
);

export default function PrivacyPage() {
  return (
    <>
      <PageIntro eyebrow="Legal" title="Privacy Policy">
        This policy explains how Wova8 handles information when you visit our
        website, contact us, or use Wova8 CRM. Last updated: 27 August 2026.
      </PageIntro>
      <LegalArticle>
        <h2>1. Scope and roles</h2>
        <p>
          Wova8 is the public brand and product identity operated by SM
          SERVICES. This policy applies to Wova8&apos;s public website and Wova8
          CRM. For customer data placed in a CRM workspace, the subscribing
          organization generally determines why and how that data is used, and
          Wova8 processes it to provide the service. Wova8 acts as controller
          for its own account, support, security, and website administration
          data where applicable.
        </p>
        <h2>2. Information we process</h2>
        <ul>
          <li>
            Account and profile details, including name, email, role, and
            workspace membership.
          </li>
          <li>
            Customer records, conversations, messages, files, tags, assignments,
            deals, workflows, and other content submitted by authorized users or
            connected channels.
          </li>
          <li>
            Configuration and integration information required to operate
            enabled services.
          </li>
          <li>
            Usage, audit, diagnostic, security, and device information needed to
            provide and protect the service.
          </li>
          <li>
            Information included in support, privacy, or legal correspondence.
          </li>
        </ul>
        <h2>3. Why we process information</h2>
        <p>
          We process information to provide and secure the service, authenticate
          users, support customer communication workflows, maintain
          integrations, respond to enquiries, troubleshoot problems, meet legal
          obligations, and improve reliability. Where consent or another
          specific lawful basis is required, the responsible organization must
          ensure that basis exists.
        </p>
        <h2>4. Service providers and integrations</h2>
        <p>
          Wova8 uses infrastructure and service providers to operate the
          application. Customer-enabled integrations, including WhatsApp
          Business Platform and configured AI providers, may receive data when
          an authorized user invokes those features. Their processing is
          governed by the relevant provider terms and the customer&apos;s
          configuration.
        </p>
        <h2>5. Retention and deletion</h2>
        <p>
          We retain information for the period needed to provide the service,
          protect accounts, comply with law, resolve disputes, and enforce
          agreements. Workspace administrators control business records through
          product functions where available. Verified deletion requests are
          handled as described on the Data Deletion page, subject to legal,
          security, backup, and fraud-prevention requirements.
        </p>
        <h2>6. Security and access</h2>
        <p>
          Wova8 uses access controls, tenant-scoped authorization, encrypted
          transport, and operational safeguards appropriate to the service. No
          method of storage or transmission is completely risk-free. Customers
          are responsible for authorized user access, suitable credentials, and
          lawful configuration of their connected services.
        </p>
        <h2>7. Your choices and rights</h2>
        <p>
          Depending on your location, you may have rights to access, correct,
          delete, restrict, or object to processing of personal data. If your
          information is held inside a customer&apos;s workspace, contact that
          organization first because it controls the business record. You may
          also contact Wova8 at{' '}
          <a
            className="text-violet-200 hover:text-white"
            href={`mailto:${WOVA8.emails.support}`}
          >
            {WOVA8.emails.support}
          </a>
          .
        </p>
        <h2>8. International processing and changes</h2>
        <p>
          Service providers may process information in countries other than your
          own, subject to applicable safeguards. We may update this policy as
          the service or legal requirements change; the revision date above
          identifies the current version.
        </p>
      </LegalArticle>
    </>
  );
}
