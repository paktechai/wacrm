import Link from 'next/link'
import {
  Bot,
  CheckCircle2,
  Circle,
  CreditCard,
  MessageSquare,
  Rocket,
  UsersRound,
} from 'lucide-react'

import { getCurrentAccount } from '@/lib/auth/account'
import { getAccountEntitlements } from '@/lib/billing/entitlements'

export default async function OnboardingPage() {
  const ctx = await getCurrentAccount()

  const [
    { data: whatsapp },
    { data: aiConfig },
    { count: memberCount },
    { count: contactCount },
    entitlements,
  ] = await Promise.all([
    ctx.supabase
      .from('whatsapp_config')
      .select('id, phone_number_id')
      .eq('account_id', ctx.accountId)
      .maybeSingle(),
    ctx.supabase
      .from('ai_configs')
      .select('id, is_active')
      .eq('account_id', ctx.accountId)
      .maybeSingle(),
    ctx.supabase
      .from('profiles')
      .select('user_id', { count: 'exact', head: true })
      .eq('account_id', ctx.accountId),
    ctx.supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', ctx.accountId),
    getAccountEntitlements(ctx.supabase, ctx.accountId),
  ])

  const metaReady = Boolean(
    process.env.META_APP_ID && process.env.META_EMBEDDED_SIGNUP_CONFIG_ID,
  )

  const steps = [
    {
      title: 'Workspace created',
      description: `${ctx.account.name} is isolated and ready for your team.`,
      done: true,
      icon: Rocket,
      href: '/settings?tab=profile',
      action: 'Review workspace',
    },
    {
      title: 'Plan assigned',
      description: entitlements.planName
        ? `${entitlements.planName} is active for this workspace.`
        : 'An Wova8 plan still needs to be assigned.',
      done: Boolean(entitlements.planId),
      icon: CreditCard,
      href: '/billing',
      action: 'View plan',
    },
    {
      title: 'Connect WhatsApp',
      description: whatsapp?.phone_number_id
        ? 'A WhatsApp Business number is connected.'
        : metaReady
          ? 'Meta Embedded Signup is configured and ready to start.'
          : 'Meta connection will be enabled after the Wova8 domain and Tech Provider configuration are ready.',
      done: Boolean(whatsapp?.phone_number_id),
      icon: MessageSquare,
      href: '/settings?tab=whatsapp',
      action: whatsapp?.phone_number_id ? 'Review connection' : 'Open WhatsApp setup',
    },
    {
      title: 'Build your team',
      description:
        (memberCount ?? 0) > 1
          ? `${memberCount} members are already in this workspace.`
          : 'Invite teammates and assign owner, admin, agent or viewer access.',
      done: (memberCount ?? 0) > 1,
      icon: UsersRound,
      href: '/settings?tab=members',
      action: 'Manage team',
    },
    {
      title: 'Configure AI assistant',
      description: aiConfig?.is_active
        ? 'AI assistant is configured for this workspace.'
        : 'Add your provider key and configure the assistant when you are ready.',
      done: Boolean(aiConfig?.is_active),
      icon: Bot,
      href: '/agents',
      action: 'Open AI setup',
    },
    {
      title: 'Add your first contact',
      description:
        (contactCount ?? 0) > 0
          ? `${contactCount} contact${contactCount === 1 ? '' : 's'} available.`
          : 'Add or import a contact to start building customer relationships.',
      done: (contactCount ?? 0) > 0,
      icon: UsersRound,
      href: '/contacts',
      action: 'Open contacts',
    },
  ]

  const completed = steps.filter((step) => step.done).length
  const progress = Math.round((completed / steps.length) * 100)

  return (
    <div className="mx-auto w-full max-w-5xl space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-primary">
            <Rocket className="size-4" />
            Wova8 CRM setup
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-foreground">
            Get your workspace ready
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            A single checklist for account, plan, WhatsApp, team, AI and customer-data readiness.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card px-5 py-4 text-right">
          <div className="text-2xl font-semibold text-foreground">{progress}%</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {completed} of {steps.length} complete
          </div>
        </div>
      </header>

      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="divide-y divide-border">
          {steps.map((step) => {
            const Icon = step.icon
            return (
              <div
                key={step.title}
                className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 gap-4">
                  <div
                    className={[
                      'flex size-10 shrink-0 items-center justify-center rounded-xl border',
                      step.done
                        ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'
                        : 'border-border bg-background text-muted-foreground',
                    ].join(' ')}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-foreground">{step.title}</h2>
                      {step.done ? (
                        <CheckCircle2 className="size-4 text-emerald-400" />
                      ) : (
                        <Circle className="size-4 text-muted-foreground" />
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </div>
                <Link
                  href={step.href}
                  className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  {step.action}
                </Link>
              </div>
            )
          })}
        </div>
      </section>

      {!metaReady ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 text-xs leading-5 text-amber-200">
          Meta Embedded Signup is intentionally waiting for the Wova8 domain/Tech Provider setup. The rest of the CRM can be configured and tested independently.
        </div>
      ) : null}
    </div>
  )
}
