import { retrieve, sourceURL } from './guide/core.mjs?v=20261009-guide3';

const $ = id => document.getElementById(id);
const config = window.BIURET_APPWRITE_CONFIG, sdk = window.Appwrite;
const client = sdk && config ? new sdk.Client().setEndpoint(config.endpoint).setProject(config.projectId) : null;
const functions = client ? new sdk.Functions(client) : null;
let cards = [], ready = false, busy = false, checking = false, connection = 'loading', current = null;
const tr = (en, ar) => document.documentElement.lang === 'ar' ? ar : en;
const locale = () => document.documentElement.lang === 'ar' ? 'ar' : 'en';
const statuses = {
  loading: ['Checking private pilot access…', 'جارٍ فحص صلاحية التجربة الخاصة…'],
  ready: ['Gemini is ready for a private test.', 'Gemini جاهز للتجربة الخاصة.'],
  disabled: ['Server access is approved; Gemini is not enabled yet.', 'وصولك للخادم معتمد؛ لم يُفعّل Gemini بعد.'],
  restricted: ['Sign in with the approved administrator account.', 'سجّل الدخول بحساب الإدارة المعتمد.'],
  unavailable: ['Pilot connection is unavailable. Try again after setup.', 'اتصال التجربة غير متاح. أعد المحاولة بعد إكمال الإعداد.']
};
const starters = {
  portfolio: [['What can I try now?', 'ما الذي يمكنني تجربته الآن؟'], ['Where are the certificates?', 'أين أجد الشهادات؟']],
  academy: [['Where should a beginner start?', 'من أين يبدأ المبتدئ؟'], ['How do path exams and certificates work?', 'كيف تعمل امتحانات المسارات والشهادات؟']],
  playground: [['Which tool helps me organize my week?', 'أي أداة تساعدني على تنظيم أسبوعي؟'], ['Are the Desktop and CLI downloads available?', 'هل تنزيل برامج Desktop وCLI متاح؟']]
};
async function execute(action, data = {}) {
  if (!functions) throw Object.assign(Error('unavailable'), { code: 503 });
  const execution = await functions.createExecution({ functionId: config.licensingFunctionId, body: JSON.stringify({ ...data, action: `guide:${action}` }), async: false, path: '/', method: 'POST' });
  const result = JSON.parse(execution.responseBody || '{}');
  if (execution.responseStatusCode < 200 || execution.responseStatusCode >= 300) throw Object.assign(Error(result.error || 'unavailable'), { code: execution.responseStatusCode });
  return result;
}
function render() {
  const ar = locale() === 'ar'; document.documentElement.dir = ar ? 'rtl' : 'ltr';
  for (const el of document.querySelectorAll('[data-en][data-ar]')) el.textContent = el.dataset[locale()];
  $('language').textContent = ar ? 'English' : 'العربية';
  $('question').placeholder = tr('Ask about a feature, a tool or your next step…', 'اسأل عن ميزة أو أداة أو خطوتك القادمة…');
  $('connection').textContent = tr(...statuses[connection]);
  $('connection').parentElement.classList.toggle('ready', ready);
  $('signin').hidden = connection !== 'restricted'; $('refresh').disabled = checking || busy;
  $('send').disabled = !ready || busy || !cards.length;
  if (busy) $('send').textContent = tr('Finding your next step…', 'جارٍ البحث عن خطوتك القادمة…');
  $('site').disabled = busy; $('language').disabled = busy;
  $('suggestions').replaceChildren();
  for (const pair of starters[$('site').value]) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = tr(...pair); button.disabled = busy;
    button.addEventListener('click', () => { $('question').value = tr(...pair); $('question').focus(); }); $('suggestions').append(button);
  }
  $('result').replaceChildren(); $('mode').textContent = '';
  $('answer-status').textContent = busy ? tr('Waiting for Gemini…', 'بانتظار رد Gemini…') : current?.status ? tr(...current.status) : '';
  if (!current) { $('result').textContent = tr('Choose a site and ask a question. No request is sent until you check consent and submit.', 'اختر الموقع واكتب سؤالك. لا يُرسل طلب قبل الموافقة والضغط على زر الإرسال.'); return; }
  const p = document.createElement('p'); p.dir = 'auto';
  if (current.remote) { p.textContent = current.remote.answer; $('mode').textContent = 'Gemini'; }
  else { p.textContent = current.matches.map(c => c.body[locale()]).join('\n\n') || tr('No documented topic matches this question. Try a site feature or one of the suggestions.', 'لا يطابق هذا السؤال موضوعاً موثقاً. جرّب ميزة من الموقع أو أحد الاقتراحات.'); $('mode').textContent = tr('Site guide', 'دليل الموقع'); }
  $('result').append(p);
  for (const card of current.matches) { const link = document.createElement('a'); link.href = sourceURL(card, 'portfolio'); link.textContent = card.title[locale()] + ' ↗'; $('result').append(link); }
}
async function check() {
  if (checking || busy) return;
  checking = true; ready = false; connection = 'loading'; render();
  try { const value = await execute('status'); ready = value.configured === true; connection = ready ? 'ready' : 'disabled'; }
  catch (failure) { connection = [401, 403].includes(failure.code) ? 'restricted' : 'unavailable'; }
  finally { checking = false; render(); }
}
$('refresh').addEventListener('click', check);
$('language').addEventListener('click', () => { document.documentElement.lang = locale() === 'ar' ? 'en' : 'ar'; render(); });
$('site').addEventListener('change', () => { current = null; render(); });
$('pilot-form').addEventListener('submit', async event => {
  event.preventDefault(); if (busy || !ready || !$('consent').checked) return;
  const question = $('question').value.trim(), site = $('site').value, lang = locale();
  if (question.length < 2 || question.length > 500) return;
  busy = true; current = null; render(); const start = performance.now();
  let matches = retrieve(question, cards, site), remote = null, status;
  try {
    const value = await execute('ask', { question, site, locale: lang, consent: true });
    if (value.outcome === 'unknown' && Array.isArray(value.sourceIds) && !value.sourceIds.length) {
      status = ['Gemini abstained; showing documented site guidance.', 'لم يجد Gemini إجابة موثقة؛ نعرض دليل الموقع.'];
    } else {
      if (typeof value.answer !== 'string' || !value.answer.trim() || value.answer.length > 4000 || !Array.isArray(value.sourceIds) || !value.sourceIds.length ||
          value.sourceIds.some(id => !cards.some(c => c.id === id && c.site === site))) throw Error('invalid');
      remote = value; matches = cards.filter(c => c.site === site && value.sourceIds.includes(c.id));
      const seconds = ((performance.now() - start) / 1000).toFixed(1);
      status = [`AI reply · ${seconds}s · check the sources.`, `إجابة النموذج · ${seconds} ثانية · راجع المصادر.`];
    }
  } catch (failure) {
    status = failure.message === 'model_quota_exceeded' || failure.code === 429
      ? ['Usage limit reached; showing the site guide.', 'وصلنا إلى حد الاستخدام؛ نعرض دليل الموقع.']
      : ['AI is unavailable; showing the site guide.', 'النموذج غير متاح؛ نعرض دليل الموقع.'];
    if ([401, 403].includes(failure.code)) { ready = false; connection = 'restricted'; }
  } finally { current = { remote, matches, status }; busy = false; render(); }
});
render();
fetch('guide/knowledge.json?v=20261009-guide3').then(r => { if (!r.ok) throw Error(); return r.json(); }).then(value => { cards = value; render(); }).catch(() => { connection = 'unavailable'; ready = false; render(); });
check();
