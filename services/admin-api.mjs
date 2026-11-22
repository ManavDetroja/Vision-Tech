import { processDelivery, startNotificationWorker } from './api/notification-mail.mjs';
import { config, missingConfig } from './api/config.mjs';
import { listEnquiries, positivePage } from './api/enquiry-query.mjs';
import { uuid } from './api/staff-service.mjs';
import { roles, statuses } from './api/constants.mjs';
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
async function handle(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, 'http://api.local'); const path = url.pathname;
  if (await publicRoutes(req, res, path)) return;
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
    const asOf = new Date().toISOString();
    const events = '/rest/v1/admin_activity?select=action,entity_type,created_at&order=created_at.desc,id.desc&limit=8';
    const managesStaff = actor.profile.role === 'ADMIN' || actor.profile.role === 'SUPER_ADMIN';
    const countStaff = state => userRequest(`/rest/v1/profiles?role=eq.STAFF&account_state=eq.${state}&select=id&limit=1`, { exactCount: true });
    const staffEvents = '/rest/v1/admin_activity?select=action,entity_type,created_at,actor:profiles!admin_activity_actor_id_fkey!inner(full_name)&actor.role=eq.STAFF&order=created_at.desc,id.desc&limit=8';
    const [stats, recent, dueFollowUps, notifications, activity, enquiryActivity, staff] = await Promise.all([
      userRequest('/rest/v1/rpc/admin_dashboard_stats', { method: 'POST', body: {} }),
      userRequest('/rest/v1/enquiries?select=id,enquiry_code,customer_name,enquiry_type,status,created_at,assigned_to,follow_up_at&order=created_at.desc&limit=8'),
      userRequest(`/rest/v1/enquiries?select=id,enquiry_code,customer_name,enquiry_type,status,follow_up_at&follow_up_at=lte.${encodeURIComponent(new Date().toISOString())}&status=not.in.(CONVERTED,CLOSED)&order=follow_up_at.asc&limit=8`),
      userRequest('/rest/v1/admin_notifications?select=id,title,kind,enquiry_id,created_at,read_at&read_at=is.null&order=created_at.desc&limit=8'),
      userRequest(events),
      userRequest(events + '&entity_type=eq.ENQUIRY'),
      managesStaff ? Promise.all([countStaff('ACTIVE'), countStaff('DISABLED'), userRequest(staffEvents)]) : null
    ]);
    const staffOverview = staff && { active: staff[0], disabled: staff[1], total: staff[0] + staff[1], activity: staff[2] };
    return reply(res, 200, { stats, recent, dueFollowUps, notifications, activity, enquiryActivity, staffOverview, asOf });
  }
  if (path === '/api/admin/enquiries' && req.method === 'GET') {
    return reply(res, 200, await listEnquiries(url.searchParams, userRequest));
  }
  if (path === '/api/admin/assignees' && req.method === 'GET') {
    const staff = [];
    const filter = url.searchParams.get('includeDisabled') === 'true' ? '' : '&account_state=eq.ACTIVE';
    for (let offset = 0; ; offset += 250) {
      const batch = await userRequest(`/rest/v1/profiles?select=id,full_name,notification_email,role,account_state&order=full_name.asc,id.asc&limit=250&offset=${offset}${filter}`);
      staff.push(...batch);
      if (batch.length < 250) break;
    }
    return reply(res, 200, { assignees: staff });
  }
  const enquiryId = path.match(/^\/api\/admin\/enquiries\/([^/]+)/)?.[1];
  if (enquiryId && !uuid(enquiryId)) return reply(res, 422, { error: 'Invalid enquiry ID.' });
  const detail = path.match(/^\/api\/admin\/enquiries\/([0-9a-f-]{36})$/i);
  if (detail && req.method === 'GET') {
    const id = detail[1];
    const historyPage = positivePage(url.searchParams.get('historyPage'));
    const notesPage = positivePage(url.searchParams.get('notesPage'));
    const rows = await userRequest(`/rest/v1/enquiries?id=eq.${id}&select=*,assignee:profiles!enquiries_assigned_to_fkey(full_name)`);
    if (!rows.length) return reply(res, 404, { error: 'Enquiry not found or access denied.' });
    const [notes, activity, outbox] = await Promise.all([
      userRequest(`/rest/v1/enquiry_notes?enquiry_id=eq.${id}&select=id,author_id,author:profiles!enquiry_notes_author_id_fkey(full_name),note,created_at&order=created_at.desc,id.desc&limit=26&offset=${(notesPage-1)*25}`),
      userRequest(`/rest/v1/admin_activity?entity_type=eq.ENQUIRY&entity_id=eq.${id}&select=id,actor_id,actor:profiles!admin_activity_actor_id_fkey(full_name),action,details,created_at&order=created_at.desc,id.desc&limit=26&offset=${(historyPage-1)*25}`),
      ['SUPER_ADMIN', 'ADMIN'].includes(actor.profile.role) ? userRequest(`/rest/v1/email_outbox?enquiry_id=eq.${id}&select=id,status,attempts,last_error,updated_at,sent_at`) : Promise.resolve([])
    ]);
    return reply(res, 200, { enquiry: rows[0], notes: notes.slice(0,25), activity: activity.slice(0,25),
      moreNotes: notes.length > 25, moreHistory: activity.length > 25, email: outbox[0] || null });
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
    const body = await readJson(req, 4096); const assignee = body.assignee;
    if (assignee !== null && !uuid(assignee)) return reply(res, 422, { error: 'Choose a valid staff account or explicitly unassign.' });
    return reply(res, 200, { enquiry: await userRequest('/rest/v1/rpc/admin_assign_enquiry', { method: 'POST', body: { p_enquiry_id: assignRoute[1], p_assignee: assignee } }) });
  }
  const noteRoute = path.match(/^\/api\/admin\/enquiries\/([0-9a-f-]{36})\/notes$/i);
  if (noteRoute && req.method === 'POST') {
    if (!sameOrigin(req)) return reply(res, 403, { error: 'Request origin is not allowed.' });
    const body = await readJson(req, 32768); const note = typeof body.note === 'string' ? body.note.trim() : '';
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
    const countOnly = url.searchParams.get('view') === 'count';
    const page = positivePage(url.searchParams.get('page'));
    const size = url.searchParams.has('page') ? 25 : 100;
    const count = userRequest('/rest/v1/admin_notifications?select=id&read_at=is.null&limit=1', { exactCount: true });
    if (countOnly) return reply(res, 200, { unread: await count });
    const [notifications, unread] = await Promise.all([
      userRequest(`/rest/v1/admin_notifications?select=id,title,kind,created_at,read_at,enquiry:enquiries(id),staff:profiles!admin_notifications_staff_id_fkey(id,role)&order=created_at.desc,id.desc&limit=${size+1}&offset=${(page-1)*size}`),
      count
    ]);
    const items=notifications.slice(0,size).map(({enquiry,staff,...item})=>({
      ...item, enquiry_id:enquiry?.id || null,
      staff_id:staff && (actor.profile.role==='SUPER_ADMIN' || (actor.profile.role==='ADMIN' && staff.role==='STAFF')) ? staff.id : null
    }));
    return reply(res, 200, { notifications:items, unread, page, hasMore:notifications.length>size });
  }
  if (path === '/api/admin/notifications/read-all' && req.method === 'POST') {
    await userRequest(`/rest/v1/admin_notifications?recipient_id=eq.${actor.user.id}&read_at=is.null`,{
      method:'PATCH',body:{read_at:new Date().toISOString()}
    });
    return reply(res,200,{read:true});
  }
  const readRoute = path.match(/^\/api\/admin\/notifications\/([0-9a-f-]{36})\/read$/i);
  if (readRoute && req.method === 'POST') {
    if (!uuid(readRoute[1])) return reply(res,422,{error:'Invalid notification ID.'});
    if (!sameOrigin(req)) return reply(res, 403, { error: 'Request origin is not allowed.' });
    await userRequest('/rest/v1/rpc/admin_mark_notification_read', { method: 'POST', body: { p_notification_id: readRoute[1] } });
    return reply(res, 200, { read: true });
  }
  const retryRoute = path.match(/^\/api\/admin\/email-outbox\/([0-9a-f-]{36})\/retry$/i);
  if (retryRoute && req.method === 'POST') {
    if (!uuid(retryRoute[1])) return reply(res,422,{error:'Invalid delivery ID.'});
    if (!sameOrigin(req)) return reply(res, 403, { error: 'Request origin is not allowed.' });
    if (!['SUPER_ADMIN', 'ADMIN'].includes(actor.profile.role)) return reply(res, 403, { error: 'Only admins may retry notifications.' });
    return reply(res, 200, { notification: await processDelivery(retryRoute[1]) });
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
  if (!missingConfig().length) server.once('listening', () => server.once('close', startNotificationWorker()));
  server.listen(config.port, '127.0.0.1', () => console.log(`VisionTech API listening on 127.0.0.1:${config.port}${missingConfig().length ? ` (not configured: ${missingConfig().join(', ')})` : ''}`));
}
export { handle, supabaseHeaders, validateEnquiry };
