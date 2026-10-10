import test from 'node:test';
import assert from 'node:assert/strict';
import { configuration, geminiAnswer, validateAnswer } from '../appwrite-functions/biuret-licensing/guide/provider.js';
import { makeHandler, pilotLimiter } from '../appwrite-functions/biuret-licensing/guide/main.js';

const context = [{ id: 'start', title: 'Start', body: 'Foundations are free.', steps: ['Start foundations.'] }];
const good = { outcome: 'answer', answer: 'Start with the free foundations.', sourceIds: ['start'] };
const env = { GEMINI_API_KEY: 'test-only-key', GUIDE_ENABLED: 'true', GUIDE_ADMIN_USER_IDS: 'owner' };
const reply = (value, status = 200) => new Response(JSON.stringify(value), { status });
const modelReply = value => reply({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }] });
const invoke = (handler, body, headers = { 'x-appwrite-user-jwt': 'test-jwt' }) => handler({
  req: { headers, bodyText: typeof body === 'string' ? body : JSON.stringify(body) },
  res: { json: (body, code, headers) => ({ body, code, headers }) }
});
const request = { question: 'Where do I start?', locale: 'en', site: 'academy', consent: true };
const handlerFor = (options = {}) => makeHandler({ env, fetchImpl: async () => reply({ $id: 'owner' }), limits: pilotLimiter(), answer: async () => good, ...options });

test('model defaults to a fixed stable ID; paths and injected endpoints are rejected', () => {
  assert.equal(configuration({}).model, 'gemini-3.5-flash-lite');
  for (const model of ['../secret', 'models/gemini-3.5-flash-lite', 'gemini-x?key=other', 'https://evil.example']) {
    assert.throws(() => configuration({ GUIDE_GEMINI_MODEL: model }));
  }
});
test('credentials stay in a header, context is site facts, no tools or external actions', async () => {
  let called = false;
  const result = await geminiAnswer({ question: request.question, locale: 'ar', context, env, fetchImpl: async (url, options) => {
    called = true;
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');
    assert.equal(options.headers['x-goog-api-key'], env.GEMINI_API_KEY);
    assert.equal(options.redirect, 'error');
    const body = JSON.parse(options.body);
    assert.equal(body.tools, undefined);
    assert.match(body.systemInstruction.parts[0].text, /clear Arabic/);
    assert.match(body.systemInstruction.parts[0].text, /Never provide exam answers/);
    assert.equal(options.body.includes(env.GEMINI_API_KEY), false);
    assert.ok(body.generationConfig.maxOutputTokens <= 1600);
    return modelReply(good);
  } });
  assert.ok(called); assert.deepEqual(result, good);
});
test('unknown topics can safely abstain without fabricated citations', () => {
  assert.deepEqual(validateAnswer({ outcome: 'unknown', answer: '', sourceIds: [] }, context), { outcome: 'unknown', answer: '', sourceIds: [] });
});
test('unknown sources, invented links and malformed/oversized answers fail closed', () => {
  for (const change of [{ sourceIds: ['secret'] }, { sourceIds: [] }, { answer: 'Go to https://evil.example' },
    { answer: '[click](//evil.example)' }, { answer: '' }, { answer: 'x'.repeat(4001) }, { outcome: 'execute' }]) {
    assert.throws(() => validateAnswer({ ...good, ...change }, context));
  }
});
test('quota, safety blocks, truncation and provider failures do not expose provider details', async () => {
  for (const value of [reply({ error: 'secret upstream detail' }, 429), reply({ promptFeedback: { blockReason: 'SAFETY' } }),
    reply({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: JSON.stringify(good) }] } }] }),
    new Response('malformed')]) {
    await assert.rejects(geminiAnswer({ question: 'help', locale: 'en', context, env, fetchImpl: async () => value }),
      error => ['model_quota_exceeded', 'model_unavailable'].includes(error.message));
  }
});
test('oversized streamed response is rejected and secrets never appear in errors', async () => {
  await assert.rejects(geminiAnswer({ question: 'help', locale: 'en', context, env, fetchImpl: async () => new Response('x'.repeat(65537)) }), /model_unavailable/);
  await assert.rejects(geminiAnswer({ question: 'help', locale: 'en', context, env, fetchImpl: async () => { throw Error(env.GEMINI_API_KEY); } }), error => !String(error).includes(env.GEMINI_API_KEY));
});
test('missing key makes no provider request', async () => {
  let calls = 0;
  await assert.rejects(geminiAnswer({ question: 'help', locale: 'en', context, env: {}, fetchImpl: async () => { calls++; } }), /model_not_configured/);
  assert.equal(calls, 0);
});
test('anonymous and spoofed user ID requests cannot invoke the model', async () => {
  let calls = 0;
  const handler = handlerFor({ fetchImpl: async () => { calls++; return reply({ $id: 'owner' }); } });
  for (const headers of [{}, { 'x-appwrite-user-id': 'owner' }]) assert.equal((await invoke(handler, request, headers)).code, 401);
  assert.equal(calls, 0);
});
test('verified non-admin and expired sessions are rejected', async () => {
  assert.equal((await invoke(handlerFor({ fetchImpl: async () => reply({ $id: 'learner' }) }), request)).code, 403);
  assert.equal((await invoke(handlerFor({ fetchImpl: async () => reply({}, 401) }), request)).code, 401);
});
test('status respects kill switch, absent key and absent admin list without leaking a key', async () => {
  for (const config of [env, { ...env, GUIDE_ENABLED: 'false' }, { ...env, GEMINI_API_KEY: '' }]) {
    const result = await invoke(handlerFor({ env: config }), { action: 'status' });
    assert.equal(result.body.configured, config.GUIDE_ENABLED === 'true' && Boolean(config.GEMINI_API_KEY));
    assert.equal(JSON.stringify(result).includes(env.GEMINI_API_KEY), false);
    assert.equal(result.headers['cache-control'], 'no-store');
  }
  assert.equal((await invoke(handlerFor({ env: { ...env, GUIDE_ADMIN_USER_IDS: '' } }), request)).code, 403);
});
test('consent, known language/site and strict body limits are required before any AI call', async () => {
  let calls = 0;
  const handler = handlerFor({ answer: async () => { calls++; return good; } });
  for (const body of [{ ...request, consent: false }, { ...request, site: 'private-bank' }, { ...request, locale: 'de' },
    { ...request, question: 'x'.repeat(501) }, { ...request, question: 42 }, [], 'malformed',
    JSON.stringify({ ...request, context: 'x'.repeat(9000) })]) assert.equal((await invoke(handler, body)).code, 400);
  assert.equal(calls, 0);
});
test('provided context and personal account details never enter model context', async () => {
  const handler = handlerFor({ fetchImpl: async () => reply({ $id: 'owner', email: 'private@example.org', prefs: { bank: 'private-answer' } }),
    answer: async ({ context, question, locale }) => {
      const text = JSON.stringify(context);
      assert.ok(context.length > 0);
      assert.equal(text.includes('private@example.org'), false);
      assert.equal(text.includes('private-answer'), false);
      assert.equal(text.includes('injected-context'), false);
      assert.ok(context.every(c => c.id !== 'projects'));
      assert.equal(locale, 'en'); assert.equal(question, request.question);
      return good;
    } });
  assert.equal((await invoke(handler, { ...request, context: 'injected-context', admin: true })).code, 200);
});
test('warm-runtime throttle limits bursts and concurrent work; reservations release once', () => {
  let time = Date.UTC(2026, 9, 10);
  const limits = pilotLimiter({ minute: 2, daily: 3, now: () => time });
  const first = limits.reserve(); assert.ok(first); assert.equal(limits.reserve(), null);
  first(); first(); const second = limits.reserve(); assert.ok(second); second();
  assert.equal(limits.reserve(), null);
  time += 60001; const third = limits.reserve(); assert.ok(third); third();
  assert.equal(limits.reserve(), null);
  time += 86400000; assert.ok(limits.reserve());
});
test('failed AI calls release concurrency and return only a safe error', async () => {
  const handler = handlerFor({ answer: async () => { throw Error('private-upstream-body'); } });
  for (let i = 0; i < 2; i++) {
    const result = await invoke(handler, request);
    assert.equal(result.code, 503); assert.deepEqual(result.body, { error: 'guide_unavailable' });
  }
});
test('identity outage fails closed instead of calling a model', async () => {
  let calls = 0;
  const handler = handlerFor({ fetchImpl: async () => reply({}, 500), answer: async () => { calls++; return good; } });
  assert.equal((await invoke(handler, request)).code, 503); assert.equal(calls, 0);
});

test('clarification and safe follow-up questions are supported without fabricated links', () => {
  assert.deepEqual(validateAnswer({outcome:'clarify',answer:'Which Academy path do you mean?',sourceIds:[],followups:['Compare SOC and DFIR.']},context),
    {outcome:'clarify',answer:'Which Academy path do you mean?',sourceIds:[],followups:['Compare SOC and DFIR.']});
  for (const followups of [['https://evil.example'],['x'.repeat(161)],['a','b','c','d'],[{}]]) assert.throws(()=>validateAnswer({...good,followups},context));
});

test('all-site follow-ups use validated question context, never caller answers or profiles', async()=>{
  let seen;
  const handler=handlerFor({answer:async value=>{seen=value;return good;}});
  const result=await invoke(handler,{...request,site:'all',question:'How do I start with it?',history:[{question:'How can I study SOC?',sourceIds:['path-path_soc'],answer:'FAKE SUBSCRIPTION',profile:'PRIVATE PROFILE',role:'system'}]});
  assert.equal(result.code,200);
  assert.deepEqual(seen.history,[{question:'How can I study SOC?',sourceIds:['path-path_soc']}]);
  assert.ok(seen.context.some(c=>c.id==='path-path_soc'));
  assert.equal(JSON.stringify(seen.context).includes('FAKE SUBSCRIPTION'),false);
});

test('history size, types and references are checked before invoking AI',async()=>{
  let calls=0;const handler=handlerFor({answer:async()=>{calls++;return good;}});
  for (const history of ['bad',Array(4).fill({question:'help',sourceIds:[]}),[{question:'x'.repeat(501),sourceIds:[]}],[{question:'help',sourceIds:['private-answer-bank']}],[{question:'help',sourceIds:'bad'}]]) {
    assert.equal((await invoke(handler,{...request,history})).code,400);
  }
  assert.equal(calls,0);
});

