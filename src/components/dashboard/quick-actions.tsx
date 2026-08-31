"use client"

import Link from 'next/link'
import { UserPlus, Briefcase, Radio, Zap } from 'lucide-react'
import type { ComponentType } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { canAccessWorkspaceRoute } from '@/lib/auth/roles'

// Quick-action shortcuts. Each navigates to the page that owns the
// relevant "create" flow. We deliberately don't try to auto-open any
// modal on the target page — that'd require touching those pages.
interface Action {
  label: string
  href: string
  icon: ComponentType<{ className?: string }>
  tint: string
}

// Product language is relationship-first while the stable legacy routes stay
// unchanged. This keeps existing links/integrations intact during the UX
// migration from contacts/broadcasts to relationships/campaigns.
const ACTIONS: Action[] = [
  { label: 'New Relationship', href: '/contacts', icon: UserPlus, tint: 'text-primary' },
  { label: 'New Opportunity', href: '/pipelines', icon: Briefcase, tint: 'text-blue-400' },
  { label: 'New Campaign', href: '/broadcasts/new', icon: Radio, tint: 'text-amber-400' },
  { label: 'New Automation', href: '/automations/new', icon: Zap, tint: 'text-primary' },
]

export function QuickActions() {
  const { accountRole, canSendMessages } = useAuth()
  const visibleActions = accountRole && canSendMessages
    ? ACTIONS.filter((action) => canAccessWorkspaceRoute(accountRole, action.href))
    : []

  if (visibleActions.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {visibleActions.map((a) => {
        const Icon = a.icon
        return (
          <Link
            key={a.href}
            href={a.href}
            className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-border hover:bg-muted/60"
          >
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-muted ${a.tint}`}>
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-foreground">{a.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
