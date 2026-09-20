document.addEventListener('DOMContentLoaded', async () => {
  const service = window.BiuretAppwrite;
  const isArabic = () => document.documentElement.lang === 'ar';
  const text = (en, ar) => isArabic() ? ar : en;
  const status = document.querySelector('[data-account-status]');
  const name = document.querySelector('[data-account-name]');
  const email = document.querySelector('[data-account-email]');
  const verification = document.querySelector('[data-account-verification]');
  const signOut = document.querySelector('[data-sign-out]');

  const setStatus = (message, kind = '') => {
    if (!status) return;
    status.textContent = message;
    status.dataset.state = kind;
  };
  const redirectToAuth = () => window.location.replace(`auth.html?redirect=${encodeURIComponent('account.html')}`);

  if (!service?.configured) {
    if (name) name.textContent = text('Account setup pending', 'بانتظار إعداد الحساب');
    if (email) email.textContent = text('Connect Appwrite to activate secure account access.', 'اربط Appwrite لتفعيل وصول الحساب الآمن.');
    if (verification) verification.hidden = true;
    if (signOut) signOut.hidden = true;
    setStatus(text('Appwrite setup is still required before accounts can go live.', 'يلزم إكمال إعداد Appwrite قبل تفعيل الحسابات.'), 'notice');
    return;
  }

  let user;
  try { user = await service.getCurrentUser(); } catch { redirectToAuth(); return; }
  if (name) name.textContent = user.name || user.email.split('@')[0];
  if (email) email.textContent = user.email;
  if (verification) {
    verification.textContent = user.emailVerification ? text('Verified account', 'حساب موثّق') : text('Email verification pending', 'بانتظار توثيق البريد الإلكتروني');
    verification.classList.toggle('pending', !user.emailVerification);
  }
  setStatus(text('Your profile is protected by an active session.', 'ملفك الشخصي محمي بجلسة نشطة.'), 'success');
  signOut?.addEventListener('click', async () => {
    signOut.disabled = true;
    try { await service.signOut(); window.location.replace('auth.html'); }
    catch { setStatus(text('Could not sign out. Please try again.', 'تعذر تسجيل الخروج. حاول مرة أخرى.'), 'error'); signOut.disabled = false; }
  });
});
