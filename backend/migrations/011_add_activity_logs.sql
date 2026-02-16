-- Adds an audit/activity log for tracking system changes.

create extension if not exists pgcrypto;

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  actor_user_id uuid null,
  actor_email text null,
  actor_role text null,

  action text not null,
  summary text null,

  entity_type text null,
  entity_id text null,

  method text null,
  route text null,
  status int null,
  request_id text null,

  meta jsonb not null default '{}'::jsonb
);

create index if not exists activity_logs_created_at_idx on public.activity_logs (created_at desc);
create index if not exists activity_logs_actor_user_id_idx on public.activity_logs (actor_user_id);
create index if not exists activity_logs_entity_idx on public.activity_logs (entity_type, entity_id);
