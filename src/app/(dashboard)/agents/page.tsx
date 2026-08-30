'use client';

import { useEffect, useState } from 'react';
import {
  Bot,
  Sparkles,
  Settings2,
  BarChart3,
  Users,
  Workflow,
  Shield,
  MessageSquare,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AiPlayground } from '@/components/agents/ai-playground';
import { AiUsageCard } from '@/components/agents/ai-usage';
import { AiConfig } from '@/components/settings/ai-config';
import { useAuth } from '@/hooks/use-auth';
import { canEditSettings } from '@/lib/auth/roles';

type Tab = 'playground' | 'setup' | 'usage';

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
  const { accountRole } = useAuth();
  const canViewUsage = accountRole ? canEditSettings(accountRole) : false;
  const [tab, setTab] = useState<Tab>('playground');
  const [decided, setDecided] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/ai/config');
        const data = await res.json().catch(() => ({}));
        if (!cancelled) setTab(data?.configured ? 'playground' : 'setup');
      } catch {
        if (!cancelled) setTab('setup');
      } finally {
        if (!cancelled) setDecided(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            AI Relationship Agent
          </h1>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Configure, test and govern the AI layer that assists conversations
          using relationship memory, recent messages and approved knowledge.
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
          Wova8 does not treat AI as a standalone chatbot. It combines bounded
          CRM context with conversation history and approved knowledge, then
          falls back to deterministic automation or a human when confidence is
          insufficient.
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
                <p className="mt-2 text-xs font-semibold text-foreground">
                  {step.title}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {step.detail}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {decided && (
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
        >
          <TabsList>
            <TabsTrigger value="playground">
              <Sparkles className="mr-1.5 h-4 w-4" /> Playground
            </TabsTrigger>
            <TabsTrigger value="setup">
              <Settings2 className="mr-1.5 h-4 w-4" /> Setup
            </TabsTrigger>
            {canViewUsage && (
              <TabsTrigger value="usage">
                <BarChart3 className="mr-1.5 h-4 w-4" /> Usage
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="playground" className="mt-4">
            <AiPlayground onGoToSetup={() => setTab('setup')} />
          </TabsContent>

          <TabsContent value="setup" className="mt-4">
            <AiConfig />
          </TabsContent>

          {canViewUsage && (
            <TabsContent value="usage" className="mt-4">
              <AiUsageCard />
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}
