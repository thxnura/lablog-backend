import { supabaseAdmin } from '../config/supabase.js';
import { HttpError } from '../middleware/errorHandler.js';

/** Read-only access to the lab/experiment/step catalog. */
export const catalogRepository = {
  async listLabs() {
    const { data, error } = await supabaseAdmin
      .from('labs')
      .select('id, name, code, created_by')
      .order('name');
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  /** Lab ids a student is enrolled in (ADR-029). */
  async enrolledLabIds(studentId: string): Promise<Set<string>> {
    const { data, error } = await supabaseAdmin.from('lab_enrolments').select('lab_id').eq('student_id', studentId);
    if (error) throw new HttpError(500, error.message);
    return new Set((data ?? []).map((r) => r.lab_id as string));
  },

  async listExperiments(labId: string) {
    const { data, error } = await supabaseAdmin
      .from('experiments')
      .select('id, lab_id, title, description')
      .eq('lab_id', labId)
      .order('title');
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async getExperimentWithSteps(experimentId: string) {
    const { data, error } = await supabaseAdmin
      .from('experiments')
      .select(
        'id, lab_id, title, description, steps(id, experiment_id, "order", title, instruction, requires_photo, min_duration_seconds, prerequisite_step_ids, guide_steps, safety_note, expected_result)',
      )
      .eq('id', experimentId)
      .single();
    if (error) throw new HttpError(404, 'Experiment not found');
    return data;
  },
};
