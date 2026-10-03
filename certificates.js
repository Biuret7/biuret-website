(() => {
  const viewer = document.querySelector('#certificate-viewer');
  if (!viewer || typeof viewer.showModal !== 'function') return;

  const viewerImage = viewer.querySelector('.certificate-viewer-image img');
  const viewerDetails = viewer.querySelector('.certificate-viewer-details');
  const viewerTitle = viewer.querySelector('#certificate-viewer-title');
  const originalLink = viewer.querySelector('.certificate-viewer-actions a');
  const closeButton = viewer.querySelector('.certificate-viewer-close');
  let trigger = null;

  document.querySelectorAll('.certificate-media').forEach((link) => {
    link.addEventListener('click', (event) => {
      const card = link.closest('.certificate-card');
      if (!card) return;
      event.preventDefault();
      trigger = link;
      const source = link.querySelector('img');
      viewerImage.src = link.dataset.preview || link.href;
      viewerImage.alt = source?.alt || '';
      viewerTitle.textContent = card.querySelector('h3')?.textContent || '';
      viewerDetails.replaceChildren(card.querySelector('.certificate-body').cloneNode(true));
      originalLink.href = link.href;
      originalLink.textContent = document.documentElement.lang === 'ar' ? 'فتح الملف الأصلي ↗' : 'Open original file ↗';
      viewer.showModal();
      closeButton.focus();
    });
  });

  closeButton.addEventListener('click', () => viewer.close());
  viewer.addEventListener('click', (event) => { if (event.target === viewer) viewer.close(); });
  viewer.addEventListener('close', () => {
    viewerImage.removeAttribute('src');
    trigger?.focus();
  });
})();
