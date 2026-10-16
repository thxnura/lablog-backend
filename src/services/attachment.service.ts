import { attachmentRepository } from '../repositories/attachment.repository.js';
import type { SignUploadRequest } from '../dto/attachment.dto.js';
import { forClient } from './client-url.js';

export const attachmentService = {
  /** Deterministic path keeps retries idempotent: record/<id>/<attachmentId>. */
  async signUpload(req: SignUploadRequest, requestHost?: string) {
    const ext = req.contentType === 'image/png' ? 'png' : 'jpg';
    const path = `records/${req.recordId}/${req.attachmentId}.${ext}`;
    const signed = await attachmentRepository.createSignedUploadUrl(path);
    return { ...signed, signedUrl: forClient(signed.signedUrl, requestHost), storagePath: path };
  },

  async getDownloadUrl(path: string, requestHost?: string) {
    return forClient(await attachmentRepository.createSignedDownloadUrl(path), requestHost);
  },
};
