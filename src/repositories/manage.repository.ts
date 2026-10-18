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
