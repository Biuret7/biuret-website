import { readFileSync } from 'node:fs';
import { configuration, geminiAnswer, GuideUnavailable } from './provider.js';

const cards = JSON.parse(readFileSync(new URL('./knowledge.json', import.meta.url), 'utf8'));
const ENDPOINT = 'https://fra.cloud.appwrite.io/v1';
const PROJECT_ID = '6aa55a88003959a536e9';

// Pilot safeguards are per warm runtime. They are not a distributed billing cap.
// Public rollout requires durable quotas and an appropriate provider data policy.
export function pilotLimiter({ minute = 4, daily = 80, now = Date.now } = {}) {
  let requests = [], day = '', dailyCount = 0, inFlight = 0;
  return {
    reserve() {
      const time = now(), today = new Date(time).toISOString().slice(0, 10);
      if (day !== today) { day = today; dailyCount = 0; }
      requests = requests.filter(t => t > time - 60000);
      if (inFlight >= 1 || requests.length >= minute || dailyCount >= daily) return null;
      requests.push(time); dailyCount++; inFlight++;
      let released = false;
      return () => { if (!released) { released = true; inFlight--; } };
    }
  };
}
const limiter = pilotLimiter();

export function makeHandler({ env = process.env, fetchImpl = fetch, limits = limiter, answer = geminiAnswer } = {}) {
  return async ({ req, res }) => {
    const json = (value, code = 200) => res.json(value, code, { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    let release;
    try {
      const admins = new Set((env.GUIDE_ADMIN_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean));
      const cfg = configuration(env), enabled = env.GUIDE_ENABLED === 'true' && cfg.key && admins.size;
      const headers = Object.fromEntries(Object.entries(req.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
      const jwt = headers['x-appwrite-user-jwt'];
      if (!jwt) return json({ error: 'sign_in_required', configured: false }, 401);
      const response = await fetchImpl(`${ENDPOINT}/account`, {
        headers: { 'X-Appwrite-Project': PROJECT_ID, 'X-Appwrite-JWT': jwt },
        redirect: 'error', signal: AbortSignal.timeout(4000)
      });
      if (response.status === 401) return json({ error: 'sign_in_required', configured: false }, 401);
      if (!response.ok) { await response.body?.cancel(); return json({ error: 'identity_unavailable', configured: false }, 503); }
      const account = await response.json();
      if (!admins.has(account.$id)) return json({ error: 'private_pilot_only', configured: false }, 403);
      const raw = req.bodyText || JSON.stringify(req.bodyJson || {});
      if (Buffer.byteLength(raw, 'utf8') > 4096) return json({ error: 'invalid_request' }, 400);
      const value = JSON.parse(raw);
      if (!value || typeof value !== 'object' || Array.isArray(value)) return json({ error: 'invalid_request' }, 400);
      if (value.action === 'status') return json({ configured: Boolean(enabled), provider: 'Gemini', mode: 'private-pilot', dataPolicy: 'unpaid' });
      if (!enabled) return json({ error: 'model_not_configured' }, 503);
      if (value.consent !== true) return json({ error: 'consent_required' }, 400);
      if (!['portfolio', 'academy', 'playground'].includes(value.site) || !['en', 'ar'].includes(value.locale) ||
          typeof value.question !== 'string' || value.question.trim().length < 2 || value.question.length > 500) {
        return json({ error: 'invalid_request' }, 400);
      }
      const context = cards.filter(c => c.site === value.site).map(c => ({
        id: c.id, title: c.title[value.locale], body: c.body[value.locale], steps: c.steps?.[value.locale] || []
      }));
      release = limits.reserve();
      if (!release) return json({ error: 'pilot_limit_reached' }, 429);
      const result = await answer({ question: value.question.trim(), locale: value.locale, context, env, fetchImpl });
      return json(result);
    } catch (error) {
      if (error instanceof SyntaxError) return json({ error: 'invalid_request' }, 400);
      return json({ error: error instanceof GuideUnavailable ? error.code : 'guide_unavailable' }, 503);
    } finally { release?.(); }
  };
}

export default makeHandler();
