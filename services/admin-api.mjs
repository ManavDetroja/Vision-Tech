import { config, missingConfig } from './api/config.mjs';
import { roles, statuses, enquiryTypes } from './api/constants.mjs';
import { reply, readJson, sameOrigin, handleError } from './api/http.mjs';
import { sb, supabaseHeaders } from './api/supabase.mjs';
import { actorFor } from './api/auth.mjs';
import { authRoutes } from './api/auth-routes.mjs';
import { invitationRoutes } from './api/invitation-routes.mjs';
import { staffRoutes } from './api/staff-routes.mjs';
import { routePermission } from './api/permissions.mjs';
import { recordDenied } from './api/audit.mjs';
import { publicRoutes } from './api/public-routes.mjs';
import { validateEnquiry } from './api/validation.mjs';
import { createServer } from 'node:http';

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && origin === config.appOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Vary', 'Origin');
  }
}
function html(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
async function setEmailStatus(id, status, providerId = null, error = null) {
  return sb('/rest/v1/rpc/admin_set_email_delivery', { method: 'POST', service: true, body: { p_outbox_id: id, p_status: status, p_provider_id: providerId, p_error: error } });
}
async function sendOutbox(id) {
  const rows = await sb(`/rest/v1/email_outbox?id=eq.${encodeURIComponent(id)}&select=id,enquiry_id,recipient_ids,status`, { service: true });
  const outbox = rows?.[0]; if (!outbox) throw new Error('Notification record not found.');
  if (outbox.status === 'SENT') return { accepted: true, alreadySent: true };
  if (!config.resendKey || !config.emailFrom || !config.enquiryNotificationEmail || !config.adminUrl) {
    await setEmailStatus(id, 'FAILED', null, 'Email provider or notification settings are not configured.');
    return { accepted: false };
  }
  const ids = outbox.recipient_ids || [];
  const profiles = ids.length ? await sb(`/rest/v1/profiles?id=in.(${ids.join(',')})&select=notification_email`, { service: true }) : [];
  const recipients = [...new Set(profiles.map((row) => String(row.notification_email || '').trim().toLowerCase()).filter((email) => email && email !== config.enquiryNotificationEmail))];
  const rowsForEnquiry = await sb(`/rest/v1/enquiries?id=eq.${encodeURIComponent(outbox.enquiry_id)}&select=enquiry_code,customer_name,enquiry_type,product_model,customer_message,created_at`, { service: true });
  const enquiry = rowsForEnquiry?.[0];
  if (!enquiry) { await setEmailStatus(id, 'FAILED', null, 'Enquiry record is unavailable.'); return { accepted: false }; }
  let emailResponse;
  try {
    emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${config.resendKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `visiontech-enquiry-${outbox.id}` },
    body: JSON.stringify({
      from: config.emailFrom, to: [config.enquiryNotificationEmail], ...(recipients.length ? { bcc: recipients } : {}), subject: `New enquiry ${enquiry.enquiry_code}`,
      html: `<h1>New customer enquiry</h1><p><strong>ID:</strong> ${html(enquiry.enquiry_code)}</p><p><strong>Name:</strong> ${html(enquiry.customer_name)}</p><p><strong>Category:</strong> ${html(enquiry.enquiry_type)}</p><p><strong>Product:</strong> ${html(enquiry.product_model || 'Not supplied')}</p><p><strong>Message preview:</strong> ${html(enquiry.customer_message.slice(0, 240))}</p><p><strong>Submitted:</strong> ${html(enquiry.created_at)}</p><p><a href="${html(config.adminUrl)}">Open private dashboard</a></p>`
    }), redirect: 'error', signal: AbortSignal.timeout(8000)
    });
  } catch {
    await setEmailStatus(id, 'FAILED', null, 'Email provider could not be reached.');
    return { accepted: false };
  }
  const provider = await emailResponse.json().catch(() => ({}));
  if (!emailResponse.ok || !provider.id) { await setEmailStatus(id, 'FAILED', null, `Email provider returned ${emailResponse.status}.`); return { accepted: false }; }
  await setEmailStatus(id, 'SENT', provider.id, null);
  return { accepted: true };
}
async function handle(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, 'http://api.local'); const path = url.pathname;
  if (await publicRoutes(req, res, path, { sendOutbox, setEmailStatus })) return;
  if (missingConfig().length) return reply(res, 503, { error: 'Admin API is not configured.' });

  if (await invitationRoutes(req, res, path)) return;
  if (await authRoutes(req, res, path)) return;
  if (path === '/api/public/products' && req.method === 'GET') {
    const records = await sb('/rest/v1/products?select=record&is_visible=eq.true&order=model.asc');
    return reply(res, 200, { products: records.map((row) => row.record) });
  }
  if (path === '/api/public/services' && req.method === 'GET') {
    const records = await sb('/rest/v1/service_content?select=record&is_visible=eq.true&order=id.asc');
    return reply(res, 200, { services: records.map((row) => row.record) });
  }
  if (path === '/api/public/contact-settings' && req.method === 'GET') {
    const settings = await sb('/rest/v1/rpc/public_contact_settings', { method: 'POST', body: {} });
    return reply(res, 200, settings || {});
  }

  if (!path.startsWith('/api/admin/')) return reply(res, 404, { error: 'Not found.' });
  const actor = await actorFor(req, res); if (!actor) return;
  const permission = routePermission(path, req.method);
  req.auditActor = actor; req.auditPermission = permission.name;
  if (!permission.roles.includes(actor.profile.role)) {
    await recordDenied(actor, permission.name);
    return reply(res, 403, { error: 'You do not have permission to perform this action.' });
  }
  // Central CSRF gate also protects future private mutation routes.
  if (path.startsWith('/api/admin/') && !['GET', 'HEAD'].includes(req.method) && !sameOrigin(req)) {
    await recordDenied(actor, 'REQUEST_ORIGIN');
    return reply(res, 403, { error: 'Request origin is not allowed.' });
  }
  if (await staffRoutes(req, res, url, actor)) return;
  const userRequest = (route, options = {}) => sb(route, { token: actor.session.accessToken, ...options });
  const adminRequest = (route, options = {}) => sb(route, { service: true, ...options });

  if (path === '/api/admin/overview' && req.method === 'GET') {
    const [stats, recent, dueFollowUps, notifications, activity] = await Promise.all([
      userRequest('/rest/v1/rpc/admin_dashboard_stats', { method: 'POST', body: {} }),
      userRequest('/rest/v1/enquiries?select=id,enquiry_code,customer_name,enquiry_type,status,created_at,assigned_to,follow_up_at&order=created_at.desc&limit=8'),
      userRequest(`/rest/v1/enquiries?select=id,enquiry_code,customer_name,enquiry_type,status,follow_up_at&follow_up_at=lte.${encodeURIComponent(new Date().toISOString())}&status=not.in.(CONVERTED,CLOSED)&order=follow_up_at.asc&limit=8`),
      userRequest('/rest/v1/admin_notifications?select=id,title,kind,enquiry_id,created_at,read_at&read_at=is.null&order=created_at.desc&limit=8'),
      userRequest('/rest/v1/admin_activity?select=id,action,entity_type,entity_id,created_at,actor_id&order=created_at.desc&limit=8')
    ]);
    return reply(res, 200, { stats, recent, dueFollowUps, notifications, activity });
  }
  if (path === '/api/admin/enquiries' && req.method === 'GET') {
    const params = new URLSearchParams({ select: 'id,enquiry_code,customer_name,customer_email,customer_phone,enquiry_type,status,product_model,service_requirement,created_at,assigned_to,follow_up_at,converted_at,closed_at', order: 'created_at.desc', limit: '250' });
    if (statuses.includes(url.searchParams.get('status'))) params.set('status', `eq.${url.searchParams.get('status')}`);
    const type = url.searchParams.get('type'); if (type && enquiryTypes.has(type)) params.set('enquiry_type', `eq.${enquiryTypes.get(type)}`);
    const from = url.searchParams.get('from'); const to = url.searchParams.get('to');
    const range = [];
    if (from && !Number.isNaN(Date.parse(from))) range.push(`created_at.gte.${new Date(from).toISOString()}`);
    if (to && !Number.isNaN(Date.parse(to))) range.push(`created_at.lte.${new Date(to).toISOString()}`);
    if (range.length) params.set('and', `(${range.join(',')})`);
    const assignee = url.searchParams.get('assignedTo');
    if (assignee === 'unassigned') params.set('assigned_to', 'is.null');
    else if (assignee && /^[0-9a-f-]{36}$/i.test(assignee)) params.set('assigned_to', `eq.${assignee}`);
    const rows = await userRequest(`/rest/v1/enquiries?${params}`);
    const term = (url.searchParams.get('q') || '').trim().toLowerCase().slice(0, 120);
    return reply(res, 200, { enquiries: term ? rows.filter((row) => [row.customer_name, row.customer_email, row.customer_phone, row.enquiry_code].some((value) => String(value || '').toLowerCase().includes(term))) : rows });
  }
  if (path === '/api/admin/assignees' && req.method === 'GET') {
    const staff = await userRequest('/rest/v1/profiles?select=id,full_name,notification_email,role&account_state=eq.ACTIVE&order=full_name.asc');
    return reply(res, 200, { assignees: staff });
  }
  const detail = path.match(/^\/api\/admin\/enquiries\/([0-9a-f-]{36})$/i);
  if (detail && req.method === 'GET') {
    const id = detail[1];
    const [rows, notes, activity, outbox] = await Promise.all([
      userRequest(`/rest/v1/enquiries?id=eq.${id}&select=*`),
      userRequest(`/rest/v1/enquiry_notes?enquiry_id=eq.${id}&select=id,author_id,note,created_at&order=created_at.desc`),
      userRequest(`/rest/v1/admin_activity?entity_type=eq.ENQUIRY&entity_id=eq.${id}&select=id,actor_id,action,details,created_at&order=created_at.desc&limit=100`),
      ['SUPER_ADMIN', 'ADMIN'].includes(actor.profile.role) ? userRequest(`/rest/v1/email_outbox?enquiry_id=eq.${id}&select=id,status,attempts,last_error,updated_at,sent_at`) : Promise.resolve([])
    ]);
    if (!rows.length) return reply(res, 404, { error: 'Enquiry not found or access denied.' });
    return reply(res, 200, { enquiry: rows[0], notes, activity, email: outbox[0] || null });
  }
  const statusRoute = path.match(/^\/api\/admin\/enquiries\/([0-9a-f-]{36})\/status$/i);
  if (statusRoute && req.method === 'PATCH') {
    if (!sameOrigin(req)) return reply(res, 403, { error: 'Request origin is not allowed.' });
    const body = await readJson(req, 4096); if (!statuses.includes(body.status)) return reply(res, 422, { error: 'Choose a valid enquiry status.' });
    return reply(res, 200, { enquiry: await userRequest('/rest/v1/rpc/admin_update_enquiry_status', { method: 'POST', body: { p_enquiry_id: statusRoute[1], p_status: body.status } }) });
  }
  const followUpRoute = path.match(/^\/api\/admin\/enquiries\/([0-9a-f-]{36})\/follow-up$/i);
  if (followUpRoute && req.method === 'PATCH') {
    if (!sameOrigin(req)) return reply(res, 403, { error: 'Request origin is not allowed.' });
    const body = await readJson(req, 4096);
    let followUpAt = null;
    if (body.followUpDate !== null && body.followUpDate !== '') {
      if (typeof body.followUpDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.followUpDate)) return reply(res, 422, { error: 'Choose a valid follow-up date.' });
      const parsed = new Date(`${body.followUpDate}T12:00:00.000Z`);
      if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== body.followUpDate) return reply(res, 422, { error: 'Choose a valid follow-up date.' });
      followUpAt = parsed.toISOString();
    }
    const enquiry = await userRequest('/rest/v1/rpc/admin_set_enquiry_follow_up', { method: 'POST', body: { p_enquiry_id: followUpRoute[1], p_follow_up_at: followUpAt } });
    return reply(res, 200, { enquiry });
  }
  const assignRoute = path.match(/^\/api\/admin\/enquiries\/([0-9a-f-]{36})\/assign$/i);
  if (assignRoute && req.method === 'PATCH') {
    if (!sameOrigin(req)) return reply(res, 403, { error: 'Request origin is not allowed.' });
    const body = await readJson(req, 4096); const assignee = body.assignee || null;
    if (assignee && !/^[0-9a-f-]{36}$/i.test(assignee)) return reply(res, 422, { error: 'Choose a valid staff account.' });
    return reply(res, 200, { enquiry: await userRequest('/rest/v1/rpc/admin_assign_enquiry', { method: 'POST', body: { p_enquiry_id: assignRoute[1], p_assignee: assignee } }) });
  }
  const noteRoute = path.match(/^\/api\/admin\/enquiries\/([0-9a-f-]{36})\/notes$/i);
  if (noteRoute && req.method === 'POST') {
    if (!sameOrigin(req)) return reply(res, 403, { error: 'Request origin is not allowed.' });
    const body = await readJson(req, 8192); const note = String(body.note || '').trim();
    if (!note || note.length > 4000) return reply(res, 422, { error: 'Enter an internal note under 4000 characters.' });
    return reply(res, 201, { note: await userRequest('/rest/v1/rpc/admin_add_enquiry_note', { method: 'POST', body: { p_enquiry_id: noteRoute[1], p_note: note } }) });
  }
  if (detail && req.method === 'DELETE') {
    if (!sameOrigin(req)) return reply(res, 403, { error: 'Request origin is not allowed.' });
    if (actor.profile.role !== 'SUPER_ADMIN') return reply(res, 403, { error: 'Only a super admin may delete enquiries.' });
    const body = await readJson(req, 1024); if (body.confirm !== true) return reply(res, 400, { error: 'Confirm deletion to continue.' });
    await userRequest('/rest/v1/rpc/admin_delete_enquiry', { method: 'POST', body: { p_enquiry_id: detail[1] } });
    return reply(res, 200, { deleted: true });
  }
  if (path === '/api/admin/notifications' && req.method === 'GET') {
    const notifications = await userRequest('/rest/v1/admin_notifications?select=id,title,kind,enquiry_id,created_at,read_at&order=created_at.desc&limit=100');
    return reply(res, 200, { notifications, unread: notifications.filter((item) => !item.read_at).length });
  }
  const readRoute = path.match(/^\/api\/admin\/notifications\/([0-9a-f-]{36})\/read$/i);
  if (readRoute && req.method === 'POST') {
    if (!sameOrigin(req)) return reply(res, 403, { error: 'Request origin is not allowed.' });
    await userRequest('/rest/v1/rpc/admin_mark_notification_read', { method: 'POST', body: { p_notification_id: readRoute[1] } });
    return reply(res, 200, { read: true });
  }
  const retryRoute = path.match(/^\/api\/admin\/email-outbox\/([0-9a-f-]{36})\/retry$/i);
  if (retryRoute && req.method === 'POST') {
    if (!sameOrigin(req)) return reply(res, 403, { error: 'Request origin is not allowed.' });
    if (!['SUPER_ADMIN', 'ADMIN'].includes(actor.profile.role)) return reply(res, 403, { error: 'Only admins may retry notifications.' });
    return reply(res, 200, { notification: await sendOutbox(retryRoute[1]) });
  }
  if (path === '/api/admin/activity' && req.method === 'GET') {
    const params = new URLSearchParams({ select: 'id,actor_id,action,entity_type,entity_id,details,created_at', order: 'created_at.desc', limit: '100' });
    const actorId = url.searchParams.get('actor');
    if (actorId && /^[0-9a-f-]{36}$/i.test(actorId)) params.set('actor_id', `eq.${actorId}`);
    const activity = await userRequest(`/rest/v1/admin_activity?${params}`);
    return reply(res, 200, { activity });
  }
  if (path === '/api/admin/products' && req.method === 'GET') {
    if (!['SUPER_ADMIN', 'ADMIN'].includes(actor.profile.role)) return reply(res, 403, { error: 'Product management requires an admin role.' });
    const products = await userRequest('/rest/v1/products?select=id,model,category_id,record,is_visible,updated_at&order=model.asc&limit=500');
    return reply(res, 200, { products });
  }
  if (path === '/api/admin/products' && req.method === 'POST') {
    if (!sameOrigin(req)) return reply(res, 403, { error: 'Request origin is not allowed.' });
    if (!['SUPER_ADMIN', 'ADMIN'].includes(actor.profile.role)) return reply(res, 403, { error: 'Product management requires an admin role.' });
    const body = await readJson(req, 16384);
    if (!body.record || typeof body.record !== 'object' || !body.record.id || !body.record.model || !body.record.categoryId) return reply(res, 422, { error: 'Product id, model and category are required.' });
    return reply(res, 201, { product: await userRequest('/rest/v1/rpc/admin_create_product', { method: 'POST', body: { p_record: body.record } }) });
  }
  const productRoute = path.match(/^\/api\/admin\/products\/([a-z0-9-]+)$/i);
  if (productRoute && req.method === 'PATCH') {
    if (!sameOrigin(req)) return reply(res, 403, { error: 'Request origin is not allowed.' });
    if (!['SUPER_ADMIN', 'ADMIN'].includes(actor.profile.role)) return reply(res, 403, { error: 'Product management requires an admin role.' });
    const body = await readJson(req, 16384);
    return reply(res, 200, { product: await userRequest('/rest/v1/rpc/admin_update_product', { method: 'POST', body: { p_id: productRoute[1], p_patch: body.record, p_is_visible: body.isVisible === true } }) });
  }
  if (path === '/api/admin/services' && req.method === 'GET') {
    if (!['SUPER_ADMIN', 'ADMIN'].includes(actor.profile.role)) return reply(res, 403, { error: 'Service management requires an admin role.' });
    const services = await userRequest('/rest/v1/service_content?select=id,record,is_visible,updated_at&order=id.asc&limit=100');
    return reply(res, 200, { services });
  }
  const serviceRoute = path.match(/^\/api\/admin\/services\/([a-z0-9-]+)$/i);
  if (serviceRoute && req.method === 'PATCH') {
    if (!sameOrigin(req)) return reply(res, 403, { error: 'Request origin is not allowed.' });
    if (!['SUPER_ADMIN', 'ADMIN'].includes(actor.profile.role)) return reply(res, 403, { error: 'Service management requires an admin role.' });
    const body = await readJson(req, 16384);
    return reply(res, 200, { service: await userRequest('/rest/v1/rpc/admin_update_service', { method: 'POST', body: { p_id: serviceRoute[1], p_record: body.record, p_is_visible: body.isVisible === true } }) });
  }
  if (path === '/api/admin/settings' && req.method === 'GET') {
    if (actor.profile.role !== 'SUPER_ADMIN') return reply(res, 403, { error: 'Only a super admin may view private site settings.' });
    const rows = await userRequest('/rest/v1/site_settings?id=eq.public&select=settings,updated_at');
    return reply(res, 200, { settings: rows[0]?.settings || { showEmail: false, showPhone: false, showAddress: false, showBusinessHours: false, showMap: false }, updatedAt: rows[0]?.updated_at || null });
  }
  if (path === '/api/admin/settings' && req.method === 'PATCH') {
    if (!sameOrigin(req)) return reply(res, 403, { error: 'Request origin is not allowed.' });
    if (actor.profile.role !== 'SUPER_ADMIN') return reply(res, 403, { error: 'Only a super admin may change site settings.' });
    const body = await readJson(req, 8192);
    const allowedSwitches = ['showEmail', 'showPhone', 'showAddress', 'showBusinessHours', 'showMap'];
    if (!body.settings || allowedSwitches.some((key) => typeof body.settings[key] !== 'boolean')) return reply(res, 422, { error: 'All contact publication switches must be set explicitly.' });
    return reply(res, 200, { saved: true, settings: await userRequest('/rest/v1/rpc/admin_update_site_settings', { method: 'POST', body: { p_settings: body.settings } }) });
  }
  return reply(res, 404, { error: 'Not found.' });
}

export function createApiServer() {
  const server = createServer(async (req, res) => {
    try { await handle(req, res); }
    catch (error) {
      if (error.status === 403 && req.auditActor) await recordDenied(req.auditActor, req.auditPermission || 'PRIVATE_OPERATION');
      handleError(error, req, res);
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return server;
}
const server = createApiServer();

if (process.argv[1] && new URL(import.meta.url).pathname.toLowerCase() === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).pathname.toLowerCase()) {
  server.listen(config.port, '127.0.0.1', () => console.log(`VisionTech API listening on 127.0.0.1:${config.port}${missingConfig().length ? ` (not configured: ${missingConfig().join(', ')})` : ''}`));
}
export { handle, supabaseHeaders, validateEnquiry };
