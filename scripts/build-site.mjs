import { cp, mkdir, readdir, rm, stat, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');
const preview = process.argv.includes('--preview');

// Only browser-safe portfolio files belong in the GitHub Pages artifact.
// Commerce sources remain in the repository for a future launch, but licensing
// pages and Paddle checkout code are intentionally excluded from this build.
const publicFiles = [
  '.openai/hosting.json',
  '404.html',
  'academy_icon.ico',
  'account.html',
  'account.js',
  'analytics.html',
  'analytics.js',
  'analytics-dashboard.js',
  'profile-photo.js',
  'appwrite-client.js',
  'appwrite-config.js',
  'auth.html',
  'biucrypt_icon.ico',
  'biulock_icon.ico',
  'certifications.html',
  'certificates.js',
  'forgot-password.html',
  'guide-pilot.html',
  'guide-pilot.css',
  'guide-pilot.js',
  'icon.png',
  'index.html',
  'osint_icon.ico',
  'privacy.html',
  'playground.html',
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
  'experience.css',
  'site-switcher.css',
  'site-switcher.js',
  'terms.html',
  'verify.html',
  'verify.js'
];

const publicDirectories = ['.well-known', 'assets', 'sites', 'guide'];
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
for (const file of (await walk(output)).filter((name) => name.endsWith('.html'))) {
  const destination = path.join(output, file);
  let html = await readFile(destination, 'utf8');
  const source = file.startsWith(`sites${path.sep}`) ? '../analytics.js' : 'analytics.js';
  if (preview) {
    html = html.replace(/<script[^>]+src="https:\/\/cdn.jsdelivr.net\/npm\/appwrite[^>]*><\/script>/g, '')
      .replace('</head>', '<meta name="robots" content="noindex">\n</head>');
  } else {
    html = html.replace('</body>', `  <script defer src="${source}?v=20261004-1"></script>\n</body>`);
  }
  await writeFile(destination, html, 'utf8');
}
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
