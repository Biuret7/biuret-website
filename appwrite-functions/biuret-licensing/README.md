# Biuret licensing function

This Appwrite Function is the server-side authority for Biuret purchases and
desktop-app access. It is deliberately separate from the static site: Paddle
webhook secrets and Appwrite server privileges never reach a browser or a
released desktop app.

## Function settings

- Suggested function ID: `biuret-licensing`
- Runtime: current Node.js LTS
- Entrypoint: `index.js`
- Build command: `npm install`
- Execute access: `Any` (required for Paddle's unsigned HTTP webhook)
- Scopes: `users.read`, `databases.read`, `databases.write`

The Paddle webhook must use the function's generated domain URL. `Any` is safe
here because the function rejects every non-webhook request without an
authenticated Appwrite user, and rejects every webhook without a valid
Paddle signature. Do not add any other public actions to this function.

The authenticated `account-access` action is intentionally limited to checking
that an email-verified Biuret account exists. It is used by the Academy desktop
app; paid desktop products use `entitlement` and still require an active row in
the licenses table (or the `biuretadmin` account label).

## Required environment variables

| Variable | Value |
| --- | --- |
| `BIURET_LICENSE_DATABASE_ID` | `6aa56477002e28054068` |
| `BIURET_LICENSES_TABLE_ID` | `6aa5648e00020bbf8f1d` |
| `BIURET_CHECKOUT_INTENTS_TABLE_ID` | `6aa59c41001c11db12ef` |
| `BIURET_PADDLE_PRICES` | JSON map of allowed Paddle price IDs; see below |
| `PADDLE_WEBHOOK_SECRET` | Paddle webhook secret — mark as Secret |
| `BIURET_ADMIN_LABEL` | `biuretadmin` |

Example `BIURET_PADDLE_PRICES` for the existing BiuLock Sandbox monthly price:

```json
{
  "pri_01m2b6rpddtch9bvgf0g4j14wf": {
    "productSlug": "biulock",
    "productName": "BiuLock",
    "plan": "monthly",
    "durationDays": 31,
    "downloadUrl": ""
  }
}
```

## Required table changes

Create an `checkout_intents` table with server-only permissions and these
required columns:

| Column | Type / length |
| --- | --- |
| `userId` | varchar 36 |
| `productSlug` | varchar 64 |
| `productName` | varchar 128 |
| `plan` | varchar 32 |
| `priceId` | varchar 64 |
| `status` | varchar 24 |
| `expiresAt` | datetime |
| `fulfillmentTransactionId` | varchar 64 |

In the existing licenses table, add these columns before deployment:

| Column | Type / length |
| --- | --- |
| `providerSubscriptionId` | varchar 64 |
| `providerTransactionId` | varchar 64 |

Enable Row Security for the licenses table. A fulfillment row gets only
`read` access for the buyer's Appwrite user; users must not receive create,
update, or delete permission. The function creates and updates all payment
records with its server-only dynamic key.

## Admin access

In Appwrite Console, open **Auth → Users**, select your own user, and add the
label `biuretadmin`. The function receives the signed-in user's labels from
Appwrite and grants that account access to every product without a license row.
No admin email, secret key, or offline bypass is embedded in the applications.

Admin access still requires a verified Biuret account and sign-in.
