export async function renderStaff({ view, api, profile, esc, date, toast }) {
  if (!['SUPER_ADMIN', 'ADMIN'].includes(profile.role)) {
    view.innerHTML = '<h1>Staff accounts</h1><p role="alert">Your role cannot manage staff accounts.</p>'; return;
  }
  let offset = 0, directory;
  const roles = profile.role === 'SUPER_ADMIN' ? ['STAFF', 'ADMIN'] : ['STAFF'];
  view.innerHTML = `<div class="admin-page-heading"><div><p class="eyebrow">People & permissions</p><h1>Staff accounts</h1><p>Manage individual access and review account activity.</p></div></div>
    <section class="admin-card admin-section"><h2>Invite an employee</h2><p id="invite-readiness" class="admin-muted"></p>
      <form id="invite-form" class="admin-inline-form"><label>Full name<input name="fullName" minlength="2" maxlength="100" required></label><label>Sign-in email<input name="email" type="email" maxlength="254" required></label><label>Role<select name="role">${roles.map(r => `<option>${r}</option>`).join('')}</select></label><button type="submit" class="button button-primary">Send invitation</button></form>
    </section><form id="staff-filters" class="admin-filter"><label>Search name or notification email<input type="search" name="q" maxlength="100"></label><label>Role<select name="role"><option value="">All permitted roles</option>${(profile.role === 'SUPER_ADMIN' ? ['SUPER_ADMIN', 'ADMIN', 'STAFF'] : ['STAFF']).map(r => `<option>${r}</option>`).join('')}</select></label><label>Account status<select name="state"><option value="">All statuses</option><option>ACTIVE</option><option>DISABLED</option></select></label><button class="button button-outline" type="submit">Apply filters</button></form>
    <p id="staff-status" role="status" aria-live="polite"></p><div id="staff-directory"></div><div class="admin-actions"><button class="button button-outline" id="staff-prev">Previous</button><button class="button button-outline" id="staff-next">Next</button></div>
    <dialog class="admin-dialog staff-dialog" id="staff-detail" aria-labelledby="staff-detail-title"><div id="staff-detail-body"></div><button class="button button-outline" id="staff-close" type="button">Close</button></dialog>
    <dialog class="admin-dialog staff-dialog" id="staff-confirm" aria-labelledby="staff-confirm-title"><form method="dialog"><h2 id="staff-confirm-title">Confirm account action</h2><p id="staff-confirm-message" class="staff-confirm-message"></p><div class="admin-actions"><button class="button button-outline" value="cancel">Cancel</button><button class="button button-primary" value="confirm">Confirm action</button></div></form></dialog>`;
  const filters = view.querySelector('#staff-filters'), invite = view.querySelector('#invite-form');
  const status = view.querySelector('#staff-status'), dialog = view.querySelector('#staff-detail');
  const confirmation = view.querySelector('#staff-confirm');
  function confirmAction(message) {
    if (confirmation.open) return Promise.resolve(false);
    view.querySelector('#staff-confirm-message').textContent = message;
    confirmation.returnValue = ''; confirmation.showModal();
    return new Promise(resolve => confirmation.addEventListener('close', () => resolve(confirmation.returnValue === 'confirm'), { once: true }));
  }
  const badge = (value) => `<span class="admin-badge">${esc(value.replaceAll('_', ' '))}</span>`;
  const invitationText = (p) => `${badge(p.invitation.status)}${p.invitation.expiresAt ? `<small>Setup deadline: ${date(p.invitation.expiresAt)}</small>` : ''}`;
  async function load() {
    status.textContent = 'Loading staff accounts…';
    const params = new URLSearchParams(new FormData(filters)); params.set('offset', offset);
    directory = await api(`/api/admin/staff?${params}`);
    invite.querySelector('button[type="submit"]').disabled = !directory.invitationsEnabled;
    view.querySelector('#invite-readiness').textContent = directory.invitationsEnabled
      ? 'An individual invitation expires after one hour or earlier if Supabase expires it. No default password is created.'
      : 'Sending is disabled until the Supabase invite email template and exact redirect are configured and approved.';
    view.querySelector('#staff-directory').innerHTML = `<div class="admin-table-wrap"><table class="admin-table staff-table"><caption class="sr-only">Authorized staff directory</caption><thead><tr><th>Name</th><th>Notification email</th><th>Role</th><th>Account</th><th>Invitation</th><th>Last login</th><th>Details</th></tr></thead><tbody>${directory.staff.length ? directory.staff.map(p => `<tr><td>${esc(p.full_name || 'Unnamed account')}</td><td>${esc(p.notification_email)}</td><td>${badge(p.role)}</td><td>${badge(p.account_state)}</td><td>${invitationText(p)}</td><td>${date(p.last_login_at)}</td><td><button class="button button-outline" data-staff-id="${esc(p.id)}">${p.editable ? 'Manage' : 'View protected account'}</button></td></tr>`).join('') : '<tr><td colspan="7">No staff accounts match these filters.</td></tr>'}</tbody></table></div>`;
    status.textContent = `Showing ${directory.staff.length} account${directory.staff.length === 1 ? '' : 's'}${offset ? ` from ${offset + 1}` : ''}.`;
    view.querySelector('#staff-prev').disabled = offset === 0;
    view.querySelector('#staff-next').disabled = !directory.hasMore;
    view.querySelectorAll('[data-staff-id]').forEach(button => button.addEventListener('click', () => detail(button.dataset.staffId).catch(e => toast(e.message, true))));
  }
  async function detail(id) {
    const data = await api(`/api/admin/staff/${encodeURIComponent(id)}`), p = data.staff;
    const disabled = p.editable ? '' : 'disabled';
    view.querySelector('#staff-detail-body').innerHTML = `<h2 id="staff-detail-title">${esc(p.full_name || 'Staff account')}</h2><p>Sign-in email: ${esc(p.authEmail || 'Unavailable')}</p><p>${invitationText(p)}</p><p class="admin-muted">Notification email changes do not change the Supabase sign-in email.</p>${p.editable ? '' : '<p class="admin-callout">This account is protected from editing here. Super Admin accounts and your own account cannot be changed through staff management.</p>'}
      <form id="staff-edit" class="admin-form"><label>Full name<input name="fullName" value="${esc(p.full_name)}" minlength="2" maxlength="100" required ${disabled}></label><label>Notification email<input name="email" type="email" value="${esc(p.notification_email)}" maxlength="254" required ${disabled}></label><label>Role<select name="role" ${disabled}>${(p.editable ? roles : [p.role]).map(r => `<option ${r === p.role ? 'selected' : ''}>${r}</option>`).join('')}</select></label><label>Account status<select name="state" ${disabled}>${['ACTIVE', 'DISABLED'].map(s => `<option ${s === p.account_state ? 'selected' : ''}>${s}</option>`).join('')}</select></label>${p.editable ? '<button class="button button-primary" type="submit">Review and save changes</button>' : ''}<p id="staff-edit-status" role="status"></p></form>
      <h3>Recent activity</h3>${data.activity.length ? `<ul class="admin-list">${data.activity.map(a => `<li>${esc(a.action.replaceAll('_', ' '))}<small>${date(a.created_at)}</small></li>`).join('')}</ul>` : '<p>No recorded activity.</p>'}`;
    if (!dialog.open) dialog.showModal();
    view.querySelector('#staff-edit').addEventListener('submit', async event => {
      event.preventDefault(); if (!p.editable) return;
      const form = event.currentTarget; if (!form.reportValidity()) return;
      const nextRole = form.elements.role.value, nextState = form.elements.state.value;
      if (!await confirmAction(`Save changes for ${p.full_name}?\nRole: ${p.role} → ${nextRole}\nAccess: ${p.account_state} → ${nextState}\nExisting application sessions will be revoked. Notification email is separate from sign-in email.`)) return;
      const button = form.querySelector('button'); button.disabled = true;
      try {
        const result = await api('/api/admin/staff/update', { method: 'POST', body: JSON.stringify({ userId: p.id, fullName: form.elements.fullName.value, email: form.elements.email.value, role: nextRole, accountState: nextState, confirm: true }) });
        if (result.updated !== true) throw new Error('The account update was not confirmed. Refresh the directory before retrying.');
        dialog.close(); await load(); toast('Staff changes saved. Existing application sessions were revoked.');
      } catch (error) { form.querySelector('#staff-edit-status').textContent = error.message; button.disabled = false; }
    });
  }
  invite.addEventListener('submit', async event => {
    event.preventDefault(); if (!invite.reportValidity() || !directory.invitationsEnabled) return;
    const body = Object.fromEntries(new FormData(invite));
    if (!await confirmAction(`Invite ${body.email} as ${body.role}? This grants the selected role after identity verification. No Super Admin role can be invited.`)) return;
    const button = invite.querySelector('button'); button.disabled = true; button.textContent = 'Requesting invitation…';
    try { const result = await api('/api/admin/staff/invite', { method: 'POST', body: JSON.stringify({ ...body, confirm: true }) }); if (result.invited !== true) throw new Error('The invitation was not confirmed. Review the directory before retrying.'); invite.reset(); await load(); toast(result.message); }
    catch (error) { toast(error.message, true); }
    finally { button.disabled = !directory.invitationsEnabled; button.textContent = 'Send invitation'; }
  });
  filters.addEventListener('submit', event => { event.preventDefault(); offset = 0; load().catch(e => { status.textContent = e.message; }); });
  view.querySelector('#staff-prev').addEventListener('click', () => { offset = Math.max(0, offset - 25); load().catch(e => toast(e.message, true)); });
  view.querySelector('#staff-next').addEventListener('click', () => { offset += 25; load().catch(e => toast(e.message, true)); });
  view.querySelector('#staff-close').addEventListener('click', () => dialog.close());
  await load();
}
