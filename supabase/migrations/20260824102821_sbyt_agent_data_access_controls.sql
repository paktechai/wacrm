-- Least-privilege agent access: assignment-scoped customer data, operational
-- messaging, and admin-only management/destructive actions.

CREATE INDEX IF NOT EXISTS idx_conversations_account_assignee_contact
  ON public.conversations(account_id, assigned_agent_id, contact_id);

-- Owners/admins retain full workspace access. Agents and viewers may read
-- their assigned queue plus the shared unassigned queue.
ALTER POLICY conversations_select ON public.conversations
  TO authenticated
  USING (
    public.is_account_member(account_id)
    AND (
      public.is_account_member(account_id, 'admin')
      OR assigned_agent_id IS NULL
      OR assigned_agent_id = (SELECT auth.uid())
    )
  );

ALTER POLICY conversations_insert ON public.conversations
  TO authenticated
  WITH CHECK (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'whatsapp_messaging')
    AND (
      public.is_account_member(account_id, 'admin')
      OR user_id = (SELECT auth.uid())
    )
  );

ALTER POLICY conversations_update ON public.conversations
  TO authenticated
  USING (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'whatsapp_messaging')
    AND (
      public.is_account_member(account_id, 'admin')
      OR assigned_agent_id IS NULL
      OR assigned_agent_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'whatsapp_messaging')
    AND (
      assigned_agent_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.profiles assignee
        WHERE assignee.user_id = assigned_agent_id
          AND assignee.account_id = conversations.account_id
      )
    )
  );

ALTER POLICY conversations_delete ON public.conversations
  TO authenticated
  USING (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'whatsapp_messaging')
  );

-- A newly created contact is visible to its creator before the first message.
-- Existing customer records become visible through an accessible conversation.
ALTER POLICY contacts_select ON public.contacts
  TO authenticated
  USING (
    public.is_account_member(account_id)
    AND (
      public.is_account_member(account_id, 'admin')
      OR user_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.conversations conversation
        WHERE conversation.contact_id = contacts.id
          AND conversation.account_id = contacts.account_id
          AND (
            conversation.assigned_agent_id IS NULL
            OR conversation.assigned_agent_id = (SELECT auth.uid())
          )
      )
    )
  );

ALTER POLICY contacts_insert ON public.contacts
  TO authenticated
  WITH CHECK (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'contacts')
    AND (
      public.is_account_member(account_id, 'admin')
      OR user_id = (SELECT auth.uid())
    )
  );

ALTER POLICY contacts_delete ON public.contacts
  TO authenticated
  USING (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'contacts')
  );

-- Notes inherit visibility from their parent contact. Agents can only edit
-- or remove their own notes; administrators retain moderation rights.
ALTER POLICY contact_notes_select ON public.contact_notes
  TO authenticated
  USING (
    public.is_account_member(account_id)
    AND EXISTS (
      SELECT 1 FROM public.contacts contact
      WHERE contact.id = contact_notes.contact_id
        AND contact.account_id = contact_notes.account_id
    )
  );

ALTER POLICY contact_notes_insert ON public.contact_notes
  TO authenticated
  WITH CHECK (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'contacts')
    AND (
      public.is_account_member(account_id, 'admin')
      OR user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.contacts contact
      WHERE contact.id = contact_notes.contact_id
        AND contact.account_id = contact_notes.account_id
    )
  );

ALTER POLICY contact_notes_update ON public.contact_notes
  TO authenticated
  USING (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'contacts')
    AND (
      public.is_account_member(account_id, 'admin')
      OR user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'contacts')
    AND (
      public.is_account_member(account_id, 'admin')
      OR user_id = (SELECT auth.uid())
    )
  );

ALTER POLICY contact_notes_delete ON public.contact_notes
  TO authenticated
  USING (
    public.is_account_operational(account_id, 'agent')
    AND public.is_account_feature_enabled(account_id, 'contacts')
    AND (
      public.is_account_member(account_id, 'admin')
      OR user_id = (SELECT auth.uid())
    )
  );

ALTER POLICY deals_delete ON public.deals
  TO authenticated
  USING (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'pipelines')
  );

-- Management records must remain protected when a caller uses Supabase's
-- Data API directly instead of the guarded Next.js dashboard routes.
ALTER POLICY broadcasts_select ON public.broadcasts
  TO authenticated USING (public.is_account_member(account_id, 'admin'));
ALTER POLICY broadcasts_insert ON public.broadcasts
  TO authenticated WITH CHECK (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'broadcasts')
  );
ALTER POLICY broadcasts_update ON public.broadcasts
  TO authenticated USING (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'broadcasts')
  ) WITH CHECK (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'broadcasts')
  );
ALTER POLICY broadcasts_delete ON public.broadcasts
  TO authenticated USING (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'broadcasts')
  );

ALTER POLICY automations_select ON public.automations
  TO authenticated USING (public.is_account_member(account_id, 'admin'));
ALTER POLICY automations_insert ON public.automations
  TO authenticated WITH CHECK (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'automations')
  );
ALTER POLICY automations_update ON public.automations
  TO authenticated USING (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'automations')
  ) WITH CHECK (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'automations')
  );
ALTER POLICY automations_delete ON public.automations
  TO authenticated USING (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'automations')
  );
ALTER POLICY automation_logs_select ON public.automation_logs
  TO authenticated USING (public.is_account_member(account_id, 'admin'));

ALTER POLICY flows_select ON public.flows
  TO authenticated USING (public.is_account_member(account_id, 'admin'));
ALTER POLICY flows_insert ON public.flows
  TO authenticated WITH CHECK (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'flows')
  );
ALTER POLICY flows_update ON public.flows
  TO authenticated USING (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'flows')
  ) WITH CHECK (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'flows')
  );
ALTER POLICY flows_delete ON public.flows
  TO authenticated USING (
    public.is_account_operational(account_id, 'admin')
    AND public.is_account_feature_enabled(account_id, 'flows')
  );
ALTER POLICY flow_runs_select ON public.flow_runs
  TO authenticated USING (public.is_account_member(account_id, 'admin'));

ALTER POLICY api_keys_select ON public.api_keys
  TO authenticated USING (public.is_account_member(account_id, 'admin'));
ALTER POLICY webhook_endpoints_select ON public.webhook_endpoints
  TO authenticated USING (public.is_account_member(account_id, 'admin'));

-- Follow-ups and appointments belong to their assignee/creator rather than
-- every person in the workspace.
ALTER POLICY crm_tasks_select ON public.crm_tasks
  TO authenticated
  USING (
    public.is_account_member(account_id)
    AND (
      public.is_account_member(account_id, 'admin')
      OR assigned_to = (SELECT auth.uid())
      OR created_by = (SELECT auth.uid())
    )
  );

ALTER POLICY crm_appointments_select ON public.crm_appointments
  TO authenticated
  USING (
    public.is_account_member(account_id)
    AND (
      public.is_account_member(account_id, 'admin')
      OR assigned_to = (SELECT auth.uid())
      OR created_by = (SELECT auth.uid())
    )
  );
