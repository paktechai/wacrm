-- Atomic, tenant-scoped first-inbound claim for webhook automations.
--
-- A per-conversation message count can incorrectly classify the first
-- message in a NEW conversation as the contact's first-ever message, and
-- two distinct inbound messages can race while both counts are still zero.
-- The nullable contact marker below is claimed by one UPDATE, so exactly
-- one webhook delivery wins across every conversation for that contact.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS first_inbound_message_at TIMESTAMPTZ;

-- Existing contacts that have already sent a message must not receive a
-- welcome automation after this migration. Backfill their earliest inbound.
UPDATE public.contacts AS c
SET first_inbound_message_at = history.first_inbound_at
FROM (
  SELECT conv.contact_id, MIN(m.created_at) AS first_inbound_at
  FROM public.conversations AS conv
  JOIN public.messages AS m ON m.conversation_id = conv.id
  WHERE m.sender_type = 'customer'
  GROUP BY conv.contact_id
) AS history
WHERE c.id = history.contact_id
  AND c.first_inbound_message_at IS NULL;

CREATE OR REPLACE FUNCTION public.claim_contact_first_inbound_message(
  p_account_id UUID,
  p_contact_id UUID,
  p_received_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claimed_id UUID;
BEGIN
  UPDATE public.contacts
  SET first_inbound_message_at = COALESCE(p_received_at, NOW()),
      updated_at = NOW()
  WHERE id = p_contact_id
    AND account_id = p_account_id
    AND first_inbound_message_at IS NULL
  RETURNING id INTO claimed_id;

  RETURN claimed_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_contact_first_inbound_message(UUID, UUID, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_contact_first_inbound_message(UUID, UUID, TIMESTAMPTZ)
  TO service_role;

COMMENT ON FUNCTION public.claim_contact_first_inbound_message(UUID, UUID, TIMESTAMPTZ)
  IS 'Atomically claims a contact first-inbound event within an account; service-role webhook only.';
