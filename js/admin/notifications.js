export function updateBell(unread) {
  const badge=document.querySelector('#unread-count');
  if (!badge) return;
  badge.textContent=String(unread);
  badge.hidden=unread===0;
  badge.closest('a').setAttribute('aria-label','Notifications, '+unread+' unread');
}

export async function renderNotifications({api,view,heading,esc,date,toast}) {
  let page=1;
  async function load() {
    view.innerHTML='<p role="status">Loading notifications…</p>';
    try {
      const result=await api('/api/admin/notifications?page='+page);
      updateBell(result.unread);
      const entries=result.notifications.map(n=>{
        const link=n.enquiry_id ? '<a href="enquiry-details.html?id='+encodeURIComponent(n.enquiry_id)+'">Open enquiry</a>' :
          n.staff_id ? '<a href="staff.html?id='+encodeURIComponent(n.staff_id)+'">View staff account</a>' : '';
        return '<article class="admin-card"><div><h2>'+esc(n.title)+'</h2><small>'+date(n.created_at)+'</small> '+
          (n.read_at?'Read':'<span class="admin-badge">Unread</span>')+'</div>'+link+
          (n.read_at?'':'<button class="button button-outline" data-read="'+esc(n.id)+'" aria-label="Mark as read: '+esc(n.title)+'">Mark as read</button>')+'</article>';
      }).join('');
      view.innerHTML=heading('Notifications',result.unread+' unread',result.unread?'<button class="button button-primary" data-all>Mark all as read</button>':'')+
        '<p id="notification-feedback" role="status"></p>'+
        (entries?'<div class="admin-record-list">'+entries+'</div>':'<p class="admin-empty">No notifications on this page.</p>')+
        '<nav class="dash-actions" aria-label="Notification history pages"><button class="button button-outline" data-prev '+(page===1?'disabled':'')+'>Previous</button><span>Page '+page+'</span><button class="button button-outline" data-next '+(!result.hasMore?'disabled':'')+'>Next</button></nav>';
      async function mark(button,path) {
        button.disabled=true;
        try { await api(path,{method:'POST'}); await load(); toast('Notifications updated.'); }
        catch(error) { button.disabled=false; view.querySelector('#notification-feedback').textContent=error.message+' Please try again.'; }
      }
      view.querySelector('[data-all]')?.addEventListener('click',e=>mark(e.currentTarget,'/api/admin/notifications/read-all'));
      view.querySelectorAll('[data-read]').forEach(b=>b.onclick=()=>mark(b,'/api/admin/notifications/'+encodeURIComponent(b.dataset.read)+'/read'));
      view.querySelector('[data-prev]').onclick=()=>{page--;load();};
      view.querySelector('[data-next]').onclick=()=>{page++;load();};
    } catch(error) {
      view.innerHTML=heading('Notifications','')+'<p role="alert">'+esc(error.message)+'</p><button class="button button-outline">Retry</button>';
      view.querySelector('button').onclick=load;
    }
  }
  await load();
}
