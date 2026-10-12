import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { HttpError } from '../middleware/errorHandler.js';

export const attachmentRepository = {
  /**
   * Create a time-limited signed URL the app uses to PUT a photo to Storage.
   * `upsert` lets a retried upload (app crashed after the PUT but before it
   * recorded success) overwrite the same deterministic path instead of 409ing.
   */
  async createSignedUploadUrl(path: string) {
    const { data, error } = await supabaseAdmin.storage
      .from(env.storageBucket)
      .createSignedUploadUrl(path, { upsert: true });
    if (error) throw new HttpError(500, error.message);
    return data; // { signedUrl, token, path }
  },

  /** Signed download URL so the lecturer view can display evidence. */
  async createSignedDownloadUrl(path: string, expiresIn = 3600) {
    const { data, error } = await supabaseAdmin.storage
      .from(env.storageBucket)
      .createSignedUrl(path, expiresIn);
    if (error) throw new HttpError(500, error.message);
    return data.signedUrl;
  },
};
