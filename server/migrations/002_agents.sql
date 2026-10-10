-- Replies the server starts on its own (a timer ran out) still need the user's local time.
alter table users add column time_zone text not null default 'UTC';

create table agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  shape text not null,
  pinned boolean not null default false,
  unread boolean not null default false,
  created_at timestamptz not null default now()
);

create index agents_user_id_idx on agents(user_id, created_at);

create table messages (
  id bigint generated always as identity primary key,
  agent_id uuid not null references agents(id) on delete cascade,
  sender text not null check (sender in ('user', 'agent', 'event')),
  text text not null,
  -- What the agent did to its timers along with this message.
  timers jsonb,
  created_at timestamptz not null default now()
);

create index messages_agent_id_idx on messages(agent_id, id);

create table timers (
  agent_id uuid not null references agents(id) on delete cascade,
  id text not null,
  label text not null,
  seconds int not null,
  status text not null check (status in ('running', 'stopped', 'reset', 'done')),
  -- While running, when it runs out; otherwise how many milliseconds are left.
  ends_at timestamptz,
  remaining_ms int not null,
  primary key (agent_id, id)
);

create index timers_running_idx on timers(ends_at) where status = 'running';
