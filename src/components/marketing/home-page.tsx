import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  Boxes,
  MessageSquareText,
  Network,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Workflow,
} from 'lucide-react';
import { WOVA8 } from '@/lib/brand';

const operatingAreas = [
  {
    icon: MessageSquareText,
    title: 'Customer communication',
    text: 'Keep business conversations visible, organized, and connected to the people your team serves.',
  },
  {
    icon: UsersRound,
    title: 'Relationship management',
    text: 'Give teams a shared customer record with ownership, context, tags, deals, and follow-up work.',
  },
  {
    icon: Workflow,
    title: 'Workflow automation',
    text: 'Turn repeatable communication and operational steps into controlled, observable workflows.',
  },
  {
    icon: Sparkles,
    title: 'AI-assisted operations',
    text: 'Help people understand conversations, prepare responses, and take the next useful action faster.',
  },
];

const workspacePanels = [
  { icon: MessageSquareText, title: 'Conversations', note: 'Shared context' },
  { icon: Network, title: 'Relationships', note: 'Connected records' },
  { icon: Workflow, title: 'Automations', note: 'Repeatable work' },
  { icon: Bot, title: 'AI assistance', note: 'Human-controlled' },
];

export function HomePage() {
  return (
    <>
      <section className="mx-auto grid min-h-[44rem] max-w-7xl items-center gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:py-28">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-400/8 px-3 py-1.5 text-xs font-medium text-violet-200">
            <Boxes className="size-3.5" /> Business software, built around real
            work
          </div>
          <h1 className="mt-7 max-w-4xl text-5xl leading-[0.98] font-semibold tracking-[-0.055em] text-white sm:text-7xl">
            Make customer operations easier to run.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300">
            Wova8 builds software that brings customer communication,
            relationship management, automation, and AI-assisted work into a
            clearer operating system for business teams.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/product"
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-violet-100"
            >
              Explore Wova8 CRM <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Contact Wova8
            </Link>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl">
          <div className="absolute -inset-10 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-black/35">
            <div className="rounded-[1.45rem] border border-white/8 bg-[#0d1018] p-5">
              <div className="flex items-center justify-between border-b border-white/8 pb-4">
                <div>
                  <p className="text-xs tracking-[0.15em] text-slate-500 uppercase">
                    Operating view
                  </p>
                  <p className="mt-1 font-semibold text-white">
                    Customer workspace
                  </p>
                </div>
                <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_0_5px_rgba(52,211,153,0.08)]" />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {workspacePanels.map(({ icon: Icon, title, note }) => (
                  <div
                    key={title}
                    className="rounded-2xl border border-white/8 bg-white/[0.035] p-4"
                  >
                    <Icon className="size-5 text-violet-300" />
                    <p className="mt-5 text-sm font-semibold text-white">
                      {title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/8 bg-white/[0.025]">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.2em] text-violet-300 uppercase">
              One connected operating layer
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">
              Built for the work between a message and an outcome.
            </h2>
          </div>
          <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-white/8 bg-white/8 md:grid-cols-2 lg:grid-cols-4">
            {operatingAreas.map(({ icon: Icon, title, text }) => (
              <div key={title} className="bg-[#0a0c13] p-6 sm:p-7">
                <Icon className="size-5 text-cyan-300" />
                <h3 className="mt-8 font-semibold text-white">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-violet-300 uppercase">
            Current product
          </p>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-white">
            Wova8 CRM
          </h2>
          <p className="mt-5 text-base leading-7 text-slate-300">
            A secure workspace for teams handling customer conversations,
            contacts, deals, messaging workflows, and assisted operations.
          </p>
          <Link
            href="/product"
            className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-violet-200 hover:text-white"
          >
            Product details <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-white/8 bg-white/[0.035] p-6">
            <ShieldCheck className="size-5 text-emerald-300" />
            <h3 className="mt-6 font-semibold text-white">
              Account boundaries
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Tenant-scoped data access and role-aware product surfaces support
              responsible team operation.
            </p>
          </div>
          <div className="rounded-3xl border border-white/8 bg-white/[0.035] p-6">
            <Bot className="size-5 text-violet-300" />
            <h3 className="mt-6 font-semibold text-white">
              Bring-your-own-provider AI
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Organizations control their configured provider, model, and API
              credentials inside their account.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8">
        <div className="rounded-[2rem] border border-violet-300/15 bg-gradient-to-br from-violet-400/12 to-cyan-400/5 px-7 py-12 sm:px-12">
          <p className="text-xs font-semibold tracking-[0.2em] text-violet-200 uppercase">
            Talk to us
          </p>
          <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-[-0.04em] text-white">
            Discuss how Wova8 can support your customer operations.
          </h2>
          <a
            href={`mailto:${WOVA8.emails.support}`}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950"
          >
            {WOVA8.emails.support}
            <ArrowRight className="size-4" />
          </a>
        </div>
      </section>
    </>
  );
}
