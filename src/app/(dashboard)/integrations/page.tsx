'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Globe2,
  Loader2,
  MessageCircle,
  PlugZap,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { WOVA8 } from '@/lib/brand';
import {
  validateWidgetDraft,
  type WidgetFieldErrors,
} from '@/lib/webchat/widget-validation';

type Integration = {
  id: string;
  provider: string;
  name: string;
  status: string;
  last_synced_at?: string | null;
  last_error?: string | null;
};
type Widget = {
  id: string;
  public_key: string;
  name: string;
  welcome_message: string;
  allowed_origins: string[];
  is_active: boolean;
};
type ConnectionState =
  | 'Connected'
  | 'Active'
  | 'Needs review'
  | 'Ready for credentials'
  | 'Not registered'
  | 'Provider required';

const providers = [
  ['shopify', 'Shopify'],
  ['woocommerce', 'WooCommerce'],
  ['google_sheets', 'Google Sheets'],
  ['n8n', 'n8n'],
  ['zapier', 'Zapier'],
  ['hubspot', 'HubSpot'],
  ['custom_webhook', 'Custom Webhook'],
] as const;

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [whatsappStatus, setWhatsappStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creatingWidget, setCreatingWidget] = useState(false);
  const [widgetErrors, setWidgetErrors] = useState<WidgetFieldErrors>({});
  const [registeringProvider, setRegisteringProvider] = useState<string | null>(
    null
  );
  const [copyingWidget, setCopyingWidget] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const db = createClient();
      const [integrationsRes, widgetsRes, whatsapp] = await Promise.all([
        fetch('/api/integrations', { cache: 'no-store' }),
        fetch('/api/webchat/widgets', { cache: 'no-store' }),
        db.from('whatsapp_config').select('status').maybeSingle(),
      ]);
      const [integrationsJson, widgetsJson] = await Promise.all([
        integrationsRes.json().catch(() => null),
        widgetsRes.json().catch(() => null),
      ]);
      if (!integrationsRes.ok)
        throw new Error(
          integrationsJson?.error || 'Could not load business integrations'
        );
      if (!widgetsRes.ok)
        throw new Error(widgetsJson?.error || 'Could not load chat widgets');
      setIntegrations(integrationsJson?.integrations ?? []);
      setWidgets(widgetsJson?.widgets ?? []);
      setWhatsappStatus(
        whatsapp.error ? 'error' : (whatsapp.data?.status ?? null)
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not load integrations';
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeWidgetCount = useMemo(
    () => widgets.filter((widget) => widget.is_active).length,
    [widgets]
  );

  async function registerIntegration(provider: string, name: string) {
    if (registeringProvider) return;
    setRegisteringProvider(provider);
    try {
      const response = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, name, settings: {} }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(payload?.error || `Could not register ${name}`);
      if (!payload?.integration)
        throw new Error(`${name} returned an incomplete registration response`);
      setIntegrations((items) => [
        payload.integration,
        ...items.filter((item) => item.provider !== provider),
      ]);
      toast.success(`${name} added to connection registry`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : `Could not register ${name}`
      );
    } finally {
      setRegisteringProvider(null);
    }
  }

  async function createWidget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creatingWidget) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const origins = String(form.get('origins') || '')
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
    const validation = validateWidgetDraft({
      name: form.get('name'),
      welcomeMessage: form.get('welcomeMessage'),
      allowedOrigins: origins,
    });
    if (!validation.ok) {
      setWidgetErrors(validation.errors);
      return;
    }

    setWidgetErrors({});
    setCreatingWidget(true);
    try {
      const response = await fetch('/api/webchat/widgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validation.value),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        if (payload?.fields && typeof payload.fields === 'object')
          setWidgetErrors(payload.fields as WidgetFieldErrors);
        throw new Error(payload?.error || 'Could not create chat widget');
      }
      if (!payload?.widget)
        throw new Error(
          'The widget response was incomplete. Please try again.'
        );
      formElement.reset();
      setWidgets((items) => [...items, payload.widget]);
      toast.success('Website chat widget created');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not create chat widget';
      setWidgetErrors((current) => ({ ...current, form: message }));
      toast.error(message);
    } finally {
      setCreatingWidget(false);
    }
  }

  function clearWidgetError(field: keyof WidgetFieldErrors) {
    setWidgetErrors((current) => ({
      ...current,
      [field]: undefined,
      form: undefined,
    }));
  }

  function embed(widget: Widget) {
    const base =
      typeof window !== 'undefined' ? window.location.origin : WOVA8.crmUrl;
    return `<script src="${base}/wova8-chat-widget.js" data-wova8-key="${widget.public_key}" defer></script>`;
  }

  async function copyEmbedCode(widget: Widget) {
    setCopyingWidget(widget.id);
    try {
      const code = embed(widget);
      if (navigator.clipboard?.writeText)
        await navigator.clipboard.writeText(code);
      else {
        const textarea = document.createElement('textarea');
        textarea.value = code;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        textarea.remove();
        if (!copied) throw new Error('Clipboard access is unavailable');
      }
      toast.success('Embed code copied');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not copy embed code'
      );
    } finally {
      setCopyingWidget(null);
    }
  }

  const whatsappState: ConnectionState =
    whatsappStatus === 'connected'
      ? 'Connected'
      : whatsappStatus
        ? 'Needs review'
        : 'Not registered';
  const websiteChatState: ConnectionState =
    activeWidgetCount > 0
      ? 'Active'
      : widgets.length > 0
        ? 'Needs review'
        : 'Not registered';

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-primary mb-2 text-xs font-semibold tracking-[0.16em] uppercase">
            Connections
          </div>
          <h1 className="text-foreground text-3xl font-semibold tracking-[-0.04em]">
            Channels & integrations
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
            Manage messaging channels, first-party website chat and
            business-system connection records from one workspace.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="border-border bg-card text-foreground hover:bg-muted inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />{' '}
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {loadError ? (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive flex flex-col gap-3 rounded-xl border p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            {loadError}
          </span>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-current px-3 py-1.5 font-medium"
          >
            Try again
          </button>
        </div>
      ) : null}

      <section
        aria-labelledby="messaging-channels-heading"
        className="border-border bg-card rounded-2xl border p-5 sm:p-6"
      >
        <h2
          id="messaging-channels-heading"
          className="text-foreground text-lg font-semibold"
        >
          Messaging Channels
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Current availability and setup state for every customer messaging
          channel.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Channel
            name="WhatsApp"
            detail={
              whatsappState === 'Connected'
                ? 'Business messaging is connected.'
                : 'Review WhatsApp setup and registration.'
            }
            state={whatsappState}
          />
          <Channel
            name="Website Chat"
            detail={
              widgets.length
                ? `${activeWidgetCount} active of ${widgets.length} widget${widgets.length === 1 ? '' : 's'}.`
                : 'Create a widget below to activate this channel.'
            }
            state={websiteChatState}
          />
          <Channel
            name="Instagram / Messenger"
            detail="Meta approval is required before connection."
            state="Needs review"
          />
          <Channel
            name="SMS / RCS / TikTok"
            detail="Choose and configure a supported provider first."
            state="Provider required"
          />
        </div>
      </section>

      <section
        aria-labelledby="website-chat-heading"
        className="border-border bg-card overflow-hidden rounded-2xl border"
      >
        <div className="border-border border-b p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <MessageCircle className="text-primary size-5" />
            <h2
              id="website-chat-heading"
              className="text-foreground text-lg font-semibold"
            >
              Website Chat
            </h2>
          </div>
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-relaxed">
            Create embeddable chat widgets. Visitor messages appear in Unified
            Inbox as website-chat conversations.
          </p>
        </div>
        <div className="grid lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="border-border bg-muted/25 border-b p-5 sm:p-6 lg:border-r lg:border-b-0">
            <h3 className="text-foreground font-semibold">Create a widget</h3>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              All three fields are required. Origins restrict which websites may
              load this widget.
            </p>
            <form onSubmit={createWidget} noValidate className="mt-5 space-y-4">
              <WidgetField
                label="Widget name"
                error={widgetErrors.name}
                htmlFor="widget-name"
              >
                <input
                  id="widget-name"
                  name="name"
                  required
                  maxLength={120}
                  defaultValue="Website Chat"
                  onInput={() => clearWidgetError('name')}
                  aria-invalid={Boolean(widgetErrors.name)}
                  aria-describedby={
                    widgetErrors.name ? 'widget-name-error' : undefined
                  }
                  placeholder="e.g. Sales Chat"
                  className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-ring/20 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2"
                />
              </WidgetField>
              <WidgetField
                label="Greeting message"
                error={widgetErrors.welcomeMessage}
                htmlFor="widget-greeting"
              >
                <textarea
                  id="widget-greeting"
                  name="welcomeMessage"
                  required
                  maxLength={500}
                  rows={3}
                  defaultValue="Hi! How can we help?"
                  onInput={() => clearWidgetError('welcomeMessage')}
                  aria-invalid={Boolean(widgetErrors.welcomeMessage)}
                  aria-describedby={
                    widgetErrors.welcomeMessage
                      ? 'widget-greeting-error'
                      : undefined
                  }
                  placeholder="Greeting shown to website visitors"
                  className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-ring/20 w-full resize-y rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2"
                />
              </WidgetField>
              <WidgetField
                label="Allowed origins"
                error={widgetErrors.allowedOrigins}
                htmlFor="widget-origins"
                hint="Comma or line separated, e.g. https://www.example.com"
              >
                <textarea
                  id="widget-origins"
                  name="origins"
                  required
                  rows={3}
                  onInput={() => clearWidgetError('allowedOrigins')}
                  aria-invalid={Boolean(widgetErrors.allowedOrigins)}
                  aria-describedby={
                    widgetErrors.allowedOrigins
                      ? 'widget-origins-error'
                      : 'widget-origins-hint'
                  }
                  placeholder="https://www.example.com"
                  className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-ring/20 w-full resize-y rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2"
                />
              </WidgetField>
              {widgetErrors.form ? (
                <p
                  role="alert"
                  className="text-destructive flex items-start gap-2 text-sm"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  {widgetErrors.form}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={creatingWidget}
                className="bg-primary text-primary-foreground inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity disabled:cursor-wait disabled:opacity-60"
              >
                {creatingWidget ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                {creatingWidget ? 'Creating widget…' : 'Create widget'}
              </button>
            </form>
          </div>

          <div className="min-w-0 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-foreground font-semibold">
                  Widget registry
                </h3>
                <p className="text-muted-foreground mt-1 text-xs">
                  {loading
                    ? 'Loading widgets…'
                    : `${widgets.length} widget${widgets.length === 1 ? '' : 's'} registered`}
                </p>
              </div>
              <StatusBadge state={websiteChatState} />
            </div>
            <div className="mt-5 space-y-4">
              {widgets.map((widget) => (
                <WidgetCard
                  key={widget.id}
                  widget={widget}
                  code={embed(widget)}
                  copying={copyingWidget === widget.id}
                  onCopy={() => void copyEmbedCode(widget)}
                />
              ))}
              {!loading && widgets.length === 0 ? (
                <div className="border-border bg-background/60 rounded-xl border border-dashed px-5 py-10 text-center">
                  <MessageCircle className="text-muted-foreground mx-auto size-6" />
                  <p className="text-foreground mt-3 text-sm font-medium">
                    No website-chat widgets yet
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Complete the form to create the first widget.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="business-integrations-heading"
        className="border-border bg-card overflow-hidden rounded-2xl border"
      >
        <div className="border-border border-b p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <PlugZap className="text-primary size-5" />
            <h2
              id="business-integrations-heading"
              className="text-foreground text-lg font-semibold"
            >
              Business Integrations
            </h2>
          </div>
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-relaxed">
            Register a provider connection record here. Credentials and OAuth
            are completed only through each provider’s dedicated setup.
          </p>
        </div>
        <div className="divide-border grid divide-y md:grid-cols-2 md:divide-y-0">
          {providers.map(([provider, label], index) => {
            const existing = integrations.find(
              (item) => item.provider === provider
            );
            const state = integrationState(existing);
            const registering = registeringProvider === provider;
            return (
              <div
                key={provider}
                className={`flex min-w-0 flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between ${index % 2 === 0 ? 'md:border-border md:border-r' : ''} ${index >= 2 ? 'md:border-border md:border-t' : ''}`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-foreground font-medium">{label}</h3>
                    <StatusBadge state={state} />
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs leading-relaxed break-words">
                    {existing?.last_error ||
                      (existing
                        ? 'Connection record exists; use provider-specific setup for credentials.'
                        : 'No connection record exists yet.')}
                  </p>
                </div>
                {!existing ? (
                  <button
                    type="button"
                    onClick={() => void registerIntegration(provider, label)}
                    disabled={Boolean(registeringProvider)}
                    className="border-border bg-background text-foreground hover:bg-muted inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium disabled:cursor-wait disabled:opacity-60"
                  >
                    {registering ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Plus className="size-3.5" />
                    )}
                    {registering ? 'Registering…' : 'Register'}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function WidgetField({
  label,
  error,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  const messageId = `${htmlFor}-${error ? 'error' : 'hint'}`;
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="text-foreground mb-1.5 block text-sm font-medium"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p
          id={messageId}
          role="alert"
          className="text-destructive mt-1.5 text-xs"
        >
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-muted-foreground mt-1.5 text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function WidgetCard({
  widget,
  code,
  copying,
  onCopy,
}: {
  widget: Widget;
  code: string;
  copying: boolean;
  onCopy: () => void;
}) {
  const state: ConnectionState = widget.is_active ? 'Active' : 'Needs review';
  return (
    <article className="border-border bg-background/65 min-w-0 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-foreground font-medium break-words">
            {widget.name}
          </h4>
          <p className="text-muted-foreground mt-1 text-xs break-words">
            Greeting: {widget.welcome_message}
          </p>
        </div>
        <StatusBadge state={state} />
      </div>
      <div className="mt-4">
        <div className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          Allowed origins
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {widget.allowed_origins.length ? (
            widget.allowed_origins.map((origin) => (
              <span
                key={origin}
                className="border-border bg-card text-foreground max-w-full rounded-lg border px-2 py-1 text-xs break-all"
              >
                {origin}
              </span>
            ))
          ) : (
            <span className="text-xs text-amber-700 dark:text-amber-300">
              No origin restriction — review before public use.
            </span>
          )}
        </div>
      </div>
      <div className="border-border bg-card mt-4 rounded-xl border p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
            Embed code
          </span>
          <button
            type="button"
            onClick={onCopy}
            disabled={copying}
            className="border-border bg-background text-foreground hover:bg-muted inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium disabled:cursor-wait disabled:opacity-60"
          >
            {copying ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copying ? 'Copying…' : 'Copy code'}
          </button>
        </div>
        <code className="text-muted-foreground mt-2 block text-[11px] leading-relaxed break-all whitespace-pre-wrap">
          {code}
        </code>
      </div>
    </article>
  );
}

function Channel({
  name,
  detail,
  state,
}: {
  name: string;
  detail: string;
  state: ConnectionState;
}) {
  return (
    <article className="border-border bg-background/65 rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="bg-primary/10 text-primary rounded-lg p-2">
          <Globe2 className="size-4" />
        </span>
        <StatusBadge state={state} />
      </div>
      <h3 className="text-foreground mt-4 font-medium">{name}</h3>
      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
        {detail}
      </p>
    </article>
  );
}

function integrationState(integration?: Integration): ConnectionState {
  if (!integration) return 'Not registered';
  if (
    integration.last_error ||
    ['error', 'failed', 'needs_review'].includes(integration.status)
  )
    return 'Needs review';
  if (integration.status === 'connected') return 'Connected';
  if (integration.status === 'active') return 'Active';
  return 'Ready for credentials';
}

function StatusBadge({ state }: { state: ConnectionState }) {
  const styles: Record<ConnectionState, string> = {
    Connected:
      'border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    Active:
      'border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    'Needs review':
      'border-amber-600/30 bg-amber-500/10 text-amber-800 dark:text-amber-300',
    'Ready for credentials': 'border-primary/30 bg-primary/10 text-primary',
    'Not registered': 'border-border bg-muted text-muted-foreground',
    'Provider required':
      'border-rose-600/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wider uppercase ${styles[state]}`}
    >
      {state === 'Connected' || state === 'Active' ? (
        <CheckCircle2 className="size-3" />
      ) : state === 'Needs review' ? (
        <AlertCircle className="size-3" />
      ) : null}
      {state}
    </span>
  );
}
