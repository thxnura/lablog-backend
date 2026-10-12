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

-- Second experiment in the same lab: a branching DAG. Steps 1 and 2 can be
-- done in either order; Step 4 needs BOTH Step 1 and Step 3 (multi-parent).
insert into experiments (id, lab_id, title, description) values
  ('22222222-2222-2222-2222-222222222223',
   '11111111-1111-1111-1111-111111111111',
   'Acid–Base Titration',
   'Find the concentration of an HCl solution by titrating against 0.10 M NaOH.')
on conflict (id) do nothing;

insert into steps (id, experiment_id, "order", title, instruction, requires_photo, min_duration_seconds, prerequisite_step_ids) values
  ('33333333-0000-0000-0001-000000000001',
   '22222222-2222-2222-2222-222222222223', 1,
   'Rinse and fill the burette', 'Rinse with NaOH, fill, and record the initial reading.',
   false, null, '{}'),

  ('33333333-0000-0000-0001-000000000002',
   '22222222-2222-2222-2222-222222222223', 2,
   'Pipette the acid', 'Transfer 25.0 mL of HCl into a clean conical flask.',
   false, null, '{}'),

  ('33333333-0000-0000-0001-000000000003',
   '22222222-2222-2222-2222-222222222223', 3,
   'Add indicator', 'Add 3 drops of phenolphthalein to the flask.',
   false, null, array['33333333-0000-0000-0001-000000000002']::uuid[]),

  ('33333333-0000-0000-0001-000000000004',
   '22222222-2222-2222-2222-222222222223', 4,
   'Titrate to the endpoint', 'Add NaOH dropwise until a faint permanent pink. Photograph the endpoint.',
   true, null, array['33333333-0000-0000-0001-000000000001', '33333333-0000-0000-0001-000000000003']::uuid[]),

  ('33333333-0000-0000-0001-000000000005',
   '22222222-2222-2222-2222-222222222223', 5,
   'Repeat for concordant titres', 'Repeat until two titres agree within 0.10 mL.',
   false, null, array['33333333-0000-0000-0001-000000000004']::uuid[])
on conflict (id) do nothing;

-- Second lab: a physics practical with a short timer guard.
insert into labs (id, name, code) values
  ('11111111-1111-1111-1111-111111111112', 'Physics Lab', 'PHYS101')
on conflict (id) do nothing;

insert into experiments (id, lab_id, title, description) values
  ('22222222-2222-2222-2222-222222222224',
   '11111111-1111-1111-1111-111111111112',
   'Simple Pendulum',
   'Measure the period of a simple pendulum and estimate g.')
on conflict (id) do nothing;

insert into steps (id, experiment_id, "order", title, instruction, requires_photo, min_duration_seconds, prerequisite_step_ids) values
  ('33333333-0000-0000-0002-000000000001',
   '22222222-2222-2222-2222-222222222224', 1,
   'Measure the string length', 'Measure from the clamp to the centre of the bob.',
   false, null, '{}'),

  ('33333333-0000-0000-0002-000000000002',
   '22222222-2222-2222-2222-222222222224', 2,
   'Set up and photograph the rig', 'Clamp the pendulum and photograph the setup with the ruler visible.',
   true, null, array['33333333-0000-0000-0002-000000000001']::uuid[]),

  ('33333333-0000-0000-0002-000000000003',
   '22222222-2222-2222-2222-222222222224', 3,
   'Time 20 oscillations', 'Release from a small angle and time 20 full swings.',
   false, 30, array['33333333-0000-0000-0002-000000000002']::uuid[]),

  ('33333333-0000-0000-0002-000000000004',
   '22222222-2222-2222-2222-222222222224', 4,
   'Repeat at two more lengths', 'Shorten the string twice and repeat the timing.',
   false, null, array['33333333-0000-0000-0002-000000000003']::uuid[])
on conflict (id) do nothing;
