-- ============================================================
-- SBYT Marketing Growth
-- Saved audience segments, campaign experiments and first/last-touch
-- attribution. Works with the existing broadcasts engine.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contact_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  description text,
  filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_dynamic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, name)
);
CREATE INDEX IF NOT EXISTS idx_contact_segments_account
  ON public.contact_segments(account_id, created_at DESC);
ALTER TABLE public.contact_segments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contact_segments_select ON public.contact_segments;
CREATE POLICY contact_segments_select ON public.contact_segments FOR SELECT
  USING (public.is_account_member(account_id));
DROP POLICY IF EXISTS contact_segments_insert ON public.contact_segments;
CREATE POLICY contact_segments_insert ON public.contact_segments FOR INSERT
  WITH CHECK (public.is_account_operational(account_id, 'agent'));
DROP POLICY IF EXISTS contact_segments_update ON public.contact_segments;
CREATE POLICY contact_segments_update ON public.contact_segments FOR UPDATE
  USING (public.is_account_operational(account_id, 'agent'))
  WITH CHECK (public.is_account_operational(account_id, 'agent'));
DROP POLICY IF EXISTS contact_segments_delete ON public.contact_segments;
CREATE POLICY contact_segments_delete ON public.contact_segments FOR DELETE
  USING (public.is_account_operational(account_id, 'admin'));

ALTER TABLE public.broadcasts
  ADD COLUMN IF NOT EXISTS segment_id uuid REFERENCES public.contact_segments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campaign_key text,
  ADD COLUMN IF NOT EXISTS experiment_key text,
  ADD COLUMN IF NOT EXISTS variant_key text,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS attributed_replies integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attributed_conversions integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_broadcasts_campaign_key
  ON public.broadcasts(account_id, campaign_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcasts_experiment
  ON public.broadcasts(account_id, experiment_key, variant_key);

CREATE TABLE IF NOT EXISTS public.marketing_attribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  broadcast_id uuid REFERENCES public.broadcasts(id) ON DELETE SET NULL,
  touch_type text NOT NULL DEFAULT 'last' CHECK (touch_type IN ('first','last','conversion')),
  source text,
  medium text,
  campaign text,
  content text,
  term text,
  ctwa_click_id text,
  ad_id text,
  adset_id text,
  campaign_id text,
  landing_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  touched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketing_attribution_contact
  ON public.marketing_attribution(account_id, contact_id, touched_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_attribution_campaign
  ON public.marketing_attribution(account_id, campaign, touched_at DESC);
ALTER TABLE public.marketing_attribution ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS marketing_attribution_select ON public.marketing_attribution;
CREATE POLICY marketing_attribution_select ON public.marketing_attribution FOR SELECT
  USING (public.is_account_member(account_id));
DROP POLICY IF EXISTS marketing_attribution_insert ON public.marketing_attribution;
CREATE POLICY marketing_attribution_insert ON public.marketing_attribution FOR INSERT
  WITH CHECK (public.is_account_operational(account_id, 'agent'));
DROP POLICY IF EXISTS marketing_attribution_update ON public.marketing_attribution;
CREATE POLICY marketing_attribution_update ON public.marketing_attribution FOR UPDATE
  USING (public.is_account_operational(account_id, 'agent'))
  WITH CHECK (public.is_account_operational(account_id, 'agent'));
DROP POLICY IF EXISTS marketing_attribution_delete ON public.marketing_attribution;
CREATE POLICY marketing_attribution_delete ON public.marketing_attribution FOR DELETE
  USING (public.is_account_operational(account_id, 'admin'));

CREATE TABLE IF NOT EXISTS public.campaign_experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  experiment_key text NOT NULL,
  goal text NOT NULL DEFAULT 'reply_rate'
    CHECK (goal IN ('delivery_rate','read_rate','reply_rate','conversion_rate')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','running','completed','cancelled')),
  winner_variant text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, experiment_key)
);
ALTER TABLE public.campaign_experiments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS campaign_experiments_select ON public.campaign_experiments;
CREATE POLICY campaign_experiments_select ON public.campaign_experiments FOR SELECT
  USING (public.is_account_member(account_id));
DROP POLICY IF EXISTS campaign_experiments_insert ON public.campaign_experiments;
CREATE POLICY campaign_experiments_insert ON public.campaign_experiments FOR INSERT
  WITH CHECK (public.is_account_operational(account_id, 'agent'));
DROP POLICY IF EXISTS campaign_experiments_update ON public.campaign_experiments;
CREATE POLICY campaign_experiments_update ON public.campaign_experiments FOR UPDATE
  USING (public.is_account_operational(account_id, 'agent'))
  WITH CHECK (public.is_account_operational(account_id, 'agent'));
DROP POLICY IF EXISTS campaign_experiments_delete ON public.campaign_experiments;
CREATE POLICY campaign_experiments_delete ON public.campaign_experiments FOR DELETE
  USING (public.is_account_operational(account_id, 'admin'));

COMMENT ON TABLE public.contact_segments IS 'Reusable saved audiences for SBYT broadcasts and automations.';
COMMENT ON TABLE public.marketing_attribution IS 'First/last/conversion touch attribution including CTWA metadata when available.';
COMMENT ON TABLE public.campaign_experiments IS 'A/B experiment metadata spanning one or more broadcasts via experiment_key/variant_key.';
