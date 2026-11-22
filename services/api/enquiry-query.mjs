import { HttpError } from './http.mjs';
import { statuses, enquiryTypes } from './constants.mjs';
import { uuid } from './staff-service.mjs';

const listFields = 'id,enquiry_code,customer_name,customer_email,customer_phone,enquiry_type,status,product_model,service_requirement,created_at,assigned_to,follow_up_at,converted_at,closed_at,assignee:profiles!enquiries_assigned_to_fkey(full_name)';
const orders = new Map([
  ['newest', 'created_at.desc'], ['oldest', 'created_at.asc'],
  ['customer', 'customer_name.asc'], ['number', 'enquiry_code.asc']
]);
function invalid(message) { throw new HttpError(422, 'VALIDATION_ERROR', message); }
export function positivePage(value, label = 'page') {
  if (value === null) return 1;
  if (!/^[1-9]\d{0,6}$/.test(value)) invalid('Choose a valid ' + label + '.');
  return Number(value);
}
function day(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid('Enter a valid calendar date.');
  const date = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== value) invalid('Enter a valid calendar date.');
  return date;
}
export async function listEnquiries(input, request) {
  const page = positivePage(input.get('page'));
  const size = input.get('pageSize') ?? '25';
  if (!['10','25','50'].includes(size)) invalid('Choose a supported page size.');
  const limit = Number(size);
  const order = orders.get(input.get('sort') || 'newest');
  if (!order) invalid('Choose a valid sort order.');
  const params = new URLSearchParams({select:listFields, order:order+',id.asc', offset:String((page-1)*limit), limit:String(limit+1)});
  const status = input.get('status'), type = input.get('type'), assigned = input.get('assignedTo');
  if (status && !statuses.includes(status)) invalid('Choose a valid status.');
  if (type && !enquiryTypes.has(type)) invalid('Choose a valid enquiry type.');
  if (assigned && assigned !== 'unassigned' && !uuid(assigned)) invalid('Choose a valid assignee.');
  if (status) params.set('status','eq.'+status);
  if (type) params.set('enquiry_type','eq.'+enquiryTypes.get(type));
  if (assigned) params.set('assigned_to',assigned === 'unassigned' ? 'is.null' : 'eq.'+assigned);
  const from = input.get('from'), to = input.get('to');
  if (from && to && from > to) invalid('The end date must be on or after the start date.');
  if (from) params.append('created_at','gte.'+day(from).toISOString());
  if (to) {
    const end = day(to);
    end.setUTCDate(end.getUTCDate()+1);
    params.append('created_at','lt.'+end.toISOString());
  }
  const term = (input.get('q') || '').trim();
  if (term) {
    if (term.length > 120 || !/^[\p{L}\p{M}\p{N} .@+,()'’_-]+$/u.test(term)) invalid('Use a name, email, phone number or enquiry number for search.');
    // Only fixed identifiers and operators enter the PostgREST grammar. Quote the
    // value and escape LIKE's literal underscore, including its quoted backslash.
    const pattern = '"*'+term.replaceAll('_','\\\\_')+'*"';
    params.set('or','('+['enquiry_code','customer_name','customer_phone','customer_email'].map(field=>field+'.ilike.'+pattern).join(',')+')');
  }
  const rows = await request('/rest/v1/enquiries?'+params);
  return {enquiries:rows.slice(0,limit),page,pageSize:limit,hasMore:rows.length>limit};
}
