import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { HttpError } from '../middleware/errorHandler.js';
import type { CreateExperiment, CreateLab } from '../dto/manage.dto.js';

/** Lecturer writes to the catalog, and lab enrolments (ADR-029). */
export const manageRepository = {
  /** Every lab with its experiment ids and enrolled students. */
  async listLabs() {
    const { data, error } = await supabaseAdmin
      .from('labs')
      .select('id, name, code, created_by, experiments(id), lab_enrolments(student_id)')
      .order('name');
    if (error) throw new HttpError(500, error.message);
    return (data ?? []) as {
      id: string;
      name: string;
      code: string;
      created_by: string | null;
      experiments: { id: string }[];
      lab_enrolments: { student_id: string }[];
    }[];
  },

  async createLab(lecturerId: string, lab: CreateLab) {
    const { data, error } = await supabaseAdmin
      .from('labs')
      .insert({ name: lab.name, code: lab.code, created_by: lecturerId })
      .select('id, name, code')
      .single();
    if (error?.code === '23505') throw new HttpError(409, `A lab with the code ${lab.code} already exists`);
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async labExists(labId: string) {
    const { data, error } = await supabaseAdmin.from('labs').select('id').eq('id', labId).maybeSingle();
    if (error) throw new HttpError(500, error.message);
    return !!data;
  },

  /** Inserts the experiment and its steps; prerequisites by step number become step ids. */
  async createExperiment(labId: string, experiment: CreateExperiment) {
    const experimentId = randomUUID();
    const stepIds = experiment.steps.map(() => randomUUID());
    const { error } = await supabaseAdmin.from('experiments').insert({
      id: experimentId,
      lab_id: labId,
      title: experiment.title,
      description: experiment.description || null,
    });
    if (error) throw new HttpError(500, error.message);

    const { error: stepsError } = await supabaseAdmin.from('steps').insert(
      experiment.steps.map((step, index) => ({
        id: stepIds[index],
        experiment_id: experimentId,
        order: index + 1,
        title: step.title,
        instruction: step.instruction || null,
        requires_photo: step.requiresPhoto,
        min_duration_seconds: step.minDurationSeconds ?? null,
        prerequisite_step_ids: step.prerequisites.map((p) => stepIds[p - 1]),
      })),
    );
    if (stepsError) {
      await supabaseAdmin.from('experiments').delete().eq('id', experimentId); // no half-made experiment
      throw new HttpError(500, stepsError.message);
    }
    return experimentId;
  },

  /**
   * Edits an experiment in place. Steps keep their ids (and so the students'
   * completions and photos on them); new steps get ids; a step left out is
   * deleted, unless a student has completed it, which would delete their work.
   */
  async updateExperiment(experimentId: string, experiment: CreateExperiment) {
    const { data: existing, error } = await supabaseAdmin
      .from('steps')
      .select('id, order')
      .eq('experiment_id', experimentId);
    if (error) throw new HttpError(500, error.message);
    const existingIds = new Set((existing ?? []).map((s) => s.id as string));
    for (const step of experiment.steps) {
      if (step.id && !existingIds.has(step.id)) throw new HttpError(422, 'A step id belongs to another experiment');
    }
    const kept = new Set(experiment.steps.flatMap((s) => (s.id ? [s.id] : [])));
    const removed = [...existingIds].filter((id) => !kept.has(id));
    if (removed.length) {
      const { data: work, error: workError } = await supabaseAdmin
        .from('step_completions')
        .select('step_id')
        .in('step_id', removed)
        .limit(1);
      if (workError) throw new HttpError(500, workError.message);
      if (work?.length) {
        const order = existing?.find((s) => s.id === work[0].step_id)?.order;
        throw new HttpError(409, `Step ${order} has students' work on it, so it can't be removed`);
      }
    }

    const stepIds = experiment.steps.map((s) => s.id ?? randomUUID());
    const { error: updateError } = await supabaseAdmin
      .from('experiments')
      .update({ title: experiment.title, description: experiment.description || null })
      .eq('id', experimentId);
    if (updateError) throw new HttpError(500, updateError.message);

    // Upsert touches only these columns, so a step's guide stays as it was.
    const { error: stepsError } = await supabaseAdmin.from('steps').upsert(
      experiment.steps.map((step, index) => ({
        id: stepIds[index],
        experiment_id: experimentId,
        order: index + 1,
        title: step.title,
        instruction: step.instruction || null,
        requires_photo: step.requiresPhoto,
        min_duration_seconds: step.minDurationSeconds ?? null,
        prerequisite_step_ids: step.prerequisites.map((p) => stepIds[p - 1]),
      })),
      { onConflict: 'id' },
    );
    if (stepsError) throw new HttpError(500, stepsError.message);
    if (removed.length) {
      const { error: deleteError } = await supabaseAdmin.from('steps').delete().in('id', removed);
      if (deleteError) throw new HttpError(500, deleteError.message);
    }
  },

  async experimentExists(experimentId: string) {
    const { data, error } = await supabaseAdmin.from('experiments').select('id').eq('id', experimentId).maybeSingle();
    if (error) throw new HttpError(500, error.message);
    return !!data;
  },

  /** Replaces a lab's enrolment with exactly these students. */
  async setEnrolment(labId: string, studentIds: string[]) {
    const { error } = await supabaseAdmin.from('lab_enrolments').delete().eq('lab_id', labId);
    if (error) throw new HttpError(500, error.message);
    if (!studentIds.length) return;
    const { error: insertError } = await supabaseAdmin
      .from('lab_enrolments')
      .insert(studentIds.map((student_id) => ({ lab_id: labId, student_id })));
    if (insertError) throw new HttpError(422, insertError.message);
  },

  /** Student accounts (not lecturers), from Supabase Auth. */
  async listStudents() {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw new HttpError(500, error.message);
    return data.users
      .filter((u) => u.app_metadata?.role !== 'lecturer')
      .map((u) => ({ id: u.id, email: u.email ?? '' }))
      .sort((a, b) => a.email.localeCompare(b.email));
  },
};
