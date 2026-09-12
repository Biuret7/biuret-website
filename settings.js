document.addEventListener('DOMContentLoaded', async () => {
  const service = window.BiuretAppwrite;
  const isArabic = () => document.documentElement.lang === 'ar';
  const text = (en, ar) => isArabic() ? ar : en;
  const status = document.querySelector('[data-settings-status]');
  const profileForm = document.querySelector('[data-profile-form]');
  const emailForm = document.querySelector('[data-email-form]');
  const passwordForm = document.querySelector('[data-password-form]');
  const verification = document.querySelector('[data-settings-verification]');
  const verificationCopy = document.querySelector('[data-verification-copy]');
  const resendVerification = document.querySelector('[data-resend-verification]');

  const redirectToAuth = () => window.location.replace('auth.html?redirect=settings.html');
  const setStatus = (message, kind = '') => {
    if (!status) return;
    status.textContent = message;
    status.dataset.state = kind;
  };
  const setBusy = (form, busy) => {
    form?.querySelectorAll('button, input').forEach((element) => { element.disabled = busy; });
  };
  const showVerification = (user) => {
    if (!verification) return;
    const verified = Boolean(user.emailVerification);
    verification.className = `settings-verification-state${verified ? ' is-verified' : ' is-pending'}`;
    verification.textContent = verified
      ? text('Verified email', 'بريد موثّق')
      : text('Verification pending', 'بانتظار التحقق');
    if (verificationCopy) verificationCopy.textContent = verified
      ? text('Your email is verified and ready for account communication.', 'بريدك الإلكتروني موثّق وجاهز لتواصل الحساب.')
      : text('Your email still needs verification before important account communication.', 'لا يزال بريدك الإلكتروني بحاجة إلى تحقق قبل تواصل الحساب المهم.');
    if (resendVerification) resendVerification.hidden = verified;
  };

  if (!service?.configured) {
    setStatus(text('Appwrite setup is required before account settings can load.', 'يلزم إعداد Appwrite قبل تحميل إعدادات الحساب.'), 'error');
    return;
  }

  let user;
  try { user = await service.getCurrentUser(); } catch { redirectToAuth(); return; }
  const nameInput = profileForm?.elements.namedItem('name');
  const currentEmailInput = emailForm?.elements.namedItem('current-email');
  const newEmailInput = emailForm?.elements.namedItem('email');
  if (nameInput) nameInput.value = user.name || '';
  if (currentEmailInput) currentEmailInput.value = user.email;
  if (newEmailInput) newEmailInput.value = user.email;
  showVerification(user);
  setStatus(text('Account settings are protected by your active session.', 'إعدادات الحساب محمية بجلسة نشطة.'), 'success');

  profileForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = String(profileForm.elements.namedItem('name')?.value || '').trim();
    if (name.length < 2 || name.length > 128) {
      setStatus(text('Enter a display name between 2 and 128 characters.', 'أدخل اسم عرض بين حرفين و128 حرفًا.'), 'error');
      return;
    }
    setBusy(profileForm, true);
    try {
      user = await service.updateName({ name });
      setStatus(text('Your display name has been updated.', 'تم تحديث اسم العرض الخاص بك.'), 'success');
    } catch {
      setStatus(text('We could not update your display name. Please try again.', 'تعذر تحديث اسم العرض. حاول مرة أخرى.'), 'error');
    } finally { setBusy(profileForm, false); }
  });

  emailForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = String(emailForm.elements.namedItem('email')?.value || '').trim();
    const password = String(emailForm.elements.namedItem('password')?.value || '');
    if (email.toLowerCase() === user.email.toLowerCase()) {
      setStatus(text('Enter a different email address to update it.', 'أدخل بريدًا إلكترونيًا مختلفًا لتحديثه.'), 'error');
      return;
    }
    setBusy(emailForm, true);
    try {
      user = await service.updateEmail({ email, password });
      if (currentEmailInput) currentEmailInput.value = user.email;
      if (newEmailInput) newEmailInput.value = user.email;
      emailForm.reset();
      if (currentEmailInput) currentEmailInput.value = user.email;
      if (newEmailInput) newEmailInput.value = user.email;
      showVerification(user);
      try {
        await service.sendVerification();
        setStatus(text('Your email was updated. A verification email is on its way.', 'تم تحديث بريدك. رسالة التحقق في طريقها إليك.'), 'success');
      } catch {
        setStatus(text('Your email was updated. Use the verification button to try sending a new message.', 'تم تحديث بريدك. استخدم زر التحقق لمحاولة إرسال رسالة جديدة.'), 'notice');
      }
    } catch {
      setStatus(text('We could not update your email. Check your current password and try again.', 'تعذر تحديث بريدك. تحقق من كلمة المرور الحالية وحاول مرة أخرى.'), 'error');
    } finally { setBusy(emailForm, false); }
  });

  passwordForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const oldPassword = String(passwordForm.elements.namedItem('current-password')?.value || '');
    const password = String(passwordForm.elements.namedItem('new-password')?.value || '');
    const confirmation = String(passwordForm.elements.namedItem('confirm-password')?.value || '');
    if (password.length < 8) {
      setStatus(text('Your new password must contain at least 8 characters.', 'يجب أن تتكون كلمة المرور الجديدة من 8 أحرف على الأقل.'), 'error');
      return;
    }
    if (password !== confirmation) {
      setStatus(text('The new password confirmation does not match.', 'تأكيد كلمة المرور الجديدة غير متطابق.'), 'error');
      return;
    }
    setBusy(passwordForm, true);
    try {
      await service.updatePassword({ password, oldPassword });
      passwordForm.reset();
      setStatus(text('Your password has been updated securely.', 'تم تحديث كلمة المرور بأمان.'), 'success');
    } catch {
      setStatus(text('We could not update your password. Check your current password and try again.', 'تعذر تحديث كلمة المرور. تحقق من كلمة المرور الحالية وحاول مرة أخرى.'), 'error');
    } finally { setBusy(passwordForm, false); }
  });

  resendVerification?.addEventListener('click', async () => {
    resendVerification.disabled = true;
    try {
      await service.sendVerification();
      setStatus(text('A new verification email has been sent.', 'تم إرسال رسالة تحقق جديدة.'), 'success');
    } catch {
      setStatus(text('We could not send a verification email right now. Please try again shortly.', 'تعذر إرسال رسالة التحقق الآن. حاول بعد قليل.'), 'error');
    } finally { resendVerification.disabled = false; }
  });
});
