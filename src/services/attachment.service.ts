import { attachmentRepository } from '../repositories/attachment.repository.js';
import type { SignUploadRequest } from '../dto/attachment.dto.js';

export const attachmentService = {
  /** Deterministic path keeps retries idempotent: record/<id>/<attachmentId>. */
  async signUpload(req: SignUploadRequest) {
    const ext = req.contentType === 'image/png' ? 'png' : 'jpg';
    const path = `records/${req.recordId}/${req.attachmentId}.${ext}`;
    const signed = await attachmentRepository.createSignedUploadUrl(path);
    return { ...signed, storagePath: path };
  },

  getDownloadUrl: (path: string) =>
    attachmentRepository.createSignedDownloadUrl(path),
};
