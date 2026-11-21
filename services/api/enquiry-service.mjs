import { sb } from './supabase.mjs';
import { HttpError } from './http.mjs';

export async function saveEnquiry(payload, key, rateHash) {
  const result = await sb('/rest/v1/rpc/submit_public_enquiry', { method: 'POST', service: true,
    body: { p_payload: payload, p_idempotency_key: key, p_rate_hash: rateHash } });
  if (result?.accepted !== true || typeof result.enquiryCode !== 'string' || !result.enquiryCode
      || !Number.isFinite(Date.parse(result.createdAt))) {
    throw new HttpError(502, 'DATABASE_UNAVAILABLE', 'The database did not confirm that the enquiry was saved.');
  }
  return result;
}
