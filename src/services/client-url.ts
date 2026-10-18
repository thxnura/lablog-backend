import { env } from '../config/env.js';

/** Loopback or private-network host: the local Supabase stack on the dev Mac. */
function isLocalHost(host: string): boolean {
  return (
    host === 'localhost' ||
    host === '::1' ||
    host === '[::1]' ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

/**
 * Storage URLs (signed uploads, lecturer photo links) are built from
 * SUPABASE_URL. With the local stack that is the Mac's own address, which a
 * phone on another network (a phone hotspot at a demo) can't reach. The phone
 * reached this API somehow, so point the URL at the same host it used.
 * A hosted Supabase URL is left alone.
 */
export function forClient(url: string, requestHost: string | undefined): string {
  if (!requestHost || !isLocalHost(new URL(env.supabaseUrl).hostname)) return url;
  const u = new URL(url);
  u.hostname = requestHost;
  return u.toString();
}
