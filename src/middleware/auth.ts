import type { NextFunction, Request, Response } from 'express';
import { supabaseForToken } from '../config/supabase.js';
import { HttpError } from './errorHandler.js';

export type Role = 'student' | 'lecturer';

export interface AuthedRequest extends Request {
  user?: { id: string; email?: string; role: Role };
}

/**
 * Verifies the Bearer JWT issued by Supabase Auth and attaches the user to the
 * request. Downstream handlers scope queries to `req.user.id`.
 *
 * The role comes from `app_metadata.role`, which only the service role can
 * set — a student can't promote themselves (unlike `user_metadata`).
 */
export async function requireAuth(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction,
) {
  try {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new HttpError(401, 'Missing bearer token');

    const { data, error } = await supabaseForToken(token).auth.getUser();
    if (error || !data.user) throw new HttpError(401, 'Invalid or expired token');

    const role: Role = data.user.app_metadata?.role === 'lecturer' ? 'lecturer' : 'student';
    req.user = { id: data.user.id, email: data.user.email ?? undefined, role };
    next();
  } catch (err) {
    next(err);
  }
}

/** Allows the request through only for the given role (403 otherwise). */
export function requireRole(role: Role) {
  return (req: AuthedRequest, _res: Response, next: NextFunction) => {
    if (req.user?.role !== role) {
      return next(new HttpError(403, `Only a ${role} can do this`));
    }
    next();
  };
}
