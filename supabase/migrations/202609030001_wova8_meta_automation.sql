begin;

create extension if not exists pgcrypto;

do $$ begin
  create type public.coexistence_status as enum
    ('pending', 'active', 'paused', 'disconnected', 'needs_review');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.whatsapp_onboarding_mode as enum
    ('fresh', 'provider_migration', 'business_app_coexistence');
exception when duplicate_object then null;
end $$;

create table if not exists public.whatsapp_subscribers (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  business_name text not null check (length(btrim(business_name)) between 1 and 160),
  encrypted_system_user_token text not null,
  token_key_version smallint not null check (token_key_version > 0),
  token_expires_at timestamptz,
  token_scopes text[] not null default '{}',
  waba_id text not null unique check (waba_id ~ '^[0-9]{5,32}$'),
  phone_number_id text not null unique check (phone_number_id ~ '^[0-9]{5,32}$'),
  display_phone_number text,
  onboarding_mode public.whatsapp_onboarding_mode not null default 'fresh',
  source_solution_provider text,
  coexistence_status public.coexistence_status not null default 'pending',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, waba_id),
  unique (account_id, phone_number_id)
);

create index if not exists whatsapp_subscribers_account_idx
  on public.whatsapp_subscribers(account_id);
create index if not exists whatsapp_subscribers_user_idx
  on public.whatsapp_subscribers(user_id);

create table if not exists public.meta_onboarding_sessions (
  state_hash text primary key check (state_hash ~ '^[a-f0-9]{64}$'),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  onboarding_mode public.whatsapp_onboarding_mode not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists meta_onboarding_sessions_expiry_idx
  on public.meta_onboarding_sessions(expires_at)
  where consumed_at is null;

create table if not exists public.meta_webhook_events (
  id bigint generated always as identity primary key,
  event_key text not null unique,
  account_id uuid references public.accounts(id) on delete cascade,
  waba_id text,
  field_name text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text
);

create index if not exists meta_webhook_events_account_received_idx
  on public.meta_webhook_events(account_id, received_at desc);

create table if not exists public.whatsapp_synced_contacts (
  account_id uuid not null references public.accounts(id) on delete cascade,
  waba_id text not null,
  wa_id text not null,
  display_name text,
  state_payload jsonb not null,
  synced_at timestamptz not null default now(),
  primary key (account_id, waba_id, wa_id)
);

create table if not exists public.whatsapp_synced_messages (
  account_id uuid not null references public.accounts(id) on delete cascade,
  waba_id text not null,
  phone_number_id text,
  message_id text not null,
  wa_id text,
  direction text not null check (direction in ('inbound', 'outbound', 'unknown')),
  message_type text,
  occurred_at timestamptz,
  source_field text not null,
  payload jsonb not null,
  synced_at timestamptz not null default now(),
  primary key (account_id, waba_id, message_id)
);

create table if not exists public.hub_apps (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (length(btrim(name)) between 1 and 80),
  description text not null check (length(btrim(description)) between 1 and 500),
  url text not null check (url ~ '^https://'),
  icon text,
  category text not null check (length(btrim(category)) between 1 and 80),
  publication_status text not null default 'draft'
    check (publication_status in ('draft', 'published', 'archived')),
  sort_order integer not null default 1000,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists whatsapp_subscribers_set_updated_at on public.whatsapp_subscribers;
create trigger whatsapp_subscribers_set_updated_at
before update on public.whatsapp_subscribers
for each row execute function public.set_updated_at();

drop trigger if exists hub_apps_set_updated_at on public.hub_apps;
create trigger hub_apps_set_updated_at
before update on public.hub_apps
for each row execute function public.set_updated_at();

alter table public.whatsapp_subscribers enable row level security;
alter table public.whatsapp_subscribers force row level security;
alter table public.meta_onboarding_sessions enable row level security;
alter table public.meta_onboarding_sessions force row level security;
alter table public.meta_webhook_events enable row level security;
alter table public.meta_webhook_events force row level security;
alter table public.whatsapp_synced_contacts enable row level security;
alter table public.whatsapp_synced_contacts force row level security;
alter table public.whatsapp_synced_messages enable row level security;
alter table public.whatsapp_synced_messages force row level security;
alter table public.hub_apps enable row level security;
alter table public.hub_apps force row level security;

revoke all on public.whatsapp_subscribers from anon, authenticated;
revoke all on public.meta_onboarding_sessions from anon, authenticated;
revoke all on public.meta_webhook_events from anon, authenticated;
revoke all on public.whatsapp_synced_contacts from anon, authenticated;
revoke all on public.whatsapp_synced_messages from anon, authenticated;
revoke all on public.hub_apps from anon, authenticated;

grant select, insert, update, delete on public.whatsapp_subscribers to service_role;
grant select, insert, update, delete on public.meta_onboarding_sessions to service_role;
grant select, insert, update, delete on public.meta_webhook_events to service_role;
grant select, insert, update, delete on public.whatsapp_synced_contacts to service_role;
grant select, insert, update, delete on public.whatsapp_synced_messages to service_role;
grant select, insert, update, delete on public.hub_apps to service_role;
grant usage, select on sequence public.meta_webhook_events_id_seq to service_role;

grant select (
  id, account_id, user_id, business_name, waba_id, phone_number_id,
  display_phone_number, coexistence_status, onboarding_completed_at,
  created_at, updated_at
) on public.whatsapp_subscribers to authenticated;
grant select on public.whatsapp_synced_contacts to authenticated;
grant select on public.whatsapp_synced_messages to authenticated;
grant select on public.hub_apps to authenticated;

drop policy if exists whatsapp_subscribers_tenant_read on public.whatsapp_subscribers;
create policy whatsapp_subscribers_tenant_read
on public.whatsapp_subscribers for select to authenticated
using (public.is_account_member(whatsapp_subscribers.account_id));

drop policy if exists whatsapp_contacts_tenant_read on public.whatsapp_synced_contacts;
create policy whatsapp_contacts_tenant_read
on public.whatsapp_synced_contacts for select to authenticated
using (public.is_account_member(whatsapp_synced_contacts.account_id));

drop policy if exists whatsapp_messages_tenant_read on public.whatsapp_synced_messages;
create policy whatsapp_messages_tenant_read
on public.whatsapp_synced_messages for select to authenticated
using (public.is_account_member(whatsapp_synced_messages.account_id));

drop policy if exists hub_apps_authenticated_read on public.hub_apps;
create policy hub_apps_authenticated_read
on public.hub_apps for select to authenticated
using (publication_status = 'published');

-- No INSERT/UPDATE/DELETE policies are created for browser roles.
-- Backend writes use the service-role key and must never expose it to clients.

commit;
