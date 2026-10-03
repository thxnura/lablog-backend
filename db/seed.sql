-- Seed one lab + one experiment + four ordered steps that exercise every
-- constraint type: precedence, requires_photo, and a min-duration timer.

insert into labs (id, name, code) values
  ('11111111-1111-1111-1111-111111111111', 'Organic Chemistry Lab', 'CHEM201')
on conflict (id) do nothing;

insert into experiments (id, lab_id, title, description) values
  ('22222222-2222-2222-2222-222222222222',
   '11111111-1111-1111-1111-111111111111',
   'Recrystallisation of Benzoic Acid',
   'Purify an impure benzoic acid sample by recrystallisation.')
on conflict (id) do nothing;

-- Step order: 1 -> 2 -> 3 -> 4. Step 3 has a 5-min dissolve timer.
-- Step 4 requires a photo of the final crystals.
insert into steps (id, experiment_id, "order", title, instruction, requires_photo, min_duration_seconds, prerequisite_step_ids) values
  ('33333333-0000-0000-0000-000000000001',
   '22222222-2222-2222-2222-222222222222', 1,
   'Weigh the impure sample', 'Record the starting mass of impure benzoic acid.',
   false, null, '{}'),

  ('33333333-0000-0000-0000-000000000002',
   '22222222-2222-2222-2222-222222222222', 2,
   'Add hot solvent', 'Add minimum boiling water to dissolve the sample.',
   false, null, array['33333333-0000-0000-0000-000000000001']::uuid[]),

  ('33333333-0000-0000-0000-000000000003',
   '22222222-2222-2222-2222-222222222222', 3,
   'Allow to dissolve (5 min)', 'Keep near boiling until fully dissolved.',
   false, 300, array['33333333-0000-0000-0000-000000000002']::uuid[]),

  ('33333333-0000-0000-0000-000000000004',
   '22222222-2222-2222-2222-222222222222', 4,
   'Cool and photograph crystals', 'Cool slowly, then photograph the crystals formed.',
   true, null, array['33333333-0000-0000-0000-000000000003']::uuid[])
on conflict (id) do nothing;
