-- Worker app: proof-of-work submissions.
--
-- A worker in the field marks a complaint done from their phone. The submission is not
-- trusted on its own: it must carry a photo of the finished work and the worker's GPS
-- position at the moment of submitting. An administrator reviews it on the dashboard and
-- either approves it (complaint -> resolved, citizen gets a Telegram message) or rejects
-- it (complaint -> in_progress, worker sees why and redoes the job).
--
-- Run this once against the project database.

create table if not exists public.work_submissions (
  id uuid primary key default gen_random_uuid(),
  complaint_id text not null references public.complaints(id) on delete cascade,
  worker_id uuid references public.workers(id) on delete set null,
  worker_user_id uuid references public.users(id) on delete set null,
  worker_name text,

  -- Proof of work
  photo_path text not null,
  notes text,

  -- Where the worker stood when they submitted
  lat double precision not null,
  lng double precision not null,
  accuracy_m double precision,

  -- Distance from the complaint's own coordinates. Null when the complaint has none,
  -- which is the case for every Telegram complaint filed without a location pin.
  distance_m double precision,
  location_verified boolean not null default false,

  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_notes text,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  submitted_at timestamptz not null default now()
);

create index if not exists work_submissions_status_idx on public.work_submissions (status, submitted_at desc);
create index if not exists work_submissions_complaint_idx on public.work_submissions (complaint_id);
create index if not exists work_submissions_worker_idx on public.work_submissions (worker_id);

-- One complaint cannot have two submissions waiting on review at the same time.
create unique index if not exists work_submissions_one_pending_uidx
  on public.work_submissions (complaint_id) where status = 'pending';

alter table public.work_submissions enable row level security;

-- The API talks to Postgres with the service role, which bypasses RLS. No anon policy is
-- granted on purpose: work photos and worker positions must never be readable from a
-- browser holding only the anon key.
