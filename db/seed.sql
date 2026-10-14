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

-- Step guides (how-to sub-steps, safety note, expected result).
update steps set guide_steps = array['Tare the balance with a clean, dry weighing boat.', 'Add about 2 g of the impure benzoic acid.', 'Record the mass to 0.01 g in your observations.'],
  safety_note = 'Benzoic acid irritates the eyes, so keep your goggles on.',
  expected_result = 'A steady reading of roughly 2.00 g.'
  where id = '33333333-0000-0000-0000-000000000001';
update steps set guide_steps = array['Heat distilled water to boiling on the hot plate.', 'Add hot water a few mL at a time to the sample in a conical flask, swirling between additions.', 'Stop as soon as the solid dissolves. Extra solvent lowers your yield.'],
  safety_note = 'Hot glassware: handle it with tongs or a heat-proof glove.',
  expected_result = 'A clear, colourless solution with no solid left.'
  where id = '33333333-0000-0000-0000-000000000002';
update steps set guide_steps = array['Keep the flask just below boiling on the hot plate.', 'Swirl gently about once a minute.', 'If insoluble specks remain, filter the solution while it is still hot.'],
  safety_note = 'Never stopper or seal a heated flask.',
  expected_result = 'The sample is fully dissolved after five minutes.'
  where id = '33333333-0000-0000-0000-000000000003';
update steps set guide_steps = array['Let the flask cool to room temperature without disturbing it.', 'Then cool it in an ice bath for 10 minutes.', 'Photograph the crystals against a dark background.'],
  safety_note = null,
  expected_result = 'Shiny white crystals, needle- or plate-shaped.'
  where id = '33333333-0000-0000-0000-000000000004';
update steps set guide_steps = array['Rinse the burette twice with a little NaOH, draining it through the tap.', 'Fill it with 0.10 M NaOH using a funnel, then take the funnel out.', 'Run a little solution out to clear the air bubble from the tip.', 'Read the bottom of the meniscus at eye level.'],
  safety_note = 'NaOH is corrosive. Wear goggles and rinse any spill with plenty of water.',
  expected_result = 'No air in the tip, and an initial reading recorded to 0.05 mL.'
  where id = '33333333-0000-0000-0001-000000000001';
update steps set guide_steps = array['Rinse the pipette with a little of the HCl.', 'Fill it to the line with a pipette filler.', 'Let it drain into the flask, then touch the tip against the glass.'],
  safety_note = 'Always use a pipette filler. Never pipette by mouth.',
  expected_result = 'Exactly 25.0 mL of acid in the flask.'
  where id = '33333333-0000-0000-0001-000000000002';
update steps set guide_steps = array['Add 3 drops of phenolphthalein.', 'Swirl to mix.', 'Stand the flask on a white tile under the burette.'],
  safety_note = null,
  expected_result = 'The solution stays colourless, because it is still acidic.'
  where id = '33333333-0000-0000-0001-000000000003';
update steps set guide_steps = array['Run in NaOH quickly while swirling, until the pink takes longer to fade.', 'Slow down to drop by drop.', 'Stop at the first faint pink that lasts 30 seconds.', 'Photograph the endpoint, then record the final burette reading.'],
  safety_note = 'Close the tap before you move the flask.',
  expected_result = 'A pale pink colour that persists for 30 seconds.'
  where id = '33333333-0000-0000-0001-000000000004';
update steps set guide_steps = array['Refill the burette and rinse the flask with distilled water.', 'Repeat Steps 2 to 4.', 'Stop when two titres agree within 0.10 mL.'],
  safety_note = null,
  expected_result = 'Two concordant titres, for example 24.60 and 24.55 mL.'
  where id = '33333333-0000-0000-0001-000000000005';
update steps set guide_steps = array['Clamp the string so the bob hangs freely.', 'Measure from the pivot to the centre of the bob with a metre rule.', 'Record the length in metres, to the nearest millimetre.'],
  safety_note = null,
  expected_result = 'A length between about 0.50 and 1.00 m.'
  where id = '33333333-0000-0000-0002-000000000001';
update steps set guide_steps = array['Fix the clamp stand to the bench with a G-clamp.', 'Stand the ruler behind the pendulum.', 'Photograph the whole rig with the ruler markings readable.'],
  safety_note = 'Clamp the stand firmly so it can''t tip over.',
  expected_result = 'A clear photo showing the clamp, string, bob and ruler.'
  where id = '33333333-0000-0000-0002-000000000002';
update steps set guide_steps = array['Pull the bob aside to an angle under 10°.', 'Release it without pushing, and start timing as it passes the centre.', 'Count 20 full swings (there and back), then stop the timer.'],
  safety_note = 'Keep your face clear of the swinging bob.',
  expected_result = 'About 28 s for a 0.50 m string (a period of about 1.4 s).'
  where id = '33333333-0000-0000-0002-000000000003';
update steps set guide_steps = array['Shorten the string by about 20 cm.', 'Re-measure the length and time 20 swings again.', 'Repeat for a third length.'],
  safety_note = null,
  expected_result = 'Shorter strings give shorter periods (T is proportional to √L).'
  where id = '33333333-0000-0000-0002-000000000004';
