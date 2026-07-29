create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'citizen' check (role in ('citizen', 'worker', 'admin', 'manager')),
  trust_score numeric(5,2) not null default 100 check (trust_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  full_name text not null,
  availability text not null default 'available' check (availability in ('available', 'busy', 'offline', 'on_leave')),
  workload integer not null default 0 check (workload >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.complaints (
  id text primary key,
  citizen_user_id uuid references public.profiles(id) on delete set null,
  citizen_name text not null default 'Citizen',
  title text not null,
  description text not null,
  category text not null default 'general',
  department_id uuid references public.departments(id) on delete set null,
  department text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  status text not null default 'submitted' check (status in ('submitted', 'under_review', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected')),
  assigned_worker_id uuid references public.workers(id) on delete set null,
  assigned_worker text,
  recommended_worker_id uuid references public.workers(id) on delete set null,
  ai_analysis jsonb not null default '{}'::jsonb,
  recommended_worker_payload jsonb not null default '{}'::jsonb,
  location_text text,
  location_lat double precision,
  location_lng double precision,
  source text not null default 'web' check (source in ('web', 'telegram', 'mobile')),
  telegram_chat_id bigint,
  telegram_message_id bigint,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  closed_at timestamptz,
  resolution_summary text
);

create unique index if not exists complaints_telegram_message_uidx on public.complaints (telegram_chat_id, telegram_message_id) where telegram_chat_id is not null and telegram_message_id is not null;
create index if not exists complaints_status_priority_idx on public.complaints (status, priority);
create index if not exists complaints_department_idx on public.complaints (department_id);
create index if not exists complaints_citizen_idx on public.complaints (citizen_user_id);

create table if not exists public.complaint_images (
  id uuid primary key default gen_random_uuid(),
  complaint_id text not null references public.complaints(id) on delete cascade,
  storage_path text not null unique,
  content_type text,
  created_at timestamptz not null default now()
);

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  complaint_id text not null unique references public.complaints(id) on delete cascade,
  citizen_user_id uuid references public.profiles(id) on delete set null,
  score integer not null check (score between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id text primary key,
  recipient_user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  severity text not null default 'info' check (severity in ('info', 'success', 'warning', 'error')),
  complaint_id text references public.complaints(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_recipient_idx on public.notifications (recipient_user_id, created_at desc);

create table if not exists public.assignment_history (
  id uuid primary key default gen_random_uuid(),
  complaint_id text not null references public.complaints(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  assigned_worker_id uuid references public.workers(id) on delete set null,
  assigned_by uuid references public.profiles(id) on delete set null,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.telegram_updates (
  update_id bigint primary key,
  chat_id bigint,
  message_id bigint,
  received_at timestamptz not null default now()
);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists complaints_updated_at on public.complaints;
create trigger complaints_updated_at before update on public.complaints for each row execute function public.set_updated_at();
drop trigger if exists workers_updated_at on public.workers;
create trigger workers_updated_at before update on public.workers for each row execute function public.set_updated_at();

insert into public.departments (name, description) values
  ('Sanitation', 'Street cleaning and waste management'),
  ('Water', 'Water supply and leakage handling'),
  ('Public Works', 'Roads, lighting, and infrastructure'),
  ('Health', 'Public health and sanitation issues')
on conflict (name) do nothing;

alter table public.profiles enable row level security;
alter table public.departments enable row level security;
alter table public.workers enable row level security;
alter table public.complaints enable row level security;
alter table public.complaint_images enable row level security;
alter table public.ratings enable row level security;
alter table public.notifications enable row level security;
alter table public.assignment_history enable row level security;
alter table public.audit_logs enable row level security;
alter table public.telegram_updates enable row level security;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles for select to authenticated using (id = (select auth.uid()));
drop policy if exists profiles_admin_select on public.profiles;
create policy profiles_admin_select on public.profiles for select to authenticated using ((select auth.jwt()->'app_metadata'->>'role') in ('admin', 'manager'));
drop policy if exists departments_authenticated_select on public.departments;
create policy departments_authenticated_select on public.departments for select to authenticated using (true);
drop policy if exists complaints_citizen_select on public.complaints;
create policy complaints_citizen_select on public.complaints for select to authenticated using (citizen_user_id = (select auth.uid()));
drop policy if exists complaints_staff_select on public.complaints;
create policy complaints_staff_select on public.complaints for select to authenticated using ((select auth.jwt()->'app_metadata'->>'role') in ('admin', 'manager', 'worker'));
drop policy if exists complaints_citizen_insert on public.complaints;
create policy complaints_citizen_insert on public.complaints for insert to authenticated with check (citizen_user_id = (select auth.uid()));
drop policy if exists complaints_staff_update on public.complaints;
create policy complaints_staff_update on public.complaints for update to authenticated using ((select auth.jwt()->'app_metadata'->>'role') in ('admin', 'manager', 'worker')) with check ((select auth.jwt()->'app_metadata'->>'role') in ('admin', 'manager', 'worker'));
drop policy if exists notifications_owner_select on public.notifications;
create policy notifications_owner_select on public.notifications for select to authenticated using (recipient_user_id = (select auth.uid()) or (select auth.jwt()->'app_metadata'->>'role') in ('admin', 'manager'));
drop policy if exists ratings_owner_insert on public.ratings;
create policy ratings_owner_insert on public.ratings for insert to authenticated with check (citizen_user_id = (select auth.uid()));
drop policy if exists workers_staff_select on public.workers;
create policy workers_staff_select on public.workers for select to authenticated using ((select auth.jwt()->'app_metadata'->>'role') in ('admin', 'manager', 'worker'));

insert into storage.buckets (id, name, public) values ('complaint-images', 'complaint-images', false) on conflict (id) do nothing;

drop policy if exists complaint_images_owner_select on storage.objects;
create policy complaint_images_owner_select on storage.objects for select to authenticated using (bucket_id = 'complaint-images');
drop policy if exists complaint_images_authenticated_insert on storage.objects;
create policy complaint_images_authenticated_insert on storage.objects for insert to authenticated with check (bucket_id = 'complaint-images');

