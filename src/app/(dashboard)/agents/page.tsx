'use client';

import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';
import {
  Bot,
  Sparkles,
  Settings2,
  BarChart3,
  UsersRound,
  WandSparkles,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/dashboard/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { canEditSettings } from '@/lib/auth/roles';

type Tab = 'profiles' | 'copilot' | 'playground' | 'setup' | 'usage';

function TabSkeleton() {
  return (
    <div
      className="mt-4 grid gap-5 xl:grid-cols-2"
      aria-label="Loading AI agents"
    >
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
  () =>
    import('@/components/agents/agent-profiles').then(
      (mod) => mod.AgentProfiles
    ),
  { loading: TabSkeleton }
);
const CopilotWorkbench = dynamic(
  () =>
    import('@/components/agents/copilot-workbench').then(
      (mod) => mod.CopilotWorkbench
    ),
  { loading: TabSkeleton }
);
const AiPlayground = dynamic(
  () =>
    import('@/components/agents/ai-playground').then((mod) => mod.AiPlayground),
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

export default function AgentsPage() {
  const { accountId, accountRole } = useAuth();
  const canViewUsage = accountRole ? canEditSettings(accountRole) : false;
  const [tab, setTab] = useState<Tab>('profiles');
  const showSetup = useCallback(() => setTab('setup'), []);

  return (
    <div>
      <div className="flex items-center gap-2">
        <Bot className="text-primary h-6 w-6" />
        <h1 className="text-foreground text-2xl font-bold tracking-tight">
          AI Agents & Copilot
        </h1>
      </div>
      <p className="text-muted-foreground mt-1 text-sm">
        Build focused autonomous agents, analyze customer conversations,
        translate and rewrite replies, and manage the shared BYO AI provider
        safely.
      </p>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as Tab)}
        className="mt-6"
      >
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
            <AgentProfiles
              accountId={accountId}
              onConfigurationMissing={showSetup}
            />
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
