import { seedProducts } from './catalogue-seed.mjs';
const target = new URL(process.env.SUPABASE_URL);
const local = ['127.0.0.1','localhost','[::1]'].includes(target.hostname);
if (!local && (target.origin !== 'https://fszrsispjxunckknphaw.supabase.co' ||
    !process.argv.includes('--staging-fszrsispjxunckknphaw'))) {
  throw new Error('Catalogue bootstrap requires the explicitly selected VisionTech staging target or loopback.');
}
await seedProducts();
console.log('Checked 19 baseline products. Existing rows retain their values.');
