import { sourceURL } from './guide/core.mjs?v=20261010-guide6';
import { readReply } from './guide/gateway.mjs?v=20261010-guide6';

const $ = id => document.getElementById(id);
const config = window.BIURET_APPWRITE_CONFIG, sdk = window.Appwrite;
const client = sdk && config ? new sdk.Client().setEndpoint(config.endpoint).setProject(config.projectId) : null;
const functions = client ? new sdk.Functions(client) : null;
let cards = [], ready = false, busy = false, checking = false, connection = 'loading', current = null, history = [];
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
  all: [['Who owns this website?', 'مين صاحب هذا الموقع؟'], ['Help me choose a learning path.', 'ساعدني أختار مسار تعلم.'], ['How do I download my certificate?', 'كيف أنزّل شهادتي؟']],
  portfolio: [['What can I try now?', 'ما الذي يمكنني تجربته الآن؟'], ['Where are the certificates?', 'أين أجد الشهادات؟']],
  academy: [['Compare SOC and DFIR for a beginner.', 'قارن بين SOC وDFIR للمبتدئ.'], ['How do I download and verify my certificate?', 'كيف أنزّل شهادتي وأتحقق منها؟'], ['Why is my path exam locked?', 'ليش امتحان المسار مقفل؟']],
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
  $('clear-chat').disabled = busy; $('copy-answer').hidden = !current; $('copy-answer').disabled = busy;
  $('followups').replaceChildren(); $('recent').replaceChildren();
  $('followups').setAttribute('aria-label',tr('Follow-up questions','أسئلة متابعة'));
  for (const question of current?.remote?.followups || []) {
    const button = document.createElement('button');button.type='button';button.textContent=question;button.dir='auto';button.disabled=busy;
    button.addEventListener('click',()=>{$('question').value=question;$('question').focus();});$('followups').append(button);
  }
  if (history.length) {
    const label=document.createElement('p');label.textContent=tr('Recent context · kept in this page only','سياق المتابعة · داخل هذه الصفحة فقط');$('recent').append(label);
    for (const entry of history) { const line=document.createElement('p');line.dir='auto';line.textContent=entry.question;$('recent').append(line); }
  }
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
  else { p.textContent = tr(...current.status); $('mode').textContent = tr('No AI answer', 'لا توجد إجابة نموذج'); }
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
$('clear-chat').addEventListener('click',()=>{ history=[];current=null;$('question').value='';$('consent').checked=false;$('copy-status').textContent='';render();$('question').focus(); });
$('copy-answer').addEventListener('click',async()=>{ if (!current || busy) return; try { await navigator.clipboard.writeText($('result').innerText);$('copy-status').textContent=tr('Copied','تم النسخ'); } catch { $('copy-status').textContent=tr('Select the answer to copy it.','حدد الإجابة لنسخها.'); } });
$('pilot-form').addEventListener('submit', async event => {
  event.preventDefault(); if (busy || !ready || !$('consent').checked) return;
  const question = $('question').value.trim(), site = $('site').value, lang = locale();
  if (question.length < 2 || question.length > 500) return;
  busy = true; current = null; render(); const start = performance.now();
  $('copy-status').textContent='';
  let matches = [], remote = null, status;
  try {
      const value = await execute('ask', { question, site, locale: lang, consent: true, history });
    const reply=readReply(value,cards);
    if (!reply) {
      status = ['Gemini has no documented answer yet. Try identifying the page or feature. No saved answer was substituted.', 'لا يملك Gemini إجابة موثقة بعد. جرّب تحديد الصفحة أو الميزة. لم نستبدل الرد بإجابة محفوظة.'];
    } else {
      remote = reply.remote; matches = reply.matches;
      history = [...history,{question,sourceIds:value.sourceIds}].slice(-3);
      const seconds = ((performance.now() - start) / 1000).toFixed(1);
      status = value.outcome==='clarify' ? ['A quick clarification will help.','توضيح بسيط يساعدني على إرشادك.'] : [`AI reply · ${seconds}s · check the sources.`, `إجابة النموذج · ${seconds} ثانية · راجع المصادر.`];
    }
  } catch (failure) {
    status = failure.message === 'model_quota_exceeded' || failure.code === 429
      ? ['Usage limit reached. Wait a minute and try again. No saved answer was substituted.', 'بلغت حد الاستخدام. انتظر دقيقة وحاول مجدداً. لم نستبدل الإجابة برد محفوظ.']
      : ['Gemini could not answer. Check connection and retry. No saved answer was substituted.', 'تعذّر رد Gemini. افحص الاتصال وأعد المحاولة. لم نستبدل الإجابة برد محفوظ.'];
    if ([401, 403].includes(failure.code)) { ready = false; connection = 'restricted'; }
  } finally { current = { remote, matches, status }; busy = false; render(); }
});
render();
fetch('guide/knowledge.json?v=20261010-guide6').then(r => { if (!r.ok) throw Error(); return r.json(); }).then(value => { cards = value; render(); }).catch(() => { connection = 'unavailable'; ready = false; render(); });
check();
