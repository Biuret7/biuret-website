# Portfolio analytics

Anonymous analytics shares the existing deployed function `6aa5abef002dd368d5cc`
because the project Free plan allows two functions. It uses no new API keys or
expanded scopes. Payment and entitlement actions keep their existing validation.

Create table `portfolio_visits` in database `6aa56477002e28054068` with no client
permissions and Row Security enabled. Required columns:

| Column | Type | Size |
| --- | --- | --- |
| kind | Varchar | 12 |
| payload | Text | 16,383 (service maximum) |

Add a key index on `kind`. Visitor, visit and page-view rows have deterministic
hash IDs. Each page counts once per session. Browser identifiers expire after
90 days; sessions expire after 30 minutes of inactivity. No account identity,
raw visitor IDs, IP address, query strings or full referral URLs are stored.

Public actions: `analytics:track`, `analytics:totals`. Private actions:
`analytics:adminStatus`, `analytics:stats` (30-day aggregate breakdowns). Private
actions verify the JWT using `/account` then read the server-assigned user labels;
`admin` or the configured `BIURET_ADMIN_LABEL` can view aggregates. User prefs and
submitted user IDs never grant access. All rows have empty permissions.

Counts measure browsers, not verified people, and are not an anti-fraud system.
Clients can opt out; Do Not Track and Global Privacy Control are respected.
Referrers and device/browser categories are browser-reported. The 30-day detail
report is bounded at 5,000 rows and explicitly marked as sampled beyond that.
All-time totals count all rows, including when detail is sampled.

The static build adds `analytics.js` to public pages. Function source and archives
are excluded from the Pages artifact. `analytics.html` requires the server check,
even when opened directly. A shortcut appears on an administrator's profile.

References: [Function context and keys](https://appwrite.io/docs/products/functions/develop),
[Rows](https://appwrite.io/docs/products/databases/tablesdb/rows).
