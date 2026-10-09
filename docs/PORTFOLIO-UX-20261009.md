# Portfolio UX review — 9 October 2026

## Understand

Working hypotheses, not interview findings: visitors may be collaborators, hiring reviewers, cybersecurity learners, or peers exploring the project ideas. Their first questions are who Adam is, what exists today, what evidence supports his learning, and how to contact him. Phone visitors and Arabic readers need equally usable routes.

## Define

Observed in browser/source review: a long first impression postponed projects; contact navigation unexpectedly opened email; compact navigation omitted GitHub; certificate discovery required scrolling through all records; Arabic headings required more space than English; remote fonts introduced another loading dependency.

## Explore and prototype

Implemented a compact identity-first introduction, three explicit visitor routes, earlier project discovery, search plus categories, consistent controls and spacing, a complete small-screen menu, project breadcrumbs, a searchable certificate archive, and a full-size certificate dialog with next/previous controls. Documentation context is expandable. Contact leads to the contact section with email, Gmail, copy and GitHub choices. Local licensed fonts support both scripts. Existing branding and the preferred hero wordmark remain. Project readiness stays explicit: future concepts and experimental code.

## Validate

Local browser checks covered English/Arabic, 320/390 px phone widths, 1366/1440 px intermediate layouts and 1920 px desktop layout. Tested project search, no-results recovery, certificate categories, English search terms within Arabic, full-image preview, RTL arrow navigation, Escape and focus restoration, phone menu links, contact anchoring and clipboard feedback. At 320 px, document and header bounds fit the viewport. The browser reported no console errors during the final check. All 17 existing account/photo, analytics and licensing regression tests passed; JavaScript syntax and the public artifact build also passed.

These checks are an expert review and functional browser validation, not a usability study with real participants. No conversion, speed or satisfaction improvement has been measured.

## Next: test with visitors

Ask five target visitors (including Arabic and phone users) to: explain the current status of a project; find a cybersecurity certificate and inspect its original; locate a proposed project's GitHub repository; and find a way to contact Adam. Record task completion, confusion, unexpected outcomes and wording feedback. Do not coach them. Prioritize failures that prevent completion, then refine labels and layout before adding more effects.

## Font provenance

Inter and Noto Sans Arabic are local WOFF subsets from the licensed TTF assets in the StudyFlow desktop project. Their SIL Open Font License notices are retained in `assets/fonts`. The fonts are served with `font-display: swap`.
