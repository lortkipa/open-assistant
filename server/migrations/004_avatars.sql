-- Photos the user uploads in Settings. Each upload is a new row (so it can be cached forever),
-- and users.avatar_url points at it as /me/avatar/<id>.
create table avatars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null,
  data bytea not null,
  created_at timestamptz not null default now()
);

create index avatars_user_id_idx on avatars(user_id);
