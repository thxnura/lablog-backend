-- 002: step guides (how-to sub-steps, safety note, expected result).
-- For databases created before these columns were added to schema.sql.
alter table steps add column if not exists guide_steps     text[] not null default '{}';
alter table steps add column if not exists safety_note     text;
alter table steps add column if not exists expected_result text;
