-- 004: lecturers create labs and choose which students can do them (ADR-029).
-- A lab a lecturer creates (created_by set) is visible only to the students
-- enrolled in it; the seeded course labs (created_by null) stay open to all.
alter table labs add column if not exists created_by uuid references auth.users(id) on delete set null;

create table if not exists lab_enrolments (
  lab_id     uuid not null references labs(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  primary key (lab_id, student_id)
);
create index if not exists idx_enrolments_student on lab_enrolments(student_id);

-- Like every table (003): reached only through the API's service role.
alter table lab_enrolments enable row level security;
