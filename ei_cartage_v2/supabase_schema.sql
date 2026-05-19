-- EI Cartage Manifest System — Supabase Schema
-- Run this in the Supabase SQL editor before deploying

create table if not exists kn_store (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);

-- Index for faster lookups (optional but good practice)
create index if not exists kn_store_updated_at_idx on kn_store(updated_at desc);

-- Enable Row Level Security (RLS) — server uses service key so bypasses RLS
alter table kn_store enable row level security;

-- No public access — only the service key (server-side) can read/write
-- This keeps all data private and only accessible through your Express server
