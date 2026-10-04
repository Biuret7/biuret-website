(function () {
  const config = window.BIURET_APPWRITE_CONFIG || { endpoint: 'https://fra.cloud.appwrite.io/v1', projectId: '6aa55a88003959a536e9', licensingFunctionId: '6aa5abef002dd368d5cc' };
  const excluded = () => navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true || localStorage.getItem('biuret-analytics-excluded') === 'true';
  const randomId = () => [...crypto.getRandomValues(new Uint8Array(16))].map((n) => n.toString(16).padStart(2, '0')).join('');
  const validId = (id) => /^[a-f0-9]{32}$/.test(id || '');
  const source = () => {
    if (!document.referrer) return 'direct';
    let host;
    try { host = new URL(document.referrer).hostname; } catch { return 'other'; }
    if (['biuret.dev', 'www.biuret.dev'].includes(host)) return 'direct';
    if (host === 'academy.biuret.dev') return 'academy';
    for (const name of ['google', 'bing', 'github', 'linkedin', 'facebook', 'instagram', 'youtube']) {
      if (host === `${name}.com` || host.endsWith(`.${name}.com`)) return name;
    }
    return 'other';
  };
  const call = async (action, data = {}) => {
    if (window.BiuretAppwrite?.configured && typeof window.BiuretAppwrite.analytics === 'function') return window.BiuretAppwrite.analytics(action, data);
    const response = await fetch(`${config.endpoint}/functions/${config.licensingFunctionId}/executions`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Appwrite-Project': config.projectId }, body: JSON.stringify({ body: JSON.stringify({ ...data, action: `analytics:${action}` }), async: false, path: '/', method: 'POST' }), signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error('Analytics unavailable');
    const execution = await response.json();
    const result = JSON.parse(execution.responseBody || '{}');
    if (execution.responseStatusCode >= 400 || !result.ok) throw new Error(result.error || 'Analytics unavailable');
    return result;
  };
  window.BiuretAnalytics = { call };
  let visitors;
  const render = () => {
    const ar = document.documentElement.lang === 'ar';
    document.querySelectorAll('[data-visitor-label]').forEach((label) => { label.textContent = ar ? 'زوار فريدون' : 'UNIQUE VISITORS'; });
    document.querySelectorAll('[data-visitor-total]').forEach((label) => { label.textContent = Number.isInteger(visitors) ? new Intl.NumberFormat(ar ? 'ar' : 'en').format(visitors) : '—'; });
    document.querySelectorAll('[data-visitor-counter]').forEach((el) => { el.hidden = !Number.isInteger(visitors); el.title = ar ? 'عدد متصفحات الزوار منذ بدء القياس؛ قد يستخدم الشخص أكثر من متصفح.' : 'Distinct visitor browsers since measurement began; one person may use multiple browsers.'; });
  };
  async function track() {
    if (!['biuret.dev', 'www.biuret.dev'].includes(location.hostname) || location.pathname === '/analytics.html') return;
    let payload;
    try {
      if (!excluded()) {
        const now = Date.now();
        let visitor = JSON.parse(localStorage.getItem('biuret-analytics-visitor') || 'null');
        if (!validId(visitor?.id) || !Number.isFinite(visitor?.created) || now - visitor.created > 90 * 86400000) visitor = { id: randomId(), created: now };
        let session = JSON.parse(localStorage.getItem('biuret-analytics-session') || 'null');
        if (!validId(session?.id) || !Number.isFinite(session?.last) || now - session.last > 30 * 60000) session = { id: randomId(), source: source() };
        session.last = now;
        localStorage.setItem('biuret-analytics-visitor', JSON.stringify(visitor));
        localStorage.setItem('biuret-analytics-session', JSON.stringify(session));
        const ua = navigator.userAgent;
        payload = { visitorId: visitor.id, sessionId: session.id, path: location.pathname, source: session.source,
          device: /iPad|Tablet/i.test(ua) ? 'tablet' : /Mobi|Android/i.test(ua) ? 'mobile' : 'desktop',
          browser: /Edg\//.test(ua) ? 'edge' : /Firefox\//.test(ua) ? 'firefox' : /Chrome\//.test(ua) ? 'chrome' : /Safari\//.test(ua) ? 'safari' : 'other',
          language: /^ar/i.test(navigator.language) ? 'ar' : /^en/i.test(navigator.language) ? 'en' : 'other' };
      }
    } catch { /* With unavailable storage, show totals without recording a duplicate visitor. */ }
    try { const result = await call(payload ? 'track' : 'totals', payload); visitors = result.visitors; render(); } catch { /* Analytics never blocks the portfolio. */ }
  }
  function setup() {
    new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    render();
    const preference = document.querySelector('[data-analytics-optout]');
    if (preference) {
      try { preference.checked = excluded(); preference.disabled = navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true; } catch { preference.checked = true; }
      preference.addEventListener('change', () => { try { localStorage.setItem('biuret-analytics-excluded', String(preference.checked)); } catch {} });
    }
    const adminLink = document.querySelector('[data-analytics-admin-link]');
    if (adminLink && window.BiuretAppwrite?.configured) {
      window.BiuretAppwrite.getCurrentUser().then(() => call('adminStatus')).then((value) => { adminLink.hidden = !value.admin; }).catch(() => {});
    }
    if (document.visibilityState === 'visible') track();
    else document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') track(); }, { once: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true });
  else setup();
}());
