document.addEventListener('DOMContentLoaded', async () => {
  const service = window.BiuretAppwrite;
  const isArabic = () => document.documentElement.lang === 'ar';
  const text = (en, ar) => isArabic() ? ar : en;
  const status = document.querySelector('[data-account-status]');
  const name = document.querySelector('[data-account-name]');
  const email = document.querySelector('[data-account-email]');
  const verification = document.querySelector('[data-account-verification]');
  const licenses = document.querySelector('[data-account-licenses]');
  const signOut = document.querySelector('[data-sign-out]');

  const setStatus = (message, kind = '') => {
    if (!status) return;
    status.textContent = message;
    status.dataset.state = kind;
  };
  const redirectToAuth = () => {
    const redirect = encodeURIComponent('account.html');
    window.location.replace(`auth.html?redirect=${redirect}`);
  };
  const formatDate = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return text('Not specified', 'غير محدد');
    return new Intl.DateTimeFormat(isArabic() ? 'ar' : 'en', { dateStyle: 'medium' }).format(date);
  };
  const safeUrl = (value) => {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const parsed = new URL(value.trim());
      return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
    } catch { return ''; }
  };
  const renderEmpty = (message) => {
    if (!licenses) return;
    licenses.replaceChildren();
    const panel = document.createElement('p');
    panel.className = 'account-empty';
    panel.textContent = message;
    licenses.append(panel);
  };
  const renderLicenses = (rows) => {
    if (!licenses) return;
    licenses.replaceChildren();
    if (!rows.length) {
      renderEmpty(text('No active licenses are linked to this account yet.', 'لا توجد تراخيص مرتبطة بهذا الحساب حتى الآن.'));
      return;
    }
    rows.forEach((row) => {
      const card = document.createElement('article');
      card.className = 'account-license-card';
      const heading = document.createElement('div');
      heading.className = 'account-license-heading';
      const product = document.createElement('h3');
      product.textContent = row.productName || row.productSlug || text('Biuret product', 'منتج بيوريت');
      const pill = document.createElement('span');
      pill.className = `license-state ${String(row.status || 'active').toLowerCase()}`;
      pill.textContent = row.status || text('Active', 'نشط');
      heading.append(product, pill);
      const details = document.createElement('dl');
      details.className = 'account-license-details';
      const values = [
        [text('Plan', 'الخطة'), row.plan || text('Not specified', 'غير محدد')],
        [text('Expires', 'ينتهي'), formatDate(row.expiresAt)],
        [text('License key', 'مفتاح الترخيص'), row.licenseKeyMasked || text('Managed securely', 'يُدار بأمان')]
      ];
      values.forEach(([label, value]) => {
        const term = document.createElement('dt');
        term.textContent = label;
        const description = document.createElement('dd');
        description.textContent = value;
        details.append(term, description);
      });
      const actions = document.createElement('div');
      actions.className = 'account-license-actions';
      const downloadUrl = safeUrl(row.downloadUrl);
      if (downloadUrl && String(row.status || '').toLowerCase() === 'active') {
        const download = document.createElement('a');
        download.className = 'button-secondary';
        download.href = downloadUrl;
        download.textContent = text('Download ↗', 'تنزيل ↗');
        actions.append(download);
      }
      const support = document.createElement('a');
      support.className = 'license-support-link';
      support.href = `mailto:hello@biuret.dev?subject=${encodeURIComponent(`License support — ${row.productName || 'Biuret'}`)}`;
      support.textContent = text('Manage license', 'إدارة الترخيص');
      actions.append(support);
      card.append(heading, details, actions);
      licenses.append(card);
    });
  };

  if (!service?.configured) {
    if (name) name.textContent = text('Account setup pending', 'بانتظار إعداد الحساب');
    if (email) email.textContent = text('Connect Appwrite to activate secure account access.', 'اربط Appwrite لتفعيل وصول الحساب الآمن.');
    if (verification) verification.hidden = true;
    if (signOut) signOut.hidden = true;
    setStatus(text('Appwrite setup is still required before accounts can go live.', 'يلزم إكمال إعداد Appwrite قبل تفعيل الحسابات.'), 'notice');
    renderEmpty(text('Add the public Appwrite configuration to connect this page.', 'أضف إعدادات Appwrite العامة لربط هذه الصفحة.'));
    return;
  }

  let user;
  try { user = await service.getCurrentUser(); } catch { redirectToAuth(); return; }
  if (name) name.textContent = user.name || user.email.split('@')[0];
  if (email) email.textContent = user.email;
  if (verification) {
    verification.textContent = user.emailVerification
      ? text('Verified account', 'حساب موثّق')
      : text('Email verification pending', 'بانتظار توثيق البريد الإلكتروني');
    verification.classList.toggle('pending', !user.emailVerification);
  }
  setStatus(text('Your account is protected by an active session.', 'حسابك محمي بجلسة نشطة.'), 'success');
  signOut?.addEventListener('click', async () => {
    signOut.disabled = true;
    try { await service.signOut(); window.location.replace('auth.html'); }
    catch { setStatus(text('Could not sign out. Please try again.', 'تعذر تسجيل الخروج. حاول مرة أخرى.'), 'error'); signOut.disabled = false; }
  });
  if (!service.tableConfigured) {
    renderEmpty(text('Your license catalog will appear after the secure licenses table is connected.', 'ستظهر تراخيصك بعد ربط جدول التراخيص الآمن.'));
    return;
  }
  try {
    const result = await service.listLicenses();
    renderLicenses(result.rows || []);
  } catch {
    renderEmpty(text('We could not load licenses right now. Please try again later.', 'تعذر تحميل التراخيص الآن. حاول مرة أخرى لاحقًا.'));
  }
});
