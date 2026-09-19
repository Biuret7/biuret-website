import crypto from 'node:crypto';
import {
  Client,
  ID,
  Permission,
  Query,
  Role,
  TablesDB,
  Users
} from 'node-appwrite';

const activeStatus = 'active';
const fallbackAppwriteEndpoint = 'https://fra.cloud.appwrite.io/v1';
const defaultWebhookToleranceSeconds = 300;

function asJson(value) {
  if (value && typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(String(value || '{}'));
  } catch {
    return null;
  }
}

function headersOf(request) {
  return Object.fromEntries(
    Object.entries(request.headers || {}).map(([name, value]) => [name.toLowerCase(), String(value)])
  );
}

function response(res, status, body) {
  return res.json(body, status);
}

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required function variable: ${name}`);
  return value;
}

function readConfig() {
  const prices = asJson(requiredEnvironment('BIURET_PADDLE_PRICES'));
  if (!prices || typeof prices !== 'object' || Array.isArray(prices)) {
    throw new Error('BIURET_PADDLE_PRICES must be a JSON object.');
  }

  return {
    databaseId: requiredEnvironment('BIURET_LICENSE_DATABASE_ID'),
    licensesTableId: requiredEnvironment('BIURET_LICENSES_TABLE_ID'),
    intentsTableId: requiredEnvironment('BIURET_CHECKOUT_INTENTS_TABLE_ID'),
    paddleWebhookSecret: process.env.PADDLE_WEBHOOK_SECRET || '',
    paddleWebhookToleranceSeconds: Number(process.env.PADDLE_WEBHOOK_TOLERANCE_SECONDS || defaultWebhookToleranceSeconds),
    adminLabel: process.env.BIURET_ADMIN_LABEL || 'admin',
    prices
  };
}

function appwriteEndpoint() {
  // The deployed Biuret function runs in Appwrite's FRA cloud region.  Cloud
  // functions normally receive APPWRITE_FUNCTION_API_ENDPOINT automatically,
  // but older/manual deployments may omit it at runtime.  A concrete fallback
  // keeps the dynamic function key usable instead of failing before checkout.
  const supplied = String(process.env.APPWRITE_FUNCTION_API_ENDPOINT || '').trim().replace(/\/+$/, '');
  if (!/^https:\/\/fra\.cloud\.appwrite\.io(?:\/v1)?$/i.test(supplied)) {
    return fallbackAppwriteEndpoint;
  }
  return supplied.endsWith('/v1') ? supplied : `${supplied}/v1`;
}

function serverServices(request) {
  const headers = headersOf(request);
  const key = headers['x-appwrite-key'];
  if (!key) throw new Error('This function must run inside Appwrite.');

  const client = new Client()
    .setEndpoint(appwriteEndpoint())
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(key);

  return { tables: new TablesDB(client), users: new Users(client), headers };
}

function timestamp(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function dateAfterDays(days) {
  const result = new Date();
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString();
}

function isActiveLicense(row, now = Date.now()) {
  if (String(row.status || '').toLowerCase() !== activeStatus) return false;
  const startsAt = row.activateAt ? timestamp(row.activateAt) : Number.NEGATIVE_INFINITY;
  const expiresAt = timestamp(row.expiresAt);
  return Number.isFinite(expiresAt) && startsAt <= now && expiresAt > now;
}

function productFor(config, productSlug, plan) {
  const found = Object.entries(config.prices).find(([, value]) => (
    value?.productSlug === productSlug && value?.plan === plan
  ));
  if (!found) return null;
  const [priceId, product] = found;
  return { priceId, ...product };
}

function productFromPrice(config, priceId) {
  const product = config.prices[priceId];
  return product ? { priceId, ...product } : null;
}

function sameDigest(left, right) {
  const leftBytes = Buffer.from(left, 'utf8');
  const rightBytes = Buffer.from(right, 'utf8');
  return leftBytes.length === rightBytes.length && crypto.timingSafeEqual(leftBytes, rightBytes);
}

function paddleSignatureStatus(rawBody, signature, webhookSecret, toleranceSeconds) {
  if (!signature) return { valid: false, reason: 'missing signature header' };
  const parts = signature.split(';').reduce((all, item) => {
    const [key, value] = item.trim().split('=', 2);
    if (key && value) (all[key] ||= []).push(value);
    return all;
  }, {});
  const timestampValue = parts.ts?.[0];
  const submitted = parts.h1 || [];
  if (!timestampValue || !submitted.length) return { valid: false, reason: 'malformed signature header' };
  const signedAtSeconds = Number(timestampValue);
  if (!Number.isFinite(signedAtSeconds)) return { valid: false, reason: 'invalid signature timestamp' };
  const allowedAge = Number.isFinite(toleranceSeconds) && toleranceSeconds > 0
    ? toleranceSeconds
    : defaultWebhookToleranceSeconds;
  if (Math.abs(Date.now() / 1000 - signedAtSeconds) > allowedAge) {
    return { valid: false, reason: 'signature timestamp outside tolerance' };
  }

  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(`${timestampValue}:${rawBody}`, 'utf8')
    .digest('hex');

  const valid = submitted.some((candidate) => sameDigest(candidate, expected));
  return { valid, reason: valid ? 'valid' : 'HMAC mismatch' };
}

function rawBodyOf(request) {
  // Appwrite's current Node runtime exposes the exact request bytes as
  // `bodyText`. Paddle signs those exact bytes, so a parsed object (or a
  // re-serialized equivalent) cannot be used for signature verification.
  if (typeof request.bodyText === 'string') return request.bodyText;
  if (typeof request.body === 'string') return request.body;
  if (Buffer.isBuffer(request.body)) return request.body.toString('utf8');
  return request.body && typeof request.body === 'object'
    ? JSON.stringify(request.body)
    : '';
}

function jsonBodyOf(request) {
  if (request.bodyJson && typeof request.bodyJson === 'object') return request.bodyJson;
  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) {
    return request.body;
  }
  return asJson(rawBodyOf(request));
}

function licenseRowIdForTransaction(transactionId) {
  if (!transactionId) throw new Error('Transaction ID is required for fulfillment.');
  const digest = crypto.createHash('sha256').update(transactionId, 'utf8').digest('hex');
  return `paddle_${digest.slice(0, 28)}`;
}

function configuredAdminLabels(config) {
  const configured = String(config.adminLabel || 'admin')
    .split(',')
    .map((label) => label.trim().toLowerCase())
    .filter(Boolean);

  // `admin` was the label assigned to the owner account before this function
  // was deployed. Keep it valid alongside any configured label.
  return new Set([...configured, 'admin']);
}

async function currentUser(request, users, headers, config) {
  const userId = headers['x-appwrite-user-id'];
  if (!userId) return null;
  const user = await users.get({ userId });
  const adminLabels = configuredAdminLabels(config);
  return {
    id: user.$id,
    verified: Boolean(user.emailVerification),
    isAdmin: Array.isArray(user.labels) && user.labels.some((label) => adminLabels.has(String(label).toLowerCase()))
  };
}

async function entitlement(request, res, config, tables, users, headers) {
  const body = jsonBodyOf(request);
  const productSlug = String(body?.productSlug || '').trim().toLowerCase();
  if (!productSlug) return response(res, 400, { ok: false, error: 'productSlug is required.' });

  const user = await currentUser(request, users, headers, config);
  if (!user) return response(res, 401, { ok: false, error: 'Sign in is required.' });
  if (!user.verified) return response(res, 403, { ok: false, error: 'Verify your email before using a license.' });
  if (user.isAdmin) {
    return response(res, 200, {
      ok: true,
      access: 'admin',
      productSlug,
      plan: 'admin',
      expiresAt: null
    });
  }

  const result = await tables.listRows({
    databaseId: config.databaseId,
    tableId: config.licensesTableId,
    queries: [
      Query.equal('userId', [user.id]),
      Query.equal('productSlug', [productSlug])
    ]
  });
  const license = (result.rows || [])
    .filter((row) => isActiveLicense(row))
    .sort((left, right) => timestamp(right.expiresAt) - timestamp(left.expiresAt))[0];

  if (!license) {
    return response(res, 403, {
      ok: false,
      access: 'none',
      productSlug,
      error: 'No active license was found for this product.'
    });
  }

  return response(res, 200, {
    ok: true,
    access: 'licensed',
    productSlug,
    productName: license.productName,
    plan: license.plan,
    expiresAt: license.expiresAt
  });
}

async function accountAccess(request, res, config, users, headers) {
  const user = await currentUser(request, users, headers, config);
  if (!user) return response(res, 401, { ok: false, error: 'Sign in is required.' });
  if (!user.verified) {
    return response(res, 403, { ok: false, error: 'Verify your email before using your account.' });
  }
  return response(res, 200, { ok: true, access: 'account' });
}

// A deliberately data-free operational check. It lets the owner verify that
// the deployed runtime can reach both Appwrite services before relying on
// licensing or checkout; no rows or user details are returned to the caller.
async function healthCheck(res, config, tables, users) {
  await tables.listRows({
    databaseId: config.databaseId,
    tableId: config.licensesTableId,
    queries: [Query.limit(1)]
  });
  await users.list({ queries: [Query.limit(1)] });
  return response(res, 200, { ok: true, service: 'biuret-licensing' });
}

async function checkoutIntent(request, res, config, tables, users, headers) {
  const body = jsonBodyOf(request);
  const productSlug = String(body?.productSlug || '').trim().toLowerCase();
  const plan = String(body?.plan || '').trim();
  const product = productFor(config, productSlug, plan);
  if (!product) return response(res, 400, { ok: false, error: 'Unknown product or plan.' });

  const user = await currentUser(request, users, headers, config);
  if (!user) return response(res, 401, { ok: false, error: 'Sign in is required.' });
  if (!user.verified) return response(res, 403, { ok: false, error: 'Verify your email before checkout.' });

  const intentId = ID.unique();
  await tables.createRow({
    databaseId: config.databaseId,
    tableId: config.intentsTableId,
    rowId: intentId,
    data: {
      userId: user.id,
      productSlug: product.productSlug,
      productName: product.productName,
      plan: product.plan,
      priceId: product.priceId,
      status: 'created',
      expiresAt: dateAfterDays(2),
      fulfillmentTransactionId: ''
    },
    permissions: []
  });

  return response(res, 200, {
    ok: true,
    intentId,
    priceId: product.priceId,
    customData: { biuret_intent_id: intentId }
  });
}

async function fulfillTransaction(event, config, tables, log) {
  if (event.event_type !== 'transaction.completed') {
    return { ignored: true, reason: 'event type is not transaction.completed' };
  }

  const transaction = event.data || {};
  const intentId = String(transaction.custom_data?.biuret_intent_id || '');
  if (!intentId) throw new Error('Transaction does not contain a Biuret checkout intent.');

  const intent = await tables.getRow({
    databaseId: config.databaseId,
    tableId: config.intentsTableId,
    rowId: intentId
  });
  if (intent.status === 'fulfilled') return { duplicate: true };
  if (timestamp(intent.expiresAt) <= Date.now()) throw new Error('Checkout intent has expired.');

  const transactionPriceIds = new Set(
    (transaction.items || []).map((item) => String(item.price?.id || item.price_id || ''))
  );
  if (!transactionPriceIds.has(intent.priceId)) {
    throw new Error('Transaction price does not match the checkout intent.');
  }

  const product = productFromPrice(config, intent.priceId);
  if (!product || product.productSlug !== intent.productSlug || product.plan !== intent.plan) {
    throw new Error('Checkout intent price is no longer valid.');
  }

  const now = new Date().toISOString();
  const expiresAt = transaction.billing_period?.ends_at || dateAfterDays(Number(product.durationDays || 31));
  const subscriptionId = String(transaction.subscription_id || '');
  const transactionId = String(transaction.id || '').trim();
  const licenseRowId = licenseRowIdForTransaction(transactionId);
  const rowData = {
    userId: intent.userId,
    productSlug: product.productSlug,
    productName: product.productName,
    plan: product.plan,
    status: activeStatus,
    activateAt: now,
    expiresAt,
    licenseKeyMasked: 'Managed through your Biuret account',
    downloadUrl: product.downloadUrl || '',
    providerSubscriptionId: subscriptionId,
    providerTransactionId: transactionId
  };

  let duplicate = false;
  try {
    await tables.createRow({
      databaseId: config.databaseId,
      tableId: config.licensesTableId,
      rowId: licenseRowId,
      data: rowData,
      permissions: [Permission.read(Role.user(intent.userId))]
    });
  } catch (createError) {
    if (Number(createError?.code) !== 409) throw createError;
    const existing = await tables.getRow({
      databaseId: config.databaseId,
      tableId: config.licensesTableId,
      rowId: licenseRowId
    });
    const sameFulfillment = existing.providerTransactionId === transactionId
      && existing.userId === intent.userId
      && existing.productSlug === product.productSlug;
    if (!sameFulfillment) throw new Error('Transaction ID conflicts with an existing license.');
    duplicate = true;
  }
  await tables.updateRow({
    databaseId: config.databaseId,
    tableId: config.intentsTableId,
    rowId: intent.$id,
    data: { status: 'fulfilled', fulfillmentTransactionId: String(transaction.id || '') }
  });
  log(`${duplicate ? 'Confirmed duplicate' : 'Fulfilled'} ${product.productSlug} for Appwrite user ${intent.userId}.`);
  return duplicate ? { duplicate: true } : { fulfilled: true };
}

async function paddleWebhook(request, res, config, tables, log) {
  const headers = headersOf(request);
  if (!config.paddleWebhookSecret) {
    return response(res, 503, { ok: false, error: 'Paddle webhook is not configured.' });
  }
  const rawBody = rawBodyOf(request);
  const signatureStatus = paddleSignatureStatus(
    rawBody,
    headers['paddle-signature'],
    config.paddleWebhookSecret,
    config.paddleWebhookToleranceSeconds
  );
  if (!signatureStatus.valid) {
    log(`Rejected Paddle webhook: ${signatureStatus.reason}; raw body length ${Buffer.byteLength(rawBody, 'utf8')}.`);
    return response(res, 401, { ok: false, error: 'Invalid Paddle signature.' });
  }
  const event = asJson(rawBody);
  if (!event) return response(res, 400, { ok: false, error: 'Webhook body is not valid JSON.' });
  const result = await fulfillTransaction(event, config, tables, log);
  return response(res, 200, { ok: true, ...result });
}

export default async ({ req, res, log, error }) => {
  try {
    const config = readConfig();
    const { tables, users, headers } = serverServices(req);
    if (headers['paddle-signature']) return paddleWebhook(req, res, config, tables, log);

    const payload = jsonBodyOf(req);
    if (!payload) return response(res, 400, { ok: false, error: 'Request body is not valid JSON.' });
    if (payload.action === 'health-check') return healthCheck(res, config, tables, users);
    if (payload.action === 'entitlement') return entitlement(req, res, config, tables, users, headers);
    if (payload.action === 'account-access') return accountAccess(req, res, config, users, headers);
    if (payload.action === 'checkout-intent') return checkoutIntent(req, res, config, tables, users, headers);
    return response(res, 404, { ok: false, error: 'Unknown licensing action.' });
  } catch (exception) {
    const cause = exception instanceof Error && exception.cause instanceof Error
      ? `; cause: ${exception.cause.message}`
      : '';
    error(`Licensing function error: ${exception instanceof Error ? exception.message : String(exception)}${cause}`);
    return response(res, 500, { ok: false, error: 'The licensing service could not complete this request.' });
  }
};
