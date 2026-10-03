import type { NextFunction, Request, Response } from 'express';
import { supabaseForToken } from '../config/supabase.js';
import { HttpError } from './errorHandler.js';

export interface AuthedRequest extends Request {
  user?: { id: string; email?: string };
}

/**
 * Verifies the Bearer JWT issued by Supabase Auth and attaches the user to the
 * request. Downstream handlers scope queries to `req.user.id`.
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

    req.user = { id: data.user.id, email: data.user.email ?? undefined };
    next();
  } catch (err) {
    next(err);
  }
}
