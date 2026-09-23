(function () {
  const key = 'biuretProfilePhoto';
  const text = (en, ar) => document.documentElement.lang === 'ar' ? ar : en;
  const valid = (value) => typeof value === 'string' && value.length <= 24000 && /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+={0,2}$/.test(value);
  function render(element, user, preview) {
    if (!element) return;
    const fallback = (user.name || user.email || 'B').trim().charAt(0).toUpperCase();
    element.textContent = fallback;
    const source = preview === undefined ? user.prefs?.[key] : preview;
    if (!valid(source)) return;
    const image = document.createElement('img');
    image.alt = '';
    image.width = 192;
    image.height = 192;
    image.addEventListener('error', () => { element.textContent = fallback; }, { once: true });
    image.src = source;
    element.replaceChildren(image);
  }
  async function prepare(file) {
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('format');
    if (!file.size || file.size > 5 * 1024 * 1024) throw new Error('size');
    const url = URL.createObjectURL(file);
    const image = new Image();
    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('decode'));
        image.src = url;
      });
      if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40000000) throw new Error('dimensions');
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 192;
      const context = canvas.getContext('2d');
      context.fillStyle = '#11151b';
      context.fillRect(0, 0, 192, 192);
      const side = Math.min(image.naturalWidth, image.naturalHeight);
      context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 192, 192);
      // Re-encoding strips original metadata and disallows executable SVG content.
      for (const quality of [0.85, 0.7, 0.5, 0.3]) {
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        if (valid(dataUrl)) return dataUrl;
      }
      throw new Error('size');
    } finally { URL.revokeObjectURL(url); }
  }
  function renderLink(link, user, label) {
    link.textContent = '';
    link.classList.toggle('has-profile-avatar', Boolean(user));
    if (user) {
      const avatar = document.createElement('span');
      avatar.className = 'nav-profile-avatar';
      avatar.setAttribute('aria-hidden', 'true');
      avatar.setAttribute('translate', 'no');
      render(avatar, user);
      link.append(avatar);
    }
    const copy = document.createElement('span');
    copy.textContent = label;
    link.append(copy);
  }
  function bindEditor(root, initialUser, service) {
    if (!root) return;
    let user = initialUser;
    let pending;
    let busy = false;
    const file = root.querySelector('[data-photo-file]');
    const preview = root.querySelector('[data-photo-preview]');
    const status = root.querySelector('[data-photo-status]');
    const save = root.querySelector('[data-photo-save]');
    const cancel = root.querySelector('[data-photo-cancel]');
    const remove = root.querySelector('[data-photo-remove]');
    const message = (en, ar, state = '') => { status.textContent = text(en, ar); status.dataset.state = state; };
    const sync = () => {
      root.setAttribute('aria-busy', String(busy));
      file.disabled = busy;
      save.disabled = busy || pending === undefined;
      cancel.disabled = busy || pending === undefined;
      remove.disabled = busy || !valid(user.prefs?.[key]);
      render(preview, user, pending);
    };
    file.addEventListener('change', async () => {
      const selected = file.files?.[0];
      if (!selected) return;
      busy = true;
      sync();
      try {
        pending = await prepare(selected);
        message('Preview ready. Save to update your profile.', 'المعاينة جاهزة. احفظ لتحديث صورة ملفك.');
      } catch {
        message('Choose a valid JPG, PNG or WebP up to 5 MB and 40 megapixels.', 'اختر صورة JPG أو PNG أو WebP صالحة بحجم لا يتجاوز 5 ميغابايت و40 ميغابكسل.', 'error');
      } finally { file.value = ''; busy = false; sync(); }
    });
    cancel.addEventListener('click', () => { pending = undefined; status.textContent = ''; sync(); });
    const persist = async (dataUrl) => {
      if (busy) return;
      busy = true;
      sync();
      message('Saving your profile photo…', 'جارٍ حفظ صورة ملفك…');
      try {
        user = await service.updateProfilePhoto({ dataUrl });
        window.dispatchEvent(new CustomEvent('biuret:profile-updated', { detail: user }));
        pending = undefined;
        message(dataUrl === null ? 'Profile photo removed.' : 'Profile photo saved.', dataUrl === null ? 'تمت إزالة صورة الملف الشخصي.' : 'تم حفظ صورة الملف الشخصي.', 'success');
      } catch {
        message('Could not save. Your saved photo is unchanged. Check your connection and try again.', 'تعذر الحفظ. صورتك المحفوظة لم تتغير. تحقق من الاتصال وحاول مجددًا.', 'error');
      } finally { busy = false; sync(); }
    };
    save.addEventListener('click', () => { if (pending !== undefined) persist(pending); });
    remove.addEventListener('click', () => persist(null));
    sync();
  }
  window.BiuretProfilePhoto = { render, renderLink, prepare, bindEditor };
}());
