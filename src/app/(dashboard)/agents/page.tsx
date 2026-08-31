'use client';

import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';
import {
  BarChart3,
  Bot,
  MessageSquare,
  Settings2,
  Shield,
  Sparkles,
  Users,
  UsersRound,
  WandSparkles,
  Workflow,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/dashboard/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { canEditSettings } from '@/lib/auth/roles';

type Tab = 'profiles' | 'copilot' | 'playground' | 'setup' | 'usage';

function TabSkeleton() {
  return (
    <div className="mt-4 grid gap-5 xl:grid-cols-2" aria-label="Loading AI agents">
      <div className="border-border bg-card rounded-2xl border p-5">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="mt-3 h-4 w-3/4" />
        <Skeleton className="mt-6 h-20 w-full" />
        <Skeleton className="mt-3 h-20 w-full" />
      </div>
      <div className="border-border bg-card rounded-2xl border p-5">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-6 h-10 w-full" />
        <Skeleton className="mt-3 h-10 w-full" />
        <Skeleton className="mt-3 h-32 w-full" />
      </div>
    </div>
  );
}

const AgentProfiles = dynamic(
  () => import('@/components/agents/agent-profiles').then((mod) => mod.AgentProfiles),
  { loading: TabSkeleton }
);
const CopilotWorkbench = dynamic(
  () => import('@/components/agents/copilot-workbench').then((mod) => mod.CopilotWorkbench),
  { loading: TabSkeleton }
);
const AiPlayground = dynamic(
  () => import('@/components/agents/ai-playground').then((mod) => mod.AiPlayground),
  { loading: TabSkeleton }
);
const AiConfig = dynamic(
  () => import('@/components/settings/ai-config').then((mod) => mod.AiConfig),
  { loading: TabSkeleton }
);
const AiUsageCard = dynamic(
  () => import('@/components/agents/ai-usage').then((mod) => mod.AiUsageCard),
  { loading: TabSkeleton }
);

const operatingSteps = [
  {
    title: 'Relationship context',
    detail: 'Identity, organization, tags, opportunities and recent internal notes.',
    icon: Users,
  },
  {
    title: 'Conversation context',
    detail: 'Recent messages are preserved so replies stay continuous and relevant.',
    icon: MessageSquare,
  },
  {
    title: 'Approved knowledge',
    detail: 'Business policies and reference content ground specific facts and answers.',
    icon: Shield,
  },
  {
    title: 'Reply or human handoff',
    detail: 'AI answers when grounded; deterministic flows or people own exceptions.',
    icon: Workflow,
  },
];

export default function AgentsPage() {
  const { accountId, accountRole } = useAuth();
  const canViewUsage = accountRole ? canEditSettings(accountRole) : false;
  const [tab, setTab] = useState<Tab>('profiles');
  const showSetup = useCallback(() => setTab('setup'), []);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            AI Relationship Agents & Copilot
          </h1>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Build focused autonomous agents, analyze conversations, and govern
          replies using relationship memory, recent messages and approved knowledge.
        </p>
      </div>

      <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">
            Relationship-aware operating model
          </p>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Wova8 combines bounded CRM context with conversation history and approved
          knowledge, then falls back to deterministic automation or a human when
          confidence is insufficient.
        </p>
        <div className="mt-4 grid gap-2 md:grid-cols-4">
          {operatingSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={step.title}
                className="rounded-lg border border-primary/10 bg-background/60 p-3"
              >
                <div className="flex items-center justify-between">
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">
                    0{index + 1}
                  </span>
                </div>
                <p className="mt-2 text-xs font-semibold text-foreground">{step.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {step.detail}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="profiles">
            <UsersRound className="mr-1.5 h-4 w-4" /> Agent profiles
          </TabsTrigger>
          <TabsTrigger value="copilot">
            <WandSparkles className="mr-1.5 h-4 w-4" /> Copilot
          </TabsTrigger>
          <TabsTrigger value="playground">
            <Sparkles className="mr-1.5 h-4 w-4" /> Playground
          </TabsTrigger>
          <TabsTrigger value="setup">
            <Settings2 className="mr-1.5 h-4 w-4" /> Provider setup
          </TabsTrigger>
          {canViewUsage && (
            <TabsTrigger value="usage">
              <BarChart3 className="mr-1.5 h-4 w-4" /> Usage
            </TabsTrigger>
          )}
        </TabsList>

        <div className="mt-4">
          {tab === 'profiles' && (
            <AgentProfiles accountId={accountId} onConfigurationMissing={showSetup} />
          )}
          {tab === 'copilot' && <CopilotWorkbench />}
          {tab === 'playground' && <AiPlayground onGoToSetup={showSetup} />}
          {tab === 'setup' && <AiConfig />}
          {tab === 'usage' && canViewUsage && <AiUsageCard />}
        </div>
      </Tabs>
    </div>
  );
}
