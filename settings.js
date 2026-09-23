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
  const preferencesForm = document.querySelector('[data-preferences-form]');
  const sessionEmail = document.querySelector('[data-settings-session-email]');
  const memberSince = document.querySelector('[data-settings-member-since]');

  const redirectToAuth = () => window.location.replace('auth.html?redirect=settings.html');
  const setStatus = (message, kind = '') => {
    if (!status) return;
    status.textContent = message;
    status.dataset.state = kind;
  };
  const setBusy = (form, busy) => {
    form?.querySelectorAll('button, input').forEach((element) => { element.disabled = busy; });
  };
  const verificationError = (error) => {
    const rateLimited = Number(error?.code) === 429 || String(error?.type || '').includes('rate_limit');
    return rateLimited
      ? text('Too many verification emails were requested. Wait a few minutes, then try again.', 'تم طلب رسائل تحقق كثيرة. انتظر بضع دقائق ثم حاول مجددًا.')
      : text('We could not request a verification email right now. Please try again shortly.', 'تعذر طلب رسالة التحقق الآن. حاول بعد قليل.');
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

  const readPreference = (key) => {
    try { return localStorage.getItem(key) === 'true'; } catch { return false; }
  };
  const savePreference = (key, value) => {
    try { localStorage.setItem(key, String(Boolean(value))); } catch {}
  };
  const applyInterfacePreferences = ({ reducedMotion, highContrast, compactLayout }) => {
    document.documentElement.classList.toggle('reduce-motion', reducedMotion);
    document.documentElement.classList.toggle('high-contrast', highContrast);
    document.documentElement.classList.toggle('compact-layout', compactLayout);
  };
  if (preferencesForm) {
    preferencesForm.elements.namedItem('language').value = document.documentElement.lang === 'ar' ? 'ar' : 'en';
    preferencesForm.elements.namedItem('reduced-motion').checked = readPreference('biuret-reduced-motion');
    preferencesForm.elements.namedItem('high-contrast').checked = readPreference('biuret-high-contrast');
    preferencesForm.elements.namedItem('compact-layout').checked = readPreference('biuret-compact-layout');
    preferencesForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const language = String(preferencesForm.elements.namedItem('language').value || 'en');
      const reducedMotion = Boolean(preferencesForm.elements.namedItem('reduced-motion').checked);
      const highContrast = Boolean(preferencesForm.elements.namedItem('high-contrast').checked);
      const compactLayout = Boolean(preferencesForm.elements.namedItem('compact-layout').checked);
      savePreference('biuret-reduced-motion', reducedMotion);
      savePreference('biuret-high-contrast', highContrast);
      savePreference('biuret-compact-layout', compactLayout);
      applyInterfacePreferences({ reducedMotion, highContrast, compactLayout });
      if (language !== document.documentElement.lang) document.querySelector('[data-language-toggle]')?.click();
      setStatus(text('Your site preferences were saved on this device.', 'تم حفظ تفضيلات الموقع على هذا الجهاز.'), 'success');
    });
  }

  if (!service?.configured) {
    setStatus(text('Appwrite setup is required before account settings can load.', 'يلزم إعداد Appwrite قبل تحميل إعدادات الحساب.'), 'error');
    return;
  }

  let user;
  try { user = await service.getCurrentUser(); } catch { redirectToAuth(); return; }
  window.BiuretProfilePhoto.bindEditor(document.querySelector('[data-photo-editor]'), user, service);
  const nameInput = profileForm?.elements.namedItem('name');
  const currentEmailInput = emailForm?.elements.namedItem('current-email');
  const newEmailInput = emailForm?.elements.namedItem('email');
  if (nameInput) nameInput.value = user.name || '';
  if (currentEmailInput) currentEmailInput.value = user.email;
  if (newEmailInput) newEmailInput.value = user.email;
  if (sessionEmail) sessionEmail.textContent = user.email;
  if (memberSince) {
    const registration = user.registration ? new Date(user.registration) : null;
    memberSince.textContent = registration && !Number.isNaN(registration.getTime())
      ? new Intl.DateTimeFormat(isArabic() ? 'ar' : 'en', { month: 'long', year: 'numeric' }).format(registration)
      : text('Biuret member', 'عضو في بيوريت');
  }
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
      if (sessionEmail) sessionEmail.textContent = user.email;
      if (currentEmailInput) currentEmailInput.value = user.email;
      if (newEmailInput) newEmailInput.value = user.email;
      emailForm.reset();
      if (currentEmailInput) currentEmailInput.value = user.email;
      if (newEmailInput) newEmailInput.value = user.email;
      showVerification(user);
      try {
        await service.sendVerification();
        setStatus(text('Your email was updated. A verification email was requested; check your inbox and spam folder.', 'تم تحديث بريدك. تم طلب رسالة تحقق؛ افحص الوارد ومجلد الرسائل غير المرغوب فيها.'), 'success');
      } catch (error) {
        setStatus(`${text('Your email was updated. ', 'تم تحديث بريدك. ')}${verificationError(error)}`, 'notice');
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
      setStatus(text('A verification email was requested. Check your inbox and spam folder.', 'تم طلب رسالة تحقق. افحص الوارد ومجلد الرسائل غير المرغوب فيها.'), 'success');
    } catch (error) {
      setStatus(verificationError(error), 'error');
    } finally { resendVerification.disabled = false; }
  });
});
