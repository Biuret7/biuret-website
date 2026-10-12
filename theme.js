(function () {
  'use strict';
  const key = 'biuret-color-theme-v1', root = document.documentElement;
  const valid = value => value === 'light' || value === 'dark';
  let theme = 'dark', timer;
  try { const saved = localStorage.getItem(key); if (valid(saved)) theme = saved; } catch {}
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  let button;
  function label() {
    if (!button) return;
    const ar = root.lang === 'ar', light = theme === 'light';
    button.querySelector('.theme-label').textContent = ar ? (light ? 'داكن' : 'فاتح') : (light ? 'Dark' : 'Light');
    const title = ar ? (light ? 'التبديل إلى الوضع الداكن' : 'التبديل إلى الوضع الفاتح') : (light ? 'Switch to dark mode' : 'Switch to light mode');
    button.title = title; button.setAttribute('aria-label', title); button.setAttribute('aria-pressed', String(light));
    button.dataset.mode = theme;
  }
  function apply(next, animate = false) {
    if (!valid(next)) return;
    if (animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.classList.add('theme-changing'); clearTimeout(timer);
      timer = setTimeout(() => root.classList.remove('theme-changing'), 360);
    }
    theme = next; root.dataset.theme = theme; root.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f6f8f4' : '#090c10');
    label();
    for (const frame of document.querySelectorAll('iframe')) {
      try { if (new URL(frame.src, location.href).origin === location.origin) frame.contentWindow?.postMessage({channel:'biuret-theme', theme}, location.origin); } catch {}
    }
  }
  function mount() {
    if (document.querySelector('[data-theme-toggle]')) return;
    button = document.createElement('button'); button.type = 'button'; button.className = 'theme-toggle'; button.dataset.themeToggle = '';
    button.innerHTML = '<span class="theme-glyph" aria-hidden="true"><svg class="theme-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4L19 5"/></svg><svg class="theme-moon" viewBox="0 0 24 24"><path d="M20.6 14.5A9 9 0 0 1 9.5 3.4a9 9 0 1 0 11.1 11.1Z"/></svg></span><span class="theme-label"></span>';
    const host = document.querySelector('.nav-actions, .top nav');
    if (host) host.prepend(button);
    else { button.classList.add('theme-floating'); (document.querySelector('header') || document.body).append(button); }
    button.addEventListener('click', () => {
      const next = theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(key, next); } catch {}
      apply(next, true);
    });
    new MutationObserver(label).observe(root, {attributes:true, attributeFilter:['lang']});
    apply(theme);
  }
  document.addEventListener('load', event => {
    const frame = event.target;
    if (frame?.tagName === 'IFRAME') {
      try { if (new URL(frame.src, location.href).origin === location.origin) frame.contentWindow?.postMessage({channel:'biuret-theme', theme}, location.origin); } catch {}
    }
  }, true);
  window.addEventListener('storage', event => { if (event.key === key) apply(valid(event.newValue) ? event.newValue : 'dark'); });
  window.addEventListener('message', event => {
    if (window.parent !== window && event.source === window.parent && event.origin === location.origin && event.data?.channel === 'biuret-theme') apply(event.data.theme);
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true}); else mount();
})();
