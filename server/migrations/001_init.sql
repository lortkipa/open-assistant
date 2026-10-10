create extension if not exists citext;

create table users (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  name text,
  avatar_url text,
  google_sub text unique,
  created_at timestamptz not null default now()
);

create table email_codes (
  email citext primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  last_sent_at timestamptz not null default now()
);

create table sessions (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

create index sessions_user_id_idx on sessions(user_id);
