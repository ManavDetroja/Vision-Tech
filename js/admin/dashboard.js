const statuses = [
  ['New', 'new'], ['Contacted', 'contacted'], ['In progress', 'inProgress'],
  ['Converted', 'converted'], ['Closed', 'closed']
];

function count(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Dashboard counts are unavailable. Please retry.');
  return value;
}

const fmt = n => count(n).toLocaleString();
const notice = message => '<p class="dash-empty">' + message + '</p>';
const card = (title, body) => '<section class="admin-card dash-panel"><h2>' + title + '</h2>' + body + '</section>';

function breakdown(rows) {
  const max = Math.max(1, ...rows.map(row => row[1]));
  return '<ul class="dash-series">' + rows.map(([label, n]) =>
    '<li><span>' + label + '</span><meter aria-hidden="true" min="0" max="' + max + '" value="' + n + '"></meter><strong>' + fmt(n) + '</strong></li>'
  ).join('') + '</ul>';
}

function metric(label, n, caption = '') {
  return '<article class="admin-stat"><span>' + label + '</span><strong>' + fmt(n) + '</strong><small>' + caption + '</small></article>';
}

function trend(monthly, asOf) {
  if (!monthly.length) return notice('Monthly data is unavailable.');
  const anchor = new Date(asOf);
  const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const last = monthLabels.indexOf(monthly.at(-1).label);
  if (last < 0 || !Number.isFinite(anchor.getTime())) throw new Error('Monthly reporting period is unavailable.');
  // Use the database month labels even for a request spanning midnight on New Year.
  let year = anchor.getUTCFullYear();
  if (last === 11 && anchor.getUTCMonth() === 0) year--;
  if (last === 0 && anchor.getUTCMonth() === 11) year++;
  const rows = monthly.map((m, i) => {
    const start = new Date(Date.UTC(year, last - monthly.length + 1 + i, 1));
    const month = monthLabels[start.getUTCMonth()];
    if (month !== m.label) throw new Error('Monthly reporting periods are inconsistent.');
    return [month + ' ' + start.getUTCFullYear(), count(m.enquiries)];
  });
  return '<p class="admin-muted">' + rows[0][0] + ' – ' + rows.at(-1)[0] + ' · current month to date</p>' +
    (rows.some(([, n]) => n > 0) ? breakdown(rows) : notice('No submissions in this period.'));
}

export function dashboardMarkup(data, profile, {heading, table, statusBadge, esc, date, links}) {
  const { stats: s, staffOverview, recent, dueFollowUps, notifications } = data;
  const manager = ['ADMIN','SUPER_ADMIN'].includes(profile.role);
  const distribution = statuses.map(([label, key]) => [label, count(s[key])]);
  const activity = (rows, none) => rows.length ? '<ul class="admin-list">' + rows.map(row =>
    '<li>' + (row.actor?.full_name ? esc(row.actor.full_name) + ' · ' : '') +
    esc(row.action.replaceAll('_', ' ').toLowerCase()) + ' · ' + esc(row.entity_type) +
    '<small>' + date(row.created_at) + '</small></li>').join('') + '</ul>' : notice(none);
  const enquiryLink = r => '<a href="enquiry-details.html?id=' + encodeURIComponent(r.id) + '">' + esc(r.enquiry_code) + '</a>';
  const quickLabels = { enquiries: 'Manage enquiries', staff: 'Manage staff', products: 'Manage products', settings: 'Admin settings' };
  const quick = links.filter(([key]) => quickLabels[key]).map(([key,,href]) =>
    '<a class="button button-outline" href="' + href + '">' + quickLabels[key] + '</a>').join('');
  const staff = manager ? card('Staff overview',
    '<p class="admin-muted">Accounts with the Staff role</p><dl class="dash-staff">' +
    [['Total staff', staffOverview.total], ['Active', staffOverview.active], ['Disabled', staffOverview.disabled]]
      .map(([label,n]) => '<div><dt>' + label + '</dt><dd>' + fmt(n) + '</dd></div>').join('') +
    '</dl><h3>Recent staff activity</h3>' + activity(staffOverview.activity, 'No staff activity recorded.')) : '';
  const overview = [
    metric('Total enquiries', s.enquiriesTotal, 'All time'), metric('New', s.new, 'Awaiting first contact'),
    metric('Pending', s.new + s.contacted, 'New or contacted'), metric('In progress', s.inProgress, 'Work underway'),
    metric('Resolved', s.closed, 'Closed enquiries')
  ].join('');
  const recentTable = recent.length ? table(['Enquiry ID','Customer','Category','Status','Follow-up','Submitted'],
    recent.map(r => '<tr><td>' + enquiryLink(r) + '</td><td>' + esc(r.customer_name) +
      '</td><td>' + esc(r.enquiry_type.replaceAll('_',' ')) + '</td><td>' + statusBadge(r.status) +
      '</td><td>' + date(r.follow_up_at) + '</td><td>' + date(r.created_at) + '</td></tr>').join(''))
    : notice('No enquiries in this view.');
  const due = dueFollowUps.length ? '<ul class="admin-list">' + dueFollowUps.map(r =>
    '<li>' + enquiryLink(r) + ' · ' + esc(r.customer_name) + '<small>' + date(r.follow_up_at) + '</small></li>').join('') + '</ul>' : notice('No follow-ups due.');
  return heading('Dashboard overview', (manager ? 'All enquiries' : 'Your assigned enquiries') + ' · Updated ' + date(data.asOf)) +
    '<nav class="dash-actions" aria-label="Quick actions">' + quick + '</nav>' +
    '<section class="admin-stat-grid dash-metrics" aria-label="Enquiry overview">' + overview + '</section>' +
    '<div class="dash-grid">' + card('Status distribution', s.enquiriesTotal ? breakdown(distribution) : notice('No enquiries to break down by status.')) +
    card('Monthly submissions', trend(s.monthly, data.asOf)) + '</div>' +
    card('Recent enquiries', recentTable) + '<div class="dash-grid">' +
    card('Recent enquiry activity', activity(data.enquiryActivity, 'No enquiry activity recorded.')) +
    card('Follow-ups due · ' + fmt(s.followUpDue), due) + staff +
    card('Recent administrative activity', activity(data.activity, 'No administrative activity recorded.')) +
    card('Unread notifications', notifications.length ? '<ul class="admin-list">' + notifications.map(n =>
      '<li>' + esc(n.title) + '<small>' + date(n.created_at) + '</small></li>').join('') + '</ul>' : notice('No unread notifications.')) +
    (manager ? card('Products', '<a href="products.html">' + fmt(s.products) + ' catalogue products</a>') : '') + '</div>';
}
