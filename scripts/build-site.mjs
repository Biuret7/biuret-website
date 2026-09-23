import { cp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');

// Only browser-safe portfolio files belong in the GitHub Pages artifact.
// Commerce sources remain in the repository for a future launch, but licensing
// pages and Paddle checkout code are intentionally excluded from this build.
const publicFiles = [
  '.openai/hosting.json',
  '404.html',
  'academy_icon.ico',
  'account.html',
  'account.js',
  'profile-photo.js',
  'appwrite-client.js',
  'appwrite-config.js',
  'auth.html',
  'biucrypt_icon.ico',
  'biulock_icon.ico',
  'certifications.html',
  'forgot-password.html',
  'icon.png',
  'index.html',
  'osint_icon.ico',
  'reaper_icon.ico',
  'recovery.js',
  'reset-password.html',
  'robots.txt',
  'security.html',
  'script.js',
  'settings.html',
  'settings.js',
  'sitemap.xml',
  'sniff_icon.ico',
  'style.css',
  'verify.html',
  'verify.js'
];

const publicDirectories = ['.well-known', 'assets', 'sites'];
const forbiddenExtensions = new Set(['.md', '.zip', '.gz']);
const commerceFiles = new Set(['licenses.html', 'paddle-checkout.js', 'paddle-config.js']);

async function copyFromRoot(relativePath) {
  const source = path.join(root, relativePath);
  const destination = path.join(output, relativePath);
  await stat(source);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true });
}

async function walk(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = path.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path.join(directory, entry.name), relativePath));
    if (entry.isFile()) files.push(relativePath);
  }
  return files;
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await Promise.all([...publicFiles, ...publicDirectories].map(copyFromRoot));
await writeFile(path.join(output, '.nojekyll'), '', 'utf8');

const outputFiles = await walk(output);
const forbidden = outputFiles.filter((file) => (
  file.startsWith(`appwrite-functions${path.sep}`)
  || forbiddenExtensions.has(path.extname(file).toLowerCase())
  || commerceFiles.has(file.replaceAll('\\', '/'))
));

if (forbidden.length) {
  throw new Error(`Refusing to publish non-public files:\n${forbidden.join('\n')}`);
}

console.log(`Built ${outputFiles.length} public files in dist/.`);
