document.addEventListener('DOMContentLoaded', async () => {
  const message = document.querySelector('[data-verification-message]');
  const service = window.BiuretAppwrite;
  const isArabic = () => document.documentElement.lang === 'ar';
  const text = (en, ar) => isArabic() ? ar : en;
  const setMessage = (value, state = '') => { if (message) { message.textContent = value; message.dataset.state = state; } };
  if (!service?.configured) { setMessage(text('Appwrite setup is required before email verification can run.', 'يلزم إعداد Appwrite قبل تشغيل توثيق البريد الإلكتروني.'), 'error'); return; }
  const params = new URLSearchParams(window.location.search);
  const userId = params.get('userId');
  const secret = params.get('secret');
  if (!userId || !secret) { setMessage(text('This verification link is incomplete or expired.', 'رابط التوثيق غير مكتمل أو منتهي الصلاحية.'), 'error'); return; }
  try {
    await service.completeVerification({ userId, secret });
    setMessage(text('Email verified. Your account is ready.', 'تم توثيق بريدك الإلكتروني. حسابك جاهز.'), 'success');
  } catch {
    setMessage(text('This verification link is invalid or expired.', 'رابط التوثيق غير صالح أو منتهي الصلاحية.'), 'error');
  }
});
