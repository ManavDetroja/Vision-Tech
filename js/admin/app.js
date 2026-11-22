import { renderNotifications, updateBell } from './notifications.js';
import { renderEnquiryList, renderEnquiryRecord } from './enquiries.js';
import { dashboardMarkup } from './dashboard.js';
import { renderStaff } from './staff.js';
import { bindPasswordControls } from './password-controls.js';
import { ADMIN_API_BASE_URL } from '../data/admin-config.js';
import { productImageMarkup } from '../components/product-image.js';

const base = ADMIN_API_BASE_URL.replace(/\/+$/, '');
const page = document.body.dataset.adminPage;
const app = document.querySelector('#admin-app');
let currentProfile = null;
const esc = (v = '') => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const date = (v) => v ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v)) : '—';
const toast = (message, error = false) => { const n = document.querySelector('#admin-toast'); if (n) { n.textContent = message; n.className = `admin-toast${error ? ' is-error' : ''}`; n.hidden = false; setTimeout(() => { n.hidden = true; }, 5000); } };

async function api(path, options = {}) {
  const response = await fetch(`${base}${path}`, { credentials: 'include', signal: AbortSignal.timeout(15000), redirect: 'error', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && page !== 'login') { if (app) app.replaceChildren(); location.replace('index.html?expired=1'); }
  if (!response.ok) { const error = new Error(data.error || `Request failed (${response.status}).`); error.status = response.status; throw error; }
  return data;
}
const json = (data) => JSON.stringify(data);

function renderLogin() {
  bindPasswordControls();
  const form = document.querySelector('#admin-login-form');
  if (!form) return;
  const restoration = api('/api/auth/session').then(() => { location.replace('dashboard.html'); return true; }).catch(() => false);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const status = document.querySelector('#admin-login-status'); const button = form.querySelector('button[type="submit"]');
    button.disabled = true; button.textContent = 'Signing in…'; form.setAttribute('aria-busy', 'true'); status.textContent = 'Signing in…';
    try { if (await restoration) return; await api('/api/auth/login', { method: 'POST', body: json({ email: form.email.value, password: form.password.value }) }); location.href = 'dashboard.html'; }
    catch (error) { status.textContent = error.message; form.password.value = ''; }
    finally { button.disabled = false; button.textContent = 'Sign in'; form.removeAttribute('aria-busy'); }
  });
  const loginStatus = document.querySelector('#admin-login-status');
  if (new URLSearchParams(location.search).has('expired')) loginStatus.textContent = 'Your session expired. Please sign in again.';
  if (new URLSearchParams(location.search).has('disabled')) loginStatus.textContent = 'This account is disabled or not authorized. Contact your administrator.';
  const resetForm = document.querySelector('#password-reset-request');
  const resetToggle = document.querySelector('#show-password-reset');
  resetToggle?.addEventListener('click', () => {
    const shown = !resetForm.hidden;
    resetForm.hidden = shown;
    resetToggle.setAttribute('aria-expanded', String(!shown));
    if (!shown) resetForm.email.focus();
  });
  resetForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = document.querySelector('#password-reset-status');
    const button = resetForm.querySelector('button[type="submit"]');
    button.disabled = true; status.textContent = 'Requesting reset instructions…';
    try {
      const result = await api('/api/auth/password-reset', { method: 'POST', body: json({ email: resetForm.email.value.trim() }) });
      status.textContent = result.message;
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  });
}

const links = [['dashboard', 'Overview', 'dashboard.html'], ['enquiries', 'Enquiries', 'enquiries.html'], ['products', 'Products', 'products.html'], ['product-images', 'Product images', 'product-images.html'], ['services', 'Services', 'services.html'], ['staff', 'Staff', 'staff.html'], ['notifications', 'Notifications', 'notifications.html'], ['activity', 'Activity', 'activity.html'], ['settings', 'Settings', 'settings.html']];
function visibleNavigation(profile) {
  return links.filter(([key]) => key === 'settings' ? profile.role === 'SUPER_ADMIN' : ['staff', 'products', 'product-images', 'services'].includes(key) ? ['SUPER_ADMIN', 'ADMIN'].includes(profile.role) : true);
}
function shell(profile) {
  const navigation = visibleNavigation(profile).map(([key, label, href]) => `<a href="${href}" ${page === key || (page === 'enquiry-details' && key === 'enquiries') ? 'aria-current="page"' : ''}>${label}</a>`).join('');
  app.innerHTML = `<header class="admin-topbar"><a class="wordmark" href="../index.html"><img class="brand-logo" src="../assets/images/logo/visiontech-vt-logo.png" width="44" height="36" alt=""><span class="brand-name">VisionTech <small>Solutions™</small></span></a><div class="admin-user"><a class="admin-bell" href="notifications.html" aria-label="Notifications"><span aria-hidden="true">&#128276;</span> Notifications <span id="unread-count" class="admin-badge" hidden>0</span></a><span>${esc(profile.full_name || profile.notification_email || 'Admin')} · ${esc(profile.role)}</span><button class="button button-outline" data-action="logout">Sign out</button></div></header><div class="admin-layout"><aside class="admin-sidebar" aria-label="Admin navigation">${navigation}<a href="../index.html">View website</a></aside><main id="admin-main" class="admin-content"><div id="admin-toast" class="admin-toast" role="status" hidden></div><div id="admin-view"><p class="admin-loading" role="status">Loading secure admin data…</p></div></main></div>`;
  app.querySelector('[data-action="logout"]').addEventListener('click', async (event) => {
    const button = event.currentTarget; button.disabled = true; button.textContent = 'Signing out…';
    try { await api('/api/auth/logout', { method: 'POST' }); location.replace('index.html'); }
    catch { toast('Sign out could not be confirmed. Check your connection and try again.', true); button.disabled = false; button.textContent = 'Sign out'; }
  });
  const refreshUnread = async () => { try { const result = await api('/api/admin/notifications?view=count'); updateBell(result.unread); } catch { /* Inbox provides retry feedback. */ } };
  refreshUnread(); window.setInterval(refreshUnread, 60000);
}
function heading(title, subtitle, action = '') { return `<div class="admin-page-heading"><div><p class="eyebrow">VisionTech Solutions™ · Private</p><h1>${title}</h1><p>${subtitle}</p></div>${action}</div>`; }
function table(headers, rows) { return `<div class="admin-table-wrap"><table class="admin-table"><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${headers.length}">${empty('No records found.')}</td></tr>`}</tbody></table></div>`; }
function empty(message) { return `<div class="admin-empty"><strong>${esc(message)}</strong><span>Records will appear here after they are saved.</span></div>`; }
function statusBadge(status) { return `<span class="admin-badge status-${esc(status).toLowerCase()}">${esc(status || 'NEW').replaceAll('_', ' ')}</span>`; }

async function renderDashboard() {
  const data = await api('/api/admin/overview');
  document.querySelector('#admin-view').innerHTML = dashboardMarkup(data, currentProfile, {
    heading, table, statusBadge, esc, date, links: visibleNavigation(currentProfile)
  });
}
async function renderGeneric() {
  const view = document.querySelector('#admin-view');
  if (page === 'product-images') { const data = await api('/api/admin/products'); view.innerHTML = `${heading('Product image review', 'Image candidates remain private until exact-model identity and reuse permission are approved.')}<p class="admin-muted">Preview is shown only for images already verified, permitted and stored locally. Candidate source links open the original product page for review. This screen does not download or publish candidates.</p><label class="admin-search">Search model <input id="image-search" type="search" placeholder="Filter models"></label><div class="admin-image-grid">${data.products.map((p) => { const record = { ...p.record, model: p.model }; const status = record.imageVerificationStatus || 'NOT_REVIEWED'; const rawSource = record.image?.sourcePageUrl || ''; const candidate = /^https:\/\/cpplusworld\.com\//i.test(rawSource) ? rawSource : ''; return `<article class="admin-card admin-image-card" data-image-card data-search="${esc(`${p.model} ${p.category_id}`.toLowerCase())}"><div class="admin-image-preview">${productImageMarkup(record, { fallback: 'No approved local preview', assetPrefix: '../' })}</div><div><h2>${esc(p.model)}</h2><p>${esc(record.name || 'Name not yet verified')} · ${esc(p.category_id)}</p><p><strong>Image status:</strong> ${esc(status)}<br><strong>Reuse permission:</strong> ${esc(record.imagePermissionStatus || record.image?.permissionStatus || 'NOT_ASSESSED')}<br><strong>Model match:</strong> ${record.imageModelMatchVerified === true ? 'Verified' : esc(record.image?.matchStatus || 'Not verified')}</p>${candidate ? `<a href="${esc(candidate)}" target="_blank" rel="noopener noreferrer">Open source product page</a>` : '<span>No exact source page recorded</span>'}</div></article>`; }).join('')}</div>`; view.querySelector('#image-search').addEventListener('input', (e) => { const q=e.target.value.trim().toLowerCase(); view.querySelectorAll('[data-image-card]').forEach((card) => { card.hidden=!card.dataset.search.includes(q); }); }); return; }
  if (page === 'notifications') return renderNotifications({api,view,heading,esc,date,toast});
  if (page === 'activity') {
    const actorId = new URLSearchParams(location.search).get('actor');
    const data = await api(`/api/admin/activity${actorId ? `?actor=${encodeURIComponent(actorId)}` : ''}`);
    const title = actorId ? 'Staff activity' : 'Administrative activity';
    view.innerHTML = `${heading(title, 'Audit history from protected database records.', actorId ? '<a class="button button-outline" href="staff.html">Back to staff</a>' : '')}${data.activity.length ? table(['Action','Record','Actor','Details','Time'],data.activity.map((a) => `<tr><td>${esc(a.action.replaceAll('_',' '))}</td><td>${esc(a.entity_type)}${a.entity_id ? ` · ${esc(a.entity_id)}` : ''}</td><td>${esc(a.actor_id || 'System')}</td><td>${esc(JSON.stringify(a.details || {}))}</td><td>${date(a.created_at)}</td></tr>`).join('')) : empty('No activity recorded.')}`;
    return;
  }
  if (page === 'staff') { await renderStaff({ view, api, profile: currentProfile, esc, date, toast }); return; }
  if (page === 'products') { const data=await api('/api/admin/products'); view.innerHTML=`${heading('Product catalogue',`${data.products.length} database records. Changes here publish to the public catalogue.`, '<button class="button button-primary" id="add-product">Add product</button>')}<p class="admin-muted">The original model number and record identity are protected by the database. Add only verified information; unknown specifications should remain unfilled.</p><label class="admin-search">Search model, name or category <input id="product-search" type="search" placeholder="Search products"></label>${table(['Model','Name','Category','Visibility','Edit'],data.products.map((p)=>`<tr data-product-row="" data-search="${esc(`${p.model} ${p.record.name} ${p.category_id}`.toLowerCase())}"><td>${esc(p.model)}</td><td>${esc(p.record.name||'Not yet verified')}</td><td>${esc(p.category_id)}</td><td>${p.is_visible?'Published':'Hidden'}</td><td><button class="button button-outline" data-product="${esc(p.id)}">Edit record</button></td></tr>`).join(''))}<dialog class="admin-dialog" id="record-dialog"><form method="dialog" id="record-form"><h2 id="record-title">Product record</h2><p>Enter a complete product record as JSON. Keep technical details blank or marked unverified unless sourced.</p><label>Product JSON<textarea name="record" rows="18" required></textarea></label><label><input type="checkbox" name="visible"> Published on website</label><div class="admin-actions"><button class="button button-outline" value="cancel">Cancel</button><button class="button button-primary" value="save">Save</button></div></form></dialog>`; const map=new Map(data.products.map(p=>[p.id,p]));view.querySelectorAll('[data-product]').forEach(b=>b.addEventListener('click',()=>{const p=map.get(b.dataset.product);const f=view.querySelector('#record-form');f.dataset.id=p.id;f.dataset.create='';f.elements.record.value=JSON.stringify(p.record,null,2);f.elements.visible.checked=p.is_visible;view.querySelector('#record-title').textContent=`Edit ${p.model}`;view.querySelector('#record-dialog').showModal();}));view.querySelector('#add-product').addEventListener('click',()=>{const f=view.querySelector('#record-form');f.dataset.id='';f.dataset.create='true';f.elements.record.value=JSON.stringify({id:'',model:'',categoryId:'',name:'',description:'',features:[],specifications:{},applications:[],image:null},null,2);f.elements.visible.checked=false;view.querySelector('#record-title').textContent='Add verified product';view.querySelector('#record-dialog').showModal();});view.querySelector('#product-search').addEventListener('input',e=>{const q=e.target.value.trim().toLowerCase();view.querySelectorAll('[data-product-row]').forEach(r=>r.hidden=!r.dataset.search.includes(q));});view.querySelector('#record-form').addEventListener('submit',async e=>{if(e.submitter.value!=='save')return;e.preventDefault();const f=e.currentTarget;try{const record=JSON.parse(f.elements.record.value);if(f.dataset.create){if(!record.id||!record.model||!record.categoryId)throw new Error('Product id, exact model and category are required.');await api('/api/admin/products',{method:'POST',body:json({record})});}else{const patch={...record};delete patch.id;delete patch.model;delete patch.categoryId;delete patch.modelNumber;await api(`/api/admin/products/${encodeURIComponent(f.dataset.id)}`,{method:'PATCH',body:json({record:patch,isVisible:f.elements.visible.checked})});}toast('Product saved.');renderGeneric();}catch(err){toast(err.message,true);}});return; }
  if (page === 'services') { const data=await api('/api/admin/services'); view.innerHTML=`${heading('Services', 'Edit service content stored in the database and published on the website.')}${table(['Service','Visibility','Edit'],data.services.map(s=>`<tr><td>${esc(s.record.title || s.id)}</td><td>${s.is_visible?'Published':'Hidden'}</td><td><button class="button button-outline" data-service="${esc(s.id)}">Edit record</button></td></tr>`).join(''))}<dialog class="admin-dialog" id="record-dialog"><form method="dialog" id="record-form"><h2>Edit service record</h2><label>Service JSON<textarea name="record" rows="18" required></textarea></label><label><input type="checkbox" name="visible"> Published on website</label><div class="admin-actions"><button class="button button-outline" value="cancel">Cancel</button><button class="button button-primary" value="save">Save</button></div></form></dialog>`;const map=new Map(data.services.map(s=>[s.id,s]));view.querySelectorAll('[data-service]').forEach(b=>b.addEventListener('click',()=>{const s=map.get(b.dataset.service),f=view.querySelector('#record-form');f.dataset.id=s.id;f.record.value=JSON.stringify(s.record,null,2);f.visible.checked=s.is_visible;view.querySelector('#record-dialog').showModal();}));view.querySelector('#record-form').addEventListener('submit',async e=>{if(e.submitter.value!=='save')return;e.preventDefault();const f=e.currentTarget;try{await api(`/api/admin/services/${encodeURIComponent(f.dataset.id)}`,{method:'PATCH',body:json({record:JSON.parse(f.record.value),isVisible:f.visible.checked})});toast('Service updated.');renderGeneric();}catch(err){toast(err.message,true);}});return; }
  if (page === 'settings') { const data=await api('/api/admin/settings');const s=data.settings;view.innerHTML=`${heading('Site settings','Control which verified business contact details are published.')}<form id="settings-form" class="admin-card admin-settings"><p>Values remain private unless their matching publication switch is enabled. Enter only approved business details.</p><label>Business email<input type="email" name="email" maxlength="254" value="${esc(s.email||'')}"></label><label>Business phone<input name="phone" maxlength="40" value="${esc(s.phone||'')}"></label><label>Business address<textarea name="address" maxlength="500">${esc(s.address||'')}</textarea></label><label>Business hours<input name="businessHours" maxlength="300" value="${esc(s.businessHours||'')}"></label><label>Google Maps URL<input type="url" name="mapUrl" maxlength="1000" value="${esc(s.mapUrl||'')}"></label>${[['showEmail','Publish business email'],['showPhone','Publish business phone'],['showAddress','Publish business address'],['showBusinessHours','Publish business hours'],['showMap','Publish Google Maps link']].map(([key,label])=>`<label><input type="checkbox" name="${key}" ${s[key]?'checked':''}> ${label}</label>`).join('')}<button class="button button-primary">Save publication settings</button></form>`;view.querySelector('#settings-form').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget;const settings=Object.fromEntries([...f.querySelectorAll('[type=checkbox]')].map(x=>[x.name,x.checked]));for(const key of ['email','phone','address','businessHours','mapUrl'])settings[key]=f.elements[key].value.trim();try{await api('/api/admin/settings',{method:'PATCH',body:json({settings})});toast('Settings saved.');}catch(err){toast(err.message,true);}});return; }
}

async function boot() {
  if (page === 'login') { renderLogin(); return; }
  try { const { profile } = await api('/api/auth/session'); currentProfile = profile; shell(profile); }
  catch (error) {
    if (error.status === 401) return;
    if (error.status === 403) { location.replace('index.html?disabled=1'); return; }
    app.innerHTML = `<main class="admin-login-shell"><section class="admin-login-card"><h1>Unable to verify your session</h1><p>${esc(error.message)}</p><button class="button button-primary" id="session-retry">Try again</button></section></main>`;
    app.querySelector('#session-retry').addEventListener('click', () => location.reload()); return;
  }
  try { if (page === 'dashboard') await renderDashboard(); else if (page === 'enquiries' || page === 'enquiry-details') {
    const render = page === 'enquiries' ? renderEnquiryList : renderEnquiryRecord;
    await render({ api, profile: currentProfile, view: document.querySelector('#admin-view'), heading, table, esc, date, toast });
  } else await renderGeneric(); }
  catch (error) { const view = document.querySelector('#admin-view'); if (view) { view.innerHTML = `${heading('Unable to load this section', 'The request failed or your account does not have permission.')}<div class="admin-callout" role="alert">${esc(error.message)}</div><button class="button button-outline" id="admin-retry">Try again</button>`; view.querySelector('#admin-retry').addEventListener('click', () => location.reload()); } }
}
boot();
