import { services } from '../js/data/services.js';
import { seedProducts, insertMissing } from './catalogue-seed.mjs';
await seedProducts();
await insertMissing('service_content',services.map(record=>({id:record.id,record,is_visible:true})),'id');
console.log('Checked catalogue and service bootstrap. Existing rows retain their values.');
