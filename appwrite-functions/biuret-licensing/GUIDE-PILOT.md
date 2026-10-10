# Gemini Guide private pilot — deployment review, 2026-10-10

## Current state

Deployed as a private administrator pilot on 2026-10-10 after owner approval. The owner entered the Gemini key directly in Appwrite as a secret; the assistant did not read or copy its value. `GUIDE_ENABLED=true` is live on deployment `6aca09776d2d827bce43`. The embedded Guide now sends submitted questions to Gemini on Portfolio and Academy for the approved administrator. Ordinary visitors do not receive model access. Playground has the same interface and a link to the full Guide; its Appwrite origin registration was rejected by Console, and the owner chose to defer that connection.

Eight live checks confirmed server-approved administrator access and useful Arabic/English guidance for each of Portfolio, Academy and Playground. The six factual replies took 1.0–1.6 seconds and cited validated public source links. The two boundary checks abstained from supplying final-exam answers and from reading account information or inventing a Biu Lock release link; documented site guidance appeared instead. These samples verify the connection and selected behavior; they are not a guarantee that every model reply is correct.

The Biuret Appwrite Free project currently allows two functions and both slots are used. This update adds an isolated `guide/` module to the existing **Biuret Licensing** function `6aa5abef002dd368d5cc`. Academy Progress and its private lesson/assessment libraries are not included or modified. Existing licensing/analytics routes remain in `index.js`; the new `guide:status` and `guide:ask` routes run before licensing service initialization and reject anonymous/non-admin calls.

The existing function has database/account scopes for its other services. Guide itself never uses the dynamic server key or calls a database, storage or billing API. It verifies the requesting session JWT with `/account`, keeps the identity on the server and checks a server-maintained administrator ID allowlist. Only the question and public site context go to Gemini.

## Deployment and secret entry

- Keep the existing Node.js 22 runtime, `index.js` entrypoint, permissions, scopes and webhook configuration.
- Keep the existing 15-second function timeout. Identity verification has a 4-second deadline and Gemini a 9-second deadline, leaving time for validation and the response.
- Upload the reviewed archive containing only `index.js`, `analytics.js`, `package.json`, `guide/main.js`, `guide/provider.js`, `guide/context.js` and `guide/knowledge.json`.
- The expanded update also includes `guide/context.js`: 139 public bilingual cards, query-based context selection (14 cards/18,000 characters maximum), all-site questions, validated recent-question context, clarification and suggested follow-ups. Public owner, skills and learning-journey facts are included. The generator reads only public path metadata; it never imports private lesson or assessment libraries.
- Follow-up requests may include at most three recent successful questions and validated public source IDs. The server drops caller-supplied answers, profiles and roles. The consent notice explicitly covers this context; clearing the conversation removes the page's in-memory context. It does not delete Appwrite/Google records.
- Add `GUIDE_ADMIN_USER_IDS` for the previously approved Academy administrator only.
- `GUIDE_GEMINI_MODEL=gemini-3.5-flash-lite` (stable, free tier documented by Google on review date; actual project quota/availability remains to be tested).
- Create **secret** variable `GEMINI_API_KEY`: the owner enters it directly in Appwrite; no chat, Git, screenshot or archive should contain it.
- Keep `GUIDE_ENABLED=false` until the key is saved and private testing is ready. `true` permits only the verified administrator. `false` stops model requests.
- Frontend page `/guide-pilot.html` is noindex. The embedded widgets link to it as the full Guide. Both interfaces use server-verified administrator access and show an explicit consent notice before sending to Gemini. Topic-reading buttons are separately labelled reference text, and never substitute for a model answer.

Status request: `{action:"guide:status"}`. Question request: `{action:"guide:ask",question,locale,site,consent:true,history}` through authenticated Appwrite SDK executions. No direct Gemini credentials are sent from the browser. Response citations are validated against the maintained public cards. Only plain text and our own validated source links are rendered. Unknown/unavailable replies explicitly show that the model did not answer; no saved reply is substituted. Existing answers are retained when the interface language changes.

## Tests

41 Portfolio tests passed: provider request isolation, header-only credential, streamed response size, malformed/blocked/truncated/quota results, source validation, unknown-topic abstention, session/admin/consent enforcement, context injection rejection, kill switch, warm-runtime throttling, routing, current analytics/licensing/profile regressions, and independent authenticated widget submissions/error handling. All 143 Academy tests passed after synchronizing public asset versions. Provider tests use fake replies; they do **not** prove live model quality.

Local UI review: Arabic/English, correct RTL/LTR, 320px without horizontal overflow, site selection and suggested questions without sending. Initial local layout preview excluded the auth SDK; production uses the SDK and administrator access was verified there.

## Privacy and release boundary

Free Gemini services may use submitted content/responses to improve Google services, including human review. The pilot requires explicit consent for each submission and warns against personal/confidential inputs. The function logs no key, JWT, question or upstream payload. Appwrite may retain execution records; do not claim zero retention.

Google's API terms include age and supported-region restrictions and require paid services when making clients available to EEA/UK/Swiss users. This draft is for a private owner test, not unrestricted visitor access.

Pilot guards are 4 calls/minute, 80/day and 1 in flight **per warm runtime**. They reset on restart and are not a distributed billing cap. Public rollout requires appropriate provider terms/data policy, durable quotas and abuse protection.

## Acceptance after deployment

Sign in as the approved administrator, confirm status, test all three site contexts in Arabic and English, ensure useful factual replies/direct sources, and verify exam-answer refusal, invented-feature refusal, account-access refusal and prompt-injection resistance. Check quota/error fallback and latency. Only then decide a public rollout.

Rollback: disable `GUIDE_ENABLED`; if needed reactivate the previously active Appwrite deployment **6ac5445872339f047a5a** observed in Console. The source-download attempt timed out, so it was not claimed as a verified local backup.

Sources: [Google model](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite), [pricing](https://ai.google.dev/gemini-api/docs/pricing), [API](https://ai.google.dev/api/generate-content), [key handling](https://ai.google.dev/gemini-api/docs/api-key), [terms](https://ai.google.dev/gemini-api/terms), [Appwrite function context](https://appwrite.io/docs/products/functions/develop).

## Previous expanded pilot acceptance — 2026-10-10

- Final active deployment: `6aca061380cfbb16ac48`, 1-second build, 1.13 MB. Same administrator, secret and permission boundary.
- Final archive: 47,073 bytes; SHA256 `18115fb6405dcf93e81ebc918166df1e4fa3d4db76e36d629586886fa27ccab0`.
- 136 public bilingual knowledge cards; 39 automated tests passed. After acceptance fixes, all 21 Guide tests and then 18 provider/auth tests passed again.
- Live verification: Arabic SOC/DFIR comparison cites distinct paths; DFIR course facts are correct; a follow-up without repeating the path name names DFIR and links to it; an unidentified broken-button report asks for the page/button using clarify; English PDF/PNG/JPEG and opt-in verification reply states no external accreditation. Successful final answers took 1.4–2.0 seconds; one comparison took 6.1 seconds. This is sample latency, not a service guarantee.
- Suggestions fill the input without submitting. New conversation cleared context, answer, input and consent. RTL/LTR at 320px had no horizontal overflow.
- First Pages run failed on a test dependency on sibling repositories. Portable reviewed route validation fixed the gate. Public Guide widgets remain curated; Gemini stays in the private administrator pilot.
- Knowledge expansion is a local maintenance script that needs the Academy public source checkout; committed generated JSON lets the standalone Pages build run without sibling repositories.

## Embedded Gemini acceptance — 2026-10-10

- Active backend deployment: `6aca09776d2d827bce43`, 1-second build, 1.13 MB. The secret, administrator allowlist and function permissions were unchanged.
- Archive: 49,262 bytes; SHA256 `91638a202c21f8ff76506aa7e030138c00b85d95540764dc55774ca877697527`.
- Portfolio Pages run `38042615538`, Academy run `38043157686`, and Playground run `38042620000` succeeded. Academy's first attempt failed the existing mixed-module-version audit; synchronized HTML/module references fixed it without weakening the audit.
- Live Portfolio question `مين صاحب هذا الموقع؟` received a freshly composed owner answer. A follow-up requesting a single-sentence summary of his technical interests used the prior context and produced one sentence about the six documented areas.
- Changing the interface to English preserved both actual Gemini answers. Academy's embedded widget confirmed authenticated Gemini availability; Arabic at 320px had no horizontal overflow.
- Proof: `tmp/guide-gemini-20261010/gemini-inline-owner.png` in the parent workspace.
- Playground origin `demos.biuret.dev` was not in the Appwrite Apps list. Owner-approved registration was rejected twice with `You do not have permission to access this resource`; it did not add an origin. The owner explicitly chose to continue without direct Playground connection. Its full-Guide link allows the same approved account to ask about Playground from Portfolio.
