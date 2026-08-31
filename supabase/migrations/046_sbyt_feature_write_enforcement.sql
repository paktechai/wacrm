-- ============================================================
-- SBYT feature-level write enforcement
--
-- Plan capabilities are enforced in Postgres for tenant-originated writes,
-- not only in UI/routes. Historical data stays readable after a downgrade.
-- Service-role engines (webhooks/background jobs) bypass RLS and therefore
-- keep their explicit server-side entitlement checks where side effects occur.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_account_feature_enabled(
  target_account_id uuid,
  feature_key text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_account_member(target_account_id)
    AND (
      -- Backward compatibility for installations/accounts that pre-date SaaS.
      NOT EXISTS (
        SELECT 1
        FROM public.account_subscriptions s
        WHERE s.account_id = target_account_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.account_subscriptions s
        JOIN public.saas_plans p ON p.id = s.plan_id
        WHERE s.account_id = target_account_id
          AND s.status NOT IN ('paused', 'cancelled')
          AND p.is_active = true
          AND p.features -> feature_key = 'true'::jsonb
      )
    );
$$;

ALTER FUNCTION public.is_account_feature_enabled(uuid, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_account_feature_enabled(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_account_feature_enabled(uuid, text)
  TO authenticated, service_role;

-- Team ----------------------------------------------------------------
ALTER POLICY account_invitations_modify ON public.account_invitations
  USING (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'team')
  )
  WITH CHECK (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'team')
  );

-- AI ------------------------------------------------------------------
ALTER POLICY ai_configs_insert ON public.ai_configs
  WITH CHECK (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'ai_assistant')
  );
ALTER POLICY ai_configs_update ON public.ai_configs
  USING (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'ai_assistant')
  )
  WITH CHECK (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'ai_assistant')
  );
ALTER POLICY ai_configs_delete ON public.ai_configs
  USING (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'ai_assistant')
  );

ALTER POLICY ai_knowledge_chunks_insert ON public.ai_knowledge_chunks
  WITH CHECK (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'ai_assistant')
  );
ALTER POLICY ai_knowledge_chunks_update ON public.ai_knowledge_chunks
  USING (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'ai_assistant')
  )
  WITH CHECK (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'ai_assistant')
  );
ALTER POLICY ai_knowledge_chunks_delete ON public.ai_knowledge_chunks
  USING (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'ai_assistant')
  );

ALTER POLICY ai_knowledge_documents_insert ON public.ai_knowledge_documents
  WITH CHECK (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'ai_assistant')
  );
ALTER POLICY ai_knowledge_documents_update ON public.ai_knowledge_documents
  USING (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'ai_assistant')
  )
  WITH CHECK (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'ai_assistant')
  );
ALTER POLICY ai_knowledge_documents_delete ON public.ai_knowledge_documents
  USING (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'ai_assistant')
  );

-- API / integrations --------------------------------------------------
ALTER POLICY api_keys_insert ON public.api_keys
  WITH CHECK (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'api')
  );
ALTER POLICY api_keys_update ON public.api_keys
  USING (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'api')
  )
  WITH CHECK (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'api')
  );
ALTER POLICY api_keys_delete ON public.api_keys
  USING (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'api')
  );

ALTER POLICY webhook_endpoints_insert ON public.webhook_endpoints
  WITH CHECK (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'api')
  );
ALTER POLICY webhook_endpoints_update ON public.webhook_endpoints
  USING (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'api')
  )
  WITH CHECK (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'api')
  );
ALTER POLICY webhook_endpoints_delete ON public.webhook_endpoints
  USING (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'api')
  );

-- Contacts ------------------------------------------------------------
ALTER POLICY contacts_insert ON public.contacts
  WITH CHECK (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'contacts')
  );
ALTER POLICY contacts_update ON public.contacts
  USING (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'contacts')
  )
  WITH CHECK (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'contacts')
  );
ALTER POLICY contacts_delete ON public.contacts
  USING (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'contacts')
  );

ALTER POLICY contact_notes_insert ON public.contact_notes
  WITH CHECK (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'contacts')
  );
ALTER POLICY contact_notes_update ON public.contact_notes
  USING (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'contacts')
  )
  WITH CHECK (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'contacts')
  );
ALTER POLICY contact_notes_delete ON public.contact_notes
  USING (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'contacts')
  );

ALTER POLICY custom_fields_insert ON public.custom_fields
  WITH CHECK (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'contacts')
  );
ALTER POLICY custom_fields_update ON public.custom_fields
  USING (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'contacts')
  )
  WITH CHECK (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'contacts')
  );
ALTER POLICY custom_fields_delete ON public.custom_fields
  USING (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'contacts')
  );

ALTER POLICY tags_insert ON public.tags
  WITH CHECK (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'contacts')
  );
ALTER POLICY tags_update ON public.tags
  USING (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'contacts')
  )
  WITH CHECK (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'contacts')
  );
ALTER POLICY tags_delete ON public.tags
  USING (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'contacts')
  );

ALTER POLICY contact_tags_modify ON public.contact_tags
  USING (
    EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = contact_tags.contact_id
        AND public.is_account_operational(c.account_id, 'agent')
        AND public.is_account_feature_enabled(c.account_id, 'contacts')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = contact_tags.contact_id
        AND public.is_account_operational(c.account_id, 'agent')
        AND public.is_account_feature_enabled(c.account_id, 'contacts')
    )
  );

ALTER POLICY contact_custom_values_modify ON public.contact_custom_values
  USING (
    EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = contact_custom_values.contact_id
        AND public.is_account_operational(c.account_id, 'agent')
        AND public.is_account_feature_enabled(c.account_id, 'contacts')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = contact_custom_values.contact_id
        AND public.is_account_operational(c.account_id, 'agent')
        AND public.is_account_feature_enabled(c.account_id, 'contacts')
    )
  );

-- WhatsApp / inbox ----------------------------------------------------
ALTER POLICY conversations_insert ON public.conversations
  WITH CHECK (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'whatsapp_messaging')
  );
ALTER POLICY conversations_update ON public.conversations
  USING (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'whatsapp_messaging')
  )
  WITH CHECK (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'whatsapp_messaging')
  );
ALTER POLICY conversations_delete ON public.conversations
  USING (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'whatsapp_messaging')
  );

ALTER POLICY messages_modify ON public.messages
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND public.is_account_operational(c.account_id, 'agent')
        AND public.is_account_feature_enabled(c.account_id, 'whatsapp_messaging')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND public.is_account_operational(c.account_id, 'agent')
        AND public.is_account_feature_enabled(c.account_id, 'whatsapp_messaging')
    )
  );

ALTER POLICY message_reactions_modify ON public.message_reactions
  USING (
    EXISTS (
      SELECT 1
      FROM public.messages m
      JOIN public.conversations c ON c.id = m.conversation_id
      WHERE m.id = message_reactions.message_id
        AND public.is_account_operational(c.account_id, 'agent')
        AND public.is_account_feature_enabled(c.account_id, 'whatsapp_messaging')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.messages m
      JOIN public.conversations c ON c.id = m.conversation_id
      WHERE m.id = message_reactions.message_id
        AND public.is_account_operational(c.account_id, 'agent')
        AND public.is_account_feature_enabled(c.account_id, 'whatsapp_messaging')
    )
  );

ALTER POLICY quick_replies_insert ON public.quick_replies
  WITH CHECK (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'whatsapp_messaging')
  );
ALTER POLICY quick_replies_update ON public.quick_replies
  USING (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'whatsapp_messaging')
  )
  WITH CHECK (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'whatsapp_messaging')
  );
ALTER POLICY quick_replies_delete ON public.quick_replies
  USING (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'whatsapp_messaging')
  );

ALTER POLICY message_templates_insert ON public.message_templates
  WITH CHECK (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'whatsapp_messaging')
  );
ALTER POLICY message_templates_update ON public.message_templates
  USING (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'whatsapp_messaging')
  )
  WITH CHECK (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'whatsapp_messaging')
  );
ALTER POLICY message_templates_delete ON public.message_templates
  USING (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'whatsapp_messaging')
  );

ALTER POLICY whatsapp_config_insert ON public.whatsapp_config
  WITH CHECK (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'whatsapp_messaging')
  );
ALTER POLICY whatsapp_config_update ON public.whatsapp_config
  USING (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'whatsapp_messaging')
  )
  WITH CHECK (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'whatsapp_messaging')
  );
ALTER POLICY whatsapp_config_delete ON public.whatsapp_config
  USING (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'whatsapp_messaging')
  );

-- Pipelines -----------------------------------------------------------
ALTER POLICY deals_insert ON public.deals
  WITH CHECK (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'pipelines')
  );
ALTER POLICY deals_update ON public.deals
  USING (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'pipelines')
  )
  WITH CHECK (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'pipelines')
  );
ALTER POLICY deals_delete ON public.deals
  USING (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'pipelines')
  );

ALTER POLICY pipelines_insert ON public.pipelines
  WITH CHECK (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'pipelines')
  );
ALTER POLICY pipelines_update ON public.pipelines
  USING (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'pipelines')
  )
  WITH CHECK (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'pipelines')
  );
ALTER POLICY pipelines_delete ON public.pipelines
  USING (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'pipelines')
  );

ALTER POLICY pipeline_stages_modify ON public.pipeline_stages
  USING (
    EXISTS (
      SELECT 1 FROM public.pipelines p
      WHERE p.id = pipeline_stages.pipeline_id
        AND public.is_account_operational(p.account_id, 'admin')
        AND public.is_account_feature_enabled(p.account_id, 'pipelines')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pipelines p
      WHERE p.id = pipeline_stages.pipeline_id
        AND public.is_account_operational(p.account_id, 'admin')
        AND public.is_account_feature_enabled(p.account_id, 'pipelines')
    )
  );

-- Broadcasts ----------------------------------------------------------
ALTER POLICY broadcasts_insert ON public.broadcasts
  WITH CHECK (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'broadcasts')
  );
ALTER POLICY broadcasts_update ON public.broadcasts
  USING (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'broadcasts')
  )
  WITH CHECK (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'broadcasts')
  );
ALTER POLICY broadcasts_delete ON public.broadcasts
  USING (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'broadcasts')
  );

ALTER POLICY broadcast_recipients_modify ON public.broadcast_recipients
  USING (
    EXISTS (
      SELECT 1 FROM public.broadcasts b
      WHERE b.id = broadcast_recipients.broadcast_id
        AND public.is_account_operational(b.account_id, 'agent')
        AND public.is_account_feature_enabled(b.account_id, 'broadcasts')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.broadcasts b
      WHERE b.id = broadcast_recipients.broadcast_id
        AND public.is_account_operational(b.account_id, 'agent')
        AND public.is_account_feature_enabled(b.account_id, 'broadcasts')
    )
  );

-- Automations ---------------------------------------------------------
ALTER POLICY automations_insert ON public.automations
  WITH CHECK (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'automations')
  );
ALTER POLICY automations_update ON public.automations
  USING (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'automations')
  )
  WITH CHECK (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'automations')
  );
ALTER POLICY automations_delete ON public.automations
  USING (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'automations')
  );

ALTER POLICY automation_steps_modify ON public.automation_steps
  USING (
    EXISTS (
      SELECT 1 FROM public.automations a
      WHERE a.id = automation_steps.automation_id
        AND public.is_account_operational(a.account_id, 'agent')
        AND public.is_account_feature_enabled(a.account_id, 'automations')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.automations a
      WHERE a.id = automation_steps.automation_id
        AND public.is_account_operational(a.account_id, 'agent')
        AND public.is_account_feature_enabled(a.account_id, 'automations')
    )
  );

-- Visual flows --------------------------------------------------------
ALTER POLICY flows_insert ON public.flows
  WITH CHECK (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'flows')
  );
ALTER POLICY flows_update ON public.flows
  USING (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'flows')
  )
  WITH CHECK (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'flows')
  );
ALTER POLICY flows_delete ON public.flows
  USING (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'flows')
  );

ALTER POLICY flow_nodes_modify ON public.flow_nodes
  USING (
    EXISTS (
      SELECT 1 FROM public.flows f
      WHERE f.id = flow_nodes.flow_id
        AND public.is_account_operational(f.account_id, 'agent')
        AND public.is_account_feature_enabled(f.account_id, 'flows')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.flows f
      WHERE f.id = flow_nodes.flow_id
        AND public.is_account_operational(f.account_id, 'agent')
        AND public.is_account_feature_enabled(f.account_id, 'flows')
    )
  );

COMMENT ON FUNCTION public.is_account_feature_enabled(uuid, text) IS
  'Membership-aware SaaS feature guard for tenant write policies; legacy accounts without a subscription remain allowed.';
