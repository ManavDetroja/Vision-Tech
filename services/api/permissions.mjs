export const managers = ['SUPER_ADMIN', 'ADMIN'];
export const permittedStaffRoles = (role) => role === 'SUPER_ADMIN' ? ['STAFF', 'ADMIN'] : role === 'ADMIN' ? ['STAFF'] : [];
export function canManageStaff(actor, target, desiredRole = target.role) {
  return actor.id !== target.id && target.role !== 'SUPER_ADMIN'
    && permittedStaffRoles(actor.role).includes(target.role)
    && permittedStaffRoles(actor.role).includes(desiredRole);
}

// This gate supplements database RLS/RPC checks; it never replaces them.
export function routePermission(path, method) {
  if (path.startsWith('/api/admin/staff')) return { name: 'STAFF_MANAGEMENT', roles: managers };
  if (path.startsWith('/api/admin/settings')) return { name: 'BUSINESS_SETTINGS', roles: ['SUPER_ADMIN'] };
  if (/^\/api\/admin\/(products|services|email-outbox)(\/|$)/.test(path)) return { name: 'CONTENT_AND_DELIVERY', roles: managers };
  if (/^\/api\/admin\/enquiries\/[\w-]+\/assign$/.test(path) || path === '/api/admin/assignees') return { name: 'ENQUIRY_ASSIGNMENT', roles: managers };
  if (/^\/api\/admin\/enquiries\/[\w-]+$/.test(path) && method === 'DELETE') return { name: 'ENQUIRY_DELETION', roles: ['SUPER_ADMIN'] };
  return { name: 'ASSIGNED_OPERATIONS', roles: ['SUPER_ADMIN', 'ADMIN', 'STAFF'] };
}
