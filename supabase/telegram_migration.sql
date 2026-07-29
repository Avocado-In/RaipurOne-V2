-- Run once in the Supabase SQL Editor for an existing Phase 3 database.
-- The full fresh-install schema remains in supabase/schema.sql.

alter table public.complaints
  add column if not exists department text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists source text not null default 'web',
  add column if not exists telegram_chat_id bigint,
  add column if not exists telegram_message_id bigint;

alter table public.complaints
  drop constraint if exists complaints_source_check;
alter table public.complaints
  add constraint complaints_source_check check (source in ('web', 'telegram', 'mobile'));

create unique index if not exists complaints_telegram_message_uidx
  on public.complaints (telegram_chat_id, telegram_message_id)
  where telegram_chat_id is not null and telegram_message_id is not null;

create table if not exists public.telegram_updates (
  update_id bigint primary key,
  chat_id bigint,
  message_id bigint,
  received_at timestamptz not null default now()
);

alter table public.telegram_updates enable row level security;
create table if not exists public.complaint_images (
  id uuid primary key default gen_random_uuid(),
  complaint_id text not null references public.complaints(id) on delete cascade,
  storage_path text not null unique,
  content_type text,
  created_at timestamptz not null default now()
);

alter table public.complaint_images enable row level security;



insert into storage.buckets (id, name, public)
values ('complaint-images', 'complaint-images', false)
on conflict (id) do nothing;

alter table public.workers
  add column if not exists worker_code text,
  add column if not exists phone text default '',
  add column if not exists email text default '',
  add column if not exists departments text[] not null default '{}';

create unique index if not exists workers_worker_code_uidx
  on public.workers (worker_code)
  where worker_code is not null;