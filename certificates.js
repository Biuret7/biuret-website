(() => {
  const viewer = document.querySelector('#certificate-viewer');
  if (!viewer || typeof viewer.showModal !== 'function') return;

  const viewerImage = viewer.querySelector('.certificate-viewer-image img');
  const viewerDetails = viewer.querySelector('.certificate-viewer-details');
  const viewerTitle = viewer.querySelector('#certificate-viewer-title');
  const originalLink = viewer.querySelector('.certificate-viewer-actions a');
  const closeButton = viewer.querySelector('.certificate-viewer-close');
  let trigger = null;
  let generation = 0;
  let previousOverflow = '';
  const ar = () => document.documentElement.lang === 'ar';
  const links = [...document.querySelectorAll('.certificate-media')];
  const visibleLinks = () => links.filter((link) => !link.closest('.certificate-card')?.hidden);
  const navigation = document.createElement('div');
  navigation.className = 'certificate-viewer-navigation';
  const previous = document.createElement('button');
  const next = document.createElement('button');
  const position = document.createElement('span');
  for (const button of [previous, next]) { button.type = 'button'; button.className = 'button-secondary'; }
  position.setAttribute('role', 'status');
  navigation.append(previous, position, next);
  closeButton.before(navigation);
  const loading = document.createElement('p');
  loading.className = 'certificate-viewer-loading';
  loading.setAttribute('role', 'status');
  viewerImage.parentElement.append(loading);

  function openCertificate(link, focus = true) {
      const card = link.closest('.certificate-card');
      if (!card) return;
      trigger = link;
      const source = link.querySelector('img');
      viewerTitle.textContent = card.querySelector('h3')?.textContent || '';
      viewerImage.src = source?.src || link.dataset.preview || link.href;
      viewerImage.alt = ar() ? `شهادة ${viewerTitle.textContent}` : source?.alt || '';
      viewerDetails.replaceChildren(card.querySelector('.certificate-body').cloneNode(true));
      originalLink.href = link.href;
      originalLink.textContent = ar() ? 'فتح الملف الأصلي ↗' : 'Open original file ↗';
      closeButton.setAttribute('aria-label', ar() ? 'إغلاق عرض الشهادة' : 'Close certificate preview');
      previous.textContent = ar() ? 'السابقة' : 'Previous';
      next.textContent = ar() ? 'التالية' : 'Next';
      const list = visibleLinks(), index = list.indexOf(link);
      position.textContent = `${index + 1} / ${list.length}`;
      position.setAttribute('aria-label', ar() ? `الشهادة ${index + 1} من ${list.length}` : `Certificate ${index + 1} of ${list.length}`);
      previous.disabled = index <= 0;
      next.disabled = index >= list.length - 1;
      loading.hidden = false;
      loading.textContent = ar() ? 'جارٍ تحميل العرض عالي الدقة…' : 'Loading high-resolution preview…';
      const token = ++generation;
      const fullImage = new Image();
      fullImage.onload = () => {
        if (token !== generation || !viewer.open) return;
        viewerImage.src = fullImage.src;
        loading.hidden = true;
      };
      fullImage.onerror = () => {
        if (token !== generation || !viewer.open) return;
        loading.textContent = ar() ? 'تعذّر تحميل العرض الكامل. يمكنك فتح الملف الأصلي أدناه.' : 'Full preview unavailable. Open the original file below.';
      };
      fullImage.src = link.dataset.preview || link.href;
      if (!viewer.open) {
        previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        viewer.showModal();
      }
      viewer.scrollTop = 0;
      if (focus) closeButton.focus();
  }
  links.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      openCertificate(link);
    });
  });
  function move(offset) {
    const list = visibleLinks();
    const link = list[list.indexOf(trigger) + offset];
    if (link) openCertificate(link, false);
  }
  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  viewer.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      move((event.key === 'ArrowRight' ? 1 : -1) * (ar() ? -1 : 1));
    }
  });

  closeButton.addEventListener('click', () => viewer.close());
  viewer.addEventListener('click', (event) => { if (event.target === viewer) viewer.close(); });
  viewer.addEventListener('close', () => {
    generation += 1;
    document.body.style.overflow = previousOverflow;
    viewerImage.removeAttribute('src');
    loading.hidden = true;
    trigger?.focus();
  });
})();
