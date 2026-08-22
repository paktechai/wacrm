-- ============================================================
-- SBYT Modern Inbox + CRM 2.0
-- Adds SLA/priority/snooze + lead intelligence, tasks, appointments,
-- and internal mentions while preserving the existing conversation model.
-- ============================================================

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high','urgent')),
  ADD COLUMN IF NOT EXISTS snoozed_until timestamptz,
  ADD COLUMN IF NOT EXISTS first_response_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolution_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_sentiment text NOT NULL DEFAULT 'unknown'
    CHECK (customer_sentiment IN ('positive','neutral','negative','unknown')),
  ADD COLUMN IF NOT EXISTS detected_intent text,
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS next_action text;

CREATE INDEX IF NOT EXISTS idx_conversations_priority_open
  ON public.conversations(account_id, priority, last_message_at DESC)
  WHERE status <> 'closed';
CREATE INDEX IF NOT EXISTS idx_conversations_snoozed
  ON public.conversations(account_id, snoozed_until)
  WHERE snoozed_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_sla_due
  ON public.conversations(account_id, first_response_due_at, resolution_due_at)
  WHERE status <> 'closed';

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS lead_score smallint NOT NULL DEFAULT 0
    CHECK (lead_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS lifecycle_stage text NOT NULL DEFAULT 'new'
    CHECK (lifecycle_stage IN ('new','qualified','opportunity','customer','inactive')),
  ADD COLUMN IF NOT EXISTS last_engaged_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_contacts_lifecycle_score
  ON public.contacts(account_id, lifecycle_stage, lead_score DESC);

CREATE TABLE IF NOT EXISTS public.crm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done','cancelled')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_tasks_account_due
  ON public.crm_tasks(account_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_assignee
  ON public.crm_tasks(account_id, assigned_to, status);
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crm_tasks_select ON public.crm_tasks;
CREATE POLICY crm_tasks_select ON public.crm_tasks FOR SELECT
  USING (public.is_account_member(account_id));
DROP POLICY IF EXISTS crm_tasks_insert ON public.crm_tasks;
CREATE POLICY crm_tasks_insert ON public.crm_tasks FOR INSERT
  WITH CHECK (public.is_account_operational(account_id, 'agent'));
DROP POLICY IF EXISTS crm_tasks_update ON public.crm_tasks;
CREATE POLICY crm_tasks_update ON public.crm_tasks FOR UPDATE
  USING (public.is_account_operational(account_id, 'agent'))
  WITH CHECK (public.is_account_operational(account_id, 'agent'));
DROP POLICY IF EXISTS crm_tasks_delete ON public.crm_tasks;
CREATE POLICY crm_tasks_delete ON public.crm_tasks FOR DELETE
  USING (public.is_account_operational(account_id, 'admin'));

CREATE TABLE IF NOT EXISTS public.crm_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  notes text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','confirmed','completed','cancelled','no_show')),
  external_calendar_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_crm_appointments_account_start
  ON public.crm_appointments(account_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_crm_appointments_assignee
  ON public.crm_appointments(account_id, assigned_to, starts_at);
ALTER TABLE public.crm_appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crm_appointments_select ON public.crm_appointments;
CREATE POLICY crm_appointments_select ON public.crm_appointments FOR SELECT
  USING (public.is_account_member(account_id));
DROP POLICY IF EXISTS crm_appointments_insert ON public.crm_appointments;
CREATE POLICY crm_appointments_insert ON public.crm_appointments FOR INSERT
  WITH CHECK (public.is_account_operational(account_id, 'agent'));
DROP POLICY IF EXISTS crm_appointments_update ON public.crm_appointments;
CREATE POLICY crm_appointments_update ON public.crm_appointments FOR UPDATE
  USING (public.is_account_operational(account_id, 'agent'))
  WITH CHECK (public.is_account_operational(account_id, 'agent'));
DROP POLICY IF EXISTS crm_appointments_delete ON public.crm_appointments;
CREATE POLICY crm_appointments_delete ON public.crm_appointments FOR DELETE
  USING (public.is_account_operational(account_id, 'admin'));

CREATE TABLE IF NOT EXISTS public.conversation_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  mentioned_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mentioned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conversation_mentions_user
  ON public.conversation_mentions(account_id, mentioned_user_id, read_at, created_at DESC);
ALTER TABLE public.conversation_mentions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS conversation_mentions_select ON public.conversation_mentions;
CREATE POLICY conversation_mentions_select ON public.conversation_mentions FOR SELECT
  USING (
    public.is_account_member(account_id)
    AND (mentioned_user_id = auth.uid() OR public.is_account_member(account_id, 'admin'))
  );
DROP POLICY IF EXISTS conversation_mentions_insert ON public.conversation_mentions;
CREATE POLICY conversation_mentions_insert ON public.conversation_mentions FOR INSERT
  WITH CHECK (public.is_account_operational(account_id, 'agent'));
DROP POLICY IF EXISTS conversation_mentions_update ON public.conversation_mentions;
CREATE POLICY conversation_mentions_update ON public.conversation_mentions FOR UPDATE
  USING (mentioned_user_id = auth.uid() AND public.is_account_member(account_id))
  WITH CHECK (mentioned_user_id = auth.uid() AND public.is_account_member(account_id));
DROP POLICY IF EXISTS conversation_mentions_delete ON public.conversation_mentions;
CREATE POLICY conversation_mentions_delete ON public.conversation_mentions FOR DELETE
  USING (public.is_account_operational(account_id, 'admin'));

COMMENT ON TABLE public.crm_tasks IS 'SBYT CRM 2.0 tasks/follow-ups linked to contacts, conversations and deals.';
COMMENT ON TABLE public.crm_appointments IS 'SBYT CRM 2.0 appointment schedule; external_calendar_ref allows later calendar integrations.';
COMMENT ON TABLE public.conversation_mentions IS 'Internal @mentions for shared-inbox collaboration.';
