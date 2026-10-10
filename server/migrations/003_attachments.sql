-- Files the user attaches. An upload belongs to the user until a message claims it;
-- uploads never sent are swept after a day.
create table attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  agent_id uuid references agents(id) on delete cascade,
  message_id bigint references messages(id) on delete cascade,
  -- Order within the message, as the user attached them.
  position int,
  name text not null,
  type text not null,
  size int not null,
  data bytea not null,
  -- The copy uploaded to OpenAI (images and PDFs), so each call refers to it instead of resending it.
  openai_file_id text,
  created_at timestamptz not null default now()
);

create index attachments_message_id_idx on attachments(message_id);
create index attachments_unclaimed_idx on attachments(created_at) where message_id is null;
