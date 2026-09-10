-- Everyone the bot can reach, not only everyone who has filed a complaint.
--
-- Broadcast recipients were derived from distinct telegram_chat_id on complaints, which
-- silently excluded anyone who pressed /start and then never reported anything. They had
-- opened a conversation with the bot and would still expect a water-cut notice.
--
-- Run this once against the project database.

create table if not exists public.telegram_subscribers (
  chat_id bigint primary key,
  username text,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  -- Set false when Telegram tells us the chat is gone (blocked, deleted). Kept rather
  -- than deleted so a returning user is recognised as the same person.
  is_active boolean not null default true
);

create index if not exists telegram_subscribers_active_idx on public.telegram_subscribers (is_active);

alter table public.telegram_subscribers enable row level security;

-- Backfill from complaints so existing citizens are subscribers from day one.
insert into public.telegram_subscribers (chat_id)
select distinct telegram_chat_id from public.complaints where telegram_chat_id is not null
on conflict (chat_id) do nothing;
