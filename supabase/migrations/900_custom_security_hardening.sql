-- Custom hardening for the paktechai/wacrm deployment.
-- Keeps the app's intentional RPC surface while removing direct API
-- execution from internal/service-only SECURITY DEFINER helpers.
-- Idempotent: safe to re-run.

-- Internal / service-role-only helpers.
REVOKE ALL ON FUNCTION public._bcast_bump(uuid, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._bcast_bump(uuid, text, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._bcast_bump(uuid, text, integer) TO service_role;

REVOKE ALL ON FUNCTION public.broadcast_recipient_aggregate_trigger() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.broadcast_recipient_aggregate_trigger() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.broadcast_recipient_aggregate_trigger() TO service_role;

REVOKE ALL ON FUNCTION public.claim_ai_reply_slot(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_ai_reply_slot(uuid, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ai_reply_slot(uuid, integer) TO service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

REVOKE ALL ON FUNCTION public.merge_duplicate_contacts() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.merge_duplicate_contacts() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_duplicate_contacts() TO service_role;

REVOKE ALL ON FUNCTION public.merge_duplicate_conversations() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.merge_duplicate_conversations() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_duplicate_conversations() TO service_role;

REVOKE ALL ON FUNCTION public.notify_conversation_assigned() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_conversation_assigned() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_conversation_assigned() TO service_role;

REVOKE ALL ON FUNCTION public.recompute_broadcast_counts(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recompute_broadcast_counts(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_broadcast_counts(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.record_webhook_failure(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_webhook_failure(uuid, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_webhook_failure(uuid, integer) TO service_role;

-- Authenticated application RPCs: remove anonymous execution while
-- preserving the roles the app legitimately uses.
REVOKE ALL ON FUNCTION public.is_account_member(uuid, account_role_enum) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_account_member(uuid, account_role_enum) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_account_member(uuid, account_role_enum) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.redeem_invitation(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.redeem_invitation(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.redeem_invitation(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.remove_account_member(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.remove_account_member(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.remove_account_member(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.set_member_role(uuid, account_role_enum) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_member_role(uuid, account_role_enum) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_member_role(uuid, account_role_enum) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.touch_presence(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.touch_presence(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.touch_presence(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.transfer_account_ownership(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.transfer_account_ownership(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.transfer_account_ownership(uuid) TO authenticated, service_role;

-- peek_invitation(text) intentionally remains callable by anon and
-- authenticated: the public join page needs to inspect a high-entropy
-- invitation token before sign-in.
REVOKE ALL ON FUNCTION public.peek_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peek_invitation(text) TO anon, authenticated, service_role;

-- Pin helper search paths to avoid role-mutable resolution.
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public._bcast_cols_for_status(text) SET search_path = public;
ALTER FUNCTION public.update_ai_configs_updated_at() SET search_path = public;
ALTER FUNCTION public.update_ai_knowledge_documents_updated_at() SET search_path = public;
