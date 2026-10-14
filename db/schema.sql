-- LabLog schema — run in Supabase SQL editor.
-- Students own their records; lecturers read submitted records.

create extension if not exists "pgcrypto";

-- ── Catalog ────────────────────────────────────────────────────────────────
create table if not exists labs (
  id    uuid primary key default gen_random_uuid(),
  name  text not null,
  code  text not null unique
);

create table if not exists experiments (
  id          uuid primary key default gen_random_uuid(),
  lab_id      uuid not null references labs(id) on delete cascade,
  title       text not null,
  description text
);

create table if not exists steps (
  id                    uuid primary key default gen_random_uuid(),
  experiment_id         uuid not null references experiments(id) on delete cascade,
  "order"               int  not null,
  title                 text not null,
  instruction           text,
  requires_photo        boolean not null default false,
  min_duration_seconds  int,
  -- precedence edges: steps that must be complete before this one unlocks
  prerequisite_step_ids uuid[] not null default '{}',
  -- step guide shown in the app: how-to sub-steps, safety note, expected result
  guide_steps           text[] not null default '{}',
  safety_note           text,
  expected_result       text
);

-- ── Records (synced from the app) ───────────────────────────────────────────
create table if not exists lab_records (
  id            uuid primary key,                 -- client-generated (idempotency)
  student_id    uuid not null references auth.users(id) on delete cascade,
  experiment_id uuid not null references experiments(id) on delete cascade,
  status        text not null default 'draft' check (status in ('draft','submitted')),
  latitude      double precision,
  longitude     double precision,
  created_at    timestamptz not null,
  submitted_at  timestamptz
);

create table if not exists step_completions (
  id           uuid primary key,
  record_id    uuid not null references lab_records(id) on delete cascade,
  step_id      uuid not null references steps(id) on delete cascade,
  completed_at timestamptz not null,
  note         text
);

create table if not exists observations (
  id        uuid primary key,
  record_id uuid not null references lab_records(id) on delete cascade,
  text      text not null
);

create table if not exists attachments (
  id           uuid primary key,
  record_id    uuid not null references lab_records(id) on delete cascade,
  step_id      uuid references steps(id) on delete set null,
  storage_path text not null
);

create index if not exists idx_experiments_lab on experiments(lab_id);
create index if not exists idx_steps_experiment on steps(experiment_id);
create index if not exists idx_records_experiment on lab_records(experiment_id);
create index if not exists idx_records_student on lab_records(student_id);

-- Storage bucket for photo evidence (also creatable from the dashboard):
-- insert into storage.buckets (id, name, public) values ('evidence','evidence',false)
--   on conflict do nothing;
