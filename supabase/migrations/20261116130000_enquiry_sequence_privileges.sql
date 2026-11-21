-- Pending explicit staging approval. No application data or sequence values change.
-- Enquiry numbering runs inside the postgres-owned SECURITY DEFINER RPC.
-- Client and service roles need EXECUTE on that RPC, not direct sequence access.
revoke all privileges on sequence public.enquiry_number_seq from public, anon, authenticated, service_role;
-- Recovery, only if separately approved: restore the exact previous ACL documented
-- in docs/ENQUIRY_SEQUENCE_PERMISSION_REVIEW.md. Never reset the sequence value.
