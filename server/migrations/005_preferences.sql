-- Preferences from Settings → General. They live on the account, so they follow the user to every device.
alter table users
  add column theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  add column accent text not null default 'bot' check (accent in ('bot', 'neutral')),
  add column language text not null default 'en' check (language in ('en', 'ka')),
  add column spellcheck boolean not null default true;
