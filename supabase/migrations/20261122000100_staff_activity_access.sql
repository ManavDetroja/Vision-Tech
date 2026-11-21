-- Prompt 7: additive restriction only. Requires explicit approval before remote apply.
-- Existing permissive activity policies allow an actor to read their old activity
-- even after deactivation. Keep their scope, but require an active profile too.
create policy activity_requires_active_account
on public.admin_activity as restrictive for select to authenticated
using (public.is_active_account());
