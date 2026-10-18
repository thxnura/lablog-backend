-- 003: lock the tables for hosting. A hosted Supabase project exposes the public
-- schema over its REST API to anyone with the anon key, and that key ships inside
-- the app. The app never reads tables directly: everything goes through the
-- Express API, which uses the service role and so bypasses RLS. RLS on with no
-- policies therefore blocks direct access without changing the API.
alter table labs             enable row level security;
alter table experiments      enable row level security;
alter table steps            enable row level security;
alter table lab_records      enable row level security;
alter table step_completions enable row level security;
alter table observations     enable row level security;
alter table attachments      enable row level security;

-- The private bucket for photo evidence (uploads and reads use signed URLs only).
insert into storage.buckets (id, name, public) values ('evidence', 'evidence', false)
  on conflict (id) do nothing;
