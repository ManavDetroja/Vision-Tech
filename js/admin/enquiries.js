const statuses = ['NEW','CONTACTED','IN_PROGRESS','CONVERTED','CLOSED'];
const categories = ['general','product','installation','repair','maintenance','upgrade'];
const readable = value => String(value).replaceAll('_',' ').toLowerCase();
const endpoint = id => '/api/admin/enquiries/' + encodeURIComponent(id);

function enquiryControls({ esc, api, toast }, people) {
  const person = id => people.find(p => p.id === id);
  const personName = p => p?.full_name || p?.notification_email || p?.id;
  const options = (items, selected) => items.map(([value,label]) =>
    `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(label)}</option>`).join('');
  const staffOptions = people.filter(p => p.account_state === 'ACTIVE').map(p => [p.id, personName(p)]);
  function select(row, field) {
    const isStatus = field === 'status';
    const selected = isStatus ? row.status : row.assigned_to || '';
    const items = isStatus ? statuses.map(s => [s,s.replaceAll('_',' ')]) : [['','Unassigned'],...staffOptions];
    if (!isStatus && selected && !items.some(([id]) => id === selected)) items.push([selected,personName(person(selected)) || row.assignee?.full_name || selected]);
    return `<select aria-label="${isStatus ? 'Status' : 'Assignment'} for ${esc(row.enquiry_code)}" data-field="${field}" data-id="${esc(row.id)}" data-original="${esc(selected)}">${options(items,selected)}</select>`;
  }
  function bind(root, refresh) {
    root.querySelectorAll('[data-field]').forEach(control => control.addEventListener('change', async () => {
      const value = control.value, old = control.dataset.original, field = control.dataset.field;
      if (!confirm(`Change ${control.getAttribute('aria-label')} to ${control.selectedOptions[0].textContent}?`)) {
        control.value = old; return;
      }
      control.disabled = true;
      try {
        await api(endpoint(control.dataset.id)+'/'+field, {method:'PATCH',body:JSON.stringify(
          field === 'status' ? {status:value} : {assignee:value || null})});
      } catch (error) { control.value = old; toast(error.message,true); control.disabled = false; return; }
      control.dataset.original = value;
      toast('Enquiry updated.');
      await refresh();
    }));
  }
  return {options, staffOptions, select, bind, personName};
}

export async function renderEnquiryList(ctx) {
  const {api, view, profile, heading, table, esc, date} = ctx;
  const manager = profile.role !== 'STAFF';
  const {assignees} = manager ? await api('/api/admin/assignees?includeDisabled=true') : {assignees:[]};
  const controls = enquiryControls(ctx,assignees);
  const filter = (name,label,items) => `<label>${label}<select name="${name}">${controls.options(items,'')}</select></label>`;
  view.innerHTML = heading('Customer enquiries',manager ? 'All customer requests' : 'Requests assigned to you') +
    `<form class="admin-filter" id="enquiry-filters">
      <label>Search<input name="q" type="search" maxlength="120" placeholder="Number, name, phone or email"></label>
      ${filter('status','Status',[['','All statuses'],...statuses.map(s=>[s,s.replaceAll('_',' ')])])}
      ${filter('type','Enquiry type',[['','All types'],...categories.map(s=>[s,s])])}
      ${manager ? filter('assignedTo','Assigned to',[['','All assignments'],['unassigned','Unassigned'],...assignees.map(p=>[p.id,controls.personName(p)+(p.account_state==='DISABLED'?' (disabled)':'')])]) : ''}
      <label>From (UTC)<input type="date" name="from"></label><label>Through (UTC)<input type="date" name="to"></label>
      ${filter('sort','Sort by',[['newest','Newest first'],['oldest','Oldest first'],['customer','Customer A–Z'],['number','Enquiry number']])}
      ${filter('pageSize','Rows per page',[['25','25'],['10','10'],['50','50']])}
      <button class="button button-primary">Apply filters</button><button class="button button-outline" type="button" data-clear>Clear</button>
    </form><div id="enquiry-results" aria-live="polite"></div>`;
  const form = view.querySelector('form'), results = view.querySelector('#enquiry-results');
  let applied = new URLSearchParams(new FormData(form)), page = 1, sequence = 0;
  async function load() {
    const version = ++sequence, params = new URLSearchParams(applied);
    params.set('page',page);
    results.innerHTML = '<p role="status">Loading enquiries…</p>';
    try {
      const data = await api('/api/admin/enquiries?'+params);
      if (version !== sequence) return;
      const rows = data.enquiries.map(r => `<tr>
        <td><a href="enquiry-details.html?id=${encodeURIComponent(r.id)}">${esc(r.enquiry_code)}</a></td>
        <td>${esc(r.customer_name)}</td><td>${esc(r.customer_phone)}<br>${esc(r.customer_email || '—')}</td>
        <td>${esc(readable(r.enquiry_type))}</td><td>${esc(r.product_model || '—')}</td>
        <td>${controls.select(r,'status')}</td><td>${manager ? controls.select(r,'assign') : esc(profile.full_name || 'You')}</td>
        <td>${date(r.follow_up_at)}</td><td>${date(r.created_at)}</td></tr>`).join('');
      results.innerHTML = (rows ? table(['Number','Customer','Phone / email','Type','Product','Status','Assigned to','Follow-up','Submitted'],rows) :
        '<p class="admin-empty">No enquiries match these filters.</p>') +
        `<nav class="dash-actions" aria-label="Enquiry pages"><button class="button button-outline" data-prev ${page===1?'disabled':''}>Previous</button><span>Page ${page}</span><button class="button button-outline" data-next ${data.hasMore?'':'disabled'}>Next</button></nav>`;
      controls.bind(results,load);
      results.querySelector('[data-prev]').onclick = () => {page--;load();};
      results.querySelector('[data-next]').onclick = () => {page++;load();};
    } catch (error) {
      if (version !== sequence) return;
      results.innerHTML = `<p role="alert">${esc(error.message)}</p><button class="button button-outline" data-retry>Retry</button>`;
      results.querySelector('[data-retry]').onclick = load;
    }
  }
  function apply() { applied = new URLSearchParams(new FormData(form)); page = 1; load(); }
  form.onsubmit = event => {event.preventDefault();apply();};
  form.querySelector('[data-clear]').onclick = () => { form.reset(); apply(); };
  await load();
}

export async function renderEnquiryRecord(ctx) {
  const {api,view,profile,heading,esc,date,toast} = ctx;
  const query = new URLSearchParams(location.search), id = query.get('id');
  if (!id) throw new Error('Missing enquiry ID.');
  const url = endpoint(id), manager = profile.role !== 'STAFF';
  // Keep the parent enquiry read ahead of related staff-directory requests.
  const data = await api(url+'?'+new URLSearchParams({historyPage:query.get('historyPage')||'1',notesPage:query.get('notesPage')||'1'}));
  const {assignees} = manager ? await api('/api/admin/assignees') : {assignees:[]};
  const controls = enquiryControls(ctx,assignees), r = data.enquiry;
  function pager(key,more) {
    const page = Number(query.get(key)||1);
    function link(n,label) {
      const params=new URLSearchParams(query); params.set(key,n);
      return `<a class="button button-outline" href="?${esc(params.toString())}">${label}</a>`;
    }
    return page>1 || more ? `<nav class="dash-actions" aria-label="${key==='historyPage'?'Activity':'Notes'} pages">${page>1?link(page-1,'Newer'):''} Page ${page} ${more?link(page+1,'Older'):''}</nav>` : '';
  }
  const actorName = (p,id) => p?.full_name || controls.personName(assignees.find(a=>a.id===id)) || id || 'System';
  const detail = (label,value) => `<dt>${label}</dt><dd>${esc(value || '—')}</dd>`;
  const product = r.product_model ? `<a href="../product-details.html?model=${encodeURIComponent(r.product_model)}">${esc(r.product_model)}</a>` : '—';
  function eventDescription(event) {
    const details=event.details || {};
    switch(event.action) {
      case 'ENQUIRY_STATUS_CHANGED': return 'Status changed to '+readable(details.status);
      case 'ENQUIRY_ASSIGNED': return details.assignedTo ? 'Assigned to '+actorName(null,details.assignedTo) : 'Assignment cleared';
      case 'ENQUIRY_FOLLOW_UP_CHANGED': return details.followUpAt ? 'Follow-up set for '+date(details.followUpAt) : 'Follow-up cleared';
      default: return readable(event.action);
    }
  }
  view.innerHTML = heading(esc(r.enquiry_code),'Submitted '+date(r.created_at),'<a href="enquiries.html" class="button button-outline">Back to enquiries</a>') +
    `<section class="admin-detail-grid"><article class="admin-card"><h2>Customer information</h2><dl>
      ${detail('Name',r.customer_name)}${detail('Phone',r.customer_phone)}
      <dt>Email</dt><dd>${r.customer_email?`<a href="mailto:${esc(r.customer_email)}">${esc(r.customer_email)}</a>`:'Not supplied'}</dd>
      ${detail('Enquiry type',readable(r.enquiry_type))}<dt>Product model</dt><dd>${product}</dd>
      ${detail('Service request',r.service_requirement)}</dl><h3>Original message</h3><p class="admin-message">${esc(r.customer_message)}</p></article>
      <article class="admin-card"><h2>Manage enquiry</h2><label>Status${controls.select(r,'status')}</label>
      <label>Assigned to${manager?controls.select(r,'assign'):esc(profile.full_name || 'You')}</label>
      <label>Follow-up date (UTC)<input type="date" id="follow-date" value="${esc(r.follow_up_at?.slice(0,10)||'')}"></label>
      <button class="button button-outline" id="follow-save">Save follow-up</button>
      ${data.email?`<p>Email notification · ${esc(data.email.status)} ${esc(data.email.last_error || '')}</p>`:''}
      ${data.email && data.email.status!=='SENT'?'<button class="button button-outline" id="email-retry">Retry email notification</button>':''}
      ${profile.role==='SUPER_ADMIN'?'<button class="button button-danger" id="delete-enquiry">Delete enquiry</button>':''}</article></section>
      <section class="admin-section admin-card"><h2>Private internal notes</h2>
      <form id="note-form"><label for="note-text">Add a staff-only note</label><textarea id="note-text" name="note" maxlength="4000" required></textarea><button class="button button-primary">Add note</button></form>
      <div class="admin-notes">${data.notes.map(n=>`<article><p>${esc(n.note)}</p><small>${esc(actorName(n.author,n.author_id))} · ${date(n.created_at)}</small></article>`).join('') || '<p>No internal notes yet.</p>'}</div>${pager('notesPage',data.moreNotes)}</section>
      <section class="admin-section admin-card"><h2>Activity timeline</h2><ol class="admin-history">${data.activity.map(a=>`<li><strong>${esc(eventDescription(a))}</strong><small>${esc(actorName(a.actor,a.actor_id))} · ${date(a.created_at)}</small></li>`).join('')}</ol>
      ${data.activity.length?'':'<p>No recorded activity.</p>'}${pager('historyPage',data.moreHistory)}</section>`;
  async function refresh() {
    try {await renderEnquiryRecord(ctx);}
    catch(error){view.innerHTML=`<p role="alert">Refresh failed. ${esc(error.message)}</p><button class="button button-outline">Retry</button>`;view.querySelector('button').onclick=refresh;}
  }
  controls.bind(view,refresh);
  async function submit(button,path,method,body,message) {
    button.disabled=true;
    try {
      const result=await api(path,{method,body:JSON.stringify(body)});
      toast(typeof message==='function'?message(result):message);
      if(method==='DELETE') location.replace('enquiries.html');
      else await refresh();
    } catch(error){toast(error.message,true);button.disabled=false;}
  }
  view.querySelector('#follow-save').onclick = e => submit(e.currentTarget,url+'/follow-up','PATCH',{followUpDate:view.querySelector('#follow-date').value || null},'Follow-up saved.');
  view.querySelector('#note-form').onsubmit = e => {e.preventDefault();submit(e.currentTarget.querySelector('button'),url+'/notes','POST',{note:e.currentTarget.elements.note.value},'Internal note saved.');};
  const retry=view.querySelector('#email-retry');
  if(retry) retry.onclick = () => {if(confirm('Retry this enquiry notification email?')) submit(retry,'/api/admin/email-outbox/'+encodeURIComponent(data.email.id)+'/retry','POST',{},result=>result.notification.accepted?'Email provider accepted the notification.':'Email delivery remains unconfirmed.');};
  const del=view.querySelector('#delete-enquiry');
  if(del) del.onclick=()=>{if(confirm('Permanently delete '+r.enquiry_code+' and its notes?')) submit(del,url,'DELETE',{confirm:true},'Enquiry deleted.');};
}
