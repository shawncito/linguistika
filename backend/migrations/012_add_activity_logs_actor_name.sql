-- Adds actor_name to activity_logs for more human-friendly display.

alter table if exists public.activity_logs
  add column if not exists actor_name text null;

create index if not exists activity_logs_actor_name_idx on public.activity_logs (actor_name);
