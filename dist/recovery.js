document.addEventListener('DOMContentLoaded', () => {
  const service = window.BiuretAppwrite;
  const isArabic = () => document.documentElement.lang === 'ar';
  const text = (en, ar) => isArabic() ? ar : en;
  const requestForm = document.querySelector('[data-recovery-request-form]');
  const requestSubmit = document.querySelector('[data-recovery-request-submit]');
  const requestNotice = document.querySelector('[data-recovery-request-notice]');
  const resetForm = document.querySelector('[data-recovery-reset-form]');
  const resetSubmit = document.querySelector('[data-recovery-reset-submit]');
  const resetNotice = document.querySelector('[data-recovery-reset-notice]');
  const successMessage = text('If that email belongs to an account, a recovery link is on its way. Check your inbox and spam folder.', 'إذا كان هذا البريد مرتبطًا بحساب، فسيصلك رابط استعادة. تحقق من البريد الوارد ومجلد الرسائل غير المرغوب فيها.');

  requestForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = String(requestForm.elements.namedItem('email')?.value || '').trim();
    if (!email) return;
    if (!service?.configured) {
      if (requestNotice) requestNotice.textContent = text('Account recovery is not configured yet.', 'استعادة الحساب غير معدّة بعد.');
      return;
    }
    if (requestSubmit) requestSubmit.disabled = true;
    if (requestNotice) requestNotice.textContent = text('Sending a secure recovery request…', 'جارٍ إرسال طلب استعادة آمن…');
    try { await service.requestPasswordRecovery({ email }); } catch {}
    if (requestNotice) requestNotice.textContent = successMessage;
    if (requestSubmit) requestSubmit.disabled = false;
  });

  if (!resetForm) return;
  const parameters = new URLSearchParams(window.location.search);
  const userId = parameters.get('userId') || '';
  const secret = parameters.get('secret') || '';
  if (!userId || !secret) {
    if (resetNotice) resetNotice.textContent = text('This recovery link is invalid or incomplete. Request a new one.', 'رابط الاستعادة غير صالح أو غير مكتمل. اطلب رابطًا جديدًا.');
    if (resetSubmit) resetSubmit.disabled = true;
    return;
  }
  resetForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = String(resetForm.elements.namedItem('password')?.value || '');
    const confirmation = String(resetForm.elements.namedItem('password-confirm')?.value || '');
    if (password.length < 8) {
      if (resetNotice) resetNotice.textContent = text('Use at least 8 characters for your new password.', 'استخدم 8 أحرف على الأقل لكلمة المرور الجديدة.');
      return;
    }
    if (password !== confirmation) {
      if (resetNotice) resetNotice.textContent = text('The password confirmation does not match.', 'تأكيد كلمة المرور غير متطابق.');
      return;
    }
    if (!service?.configured) {
      if (resetNotice) resetNotice.textContent = text('Account recovery is not configured yet.', 'استعادة الحساب غير معدّة بعد.');
      return;
    }
    if (resetSubmit) resetSubmit.disabled = true;
    if (resetNotice) resetNotice.textContent = text('Updating your password securely…', 'جارٍ تحديث كلمة المرور بأمان…');
    try {
      await service.completePasswordRecovery({ userId, secret, password });
      resetForm.reset();
      if (resetNotice) resetNotice.textContent = text('Your password has been updated. You can now sign in.', 'تم تحديث كلمة المرور. يمكنك تسجيل الدخول الآن.');
      if (resetSubmit) resetSubmit.hidden = true;
    } catch {
      if (resetNotice) resetNotice.textContent = text('This recovery link is invalid or expired. Request a new one.', 'رابط الاستعادة غير صالح أو منتهي. اطلب رابطًا جديدًا.');
      if (resetSubmit) resetSubmit.disabled = false;
    }
  });
});
