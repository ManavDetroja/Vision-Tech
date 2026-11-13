import { createHmac, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';

const config = {
  supabaseUrl: (process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
  anonKey: process.env.SUPABASE_ANON_KEY || '',
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  appOrigin: process.env.APP_ORIGIN || '',
  sessionKey: process.env.SESSION_ENCRYPTION_KEY || '',
  rateSecret: process.env.RATE_LIMIT_HASH_SECRET || '',
  resendKey: process.env.RESEND_API_KEY || '',
  emailFrom: process.env.ENQUIRY_FROM_EMAIL || '',
  enquiryNotificationEmail: (process.env.ENQUIRY_NOTIFICATION_EMAIL || '').trim().toLowerCase(),
  adminUrl: process.env.ADMIN_DASHBOARD_URL || '',
  trustedProxy: process.env.TRUST_PROXY === 'true',
  port: Number(process.env.ADMIN_API_PORT || 4175),
  production: process.env.NODE_ENV === 'production'
};
const roles = ['SUPER_ADMIN', 'ADMIN', 'STAFF'];
const statuses = ['NEW', 'CONTACTED', 'IN_PROGRESS', 'CONVERTED', 'CLOSED'];
const enquiryTypes = new Map([
  ['product', 'PRODUCT_INFORMATION'], ['installation', 'CCTV_INSTALLATION'], ['repair', 'CCTV_REPAIR'],
  ['maintenance', 'CCTV_MAINTENANCE'], ['upgrade', 'CCTV_UPGRADE'], ['general', 'GENERAL_ENQUIRY']
]);

function reply(res, status, data, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(JSON.stringify(data));
}
function missingConfig() {
  const missing = [];
  if (!config.supabaseUrl) missing.push('SUPABASE_URL');
  if (!config.anonKey) missing.push('SUPABASE_ANON_KEY');
  if (!config.serviceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!config.appOrigin) missing.push('APP_ORIGIN');
  if (!/^[0-9a-f]{64}$/i.test(config.sessionKey)) missing.push('SESSION_ENCRYPTION_KEY');
  if (config.rateSecret.length < 32) missing.push('RATE_LIMIT_HASH_SECRET');
  return missing;
}
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
function encryptSession(session) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(config.sessionKey, 'hex'), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(session)), cipher.final()]);
  const cookie = Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
  return `vt_admin_session=${cookie}; HttpOnly; Path=/api; SameSite=Strict; Max-Age=604800${config.production ? '; Secure' : ''}`;
}
function clearSession() {
  return `vt_admin_session=; HttpOnly; Path=/api; SameSite=Strict; Max-Age=0${config.production ? '; Secure' : ''}`;
}
function decryptSession(req) {
  const item = (req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith('vt_admin_session='));
  if (!item) return null;
  try {
    const bytes = Buffer.from(item.slice('vt_admin_session='.length), 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', Buffer.from(config.sessionKey, 'hex'), bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString());
  } catch { return null; }
}
function sameOrigin(req) { return req.headers.origin === config.appOrigin; }
async function readJson(req, max = 32768) {
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > max) throw Object.assign(new Error('Request is too large.'), { status: 413 });
    chunks.push(chunk);
  }
  try { return size ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}; }
  catch { throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 }); }
}
async function sb(path, { method = 'GET', body, token, service = false, headers = {} } = {}) {
  const key = service ? config.serviceKey : config.anonKey;
  const bearer = service ? config.serviceKey : token || config.anonKey;
  const response = await fetch(`${config.supabaseUrl}${path}`, {
    method, headers: { apikey: key, Authorization: `Bearer ${bearer}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: 'error'
  });
  const text = await response.text(); let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) { const error = new Error(data?.message || data?.msg || `Database service returned ${response.status}.`); error.status = response.status; throw error; }
  return data;
}
async function profileFor(id, token) {
  const query = new URLSearchParams({ select: 'id,full_name,notification_email,role,account_state,created_at,last_login_at', id: `eq.${id}`, limit: '1' });
  return (await sb(`/rest/v1/profiles?${query}`, { token }))?.[0] || null;
}
async function refresh(session) {
  const response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST', headers: { apikey: config.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: session.refreshToken }), redirect: 'error'
  });
  if (!response.ok) throw new Error('Expired session.');
  const data = await response.json();
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: data.expires_at || Math.floor(Date.now() / 1000) + data.expires_in };
}
async function actorFor(req, res, allowed = roles) {
  let session = decryptSession(req);
  if (!session) { reply(res, 401, { error: 'Sign in to continue.' }); return null; }
  try {
    if (session.expiresAt < Math.floor(Date.now() / 1000) + 30) {
      session = await refresh(session);
      res.setHeader('Set-Cookie', encryptSession(session));
    }
    const userResponse = await fetch(`${config.supabaseUrl}/auth/v1/user`, { headers: { apikey: config.anonKey, Authorization: `Bearer ${session.accessToken}` }, redirect: 'error' });
    if (!userResponse.ok) throw new Error('Authentication expired.');
    const user = await userResponse.json();
    const profile = await profileFor(user.id, session.accessToken);
    if (!profile || profile.account_state !== 'ACTIVE') { reply(res, 403, { error: 'This account is disabled or not authorized.' }, { 'Set-Cookie': clearSession() }); return null; }
    if (!allowed.includes(profile.role)) { reply(res, 403, { error: 'You do not have permission to perform this action.' }); return null; }
    return { session, user, profile };
  } catch {
    reply(res, 401, { error: 'Sign in again to continue.' }, { 'Set-Cookie': clearSession() });
    return null;
  }
}
function validateEnquiry(body) {
  const name = String(body.name || '').trim(); const email = String(body.email || '').trim(); const phone = String(body.phone || '').trim();
  const type = String(body.enquiryType || ''); const model = String(body.productModel || '').trim(); const service = String(body.serviceRequirement || '').trim(); const message = String(body.message || '').trim();
  const normalizedPhone = phone.replace(/[\s().-]/g, ''); const digits = phone.replace(/\D/g, ''); const errors = [];
  if (name.length < 2 || name.length > 100) errors.push('Enter a name between 2 and 100 characters.');
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Enter a valid email address.');
  if (phone.length > 20 || !/^\+?\d+$/.test(normalizedPhone) || digits.length < 7 || digits.length > 15) errors.push('Enter a valid phone number with 7 to 15 digits.');
  if (!enquiryTypes.has(type)) errors.push('Choose a valid enquiry type.');
  if (model.length > 100 || service.length > 180) errors.push('A selected field is too long.');
  if (message.length < 20 || message.length > 2000) errors.push('Enter a message between 20 and 2000 characters.');
  if (body.consent !== true) errors.push('Consent is required.');
  if (String(body.website || '').trim()) errors.push('Submission rejected.');
  if (['installation', 'repair', 'maintenance', 'upgrade'].includes(type) && !service) errors.push('Describe the service requirement.');
  return errors.length ? errors : { name, email, phone, enquiryType: type, productModel: model, serviceRequirement: service, message, consent: true, website: '' };
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
    }), redirect: 'error'
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
  if (path === '/api/health' && req.method === 'GET') {
    const missing = missingConfig();
    const emailConfigured = Boolean(config.resendKey && config.emailFrom && config.enquiryNotificationEmail && config.adminUrl);
    return reply(res, missing.length ? 503 : 200, { ready: !missing.length, missing, emailConfigured });
  }
  if (missingConfig().length) return reply(res, 503, { error: 'Admin API is not configured.' });

  if (path === '/api/auth/password-reset' && req.method === 'POST') {
    if (!sameOrigin(req)) return reply(res, 403, { error: 'Request origin is not allowed.' });
    const body = await readJson(req, 4096);
    const email = String(body.email || '').trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(res, 400, { error: 'Enter a valid email address.' });
    const redirectTo = new URL('/admin/reset-password.html', config.appOrigin).href;
    const response = await fetch(`${config.supabaseUrl}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: 'POST', headers: { apikey: config.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }), redirect: 'error'
    }).catch(() => null);
    if (!response) return reply(res, 502, { error: 'Password reset could not be requested. Try again later.' });
    if (response.status === 429) return reply(res, 429, { error: 'Too many reset requests. Please wait and try again.' });
    if (!response.ok) return reply(res, 502, { error: 'Password reset could not be requested. Try again later.' });
    return reply(res, 200, { accepted: true, message: 'If an active account matches that email, reset instructions will be sent.' });
  }
  if (path === '/api/auth/password-update' && req.method === 'POST') {
    if (!sameOrigin(req)) return reply(res, 403, { error: 'Request origin is not allowed.' });
    const body = await readJson(req, 8192);
    const accessToken = String(body.accessToken || '');
    const password = String(body.password || '');
    if (accessToken.length < 32 || accessToken.length > 8192 || password.length < 12 || password.length > 256) {
      return reply(res, 422, { error: 'Use the reset link and choose a password between 12 and 256 characters.' });
    }
    const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
      method: 'PUT', headers: { apikey: config.anonKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }), redirect: 'error'
    }).catch(() => null);
    if (!response?.ok) return reply(res, 422, { error: 'The reset link is invalid or expired. Request a new reset email.' });
    return reply(res, 200, { updated: true });
  }

  if (path === '/api/auth/login' && req.method === 'POST') {
    if (!sameOrigin(req)) return reply(res, 403, { error: 'Request origin is not allowed.' });
    const body = await readJson(req, 8192); const email = String(body.email || '').trim().toLowerCase(); const password = String(body.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length > 256) return reply(res, 400, { error: 'Enter a valid email and password.' });
    const response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: config.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }), redirect: 'error' });
    if (!response.ok) return reply(res, 401, { error: 'Email or password is incorrect.' });
    const data = await response.json(); const profile = await profileFor(data.user.id, data.access_token);
    if (!profile || profile.account_state !== 'ACTIVE') return reply(res, 403, { error: 'This account is not active. Ask a super admin to authorize it.' });
    const session = { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: data.expires_at || Math.floor(Date.now() / 1000) + data.expires_in };
    await sb('/rest/v1/rpc/record_own_login', { method: 'POST', token: session.accessToken, body: {} });
    return reply(res, 200, { user: { id: data.user.id, email: data.user.email }, profile }, { 'Set-Cookie': encryptSession(session) });
  }
  if (path === '/api/auth/session' && req.method === 'GET') {
    const actor = await actorFor(req, res); if (!actor) return;
    return reply(res, 200, { user: { id: actor.user.id, email: actor.user.email }, profile: actor.profile });
  }
  if (path === '/api/auth/logout' && req.method === 'POST') {
    if (!sameOrigin(req)) return reply(res, 403, { error: 'Request origin is not allowed.' });
    const session = decryptSession(req);
    if (session?.accessToken) {
      await fetch(`${config.supabaseUrl}/auth/v1/logout`, { method: 'POST', headers: { apikey: config.anonKey, Authorization: `Bearer ${session.accessToken}` }, redirect: 'error' }).catch(() => null);
    }
    return reply(res, 200, { signedOut: true }, { 'Set-Cookie': clearSession() });
  }
  if (path === '/api/enquiries' && req.method === 'POST') {
    if (!sameOrigin(req)) return reply(res, 403, { error: 'Request origin is not allowed.' });
    const key = String(req.headers['idempotency-key'] || ''); if (!/^[0-9a-f-]{36}$/i.test(key)) return reply(res, 400, { error: 'Refresh the page and try again.' });
    const body = await readJson(req); const validation = validateEnquiry(body);
    if (Array.isArray(validation)) return reply(res, 422, { error: validation[0], fields: validation });
    const forwarded = config.trustedProxy ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '';
    const ip = forwarded || req.socket.remoteAddress || 'unknown'; const ipHash = createHmac('sha256', config.rateSecret).update(ip).digest('hex');
    try {
      const result = await sb('/rest/v1/rpc/submit_public_enquiry', { method: 'POST', service: true, body: { p_payload: validation, p_idempotency_key: key, p_rate_hash: ipHash } });
      if (!result?.accepted) return reply(res, 502, { error: 'The database did not confirm that the enquiry was saved.' });
      if (!result.duplicate && result.emailOutboxId) {
        await sendOutbox(result.emailOutboxId).catch(async () => {
          await setEmailStatus(result.emailOutboxId, 'FAILED', null, 'Notification processing failed after the enquiry was saved.').catch(() => null);
        });
      }
      return reply(res, 201, { accepted: true, enquiryId: result.enquiryCode, savedAt: result.createdAt });
    } catch (error) {
      const tooMany = /too many submissions/i.test(error.message);
      return reply(res, tooMany ? 429 : 400, { error: tooMany ? 'Too many submissions. Please try later.' : 'The enquiry could not be saved. Please review the form and try again.' });
    }
  }

  if (path === '/api/public/products' && req.method === 'GET') {
    const records = await sb('/rest/v1/products?select=record&is_visible=eq.true&order=model.asc', { token: config.anonKey });
    return reply(res, 200, { products: records.map((row) => row.record) });
  }
  if (path === '/api/public/services' && req.method === 'GET') {
    const records = await sb('/rest/v1/service_content?select=record&is_visible=eq.true&order=id.asc', { token: config.anonKey });
    return reply(res, 200, { services: records.map((row) => row.record) });
  }
  if (path === '/api/public/contact-settings' && req.method === 'GET') {
    const settings = await sb('/rest/v1/rpc/public_contact_settings', { method: 'POST', token: config.anonKey, body: {} });
    return reply(res, 200, settings || {});
  }

  const staffRoute = path.startsWith('/api/admin/staff');
  const actor = await actorFor(req, res, staffRoute ? ['SUPER_ADMIN', 'ADMIN'] : roles); if (!actor) return;
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
  if (path === '/api/admin/staff' && req.method === 'GET') {
    const staffFilter = actor.profile.role === 'SUPER_ADMIN' ? '' : '&role=eq.STAFF';
    const staff = await userRequest(`/rest/v1/profiles?select=id,full_name,notification_email,role,account_state,created_at,last_login_at&order=created_at.asc${staffFilter}`);
    return reply(res, 200, { staff });
  }
  if (path === '/api/admin/staff/invite' && req.method === 'POST') {
    if (!sameOrigin(req)) return reply(res, 403, { error: 'Request origin is not allowed.' });
    const body = await readJson(req, 4096); const email = String(body.email || '').trim().toLowerCase(); const name = String(body.fullName || '').trim();
    const role = ['ADMIN', 'STAFF'].includes(body.role) ? body.role : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || name.length < 2 || name.length > 100 || !role) return reply(res, 422, { error: 'Enter a valid name, email and role.' });
    if (role === 'ADMIN' && actor.profile.role !== 'SUPER_ADMIN') return reply(res, 403, { error: 'Only a super administrator may invite an administrator.' });
    const response = await fetch(`${config.supabaseUrl}/auth/v1/invite`, { method: 'POST', headers: { apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, data: { full_name: name } }), redirect: 'error' });
    if (!response.ok) return reply(res, 400, { error: 'The staff invitation could not be created.' });
    const invited = await response.json();
    await adminRequest('/rest/v1/rpc/admin_set_staff', { method: 'POST', body: { p_actor: actor.user.id, p_target: invited.id, p_role: role, p_state: 'ACTIVE', p_name: name, p_email: email } });
    return reply(res, 201, { invited: true, userId: invited.id, role });
  }
  if (path === '/api/admin/staff/update' && req.method === 'POST') {
    if (!sameOrigin(req)) return reply(res, 403, { error: 'Request origin is not allowed.' });
    const body = await readJson(req, 4096);
    const email = String(body.email || '').trim().toLowerCase();
    const fullName = String(body.fullName || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(String(body.userId || '')) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || fullName.length < 2 || fullName.length > 100 || !['ADMIN', 'STAFF'].includes(body.role) || !['ACTIVE', 'DISABLED'].includes(body.accountState)) {
      return reply(res, 422, { error: 'Enter a valid name, email, role and account state.' });
    }
    if (body.role === 'ADMIN' && actor.profile.role !== 'SUPER_ADMIN') return reply(res, 403, { error: 'Only a super administrator may grant the administrator role.' });
    await adminRequest('/rest/v1/rpc/admin_set_staff', { method: 'POST', body: { p_actor: actor.user.id, p_target: body.userId, p_role: body.role, p_state: body.accountState, p_name: body.fullName, p_email: body.email } });
    return reply(res, 200, { updated: true });
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

const server = createServer(async (req, res) => {
  try { await handle(req, res); }
  catch (error) {
    const safePath = new URL(req.url, 'http://api.local').pathname;
    console.error(`[admin-api] ${req.method} ${safePath}: request failed`);
    if (!res.headersSent) reply(res, error.status || 500, { error: error.status && error.status < 500 ? error.message : 'The request could not be completed.' });
    else res.destroy();
  }
});

if (process.argv[1] && new URL(import.meta.url).pathname.toLowerCase() === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).pathname.toLowerCase()) {
  server.listen(config.port, '127.0.0.1', () => console.log(`VisionTech API listening on 127.0.0.1:${config.port}${missingConfig().length ? ` (not configured: ${missingConfig().join(', ')})` : ''}`));
}
export { handle, validateEnquiry };
