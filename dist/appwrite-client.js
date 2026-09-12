(function () {
  const config = window.BIURET_APPWRITE_CONFIG || {};
  const configured = Boolean(config.endpoint && config.projectId && window.Appwrite);
  const tableConfigured = Boolean(configured && config.databaseId && config.licensesTableId);
  let client;
  let account;
  let tablesDB;

  if (configured) {
    client = new window.Appwrite.Client()
      .setEndpoint(config.endpoint)
      .setProject(config.projectId);
    account = new window.Appwrite.Account(client);
    tablesDB = new window.Appwrite.TablesDB(client);
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
    async getCurrentUser() {
      requireConfigured();
      return account.get();
    },
    async updateName({ name }) {
      requireConfigured();
      return account.updateName({ name });
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
    }
  };
}());
