import { z } from 'zod';

/** Request a signed upload URL for a photo before syncing a record. */
export const signUploadSchema = z.object({
  recordId: z.string().uuid(),
  attachmentId: z.string().uuid(),
  contentType: z.string().default('image/jpeg'),
});

export type SignUploadRequest = z.infer<typeof signUploadSchema>;
