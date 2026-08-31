import type { Metadata } from 'next';
import { Headphones, Mail, ShieldCheck } from 'lucide-react';
import { PageIntro } from '@/components/marketing/site-shell';
import { WOVA8 } from '@/lib/brand';
import { marketingMetadata } from '@/lib/marketing-metadata';

export const metadata: Metadata = marketingMetadata(
  'Contact Wova8',
  'Contact Wova8 for product support, privacy questions, legal notices, or business enquiries.',
  '/contact'
);

const contacts = [
  [
    Headphones,
    'Product and support',
    WOVA8.emails.support,
    'Questions about Wova8 CRM, account access, or product operation.',
  ],
  [
    ShieldCheck,
    'Privacy',
    WOVA8.emails.support,
    'Privacy enquiries, data-subject requests, and personal-data questions.',
  ],
  [
    Mail,
    'Legal',
    WOVA8.emails.support,
    'Formal legal notices and terms-related enquiries.',
  ],
] as const;

export default function ContactPage() {
  return (
    <>
      <PageIntro eyebrow="Contact" title="Start with the right conversation.">
        Contact Wova8 about product support, business requirements, privacy, or
        legal matters. Include your workspace name when your enquiry relates to
        an existing CRM account. {WOVA8.legalDisclosure}
      </PageIntro>
      <section className="mx-auto grid max-w-7xl gap-4 px-5 pb-24 sm:px-8 lg:grid-cols-3">
        {contacts.map(([Icon, title, email, text]) => (
          <a
            key={title}
            href={`mailto:${email}`}
            className="group rounded-3xl border border-white/8 bg-white/[0.035] p-7 transition hover:border-violet-300/25 hover:bg-white/[0.055]"
          >
            <Icon className="size-5 text-violet-300" />
            <h2 className="mt-7 font-semibold text-white">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">{text}</p>
            <p className="mt-6 text-sm font-semibold text-violet-200 group-hover:text-white">
              {email}
            </p>
          </a>
        ))}
      </section>
    </>
  );
}
