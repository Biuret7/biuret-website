# Biuret Appwrite setup

This website is prepared for Appwrite Cloud. The browser receives only the public endpoint, project ID, database ID, and table ID. Never put an Appwrite API key, payment secret, webhook secret, or administrator password in `appwrite-config.js` or any browser-loaded file.

## 1. Create and connect the project

1. Open the Appwrite Console and create a project named `Biuret`.
2. Add a Web platform for `localhost` while testing locally. Add the final production hostname after the domain is live. Appwrite only accepts registered platforms for browser requests and auth redirect URLs.
3. Enable Email + Password authentication. In Auth security, enable password strength, password history, and disallow passwords containing personal data.
4. Copy the public endpoint and project ID into `appwrite-config.js`.

```js
window.BIURET_APPWRITE_CONFIG = Object.freeze({
  endpoint: 'https://YOUR-REGION.cloud.appwrite.io/v1',
  projectId: 'YOUR_PROJECT_ID',
  databaseId: 'biuret',
  licensesTableId: 'licenses'
});
```

### Google and GitHub sign-in

The sign-in and account creation tabs both use Appwrite OAuth2. To activate their buttons:

1. In the Appwrite Console, open **Auth > Social providers** and enable Google and GitHub.
2. Create an OAuth application with each provider. Copy its client ID and client secret into the matching Appwrite provider settings. Keep those secrets in Appwrite; never put them in the website files.
3. For each provider application, use the **exact authorization callback URL shown by Appwrite**. That callback points to Appwrite; Appwrite then returns the user to this site's `auth.html`.
4. Register `biuret.dev`, `www.biuret.dev`, and any local test hostname as Appwrite Web platforms.
5. Test both providers from both tabs, including a cancelled sign-in and return to `account.html` or `settings.html`.

## 2. Create the licenses database

Create a database with ID `biuret`, then add a `licenses` table with these required columns:

| Column | Type | Example |
| --- | --- | --- |
| `userId` | string | Appwrite user ID |
| `productSlug` | string | `biulock` |
| `productName` | string | `BiuLock` |
| `plan` | string | `Monthly` |
| `status` | string | `active` |
| `activateAt` | datetime | activation timestamp |
| `expiresAt` | datetime | expiry timestamp |
| `licenseKeyMasked` | string | `BIULOCK-••••-9X2A` |
| `downloadUrl` | string, optional | signed or controlled download URL |
| `providerSubscriptionId` | string, optional | Paddle subscription ID |
| `providerTransactionId` | string | Paddle transaction ID |

Do **not** grant client users create, update, or delete permission on the table. The checkout/admin server function must create each row and grant read access only to that exact user. Keep table-level public read disabled. The browser can then list only the rows for which its signed-in user has explicit row permission.

## 3. Implement purchases on the server

Create Appwrite Functions for:

- `create-checkout`: validates the product and selected plan server-side, then creates the payment checkout session.
- `payment-webhook`: verifies the gateway signature, records a paid order, creates or extends the license row, and writes a server-side audit event.
- `manage-license`: handles safe renewal/download requests without exposing secret product files or unmasked keys.

Only Functions hold payment keys, webhook secrets, or an Appwrite server API key. Never mark a license paid, active, or extended from browser JavaScript.

## 4. Go-live checklist

- Add the final domain to Appwrite as a Web platform before testing registration, verification, and recovery emails.
- Configure production email templates and sender settings in Appwrite.
- Connect the payment provider only after confirming its availability and business-verification requirements for your location.
- Create a test account, verify its email, and add one temporary license row with read permission for that user.
- Test sign out, protected `account.html`, an expired license, and a user with no licenses.
