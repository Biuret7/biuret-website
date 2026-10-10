# Gemini Guide private pilot — deployment review, 2026-10-10

## Current state

Prepared locally and tested; not deployed or enabled. No Gemini key was read or sent. No real model response has been verified.

The Biuret Appwrite Free project currently allows two functions and both slots are used. This update adds an isolated `guide/` module to the existing **Biuret Licensing** function `6aa5abef002dd368d5cc`. Academy Progress and its private lesson/assessment libraries are not included or modified. Existing licensing/analytics routes remain in `index.js`; the new `guide:status` and `guide:ask` routes run before licensing service initialization and reject anonymous/non-admin calls.

The existing function has database/account scopes for its other services. Guide itself never uses the dynamic server key or calls a database, storage or billing API. It verifies the requesting session JWT with `/account`, keeps the identity on the server and checks a server-maintained administrator ID allowlist. Only the question and public site context go to Gemini.

## Deployment and secret entry

- Keep the existing Node.js 22 runtime, `index.js` entrypoint, permissions, scopes and webhook configuration.
- Upload the reviewed archive containing only `index.js`, `analytics.js`, `package.json`, `guide/main.js`, `guide/provider.js` and `guide/knowledge.json`.
- Add `GUIDE_ADMIN_USER_IDS` for the previously approved Academy administrator only.
- `GUIDE_GEMINI_MODEL=gemini-3.5-flash-lite` (stable, free tier documented by Google on review date; actual project quota/availability remains to be tested).
- Create **secret** variable `GEMINI_API_KEY`: the owner enters it directly in Appwrite; no chat, Git, screenshot or archive should contain it.
- Keep `GUIDE_ENABLED=false` until the key is saved and private testing is ready. `true` permits only the verified administrator. `false` stops model requests.
- New frontend page `/guide-pilot.html` is noindex and unlinked from navigation. Its source is public; its AI requests require server-verified administrator access. The normal Guide on all three sites remains curated.

Status request: `{action:"guide:status"}`. Question request: `{action:"guide:ask",question,locale,site,consent:true}` through authenticated Appwrite SDK executions. No direct Gemini credentials are sent from the browser. Response citations are validated against the selected site's public cards. Only plain text and our own validated source links are rendered. Unknown/unavailable replies fall back to the curated guide.

## Tests

33 tests passed: provider request isolation, header-only credential, streamed response size, malformed/blocked/truncated/quota results, source validation, unknown-topic abstention, session/admin/consent enforcement, context injection rejection, kill switch, warm-runtime throttling, routing and current analytics/licensing/profile regressions. Provider tests use fake replies; they do **not** prove live model quality.

Local UI review: Arabic/English, correct RTL/LTR, 320px without horizontal overflow, site selection and suggested questions without sending. Local preview intentionally excludes the auth SDK; unavailable connection is the expected state.

## Privacy and release boundary

Free Gemini services may use submitted content/responses to improve Google services, including human review. The pilot requires explicit consent for each submission and warns against personal/confidential inputs. The function logs no key, JWT, question or upstream payload. Appwrite may retain execution records; do not claim zero retention.

Google's API terms include age and supported-region restrictions and require paid services when making clients available to EEA/UK/Swiss users. This draft is for a private owner test, not unrestricted visitor access.

Pilot guards are 4 calls/minute, 80/day and 1 in flight **per warm runtime**. They reset on restart and are not a distributed billing cap. Public rollout requires appropriate provider terms/data policy, durable quotas and abuse protection.

## Acceptance after deployment

Sign in as the approved administrator, confirm status, test all three site contexts in Arabic and English, ensure useful factual replies/direct sources, and verify exam-answer refusal, invented-feature refusal, account-access refusal and prompt-injection resistance. Check quota/error fallback and latency. Only then decide a public rollout.

Rollback: disable `GUIDE_ENABLED`; if needed reactivate the previously active Appwrite deployment **6ac5445872339f047a5a** observed in Console. The source-download attempt timed out, so it was not claimed as a verified local backup.

Sources: [Google model](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite), [pricing](https://ai.google.dev/gemini-api/docs/pricing), [API](https://ai.google.dev/api/generate-content), [key handling](https://ai.google.dev/gemini-api/docs/api-key), [terms](https://ai.google.dev/gemini-api/terms), [Appwrite function context](https://appwrite.io/docs/products/functions/develop).
