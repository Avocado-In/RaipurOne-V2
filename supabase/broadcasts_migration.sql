-- Civic broadcasts: one row per announcement sent out to citizens.
--
-- Kept separate from public.notifications, which is the dashboard's own bell feed about
-- individual complaints. This table is the record of messages that actually left the
-- building and reached members of the public, so it stores who it went to and how many
-- of them it reached rather than just the text.
--
-- Run this once against the project database.

create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  category text not null default 'alert',
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),

  -- What the send actually did. `recipients` is the audience size at send time;
  -- delivered + failed accounts for every one of them.
  recipients integer not null default 0,
  delivered integer not null default 0,
  failed integer not null default 0,

  sent_by uuid references public.users(id) on delete set null,
  sent_at timestamptz not null default now()
);

create index if not exists broadcasts_sent_at_idx on public.broadcasts (sent_at desc);

alter table public.broadcasts enable row level security;

-- The API reaches this with the service role, which bypasses RLS. No anon policy is
-- granted: a broadcast log is an operational record, not public data.
