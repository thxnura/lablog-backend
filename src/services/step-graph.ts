import { HttpError } from '../middleware/errorHandler.js';
import type { NewStep } from '../dto/manage.dto.js';

/**
 * Validates a new experiment's step graph on the server, as the app's
 * StepConstraintEngine does for the catalog: every prerequisite must name
 * another step of the experiment, and the graph must have no cycle (Kahn's
 * algorithm: repeatedly take the steps whose prerequisites are all placed;
 * anything never placed is on a cycle). Throws 422 with a readable reason.
 */
export function validateStepGraph(steps: NewStep[]): void {
  const n = steps.length;
  steps.forEach((step, index) => {
    const order = index + 1;
    for (const p of step.prerequisites) {
      if (p < 1 || p > n) throw new HttpError(422, `Step ${order} depends on step ${p}, which doesn't exist`);
      if (p === order) throw new HttpError(422, `Step ${order} can't depend on itself`);
    }
  });

  const remaining = new Map(steps.map((s, i) => [i + 1, new Set(s.prerequisites)]));
  const placed = new Set<number>();
  let progressed = true;
  while (remaining.size && progressed) {
    progressed = false;
    for (const [order, prerequisites] of remaining) {
      if ([...prerequisites].every((p) => placed.has(p))) {
        placed.add(order);
        remaining.delete(order);
        progressed = true;
      }
    }
  }
  if (remaining.size) {
    const cycle = [...remaining.keys()].sort((a, b) => a - b).join(', ');
    throw new HttpError(422, `Steps ${cycle} depend on each other in a loop`);
  }
}
