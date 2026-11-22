export const config = {
  supabaseUrl: (process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
  publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '',
  secretKey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  appOrigin: process.env.APP_ORIGIN || '',
  rateSecret: process.env.RATE_LIMIT_HASH_SECRET || '',
  resendKey: process.env.RESEND_API_KEY || '',
  notificationRecipients: process.env.NOTIFICATION_APPROVED_RECIPIENTS || '{}',
  emailFrom: process.env.ENQUIRY_FROM_EMAIL || '',
  enquiryNotificationEmail: (process.env.ENQUIRY_NOTIFICATION_EMAIL || '').trim().toLowerCase(),
  adminUrl: process.env.ADMIN_DASHBOARD_URL || '',
  trustedProxy: process.env.TRUST_PROXY === 'true',
  port: Number(process.env.ADMIN_API_PORT || 4175),
  production: process.env.NODE_ENV === 'production',
  staffInvitationEmailConfigured: process.env.STAFF_INVITATION_EMAIL_CONFIGURED === 'true'
};

export function missingConfig() {
  const missing = [];
  if (!validOrigin(config.supabaseUrl)) missing.push('SUPABASE_URL');
  if (!config.publishableKey) missing.push('SUPABASE_PUBLISHABLE_KEY');
  if (!config.secretKey) missing.push('SUPABASE_SECRET_KEY');
  if (!validOrigin(config.appOrigin)) missing.push('APP_ORIGIN');
  if (config.rateSecret.length < 32) missing.push('RATE_LIMIT_HASH_SECRET');
  return missing;
}

export function missingPublicConfig() {
  return missingConfig();
}

function validOrigin(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && url.origin === value
      && !url.username && !url.password && (url.protocol === 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  } catch { return false; }
}
