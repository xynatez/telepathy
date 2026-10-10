(() => {
  'use strict';

  const byId = (id) => document.getElementById(id);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let motionObserver = null;
  const pendingMotion = new Set();
  let motionFrame = 0;
  function revealMotion(target) {
    target.classList.add('is-revealed');
    motionObserver?.unobserve(target);
    pendingMotion.delete(target);
  }
  function motionTargets(scope) {
    return [...(scope.matches?.('[data-motion]') ? [scope] : []), ...scope.querySelectorAll('[data-motion]')];
  }
  function registerMotion(scope = document) {
    motionTargets(scope).forEach((target) => {
      if (!motionObserver || reducedMotion.matches) {
        target.classList.remove('motion-ready');
        revealMotion(target);
      } else if (!target.classList.contains('is-revealed')) {
        target.classList.add('motion-ready');
        pendingMotion.add(target);
        motionObserver.observe(target);
      }
    });
    scheduleMotionScan();
  }
  function scanMotionBounds() {
    motionFrame = 0;
    const viewportBottom = window.innerHeight * 0.92;
    pendingMotion.forEach((target) => {
      if (target.isConnected === false) {
        motionObserver?.unobserve(target);
        pendingMotion.delete(target);
        return;
      }
      const rect = target.getBoundingClientRect();
      const width = rect.width || rect.right - rect.left;
      const height = rect.height || rect.bottom - rect.top;
      if (width <= 0 || height <= 0) return;
      const visibleWidth = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
      const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportBottom) - Math.max(rect.top, 0));
      const threshold = height > window.innerHeight * 0.8 ? 0.08 : 0.15;
      if ((visibleWidth * visibleHeight) / (width * height) >= threshold) revealMotion(target);
    });
  }
  function scheduleMotionScan() {
    if (!motionFrame && pendingMotion.size) motionFrame = window.requestAnimationFrame(scanMotionBounds);
  }
  function revealViewport() {
    pendingMotion.forEach((target) => {
      const rect = target.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth) revealMotion(target);
    });
  }
  function prepareMotion() {
    motionObserver?.disconnect();
    motionObserver = null;
    if ('IntersectionObserver' in window && !reducedMotion.matches) {
      motionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const threshold = entry.boundingClientRect.height > window.innerHeight * 0.8 ? 0.08 : 0.15;
          if (entry.isIntersecting && entry.intersectionRatio >= threshold) revealMotion(entry.target);
        });
      }, { threshold: [0.08, 0.15], rootMargin: '0px 0px -8% 0px' });
    }
    registerMotion();
    window.requestAnimationFrame(revealViewport);
  }
  document.addEventListener('focusin', (event) => {
    let target = event.target.closest('[data-motion]');
    while (target) {
      revealMotion(target);
      target = target.parentElement?.closest('[data-motion]');
    }
  });
  window.addEventListener('hashchange', () => window.requestAnimationFrame(revealViewport));
  window.addEventListener('pageshow', () => window.requestAnimationFrame(revealViewport));
  window.addEventListener('scroll', scheduleMotionScan, { passive: true });
  window.addEventListener('resize', scheduleMotionScan, { passive: true });
  reducedMotion.addEventListener('change', () => {
    motionObserver?.disconnect();
    motionObserver = null;
    motionTargets(document).forEach((target) => {
      target.classList.remove('motion-ready');
      revealMotion(target);
    });
    prepareMotion();
  });
  prepareMotion();
  const changes = new WeakMap();
  function animateChange(element) {
    if (!element) return;
    const previous = changes.get(element);
    if (previous) window.clearTimeout(previous);
    element.classList.remove('is-changing');
    if (reducedMotion.matches) return;
    void element.offsetWidth;
    element.classList.add('is-changing');
    changes.set(element, window.setTimeout(() => {
      element.classList.remove('is-changing');
      changes.delete(element);
    }, 500));
  }

  const projects = [
    ['dtf', 'img/DTF/IMG_7135.webp', 'Kaos DTF, tampak belakang'],
    ['plastisol', 'img/Plastisol/IMG_5024.webp', 'Kaos Plastisol, tulisan biru'],
    ['hoodie', 'img/Hoodie/IMG-20241109-WA0015.webp', 'Hoodie, cetak depan dan belakang'],
    ['dtf', 'img/DTF/IMG_2100.webp', 'Detail sablon DTF, ilustrasi'],
    ['plastisol', 'img/Plastisol/IMG_7117.webp', 'Kaos Plastisol, tampak depan'],
    ['event', 'img/Foto_bersama/Kaos_Angkatan/line_290394189065846.webp', 'Kaos angkatan'],
    ['dtf', 'img/DTF/IMG_7098.webp', 'Kaos DTF di sawah'],
    ['dtf', 'img/DTF/IMG_7142.webp', 'Kaos DTF, tampak depan'],
    ['dtf', 'img/DTF/IMG_7144.webp', 'Detail DTF di dada'],
    ['dtf', 'img/DTF/IMG_7150.webp', 'Kaos DTF, cetakan potret'],
    ['dtf', 'img/DTF/IMG_7152.webp', 'Detail DTF di punggung'],
    ['plastisol', 'img/Plastisol/IMG_2082.webp', 'Detail tipografi Plastisol'],
    ['plastisol', 'img/Plastisol/IMG_7114.webp', 'Kaos Plastisol, tampak belakang'],
    ['hoodie', 'img/Hoodie/IMG-20241109-WA0009.webp', 'Hoodie hitam di jalan kota'],
    ['hoodie', 'img/Hoodie/IMG-20241109-WA0017.webp', 'Hoodie, tulisan di punggung'],
    ['hoodie', 'img/Hoodie/IMG-20241109-WA0019.webp', 'Hoodie, tampak belakang'],
    ['hoodie', 'img/Hoodie/IMG-20241109-WA0021.webp', 'Detail cetakan belakang hoodie'],
    ['hoodie', 'img/Hoodie/IMG-20241109-WA0023.webp', 'Hoodie, tulisan di dada'],
    ['event', 'img/Foto_bersama/Kaos_Event/IMG-20240922-WA0009.webp', 'Kaos acara']
  ].map(([category, src, title], index) => ({ category, src, title, index }));
  const photoDescriptions = {
    'IMG_2100.webp': 'Detail sablon ilustrasi karakter berwarna pada kaos hitam.',
    'IMG_7098.webp': 'Seseorang berkaos putih dan bertopi berdiri di tengah sawah di bawah langit biru.',
    'IMG_7135.webp': 'Bagian belakang kaos putih dengan cetakan grafis berwarna, dikenakan di sawah saat matahari terbenam.',
    'IMG_7142.webp': 'Seseorang mengenakan kaos putih dengan cetakan kecil di dada sambil mengangkat tangan di sawah.',
    'IMG_7144.webp': 'Detail cetakan kecil berwarna pada bagian dada kaos putih yang sedang dikenakan.',
    'IMG_7150.webp': 'Seseorang duduk membelakangi kamera di tepi sawah, mengenakan kaos putih dengan cetakan potret di punggung.',
    'IMG_7152.webp': 'Cetakan potret dan tulisan hitam pada punggung kaos putih, dengan latar sawah saat senja.',
    'IMG_2082.webp': 'Detail sablon tipografi biru pada kain kaos putih.',
    'IMG_5024.webp': 'Kaos putih dengan sablon tulisan biru dibentangkan di atas kain gelap.',
    'IMG_7114.webp': 'Seseorang membelakangi kamera mengenakan kaos putih dengan tipografi biru di punggung saat senja.',
    'IMG_7117.webp': 'Tampak depan seseorang mengenakan kaos putih polos di tengah sawah.',
    'IMG-20241109-WA0009.webp': 'Foto malam dua orang mengenakan hoodie hitam di jalan kota, ditampilkan dalam tangkapan layar.',
    'IMG-20241109-WA0015.webp': 'Tiga orang mengenakan hoodie hitam dengan cetakan putih pada dada dan punggung di area pepohonan.',
    'IMG-20241109-WA0017.webp': 'Sekelompok orang berhoodie hitam, dengan cetakan putih di punggung, berdiri di tepi jalan saat malam.',
    'IMG-20241109-WA0019.webp': 'Dua orang berhoodie hitam dengan tulisan putih di punggung menyeberangi jalan di depan gedung.',
    'IMG-20241109-WA0021.webp': 'Bagian punggung dua hoodie hitam dengan cetakan putih di jalan kota pada malam hari.',
    'IMG-20241109-WA0023.webp': 'Sekelompok orang mengenakan hoodie hitam dengan tulisan putih di dada saat malam.',
    'line_290394189065846.webp': 'Foto kelompok besar mengenakan kaos putih di halaman luar dengan latar pepohonan.',
    'IMG-20240922-WA0009.webp': 'Foto kelompok besar berkaos putih di lapangan, dengan panggung acara di belakangnya.'
  };
  const photoAlt = (src) => photoDescriptions[src.split('/').pop()];
  const categoryNames = { dtf: 'Sablon DTF', plastisol: 'Sablon Plastisol', hoodie: 'Hoodie custom', event: 'Event & Angkatan' };

  const heroLooks = byId('hero-look-controls');
  const heroArt = byId('hero-art');
  const heroLookStatus = byId('hero-look-status');
  function selectHeroLook(look) {
    if (!heroArt || !['wear', 'print'].includes(look)) return;
    heroArt.dataset.look = look;
    heroLooks?.querySelectorAll('button[data-look]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.look === look));
    });
    if (heroLookStatus) heroLookStatus.textContent = look === 'wear'
      ? 'Contoh kaos DTF saat dipakai.'
      : 'Detail sablon DTF pada kaos hitam.';
  }
  heroLooks?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-look]');
    if (button && heroLooks.contains(button)) selectHeroLook(button.dataset.look);
  });
  selectHeroLook('wear');

  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  let pointerFrame = 0;
  let pointerX = 0;
  let pointerY = 0;
  function resetHeroPointer() {
    if (pointerFrame) window.cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
    pointerX = 0;
    pointerY = 0;
    heroArt?.style.setProperty('--pointer-x', '0px');
    heroArt?.style.setProperty('--pointer-y', '0px');
  }
  heroArt?.addEventListener('pointermove', (event) => {
    if (!finePointer.matches || reducedMotion.matches) return;
    const rect = heroArt.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointerX = Math.max(-6, Math.min(6, ((event.clientX - rect.left) / rect.width - 0.5) * 12));
    pointerY = Math.max(-6, Math.min(6, ((event.clientY - rect.top) / rect.height - 0.5) * 12));
    if (pointerFrame) return;
    pointerFrame = window.requestAnimationFrame(() => {
      pointerFrame = 0;
      heroArt.style.setProperty('--pointer-x', `${pointerX.toFixed(2)}px`);
      heroArt.style.setProperty('--pointer-y', `${pointerY.toFixed(2)}px`);
    });
  });
  heroArt?.addEventListener('pointerleave', resetHeroPointer);
  finePointer.addEventListener('change', resetHeroPointer);
  reducedMotion.addEventListener('change', resetHeroPointer);

  const ticker = byId('print-ticker');
  const tickerToggle = byId('ticker-toggle');
  let tickerPaused = false;
  function updateTicker() {
    if (!ticker || !tickerToggle) return;
    const enabled = !reducedMotion.matches;
    ticker.classList.toggle('ticker-ready', enabled);
    ticker.classList.toggle('is-paused', tickerPaused);
    tickerToggle.hidden = !enabled;
    tickerToggle.disabled = !enabled;
    tickerToggle.setAttribute('aria-pressed', String(tickerPaused));
    tickerToggle.textContent = tickerPaused ? 'Putar' : 'Jeda';
    tickerToggle.setAttribute('aria-label', tickerPaused ? 'Jalankan teks berjalan' : 'Jeda teks berjalan');
  }
  tickerToggle?.addEventListener('click', () => {
    tickerPaused = !tickerPaused;
    updateTicker();
  });
  reducedMotion.addEventListener('change', updateTicker);
  updateTicker();

  const menu = byId('menu-toggle');
  const nav = byId('site-nav');
  function closeMenu(returnFocus = false) {
    if (!menu) return;
    menu.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
    if (returnFocus) menu.focus();
  }
  menu?.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('menu-open', open);
  });
  nav?.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.body.classList.contains('menu-open')) closeMenu(true);
  });
  document.addEventListener('click', (event) => {
    if (document.body.classList.contains('menu-open') && !byId('site-header')?.contains(event.target)) closeMenu();
  });
  const desktop = window.matchMedia('(min-width: 1020px)');
  desktop.addEventListener('change', (event) => { if (event.matches) closeMenu(); });

  const grid = byId('portfolio-grid');
  const filters = byId('portfolio-filters');
  const more = byId('gallery-more');
  let filter = 'all';
  let expanded = false;
  const filteredProjects = () => projects.filter((project) => filter === 'all' || project.category === filter);
  function renderGallery(animate = false) {
    if (!grid) return;
    const matching = filteredProjects();
    const visible = filter === 'all' && !expanded ? matching.slice(0, 6) : matching;
    const fragment = document.createDocumentFragment();
    visible.forEach((project, order) => {
      const card = document.createElement('article');
      card.className = 'project-card';
      card.dataset.category = project.category;
      card.style.setProperty('--project-order', String(Math.min(order, 5)));
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'project-image-button';
      button.dataset.motion = 'photo';
      button.dataset.project = String(project.index);
      button.setAttribute('aria-label', `Lihat foto ${project.title}`);
      button.setAttribute('aria-haspopup', 'dialog');
      const image = document.createElement('img');
      image.src = project.src;
      image.alt = photoAlt(project.src);
      image.loading = 'lazy';
      image.decoding = 'async';
      const open = document.createElement('span');
      open.className = 'project-open';
      open.textContent = 'Lihat foto';
      open.setAttribute('aria-hidden', 'true');
      button.append(image, open);
      const caption = document.createElement('div');
      caption.className = 'project-caption';
      const title = document.createElement('h3');
      title.textContent = project.title;
      const technique = document.createElement('p');
      technique.textContent = categoryNames[project.category];
      caption.append(title, technique);
      card.append(button, caption);
      fragment.append(card);
    });
    motionTargets(grid).forEach((target) => {
      motionObserver?.unobserve(target);
      pendingMotion.delete(target);
    });
    grid.replaceChildren(fragment);
    registerMotion(grid);
    if (byId('gallery-count')) byId('gallery-count').textContent = `${visible.length} dari ${matching.length} foto`;
    if (byId('gallery-empty')) byId('gallery-empty').hidden = visible.length > 0;
    if (more) {
      more.hidden = filter !== 'all' || matching.length <= 6;
      more.textContent = expanded ? 'Tampilkan lebih sedikit' : 'Lihat semua foto';
      more.setAttribute('aria-expanded', String(expanded));
    }
    filters?.querySelectorAll('button[data-filter]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
    });
    if (animate) animateChange(grid);
  }
  filters?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-filter]');
    if (!button || !filters.contains(button)) return;
    filter = button.dataset.filter;
    renderGallery(true);
  });
  more?.addEventListener('click', () => {
    expanded = !expanded;
    renderGallery(true);
  });
  renderGallery();

  const dialog = byId('project-dialog');
  const dialogImage = byId('dialog-image');
  let viewerProjects = [];
  let viewerPosition = 0;
  let imageRequest = 0;
  let returnTarget = null;
  let closingDialog = false;
  let closeTimer = 0;
  function clearDialogClose() {
    window.clearTimeout(closeTimer);
    closeTimer = 0;
    closingDialog = false;
    dialog?.classList.remove('is-closing');
    dialog?.removeEventListener('animationend', finishDialogClose);
  }
  function finishDialogClose(event) {
    if (event && (event.target !== dialog || event.animationName !== 'viewer-out')) return;
    if (!closingDialog) return;
    clearDialogClose();
    if (dialog.open) dialog.close();
  }
  function closeViewer() {
    if (!dialog?.open || closingDialog) return;
    if (reducedMotion.matches) {
      dialog.close();
      return;
    }
    closingDialog = true;
    ++imageRequest;
    dialog.classList.add('is-closing');
    dialog.addEventListener('animationend', finishDialogClose);
    closeTimer = window.setTimeout(() => finishDialogClose(), 200);
  }
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches && closingDialog) finishDialogClose();
  });
  function loadDialogImage() {
    const project = viewerProjects[viewerPosition];
    if (!project || !dialogImage) return;
    const request = ++imageRequest;
    byId('dialog-title').textContent = project.title;
    byId('dialog-category').textContent = categoryNames[project.category];
    byId('dialog-position').textContent = `${viewerPosition + 1} / ${viewerProjects.length}`;
    byId('dialog-prev').disabled = viewerProjects.length < 2;
    byId('dialog-next').disabled = viewerProjects.length < 2;
    byId('dialog-loading').hidden = false;
    byId('dialog-error').hidden = true;
    dialogImage.hidden = true;
    dialogImage.removeAttribute('src');
    dialogImage.alt = photoAlt(project.src);
    const preload = new Image();
    preload.onload = () => {
      if (request !== imageRequest || !dialog.open) return;
      dialogImage.src = project.src;
      dialogImage.hidden = false;
      byId('dialog-loading').hidden = true;
      animateChange(dialogImage);
    };
    preload.onerror = () => {
      if (request !== imageRequest || !dialog.open) return;
      byId('dialog-loading').hidden = true;
      byId('dialog-error').hidden = false;
    };
    preload.src = project.src;
  }
  function moveViewer(direction) {
    if (!viewerProjects.length || closingDialog) return;
    viewerPosition = (viewerPosition + direction + viewerProjects.length) % viewerProjects.length;
    loadDialogImage();
  }
  grid?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-project]');
    if (!button || !dialog) return;
    viewerProjects = filteredProjects();
    viewerPosition = viewerProjects.findIndex((project) => project.index === Number(button.dataset.project));
    if (viewerPosition < 0) return;
    clearDialogClose();
    returnTarget = button;
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('viewer-open');
    loadDialogImage();
    byId('dialog-close').focus();
  });
  byId('dialog-close')?.addEventListener('click', closeViewer);
  dialog?.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeViewer();
  });
  byId('dialog-prev')?.addEventListener('click', () => moveViewer(-1));
  byId('dialog-next')?.addEventListener('click', () => moveViewer(1));
  byId('dialog-retry')?.addEventListener('click', loadDialogImage);
  dialog?.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      moveViewer(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });
  let backdropPointer = false;
  dialog?.addEventListener('pointerdown', (event) => { backdropPointer = event.target === dialog; });
  dialog?.addEventListener('click', (event) => {
    if (event.target !== dialog || !backdropPointer) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeViewer();
  });
  dialog?.addEventListener('close', () => {
    clearDialogClose();
    ++imageRequest;
    document.body.classList.remove('viewer-open');
    if (returnTarget?.isConnected) returnTarget.focus({ preventScroll: true });
  });

  const products = {
    dtf: { name: 'Tele Shirt / DTF', src: 'img/DTF/IMG_7144.webp', description: 'Desain dicetak pada film, lalu dipindahkan ke kaos dengan panas. DTF bisa digunakan untuk ilustrasi dan desain banyak warna.', technique: 'Direct-to-Film (DTF)', use: 'Ilustrasi, logo, dan desain banyak warna.' },
    plastisol: { name: 'Tele Shirt / Plastisol', src: 'img/Plastisol/IMG_2082.webp', description: 'Sablon menggunakan tinta Plastisol. Bisa digunakan untuk tulisan, logo, dan bidang warna solid.', technique: 'Sablon Plastisol', use: 'Logo, tipografi, dan warna solid.' },
    hoodie: { name: 'Tele Hoodie', src: 'img/Hoodie/IMG-20241109-WA0017.webp', description: 'Hoodie dengan pilihan sablon DTF atau Plastisol. Model, bahan, dan posisi cetak dibicarakan saat pemesanan.', technique: 'Pilihan DTF atau Plastisol', use: 'Cetak di dada atau punggung.' }
  };
  const tabs = byId('product-tabs');
  const productDetail = byId('product-detail');
  let selectedProduct = 'dtf';
  function selectProduct(key, animate = true) {
    const product = products[key];
    if (!product || !productDetail) return;
    selectedProduct = key;
    tabs.querySelectorAll('button[data-product]').forEach((button) => {
      const selected = button.dataset.product === key;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
      if (selected && button.id) productDetail.setAttribute('aria-labelledby', button.id);
    });
    byId('product-name').textContent = product.name;
    byId('product-description').textContent = product.description;
    byId('product-technique').textContent = product.technique;
    byId('product-use').textContent = product.use;
    byId('product-image').src = product.src;
    byId('product-image').alt = photoAlt(product.src);
    byId('product-link').href = '#contact';
    if (animate) animateChange(productDetail);
  }
  tabs?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-product]');
    if (button && tabs.contains(button)) selectProduct(button.dataset.product);
  });
  tabs?.addEventListener('keydown', (event) => {
    const buttons = [...tabs.querySelectorAll('button[data-product]')];
    const current = buttons.indexOf(event.target);
    if (current < 0) return;
    let next;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % buttons.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current - 1 + buttons.length) % buttons.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = buttons.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    buttons[next].focus();
    selectProduct(buttons[next].dataset.product);
  });
  if (tabs) selectProduct(tabs.querySelector('[aria-selected="true"]')?.dataset.product || 'dtf', false);

  const form = byId('project-form');
  let brief = '';
  function invalidateBrief() {
    brief = '';
    byId('brief-preview').hidden = true;
    byId('brief-whatsapp').href = 'https://wa.me/6285863809688';
    byId('brief-feedback').textContent = '';
  }
  form?.addEventListener('input', (event) => {
    if (typeof event.target.setCustomValidity === 'function') event.target.setCustomValidity('');
    invalidateBrief();
  });
  form?.addEventListener('change', invalidateBrief);
  byId('product-link')?.addEventListener('click', () => {
    const type = form?.elements.namedItem('project-type');
    if (!type) return;
    type.value = { dtf: 'Tele Shirt DTF', plastisol: 'Tele Shirt Plastisol', hoodie: 'Tele Hoodie' }[selectedProduct];
    invalidateBrief();
  });
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const message = String(data.get('message') || '').trim();
    if (!name || !message) {
      const field = form.elements.namedItem(!name ? 'name' : 'message');
      field.setCustomValidity('Isi bagian ini dengan teks.');
      field.reportValidity();
      return;
    }
    const typeControl = form.elements.namedItem('project-type');
    const type = typeControl?.selectedOptions?.[0]?.textContent || String(data.get('project-type') || 'Belum ditentukan');
    const quantity = String(data.get('quantity') || '').trim();
    brief = `Halo Telepathy Lab, saya ingin bertanya tentang pesanan.\n\nNama: ${name}\nProduk: ${type}\n${quantity ? `Jumlah: ${quantity}\n` : ''}\nDetail:\n${message}`;
    byId('brief-text').textContent = brief;
    byId('brief-whatsapp').href = `https://wa.me/6285863809688?text=${encodeURIComponent(brief)}`;
    byId('brief-whatsapp').target = '_blank';
    byId('brief-whatsapp').rel = 'noopener noreferrer';
    byId('brief-preview').hidden = false;
    byId('brief-feedback').textContent = 'Pesan siap diperiksa.';
    animateChange(byId('brief-preview'));
  });
  byId('brief-copy')?.addEventListener('click', async () => {
    if (!brief) return;
    const copiedBrief = brief;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(copiedBrief);
      if (brief !== copiedBrief) return;
      byId('brief-feedback').textContent = 'Pesan disalin.';
    } catch {
      if (brief !== copiedBrief) return;
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(byId('brief-text'));
      selection.removeAllRanges();
      selection.addRange(range);
      byId('brief-feedback').textContent = 'Teks sudah dipilih. Gunakan Salin pada perangkat kamu.';
    }
  });

  if (byId('current-year')) byId('current-year').textContent = new Date().getFullYear();
  const navLinks = [...(nav?.querySelectorAll('a[href^="#"]') || [])];
  const sections = navLinks.map((link) => byId(link.getAttribute('href').slice(1))).filter(Boolean);
  let scrollQueued = false;
  function updateScroll() {
    scrollQueued = false;
    byId('site-header')?.classList.toggle('is-scrolled', window.scrollY > 20);
    byId('back-to-top')?.classList.toggle('is-visible', window.scrollY > 500);
    const threshold = (byId('site-header')?.offsetHeight || 80) + 80;
    let active;
    sections.forEach((section) => { if (section.getBoundingClientRect().top <= threshold) active = section.id; });
    navLinks.forEach((link) => {
      if (link.getAttribute('href') === `#${active}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  window.addEventListener('scroll', () => {
    if (!scrollQueued) { scrollQueued = true; window.requestAnimationFrame(updateScroll); }
  }, { passive: true });
  updateScroll();
})();
