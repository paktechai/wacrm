-- ============================================================
-- SBYT canonical plan contract
-- Keeps the internal foundation plan aligned with the feature names used
-- by server-side entitlement guards. No commercial pricing is introduced.
-- ============================================================

UPDATE public.saas_plans
SET
  features = jsonb_build_object(
    'whatsapp_messaging', true,
    'contacts', true,
    'pipelines', true,
    'broadcasts', true,
    'automations', true,
    'flows', true,
    'ai_assistant', true,
    'api', true,
    'team', true
  ),
  updated_at = now()
WHERE code = 'foundation';
