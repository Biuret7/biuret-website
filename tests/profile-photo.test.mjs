import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const photo = 'data:image/jpeg;base64,/9j/AAAA';
function serviceFixture() {
  let user = { name: 'Adam', email: 'person@example.com', labels: [], prefs: { theme: 'dark' } };
  let fail = false;
  let writes = 0;
  class Client { setEndpoint() { return this; } setProject() { return this; } }
  class Account {
    async get() { return structuredClone(user); }
    async updatePrefs({ prefs }) { if (fail) throw new Error('Offline'); writes++; user.prefs = prefs; return prefs; }
  }
  const window = { BIURET_APPWRITE_CONFIG: { endpoint: 'https://example.test/v1', projectId: 'test' }, Appwrite: { Client, Account, TablesDB: class {}, Functions: class {} } };
  vm.runInNewContext(source('appwrite-client.js'), { window, TextEncoder });
  return { service: window.BiuretAppwrite, user: () => user, fail: () => { fail = true; }, writes: () => writes };
}
test('save/remove preserves unrelated preferences and does not grant admin', async () => {
  const f = serviceFixture();
  const saved = await f.service.updateProfilePhoto({ dataUrl: photo });
  assert.equal(saved.prefs.biuretProfilePhoto, photo);
  assert.equal(saved.prefs.theme, 'dark');
  assert.deepEqual(saved.labels, []);
  f.user().prefs.locale = 'ar';
  await f.service.updateProfilePhoto({ dataUrl: null });
  assert.deepEqual({ ...f.user().prefs }, { theme: 'dark', locale: 'ar' });
});
test('rejects unsafe formats, remote URLs, malformed and oversized payloads', async () => {
  const f = serviceFixture();
  for (const dataUrl of ['', undefined, {}, 'https://example.com/photo.jpg', 'data:image/svg+xml;base64,AAAA', photo + '<script>', photo + 'A'.repeat(24000)]) {
    await assert.rejects(f.service.updateProfilePhoto({ dataUrl }));
  }
  assert.equal(f.writes(), 0);
});
test('oversized preference object and failed server save leave saved prefs intact', async () => {
  const f = serviceFixture();
  f.user().prefs.other = 'x'.repeat(64000);
  await assert.rejects(f.service.updateProfilePhoto({ dataUrl: photo }), /full/);
  delete f.user().prefs.other;
  f.fail();
  await assert.rejects(f.service.updateProfilePhoto({ dataUrl: photo }), /Offline/);
  assert.equal(f.user().prefs.biuretProfilePhoto, undefined);
});
class Element {
  constructor() { this.listeners = {}; this.dataset = {}; this.disabled = false; this.children = []; this.classList = { toggle() {} }; }
  set textContent(value) { this.text = value; this.children = []; this.child = undefined; }
  get textContent() { return this.text; }
  append(child) { this.children.push(child); }
  addEventListener(event, fn) { this.listeners[event] = fn; }
  replaceChildren(child) { this.child = child; }
  setAttribute() {}
}
function photoFixture() {
  let revoked = 0;
  let output = photo;
  const document = { documentElement: { lang: 'en' }, createElement: (tag) => tag === 'canvas' ? {
    getContext: () => ({ fillRect() {}, drawImage() {} }), toDataURL: () => output
  } : new Element() };
  class Image {
    naturalWidth = 600; naturalHeight = 400;
    set src(value) { queueMicrotask(() => this.onload()); }
  }
  const events = [];
  const window = { dispatchEvent: (event) => events.push(event) };
  class CustomEvent { constructor(type, options) { this.type = type; this.detail = options.detail; } }
  vm.runInNewContext(source('profile-photo.js'), { window, document, Image, CustomEvent, URL: { createObjectURL: () => 'blob:test', revokeObjectURL: () => revoked++ } });
  return { api: window.BiuretProfilePhoto, events, revoked: () => revoked, setOutput: (value) => { output = value; } };
}
test('prepare validates input and releases object URLs after successful or failed compression', async () => {
  const f = photoFixture();
  for (const file of [null, { type: 'image/svg+xml', size: 10 }, { type: 'image/png', size: 0 }, { type: 'image/jpeg', size: 6 * 1024 * 1024 }]) await assert.rejects(f.api.prepare(file));
  assert.equal(await f.api.prepare({ type: 'image/png', size: 100 }), photo);
  assert.equal(f.revoked(), 1);
  f.setOutput(photo + 'A'.repeat(24000));
  await assert.rejects(f.api.prepare({ type: 'image/webp', size: 100 }));
  assert.equal(f.revoked(), 2);
});
test('render uses initials for unsafe source and an image for saved JPEG', () => {
  const f = photoFixture();
  const element = new Element();
  const user = { name: 'Adam', prefs: { biuretProfilePhoto: 'javascript:alert(1)' } };
  f.api.render(element, user);
  assert.equal(element.textContent, 'A');
  assert.equal(element.child, undefined);
  f.api.render(element, user, photo);
  assert.equal(element.child.src, photo);
});
test('editor previews without saving, retries errors, saves and removes', async () => {
  const f = photoFixture();
  const elements = Object.fromEntries(['file', 'preview', 'status', 'save', 'cancel', 'remove'].map((name) => [name, new Element()]));
  const root = { querySelector: (selector) => elements[selector.slice(12, -1)], setAttribute() {} };
  let writes = 0;
  let fail = true;
  f.api.bindEditor(root, { name: 'Adam', prefs: {} }, { async updateProfilePhoto({ dataUrl }) {
    writes++;
    if (fail) throw new Error('offline');
    return { name: 'Adam', prefs: dataUrl ? { biuretProfilePhoto: dataUrl } : {} };
  } });
  assert.equal(elements.save.disabled, true);
  elements.file.files = [{ type: 'image/png', size: 100 }];
  await elements.file.listeners.change();
  assert.equal(writes, 0);
  assert.equal(elements.save.disabled, false);
  elements.save.listeners.click();
  await new Promise(setImmediate);
  assert.equal(elements.status.dataset.state, 'error');
  assert.equal(elements.save.disabled, false);
  fail = false;
  elements.save.listeners.click();
  await new Promise(setImmediate);
  assert.equal(elements.status.dataset.state, 'success');
  assert.equal(elements.remove.disabled, false);
  assert.equal(f.events.length, 1);
  assert.equal(f.events[0].detail.prefs.biuretProfilePhoto, photo);
  await elements.remove.listeners.click();
  assert.equal(elements.remove.disabled, true);
  assert.equal(f.events.length, 2);
  assert.equal(f.events[1].detail.prefs.biuretProfilePhoto, undefined);
});
test('navigation shows saved photo or initial beside localized label, and removes it for guests', () => {
  const { api } = photoFixture();
  const link = new Element();
  api.renderLink(link, { name: 'Adam', prefs: { biuretProfilePhoto: photo } }, 'Profile');
  assert.equal(link.children.length, 2);
  assert.equal(link.children[0].child.src, photo);
  assert.equal(link.children[1].textContent, 'Profile');
  api.renderLink(link, { name: 'Adam', prefs: {} }, 'الملف الشخصي');
  assert.equal(link.children[0].textContent, 'A');
  assert.equal(link.children[1].textContent, 'الملف الشخصي');
  api.renderLink(link, null, 'Sign in');
  assert.equal(link.children.length, 1);
  assert.equal(link.children[0].textContent, 'Sign in');
});
test('admin identity comes from server labels, never contact email or preferences', async () => {
  const backend = source('appwrite-functions/biuret-licensing/index.js');
  const start = backend.indexOf('function configuredAdminLabels(');
  const end = backend.indexOf('async function entitlement(', start);
  const context = vm.createContext({});
  vm.runInContext(backend.slice(start, end), context);
  const evaluateUser = (user) => context.currentUser({}, { get: async () => user }, { 'x-appwrite-user-id': 'user' }, {});
  assert.equal((await evaluateUser({ email: 'biuret956@gmail.com', labels: ['admin'] })).isAdmin, true);
  assert.equal((await evaluateUser({ email: 'adam7.workspace@gmail.com', labels: [], prefs: { admin: true } })).isAdmin, false);
  assert.equal((await evaluateUser({ email: 'biuret956@gmail.com', labels: [] })).isAdmin, false);
});
