document.addEventListener('DOMContentLoaded', () => {
  const message = document.querySelector('[data-verification-message]');
  const confirmButton = document.querySelector('[data-confirm-verification]');
  const service = window.BiuretAppwrite;
  const isArabic = () => document.documentElement.lang === 'ar';
  const text = (en, ar) => isArabic() ? ar : en;
  const setMessage = (value, state = '') => { if (message) { message.textContent = value; message.dataset.state = state; } };
  const setConfirmVisible = (visible) => {
    if (!confirmButton) return;
    confirmButton.hidden = !visible;
    confirmButton.textContent = text('Confirm email', 'تأكيد البريد الإلكتروني');
  };
  if (!service?.configured) { setMessage(text('Appwrite setup is required before email verification can run.', 'يلزم إعداد Appwrite قبل تشغيل توثيق البريد الإلكتروني.'), 'error'); return; }
  const params = new URLSearchParams(window.location.search);
  const userId = params.get('userId');
  const secret = params.get('secret');
  if (!userId || !secret) { setMessage(text('This verification link is incomplete or expired.', 'رابط التوثيق غير مكتمل أو منتهي الصلاحية.'), 'error'); return; }
  setMessage(text('Confirm that you opened this email yourself to verify your address.', 'أكّد أنك فتحت هذا البريد بنفسك لتوثيق عنوانك.'), '');
  setConfirmVisible(true);

  confirmButton?.addEventListener('click', async () => {
    confirmButton.disabled = true;
    setMessage(text('Verifying your email securely…', 'جارٍ توثيق بريدك الإلكتروني بأمان…'), '');
    try {
      await service.completeVerification({ userId, secret });
      setConfirmVisible(false);
      setMessage(text('Email verified. Your account is ready.', 'تم توثيق بريدك الإلكتروني. حسابك جاهز.'), 'success');
    } catch {
      setConfirmVisible(false);
      setMessage(text('This verification link is invalid or expired. Request a new email from account settings.', 'رابط التوثيق غير صالح أو منتهي الصلاحية. اطلب رسالة جديدة من إعدادات الحساب.'), 'error');
    } finally {
      confirmButton.disabled = false;
    }
  });
});
