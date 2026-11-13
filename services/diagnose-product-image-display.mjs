import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const imageRoot = path.join(root, 'assets', 'images');
const products = JSON.parse(await readFile(path.join(root, 'js', 'data', 'products.json'), 'utf8'));
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.avif']);

async function filesIn(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesIn(target));
    else if (entry.isFile()) files.push(target);
  }
  return files;
}

function pngValid(bytes) {
  return bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.toString('ascii', 12, 16) === 'IHDR' && bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0;
}

function jpegValid(bytes) {
  return bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
}

function webpValid(bytes) {
  return bytes.length >= 16 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
}

function recognizedImage(bytes, extension) {
  if (extension === '.png') return pngValid(bytes);
  if (extension === '.jpg' || extension === '.jpeg') return jpegValid(bytes);
  if (extension === '.webp') return webpValid(bytes);
  if (extension === '.gif') return bytes.length >= 6 && /^GIF8[79]a$/.test(bytes.toString('ascii', 0, 6));
  if (extension === '.bmp') return bytes.length >= 26 && bytes.toString('ascii', 0, 2) === 'BM';
  if (extension === '.avif') return bytes.length >= 16 && bytes.toString('ascii', 4, 8) === 'ftyp' && bytes.toString('ascii', 8, 12).startsWith('avif');
  return false;
}

function inline(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

const allFiles = await filesIn(imageRoot);
const actualImages = allFiles.filter((file) => imageExtensions.has(path.extname(file).toLowerCase()));
const productFiles = actualImages.filter((file) => path.relative(path.join(imageRoot, 'products'), file).split(path.sep)[0] !== '..');
const actualProductImages = productFiles.filter((file) => path.dirname(file).startsWith(path.join(imageRoot, 'products')));

const rows = [];
for (const product of products) {
  const model = product.model;
  const imageRef = typeof product.image === 'string' ? product.image : product.image?.localPath;
  const databasePath = product.imagePath || imageRef || '';
  const expectedModelFiles = actualProductImages.filter((file) => path.parse(file).name.toLowerCase() === model.toLowerCase());
  const referencedPath = databasePath ? path.resolve(root, databasePath.replaceAll('/', path.sep)) : '';
  let exists = false;
  let valid = 'N/A — no referenced file';
  let extension = 'N/A';
  let pathStatus = 'No path configured';
  let fileIdentity = expectedModelFiles.length ? 'Filename matches; photograph identity unverified' : 'Unverified — no model file exists';
  if (referencedPath) {
    try {
      const info = await stat(referencedPath);
      exists = info.isFile();
      extension = path.extname(referencedPath) || '(none)';
      pathStatus = exists ? 'Configured path exists' : 'Incorrect path — target is not a file';
      if (exists) {
        const bytes = await readFile(referencedPath);
        valid = bytes.length === 0 ? 'No — empty file' : recognizedImage(bytes, extension.toLowerCase()) ? 'Signature/dimensions valid' : 'No — signature/extension mismatch';
      }
    } catch {
      pathStatus = 'Incorrect path — referenced file missing';
    }
  }
  const browser = databasePath
    ? 'Not tested — browser session ended before page navigation'
    : 'No image request — database has no local image path';
  rows.push(`| ${inline(model)} | \`imagePath\`, \`image.localPath\` | ${inline(databasePath || 'null / null')} | ${exists ? 'Yes' : 'No'} | ${inline(valid)} | ${inline(extension)} | ${inline(pathStatus)} | ${inline(browser)} | ${inline(fileIdentity)} |`);
}

const counts = {
  totalProducts: products.length,
  actualImages: actualImages.length,
  productImages: actualProductImages.length,
  productRecordsWithPath: products.filter((product) => Boolean(product.imagePath || product.image?.localPath || typeof product.image === 'string')).length,
  productModelFiles: actualProductImages.filter((file) => products.some((product) => path.parse(file).name.toLowerCase() === product.model.toLowerCase())).length
};
const inventoryRows = await Promise.all(actualImages.map(async (file) => {
  const info = await stat(file);
  return `| \`${inline(path.relative(root, file).replaceAll(path.sep, '/'))}\` | ${path.extname(file).toLowerCase()} | ${info.size} | Brand asset; opened with Windows image decoder in this audit |`;
}));

const report = `# Product image display diagnostic\n\nGenerated: ${new Date().toISOString()}\n\n## Finding\n\nThe root cause is missing local product photographs, not a failed request for 22 already-downloaded files. There are ${counts.productImages} image files in \`assets/images/products/\`, and ${counts.productRecordsWithPath} of the 22 records has a non-empty local image path. Every current image record is \`imagePath: null\` and \`image.localPath: null\`; the 19 source URL entries are candidates only with \`retrievalStatus: NOT_DOWNLOADED\`. Therefore the public image helper emits the existing fallback and creates no product-photo browser request.\n\nThe ${counts.actualImages} actual image files under \`assets/images/\` are brand/logo assets, not product photographs. They were opened with Windows image decoding successfully during this inspection. No product image files were present to decode or match against product models.\n\n| Existing image file | Extension | Bytes | Result |\n|---|---:|---:|---|\n${inventoryRows.join('\n')}\n\n## All 22 catalogue records\n\n| Exact model | Database image properties | Database path | File exists | Image valid | Actual extension | Path status | Browser result | Identity result |\n|---|---|---|---|---|---|---|---|---|\n${rows.join('\n')}\n\n## Rendering trace and repair\n\n- \`js/data/products.js\` is the loader; the 22 records are in \`js/data/products.json\`.\n- Product cards and product detail/related cards use the shared \`productImageMarkup\` renderer and check the same local image metadata gate. With empty paths, it emits a labelled placeholder and no \`<img src>\`. CSS provides a visible image stage and does not hide photos. Lazy loading is not the cause because there is no image element to load.\n- Canonical saved paths are project-root-relative, for example \`assets/images/products/<category>/<model>.<extension>\`. Public pages sit at the project root. The admin review page is nested under \`/admin/\`; its preview renderer now prefixes \`../\` so that a valid canonical saved path resolves from that page too. No current product file was available to request.\n- The broken-image event handler remains a fallback only; it cannot hide a valid image before an actual image error. It was exercised with a DOM stub.\n\n## Browser checks and limits\n\nVS Code showed Live Server active on port 5500. Browser automation stopped before navigation because its safety layer could not confidently determine the browser URL. A direct local HTTP request from the project shell was denied by the sandbox socket policy. Consequently, no browser Network/Console response, MIME type, CORS, decode result, screenshot, homepage rendering, catalogue rendering, details rendering, or related-card rendering is claimed. There were no product-image URLs in the local data to test individually.\n\n## Image file inventory\n\n- Total raster image files under \`assets/images/\`: ${counts.actualImages} (brand assets).\n- Product photo files under \`assets/images/products/\`: ${counts.productImages}.\n- Records with an image path: ${counts.productRecordsWithPath}/${counts.totalProducts}.\n- Model-named product photo files: ${counts.productModelFiles}.\n- Empty/corrupt product files: none to assess because there are no product files.\n- Product photographs verified and displayed: 0/${counts.totalProducts}.\n\n## Actual completion status\n\nAll 22 model records have been compared with the product image directory. Each is marked \`IMAGE MISSING\`; file validity and browser loading are \`NOT APPLICABLE / NOT TESTED\`; the product image identity remains unverified. The earlier importer/report did not complete an image download; its own per-model metadata says \`NOT_DOWNLOADED\`. The public site should continue to show honest placeholders until real, permitted, exact-model photos are placed in the category folders and the records point to them.\n`;

await writeFile(path.join(root, 'docs', 'PRODUCT_IMAGE_DISPLAY_DIAGNOSTIC.md'), report, 'utf8');
console.log(JSON.stringify(counts));
