import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanVisit, summarize } from '../appwrite-functions/biuret-licensing/analytics.js';

const visit = { visitorId: '1'.repeat(32), sessionId: '2'.repeat(32), path: '/', source: 'github', device: 'desktop', browser: 'firefox', language: 'en' };
test('analytics accepts only public page paths and coarse fields; stored IDs are hashes', () => {
  const value = cleanVisit({ ...visit, email: 'private@example.com', ip: '127.0.0.1', browser: '<script>' });
  assert.equal(value.browser, 'other');
  assert.equal(value.email, undefined); assert.equal(value.ip, undefined);
  assert.notEqual(value.visitor, visit.visitorId);
  assert.equal(cleanVisit({ ...visit, path: '/reset-password.html?secret=sensitive' }), null);
  assert.equal(cleanVisit({ ...visit, path: '/admin' }), null);
  assert.equal(cleanVisit({ ...visit, visitorId: 'invalid' }), null);
});

test('aggregate breakdowns distinguish visitor browsers, sessions and page views without returning raw rows', () => {
  const value = cleanVisit(visit);
  const rows = [value, { ...value, path: '/certifications.html' }, { ...value, session: '3'.repeat(32) }].map((v) => ({ $createdAt: '2026-10-04T10:00:00Z', payload: JSON.stringify(v) }));
  const data = summarize(rows, '2026-09-04', { visitors: 1, visits: 2, views: 3 });
  assert.deepEqual(data.period, { visitors: 1, visits: 2, views: 3 });
  assert.equal(data.groups.source.github, 3);
  assert.equal(JSON.stringify(data).includes(value.visitor), false);
});

test('duplicate and concurrent tracking remains idempotent and every created row is private', async () => {
  const { default: handler } = await import('../appwrite-functions/biuret-licensing/analytics.js?case=track');
  const previousFetch = globalThis.fetch;
  const rows = new Map();
  globalThis.fetch = async (url, options = {}) => {
    const parsed = new URL(url);
    if (options.method === 'POST') {
      const body = JSON.parse(options.body);
      assert.deepEqual(body.permissions, []);
      if (rows.has(body.rowId)) return { status: 409, json: async () => ({}) };
      assert.equal(JSON.stringify(body).includes(visit.visitorId), false);
      rows.set(body.rowId, { ...body.data, $id: body.rowId, $createdAt: new Date().toISOString() });
      return { status: 201, json: async () => ({}) };
    }
    const kind = parsed.searchParams.getAll('queries[]').map(JSON.parse).find((q) => q.attribute === 'kind')?.values[0];
    const selected = [...rows.values()].filter((r) => r.kind === kind);
    return { status: 200, json: async () => ({ total: selected.length, rows: selected }) };
  };
  const invoke = (payload) => handler({ req: { headers: { 'x-appwrite-key': 'test' }, bodyJson: payload }, res: { json: (body,status=200) => ({ body,status }) } });
  try {
    await Promise.all([invoke({ ...visit, action: 'track' }), invoke({ ...visit, action: 'track' })]);
    assert.equal(rows.size, 3);
    const again = await invoke({ ...visit, action: 'track' });
    assert.equal(again.body.recorded, false);
    assert.deepEqual([again.body.visitors,again.body.visits,again.body.views], [1,1,1]);
    await invoke({ ...visit, path: '/certifications.html', action: 'track' });
    assert.equal(rows.size, 4);
    const bad = await invoke({ ...visit, path: '/secret', action: 'track' });
    assert.equal(bad.status, 400);
  } finally { globalThis.fetch = previousFetch; }
});

test('stats validate the JWT account and server labels; caller-supplied admin IDs and prefs cannot grant access', async () => {
  const { default: handler } = await import('../appwrite-functions/biuret-licensing/analytics.js?case=admin');
  const previousFetch = globalThis.fetch;
  let labels = [], accountStatus = 200;
  globalThis.fetch = async (url, options = {}) => {
    const path = new URL(url).pathname;
    if (path === '/v1/account') {
      assert.equal(options.headers['x-appwrite-jwt'], 'test-jwt');
      assert.equal(options.headers['x-appwrite-key'], undefined);
      return { status: accountStatus, json: async () => ({ $id: 'verified-user', prefs: { admin: true } }) };
    }
    if (path === '/v1/users/verified-user') return { status:200,json:async()=>({ labels }) };
    return { status:200,json:async()=>({ rows:[],total:0 }) };
  };
  const invoke = (jwt,action='stats') => handler({ req: { headers: { 'x-appwrite-key':'test', ...(jwt ? { 'x-appwrite-user-jwt':jwt } : {}) }, bodyJson:{ action,admin:true,userId:'owner' } }, res:{json:(body,status=200)=>({body,status})} });
  try {
    assert.equal((await invoke(null)).status,401);
    assert.equal((await invoke('test-jwt')).status,403);
    assert.equal((await invoke('test-jwt','adminStatus')).body.admin,false);
    labels=['admin'];
    const admin = await invoke('test-jwt');
    assert.equal(admin.status,200); assert.equal(admin.body.ok,true);
    accountStatus=401;
    assert.equal((await invoke('test-jwt')).status,403);
  } finally { globalThis.fetch = previousFetch; }
});
