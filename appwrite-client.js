(function () {
  const config = window.BIURET_APPWRITE_CONFIG || {};
  const configured = Boolean(config.endpoint && config.projectId && window.Appwrite);
  const tableConfigured = Boolean(configured && config.databaseId && config.licensesTableId);
  let client;
  let account;
  let tablesDB;
  let functions;

  if (configured) {
    client = new window.Appwrite.Client()
      .setEndpoint(config.endpoint)
      .setProject(config.projectId);
    account = new window.Appwrite.Account(client);
    tablesDB = new window.Appwrite.TablesDB(client);
    functions = new window.Appwrite.Functions(client);
  }

  const requireConfigured = () => {
    if (!configured) throw new Error('Appwrite is not configured yet. Add the public endpoint and project ID in appwrite-config.js.');
  };
  const verificationUrl = () => new URL('verify.html', window.location.href).href;
  const recoveryUrl = () => new URL('reset-password.html', window.location.href).href;

  window.BiuretAppwrite = {
    configured,
    tableConfigured,
    async signUp({ email, password }) {
      requireConfigured();
      await account.create({ userId: window.Appwrite.ID.unique(), email, password });
      await account.createEmailPasswordSession({ email, password });
      try { await account.createVerification({ url: verificationUrl() }); } catch (error) { console.warn('Verification email could not be sent.', error); }
      return account.get();
    },
    async signIn({ email, password }) {
      requireConfigured();
      await account.createEmailPasswordSession({ email, password });
      return account.get();
    },
    signInWithProvider({ provider, success, failure }) {
      requireConfigured();
      if (!['google', 'github'].includes(provider)) throw new Error('Unsupported sign-in provider.');
      return account.createOAuth2Session({ provider, success, failure });
    },
    async getCurrentUser() {
      requireConfigured();
      return account.get();
    },
    async updateName({ name }) {
      requireConfigured();
      return account.updateName({ name });
    },
    async updateProfilePhoto({ dataUrl }) {
      requireConfigured();
      if (dataUrl !== null && (typeof dataUrl !== 'string' || dataUrl.length > 24000 || !/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+={0,2}$/.test(dataUrl))) {
        throw new Error('Invalid profile photo.');
      }
      // Fetch fresh preferences so changing the photo preserves other settings.
      // Preferences are user-editable and must never determine authorization.
      const current = await account.get();
      const prefs = { ...current.prefs };
      if (dataUrl === null) delete prefs.biuretProfilePhoto;
      else prefs.biuretProfilePhoto = dataUrl;
      if (new TextEncoder().encode(JSON.stringify(prefs)).length > 64000) {
        throw new Error('Account preferences are full.');
      }
      await account.updatePrefs({ prefs });
      return { ...current, prefs };
    },
    async updateEmail({ email, password }) {
      requireConfigured();
      return account.updateEmail({ email, password });
    },
    async updatePassword({ password, oldPassword }) {
      requireConfigured();
      return account.updatePassword({ password, oldPassword });
    },
    async sendVerification() {
      requireConfigured();
      return account.createVerification({ url: verificationUrl() });
    },
    async requestPasswordRecovery({ email }) {
      requireConfigured();
      return account.createRecovery({ email, url: recoveryUrl() });
    },
    async completePasswordRecovery({ userId, secret, password }) {
      requireConfigured();
      return account.updateRecovery({ userId, secret, password });
    },
    async signOut() {
      requireConfigured();
      return account.deleteSession({ sessionId: 'current' });
    },
    async completeVerification({ userId, secret }) {
      requireConfigured();
      return account.updateVerification({ userId, secret });
    },
    async listLicenses() {
      if (!tableConfigured) throw new Error('The licenses database table is not configured yet.');
      return tablesDB.listRows({
        databaseId: config.databaseId,
        tableId: config.licensesTableId,
        queries: [window.Appwrite.Query.orderDesc('expiresAt')]
      });
    },
    async createCheckoutIntent({ productSlug, plan }) {
      requireConfigured();
      if (!config.licensingFunctionId) {
        throw new Error('The secure licensing function is not configured yet.');
      }
      const execution = await functions.createExecution({
        functionId: config.licensingFunctionId,
        body: JSON.stringify({ action: 'checkout-intent', productSlug, plan }),
        async: false,
        path: '/',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      let result;
      try { result = JSON.parse(execution.responseBody || '{}'); } catch { throw new Error('The licensing service returned an invalid response.'); }
      if (!result?.ok || !result?.priceId || !result?.intentId) {
        throw new Error(result?.error || 'The licensing service could not prepare this checkout.');
      }
      return result;
    }
  };
}());
