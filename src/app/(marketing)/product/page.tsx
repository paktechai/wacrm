import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Bot,
  ContactRound,
  GitBranch,
  Inbox,
  Megaphone,
  Sparkles,
  Tags,
  Workflow,
} from 'lucide-react';
import { PageIntro } from '@/components/marketing/site-shell';
import { WOVA8 } from '@/lib/brand';
import { marketingMetadata } from '@/lib/marketing-metadata';

export const metadata: Metadata = marketingMetadata(
  'Wova8 CRM',
  'A secure workspace for customer conversations, contacts, deals, messaging workflows, automation, and AI-assisted operations.',
  '/product'
);

const capabilities = [
  [
    Inbox,
    'Inbox and conversations',
    'Bring customer messages into a shared team workspace with context, assignment, and follow-up.',
  ],
  [
    ContactRound,
    'Contacts and relationships',
    'Maintain customer records, ownership, tags, notes, activity, and connected business context.',
  ],
  [
    GitBranch,
    'Deals and pipelines',
    'Track opportunities through configurable stages and connect commercial work to customer records.',
  ],
  [
    Megaphone,
    'Broadcasts',
    'Prepare and run controlled messaging campaigns with recipient and delivery-result tracking.',
  ],
  [
    Workflow,
    'Automations and flows',
    'Build repeatable trigger-based processes and inspect their runs and execution history.',
  ],
  [
    Bot,
    'AI agents and Copilot',
    'Use configured AI providers for summaries, analysis, drafting, translation, and assisted next actions.',
  ],
  [
    Sparkles,
    'Smart inbox',
    'Prioritize work with conversation intelligence while keeping decisions visible to human operators.',
  ],
  [
    BarChart3,
    'Operational analytics',
    'Review communication and workflow activity from the data generated inside the workspace.',
  ],
  [
    Tags,
    'Team organization',
    'Use roles, assignments, notifications, and tags to keep responsibility clear.',
  ],
] as const;

export default function CrmProductPage() {
  return (
    <>
      <PageIntro
        eyebrow="Wova8 CRM"
        title="Customer operations, connected in one workspace."
      >
        Wova8 CRM helps teams manage conversations, relationships, workflows,
        and assisted actions without separating the message from the customer
        context behind it.
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`${WOVA8.crmUrl}/login`}
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950"
          >
            Sign in to CRM <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/contact"
            className="rounded-full border border-white/12 bg-white/5 px-5 py-3 text-sm font-semibold text-white"
          >
            Contact us
          </Link>
        </div>
      </PageIntro>

      <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8">
        <div className="grid gap-px overflow-hidden rounded-3xl border border-white/8 bg-white/8 md:grid-cols-2 lg:grid-cols-3">
          {capabilities.map(([Icon, title, text]) => (
            <div key={title} className="bg-[#0a0c13] p-7">
              <Icon className="size-5 text-violet-300" />
              <h2 className="mt-7 font-semibold text-white">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-white/8 bg-white/[0.025]">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-emerald-300 uppercase">
              Data boundaries
            </p>
            <h2 className="mt-4 text-2xl font-semibold text-white">
              Tenant-scoped by design
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-400">
              Account-aware authorization and row-level access controls protect
              workspace data boundaries.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-cyan-300 uppercase">
              Connected channel
            </p>
            <h2 className="mt-4 text-2xl font-semibold text-white">
              WhatsApp Business Platform
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-400">
              WhatsApp is supported as a communication channel inside the
              broader CRM; it does not define the entire product.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-violet-300 uppercase">
              AI control
            </p>
            <h2 className="mt-4 text-2xl font-semibold text-white">
              Provider choice stays with the account
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-400">
              Provider, model, and API-key behavior remain configured within
              each tenant account.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
