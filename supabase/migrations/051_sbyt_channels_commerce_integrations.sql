-- ============================================================
-- SBYT Omnichannel + Commerce + Integrations foundation
-- External providers can be connected later without changing the CRM model.
-- ============================================================

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'whatsapp'
    CHECK (channel IN ('whatsapp','instagram','messenger','webchat','sms','rcs','tiktok','custom')),
  ADD COLUMN IF NOT EXISTS external_thread_id text;

CREATE INDEX IF NOT EXISTS idx_conversations_channel
  ON public.conversations(account_id, channel, last_message_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_external_thread_unique
  ON public.conversations(account_id, channel, external_thread_id)
  WHERE external_thread_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.channel_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp','instagram','messenger','webchat','sms','rcs','tiktok','custom')),
  provider text NOT NULL,
  display_name text,
  external_account_id text,
  credentials_ciphertext text,
  status text NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('disconnected','connecting','connected','error','paused')),
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_channel_connections_account
  ON public.channel_connections(account_id, channel, status);
ALTER TABLE public.channel_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS channel_connections_select ON public.channel_connections;
CREATE POLICY channel_connections_select ON public.channel_connections FOR SELECT
  USING (public.is_account_member(account_id));
DROP POLICY IF EXISTS channel_connections_insert ON public.channel_connections;
CREATE POLICY channel_connections_insert ON public.channel_connections FOR INSERT
  WITH CHECK (public.is_account_operational(account_id, 'admin'));
DROP POLICY IF EXISTS channel_connections_update ON public.channel_connections;
CREATE POLICY channel_connections_update ON public.channel_connections FOR UPDATE
  USING (public.is_account_operational(account_id, 'admin'))
  WITH CHECK (public.is_account_operational(account_id, 'admin'));
DROP POLICY IF EXISTS channel_connections_delete ON public.channel_connections;
CREATE POLICY channel_connections_delete ON public.channel_connections FOR DELETE
  USING (public.is_account_operational(account_id, 'admin'));

CREATE TABLE IF NOT EXISTS public.integration_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  provider text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('disconnected','connecting','connected','error','paused')),
  credentials_ciphertext text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  sync_cursor text,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, provider, name)
);
CREATE INDEX IF NOT EXISTS idx_integration_connections_account
  ON public.integration_connections(account_id, provider, status);
ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS integration_connections_select ON public.integration_connections;
CREATE POLICY integration_connections_select ON public.integration_connections FOR SELECT
  USING (public.is_account_member(account_id));
DROP POLICY IF EXISTS integration_connections_insert ON public.integration_connections;
CREATE POLICY integration_connections_insert ON public.integration_connections FOR INSERT
  WITH CHECK (public.is_account_operational(account_id, 'admin'));
DROP POLICY IF EXISTS integration_connections_update ON public.integration_connections;
CREATE POLICY integration_connections_update ON public.integration_connections FOR UPDATE
  USING (public.is_account_operational(account_id, 'admin'))
  WITH CHECK (public.is_account_operational(account_id, 'admin'));
DROP POLICY IF EXISTS integration_connections_delete ON public.integration_connections;
CREATE POLICY integration_connections_delete ON public.integration_connections FOR DELETE
  USING (public.is_account_operational(account_id, 'admin'));

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  sku text,
  description text,
  price numeric(14,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  currency text NOT NULL DEFAULT 'PKR',
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, sku)
);
CREATE INDEX IF NOT EXISTS idx_products_account_active
  ON public.products(account_id, is_active, created_at DESC);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS products_select ON public.products;
CREATE POLICY products_select ON public.products FOR SELECT
  USING (public.is_account_member(account_id));
DROP POLICY IF EXISTS products_insert ON public.products;
CREATE POLICY products_insert ON public.products FOR INSERT
  WITH CHECK (public.is_account_operational(account_id, 'agent'));
DROP POLICY IF EXISTS products_update ON public.products;
CREATE POLICY products_update ON public.products FOR UPDATE
  USING (public.is_account_operational(account_id, 'agent'))
  WITH CHECK (public.is_account_operational(account_id, 'agent'));
DROP POLICY IF EXISTS products_delete ON public.products;
CREATE POLICY products_delete ON public.products FOR DELETE
  USING (public.is_account_operational(account_id, 'admin'));

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  order_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending','confirmed','paid','fulfilled','cancelled','refunded')),
  subtotal numeric(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount numeric(14,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax numeric(14,2) NOT NULL DEFAULT 0 CHECK (tax >= 0),
  total numeric(14,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  currency text NOT NULL DEFAULT 'PKR',
  notes text,
  external_order_ref text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, order_number)
);
CREATE INDEX IF NOT EXISTS idx_orders_account_status
  ON public.orders(account_id, status, created_at DESC);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS orders_select ON public.orders;
CREATE POLICY orders_select ON public.orders FOR SELECT
  USING (public.is_account_member(account_id));
DROP POLICY IF EXISTS orders_insert ON public.orders;
CREATE POLICY orders_insert ON public.orders FOR INSERT
  WITH CHECK (public.is_account_operational(account_id, 'agent'));
DROP POLICY IF EXISTS orders_update ON public.orders;
CREATE POLICY orders_update ON public.orders FOR UPDATE
  USING (public.is_account_operational(account_id, 'agent'))
  WITH CHECK (public.is_account_operational(account_id, 'agent'));
DROP POLICY IF EXISTS orders_delete ON public.orders;
CREATE POLICY orders_delete ON public.orders FOR DELETE
  USING (public.is_account_operational(account_id, 'admin'));

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name text NOT NULL,
  sku text,
  quantity numeric(12,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(14,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  line_total numeric(14,2) NOT NULL DEFAULT 0 CHECK (line_total >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_items_select ON public.order_items;
CREATE POLICY order_items_select ON public.order_items FOR SELECT
  USING (public.is_account_member(account_id));
DROP POLICY IF EXISTS order_items_insert ON public.order_items;
CREATE POLICY order_items_insert ON public.order_items FOR INSERT
  WITH CHECK (public.is_account_operational(account_id, 'agent'));
DROP POLICY IF EXISTS order_items_update ON public.order_items;
CREATE POLICY order_items_update ON public.order_items FOR UPDATE
  USING (public.is_account_operational(account_id, 'agent'))
  WITH CHECK (public.is_account_operational(account_id, 'agent'));
DROP POLICY IF EXISTS order_items_delete ON public.order_items;
CREATE POLICY order_items_delete ON public.order_items FOR DELETE
  USING (public.is_account_operational(account_id, 'agent'));

CREATE TABLE IF NOT EXISTS public.payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'manual',
  external_payment_ref text,
  url text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'PKR',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paid','expired','cancelled')),
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_payment_links_order
  ON public.payment_links(account_id, order_id, status);
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_links_select ON public.payment_links;
CREATE POLICY payment_links_select ON public.payment_links FOR SELECT
  USING (public.is_account_member(account_id));
DROP POLICY IF EXISTS payment_links_insert ON public.payment_links;
CREATE POLICY payment_links_insert ON public.payment_links FOR INSERT
  WITH CHECK (public.is_account_operational(account_id, 'agent'));
DROP POLICY IF EXISTS payment_links_update ON public.payment_links;
CREATE POLICY payment_links_update ON public.payment_links FOR UPDATE
  USING (public.is_account_operational(account_id, 'agent'))
  WITH CHECK (public.is_account_operational(account_id, 'agent'));
DROP POLICY IF EXISTS payment_links_delete ON public.payment_links;
CREATE POLICY payment_links_delete ON public.payment_links FOR DELETE
  USING (public.is_account_operational(account_id, 'admin'));

COMMENT ON TABLE public.channel_connections IS 'Provider-neutral omnichannel connection registry. Sensitive credentials must be encrypted before storage.';
COMMENT ON TABLE public.integration_connections IS 'Provider-neutral integration registry for Shopify, WooCommerce, Sheets, n8n, Zapier, HubSpot and custom connectors.';
