# Portfolio UI refresh

## Changes
- Shared presentation layer on themed public pages and all six concept pages.
- Desktop navigation is visible from 1200px; the existing menu remains below that width.
- Compact utilities are visually distinct from section navigation.
- Tighter hero, project previews, segmented filters, certificate cards and account surfaces.
- An authored light palette keeps actions dark and text readable.
- Guide launcher is part of the header, with translated accessible name and tooltip.
- Pointer, touch and reduced-motion states remain supported.

## Verification
- 41 existing tests pass with the project's experimental VM flag.
- Syntax checks pass for script.js and guide/widget.js; public build succeeds.
- Mobile layouts checked on home, certificates, auth, account and a concept page.
- Header collision and overflow checks pass at 1200, 1199, 900 and 320px.
- Arabic menu opens and closes; certificate enlargement and Guide opening/closing work.
- Local Guide provider access is origin-restricted; no AI question was sent during UI verification.
