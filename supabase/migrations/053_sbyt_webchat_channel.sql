-- ============================================================
-- SBYT first-party Website Chat
-- Public widget identity is deliberately separate from provider credentials.
-- Messages land in the same conversations/messages tables with channel=webchat.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.webchat_widgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  public_key text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18), 'hex'),
  name text NOT NULL DEFAULT 'Website Chat',
  welcome_message text NOT NULL DEFAULT 'Hi! How can we help?',
  allowed_origins text[] NOT NULL DEFAULT ARRAY[]::text[],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_webchat_widgets_account
  ON public.webchat_widgets(account_id, is_active);
ALTER TABLE public.webchat_widgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS webchat_widgets_select ON public.webchat_widgets;
CREATE POLICY webchat_widgets_select ON public.webchat_widgets FOR SELECT
  USING (public.is_account_member(account_id));
DROP POLICY IF EXISTS webchat_widgets_insert ON public.webchat_widgets;
CREATE POLICY webchat_widgets_insert ON public.webchat_widgets FOR INSERT
  WITH CHECK (public.is_account_operational(account_id, 'admin'));
DROP POLICY IF EXISTS webchat_widgets_update ON public.webchat_widgets;
CREATE POLICY webchat_widgets_update ON public.webchat_widgets FOR UPDATE
  USING (public.is_account_operational(account_id, 'admin'))
  WITH CHECK (public.is_account_operational(account_id, 'admin'));
DROP POLICY IF EXISTS webchat_widgets_delete ON public.webchat_widgets;
CREATE POLICY webchat_widgets_delete ON public.webchat_widgets FOR DELETE
  USING (public.is_account_operational(account_id, 'admin'));

CREATE TABLE IF NOT EXISTS public.webchat_visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id uuid NOT NULL REFERENCES public.webchat_widgets(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  visitor_token_hash text NOT NULL,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(widget_id, visitor_token_hash)
);
CREATE INDEX IF NOT EXISTS idx_webchat_visitors_account
  ON public.webchat_visitors(account_id, last_seen_at DESC);
ALTER TABLE public.webchat_visitors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS webchat_visitors_select ON public.webchat_visitors;
CREATE POLICY webchat_visitors_select ON public.webchat_visitors FOR SELECT
  USING (public.is_account_member(account_id));
-- Public widget ingestion uses a trusted server route/service role; no client writes.

COMMENT ON TABLE public.webchat_widgets IS 'SBYT embeddable website-chat configuration. public_key identifies a widget but is not an account secret.';
COMMENT ON TABLE public.webchat_visitors IS 'Server-managed mapping from anonymous website-chat visitor token to CRM contact/conversation.';
