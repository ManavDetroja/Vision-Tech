export const roles = ['SUPER_ADMIN', 'ADMIN', 'STAFF'];
export const statuses = ['NEW', 'CONTACTED', 'IN_PROGRESS', 'CONVERTED', 'CLOSED'];
export const enquiryTypes = new Map([
  ['product', 'PRODUCT_INFORMATION'], ['installation', 'CCTV_INSTALLATION'], ['repair', 'CCTV_REPAIR'],
  ['maintenance', 'CCTV_MAINTENANCE'], ['upgrade', 'CCTV_UPGRADE'], ['general', 'GENERAL_ENQUIRY']
]);

