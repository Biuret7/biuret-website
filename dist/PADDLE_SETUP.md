# Paddle checkout setup

The site is configured for Paddle **Sandbox** with a public Paddle.js client-side token. This token starts with `test_` and is only for development and checkout in the browser.

## Before enabling checkout

Create the actual catalog in the Paddle Sandbox dashboard. For each product and billing period, record the generated **Price ID** (it starts with `pri_`). Add those IDs to the matching values in `paddle-config.js`. The first Sandbox test price for BiuLock Monthly is configured; `paddle-checkout.js` opens checkout only for plans that have a valid Price ID.

Suggested first test product:

| Field | Value |
| --- | --- |
| Product name | BiuLock |
| Plan | Monthly |
| Billing | Recurring, monthly |
| Test price | $9.99 USD |

Then repeat for the 3-month and yearly plans only when their exact billing behaviour and prices are decided.

## Security boundary

- Never put a Paddle API key or webhook secret in the website.
- A verified Paddle webhook and an Appwrite server Function must create or renew licenses after payment. Browser-side checkout alone must never grant a license.
- Sandbox and Live have separate products, prices, tokens, and webhooks. Create the Live equivalents only after the Sandbox purchase flow is tested.
