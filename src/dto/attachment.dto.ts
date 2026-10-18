import { z } from 'zod';
import { uuid } from './sync.dto.js';

/** Request a signed upload URL for a photo before syncing a record. */
export const signUploadSchema = z.object({
  recordId: uuid(),
  attachmentId: uuid(),
  contentType: z.string().default('image/jpeg'),
});

export type SignUploadRequest = z.infer<typeof signUploadSchema>;
