import { createHash } from 'node:crypto';

const endpoint = 'https://fra.cloud.appwrite.io/v1';
const project = '6aa55a88003959a536e9';
const database = '6aa56477002e28054068';
const table = 'portfolio_visits';
const pages = new Set(['/', '/index.html', '/certifications.html', '/account.html', '/settings.html', '/auth.html', '/privacy.html', '/terms.html', '/security.html', '/forgot-password.html', '/reset-password.html', '/verify.html', '/sites/biulock.html', '/sites/b-recon.html', '/sites/biusniff.html', '/sites/biucrypt.html', '/sites/biuret-academy.html', '/sites/biuret-reaper.html']);
const choices = { device: ['desktop', 'tablet', 'mobile'], browser: ['chrome', 'edge', 'firefox', 'safari', 'other'], language: ['ar', 'en', 'other'], source: ['direct', 'google', 'bing', 'github', 'academy', 'linkedin', 'facebook', 'instagram', 'youtube', 'other'] };
const hash = (value) => createHash('sha256').update(value).digest('hex').slice(0, 32);
const query = (method, attribute, values) => JSON.stringify({ method, ...(attribute ? { attribute } : {}), values });
let cachedTotals;

export function cleanVisit(input) {
  if (!input || !/^[a-f0-9]{32}$/.test(input.visitorId) || !/^[a-f0-9]{32}$/.test(input.sessionId) || !pages.has(input.path)) return null;
  const result = { path: input.path === '/index.html' ? '/' : input.path };
  for (const [field, allowed] of Object.entries(choices)) result[field] = allowed.includes(input[field]) ? input[field] : 'other';
  return { ...result, visitor: hash(`visitor:${input.visitorId}`), session: hash(`session:${input.sessionId}`) };
}

export function summarize(rows, since, totals) {
  const sessions = new Set(), visitors = new Set();
  const daily = {}, groups = Object.fromEntries(['path', ...Object.keys(choices)].map((key) => [key, {}]));
  for (const row of rows) {
    let value;
    try { value = JSON.parse(row.payload); } catch { continue; }
    if (!value || !pages.has(value.path) || !/^[a-f0-9]{32}$/.test(value.session) || !/^[a-f0-9]{32}$/.test(value.visitor)) continue;
    sessions.add(value.session); visitors.add(value.visitor);
    const day = row.$createdAt.slice(0, 10);
    daily[day] = (daily[day] || 0) + 1;
    for (const key of Object.keys(groups)) {
      const label = key === 'path' ? value.path : choices[key].includes(value[key]) ? value[key] : 'other';
      groups[key][label] = (groups[key][label] || 0) + 1;
    }
  }
  return { since, totals, period: { visitors: visitors.size, visits: sessions.size, views: Object.values(daily).reduce((sum, value) => sum + value, 0) }, daily, groups };
}

export default async function handler({ req, res, error }) {
  const headers = Object.fromEntries(Object.entries(req.headers || {}).map(([key, value]) => [key.toLowerCase(), String(value)]));
  const reply = (data, status = 200) => res.json(data, status);
  let input;
  try { input = req.bodyJson || JSON.parse(req.bodyText || '{}'); } catch { return reply({ error: 'Invalid request' }, 400); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return reply({ error: 'Invalid request' }, 400);
  const key = headers['x-appwrite-key'];
  if (!key) return reply({ error: 'Analytics unavailable' }, 503);
  const request = async (path, options = {}, jwt = null) => {
    const response = await fetch(`${endpoint}${path}`, { ...options, headers: { 'content-type': 'application/json', 'x-appwrite-project': project, ...(jwt ? { 'x-appwrite-jwt': jwt } : { 'x-appwrite-key': key }) }, signal: AbortSignal.timeout(12000) });
    return { status: response.status, data: await response.json().catch(() => ({})) };
  };
  const rowsBase = `/tablesdb/${database}/tables/${table}/rows`;
  const list = async (queries) => {
    const params = new URLSearchParams();
    queries.forEach((value) => params.append('queries[]', value));
    const result = await request(`${rowsBase}?${params}`);
    if (result.status !== 200) throw new Error('Analytics lookup failed');
    return result.data;
  };
  const totals = async () => {
    if (cachedTotals && Date.now() - cachedTotals.time < 20000) return cachedTotals.value;
    const rows = await Promise.all(['visitor', 'session', 'view'].map((kind) => list([query('equal', 'kind', [kind]), query('limit', null, [1])])));
    const value = { visitors: rows[0].total, visits: rows[1].total, views: rows[2].total };
    cachedTotals = { time: Date.now(), value };
    return value;
  };
  try {
    if (input.action === 'totals') return reply({ ok: true, ...(await totals()) });
    if (input.action === 'track') {
      const visit = cleanVisit(input);
      if (!visit) return reply({ error: 'Invalid visit' }, 400);
      if (/bot|crawl|spider|headless/i.test(headers['user-agent'] || '')) return reply({ ok: true, ignored: true });
      const create = async (id, kind, payload) => {
        const result = await request(rowsBase, { method: 'POST', body: JSON.stringify({ rowId: id, data: { kind, payload: JSON.stringify(payload) }, permissions: [] }) });
        if (![201, 409].includes(result.status)) throw new Error('Visit could not be recorded');
        return result.status === 201;
      };
      // Deterministic IDs make refreshes, retries and concurrent tabs idempotent.
      const newVisitor = await create(`v_${visit.visitor}`, 'visitor', {});
      const newSession = await create(`s_${visit.session}`, 'session', {});
      const newView = await create(`p_${hash(`${visit.session}:${visit.path}`)}`, 'view', visit);
      if (newVisitor || newSession || newView) cachedTotals = null;
      return reply({ ok: true, recorded: newView, ...(await totals()) });
    }
    if (['adminStatus', 'stats'].includes(input.action)) {
      const jwt = headers['x-appwrite-user-jwt'];
      if (!jwt) return reply({ error: 'Sign in required' }, 401);
      const account = await request('/account', {}, jwt);
      const person = account.status === 200 ? await request(`/users/${encodeURIComponent(account.data.$id)}`) : { status: 401 };
      const adminLabels = new Set(['admin', ...(process.env.BIURET_ADMIN_LABEL || 'biuretadmin').split(',').map((value) => value.trim().toLowerCase())]);
      const admin = person.status === 200 && Array.isArray(person.data.labels) && person.data.labels.some((label) => adminLabels.has(String(label).toLowerCase()));
      if (input.action === 'adminStatus') return reply({ ok: true, admin });
      if (!admin) return reply({ error: 'Administrator access required' }, 403);
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const rows = [];
      let cursor;
      for (let page = 0; page < 20; page++) {
        const batch = await list([query('equal', 'kind', ['view']), query('greaterThanEqual', '$createdAt', [since]), query('orderAsc', '$id', []), query('limit', null, [250]), ...(cursor ? [query('cursorAfter', null, [cursor])] : [])]);
        rows.push(...batch.rows);
        if (batch.rows.length < 250) return reply({ ok: true, ...summarize(rows, since, await totals()), sampled: false });
        cursor = batch.rows.at(-1).$id;
      }
      return reply({ ok: true, ...summarize(rows, since, await totals()), sampled: true });
    }
    return reply({ error: 'Unknown action' }, 400);
  } catch (failure) {
    error?.('Biuret analytics operation failed');
    return reply({ error: 'Analytics temporarily unavailable' }, 503);
  }
}
