import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import crypto from 'node:crypto';

process.env.BIURET_LICENSE_DATABASE_ID = 'test-db';
process.env.BIURET_LICENSES_TABLE_ID = 'test-licenses';
process.env.BIURET_CHECKOUT_INTENTS_TABLE_ID = 'test-intents';
process.env.BIURET_PADDLE_PRICES = '{}';
process.env.BIURET_ADMIN_LABEL = 'biuretadmin';
process.env.APPWRITE_FUNCTION_PROJECT_ID = 'test-project';

// Execute the complete deployed handler while replacing only the remote SDK.
// No real account, session, device identity or license rows are used.
async function harness(sourcePath) {
  const state = {
    user: { $id: 'user-1', emailVerification: true, labels: [] },
    rows: [], updates: [],
  };
  class Client { setEndpoint() { return this; } setProject() { return this; } setKey() { return this; } }
  class Users { async get() { return state.user; } async list() { return { users: [] }; } }
  class TablesDB {
    async listRows(options) {
      assert.equal(options.tableId, 'test-licenses');
      return { rows: state.rows };
    }
    async updateRow(options) {
      state.updates.push(options);
      Object.assign(state.rows.find(row => row.$id === options.rowId), options.data);
      return state.rows[0];
    }
  }
  const exports = { Client, Users, TablesDB, Tokens: class {}, ID: {}, Permission: {}, Role: {},
    Query: { equal: (key, values) => JSON.stringify({ key, values }), limit: value => JSON.stringify({ limit: value }) } };
  const sdk = new vm.SyntheticModule(Object.keys(exports), function () {
    for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
  });
  const cryptoModule = new vm.SyntheticModule(['default'], function () { this.setExport('default', crypto); });
  const analytics = new vm.SyntheticModule(['default'], function () {
    this.setExport('default', ({ res }) => res.json({ ok: true, analytics: true }, 200));
  });
  const module = new vm.SourceTextModule(await fs.readFile(sourcePath, 'utf8'));
  await module.link(specifier => {
    if (specifier === 'node-appwrite') return sdk;
    if (specifier === 'node:crypto') return cryptoModule;
    if (specifier === './analytics.js') return analytics;
    throw new Error(`Unexpected dependency: ${specifier}`);
  });
  await module.evaluate();
  return { state, invoke: (payload, userId = 'user-1', format = 'bodyJson') => module.namespace.default({
    req: { headers: { 'x-appwrite-key': 'test', ...(userId ? { 'x-appwrite-user-id': userId } : {}) },
      [format]: format === 'bodyJson' ? payload : JSON.stringify(payload) },
    res: { json: (body, status = 200) => ({ body, status }) }, log: () => {}, error: message => { throw new Error(message); },
  }) };
}

const sourcePath = new URL('../appwrite-functions/biuret-licensing/index.js', import.meta.url);
function device() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return { publicKey: publicKey.export({ type: 'spki', format: 'pem' }).trim(), privateKey };
}
function license() {
  return { $id: 'license-1', productSlug: 'biulock', productName: 'BiuLock', status: 'active', plan: 'monthly',
    expiresAt: new Date(Date.now() + 86400000).toISOString() };
}
function proof(identity, issuedAt = Date.now(), userId = 'user-1', productSlug = 'biulock') {
  return { action: 'entitlement', productSlug: 'biulock', devicePublicKey: identity.publicKey, deviceIssuedAt: issuedAt,
    deviceSignature: crypto.sign(null, Buffer.from(`BIURET-DEVICE-ENTITLEMENT|${userId}|${productSlug}|${issuedAt}`), identity.privateKey).toString('base64') };
}

test('desktop activation and signed entitlement work for current and legacy request bodies', async () => {
  for (const format of ['bodyJson', 'bodyText', 'body']) {
    const { state, invoke } = await harness(sourcePath);
    const identity = device(); state.rows = [license()];
    const activate = () => invoke({ action: 'activate-device', productSlug: 'biulock', devicePublicKey: identity.publicKey, deviceName: 'Test PC' }, 'user-1', format);
    assert.equal((await activate()).status, 200);
    assert.equal(state.updates.length, 1);
    assert.equal(state.rows[0].deviceName, 'Test PC');
    assert.equal((await activate()).status, 200);
    assert.equal(state.updates.length, 1, 'repeated activation does not rebind');
    const entitlement = await invoke(proof(identity), 'user-1', format);
    assert.equal(entitlement.status, 200); assert.equal(entitlement.body.access, 'licensed');
    assert.equal(state.updates.length, 2);
  }
});

test('verified server-labelled owners can activate and open without a paid license', async () => {
  for (const label of ['admin', 'biuretadmin']) {
    const { state, invoke } = await harness(sourcePath); state.user.labels = [label];
    assert.equal((await invoke({ action: 'activate-device', productSlug: 'biulock', devicePublicKey: device().publicKey })).body.access, 'admin');
    assert.equal((await invoke({ action: 'entitlement', productSlug: 'biulock' })).body.access, 'admin');
    assert.equal(state.updates.length, 0);
  }
});

test('activation still rejects unauthenticated, unverified, unpaid and expired accounts', async () => {
  const { state, invoke } = await harness(sourcePath);
  const payload = { action: 'activate-device', productSlug: 'biulock', devicePublicKey: device().publicKey };
  assert.equal((await invoke(payload, '')).status, 401);
  state.user.emailVerification = false; state.user.labels = ['admin'];
  assert.equal((await invoke(payload)).status, 403);
  state.user.emailVerification = true; state.user.labels = [];
  assert.equal((await invoke({ ...payload, admin: true })).status, 403);
  state.rows = [{ ...license(), expiresAt: new Date(Date.now() - 1000).toISOString() }];
  assert.equal((await invoke(payload)).status, 403);
  assert.equal(state.updates.length, 0);
});

test('another device, stale proof, wrong user/product signature and unsigned access fail closed', async () => {
  const { state, invoke } = await harness(sourcePath);
  const first = device(), other = device(); state.rows = [license()];
  assert.equal((await invoke(proof(first))).status, 428);
  await invoke({ action: 'activate-device', productSlug: 'biulock', devicePublicKey: first.publicKey });
  const originalHash = state.rows[0].deviceKeyHash;
  assert.equal((await invoke({ action: 'activate-device', productSlug: 'biulock', devicePublicKey: other.publicKey })).status, 409);
  for (const invalid of [proof(other), proof(first, Date.now() - 600000), proof(first, Date.now(), 'other-user'),
    proof(first, Date.now(), 'user-1', 'other-product'), { action: 'entitlement', productSlug: 'biulock' }]) {
    assert.equal((await invoke(invalid)).status, 403);
  }
  assert.equal(state.rows[0].deviceKeyHash, originalHash); assert.equal(state.updates.length, 1);
});

test('analytics routing, account access and unknown-action response remain available', async () => {
  const { invoke } = await harness(sourcePath);
  assert.equal((await invoke({ action: 'analytics:totals' }, '')).body.analytics, true);
  assert.equal((await invoke({ action: 'account-access' })).status, 200);
  assert.equal((await invoke({ action: 'unsupported' })).status, 404);
});
