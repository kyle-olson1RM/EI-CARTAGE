-- ============================================================
-- K&N House Driver Manifest — Supabase Schema
-- Run this in the Supabase SQL Editor before deploying
-- ============================================================

-- Main key-value store table
-- All app data lives here (manifests, drivers, managers, rates)
create table if not exists kn_store (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz default now()
);

-- Update timestamp automatically on every write
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger kn_store_updated_at
  before update on kn_store
  for each row execute function update_updated_at();

-- Row Level Security
-- The app uses the service_role key server-side, so RLS is a safety net
alter table kn_store enable row level security;

-- Block all direct browser access (server proxies all requests)
-- If you want to allow direct browser access in future, add policies here
create policy "server only" on kn_store
  for all
  using (false);

-- Index for faster lookups
create index if not exists kn_store_key_idx on kn_store(key);
create index if not exists kn_store_updated_idx on kn_store(updated_at desc);

-- ============================================================
-- Seed initial data (optional — app will create on first save)
-- ============================================================

-- Unit rates
insert into kn_store (key, value) values
  ('kn_unit_rates', '{"Straight Truck":67,"Tractor":75}')
on conflict (key) do nothing;

-- Default manager (badge 1234 — CHANGE THIS before go-live)
insert into kn_store (key, value) values
  ('kn_managers', '[{"name":"Manager","badge":"1234"}]')
on conflict (key) do nothing;
