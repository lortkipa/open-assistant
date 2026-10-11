-- Reminders an agent sets: at that time the server wakes the agent so it texts the user.
-- Times are the user's wall-clock time in a zone, so "every day at 9:00" stays at 9:00 across DST.
create table reminders (
  agent_id uuid not null references agents on delete cascade,
  id text not null,
  -- Written by the agent for itself: what to tell the user when it's due.
  note text not null,
  repeat text not null default 'none' check (repeat in ('none', 'daily', 'weekdays', 'weekly', 'monthly', 'yearly')),
  -- The first time ('YYYY-MM-DDTHH:MM'); monthly and yearly ones keep its day (the 31st, or Feb 29).
  anchor text not null,
  -- The next time (or the last one, once done or cancelled).
  local_at text not null,
  time_zone text not null,
  -- local_at in UTC while pending.
  fires_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'done', 'cancelled')),
  created_at timestamptz not null default now(),
  primary key (agent_id, id)
);

create index reminders_pending_idx on reminders (fires_at) where status = 'pending';

-- What an agent did to its reminders along with a message, like messages.timers.
alter table messages add column reminders jsonb;
