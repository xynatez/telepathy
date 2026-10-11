(() => {
  'use strict';

  const byId = (id) => document.getElementById(id);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let enterObserver = null;
  let exitObserver = null;
  const motionStates = new Map();
  const observationBoxes = new Map();
  const pendingBoxes = new Set();
  let motionFrame = 0;
  let motionGeneration = 0;
  let forceViewport = false;
  let lastMotionScrollY = window.scrollY;
  let motionDirection = 'down';
  const exitMargin = 128;

  function hasMotionFocus(target) {
    return !!document.activeElement && target.contains(document.activeElement);
  }
  function revealMotion(target, pinned = hasMotionFocus(target)) {
    const record = motionStates.get(target);
    if (record) record.state = pinned ? 'pinned' : 'visible';
    target.classList.remove('motion-resetting');
    target.classList.add('is-revealed');
  }
  function motionTargets(scope) {
    return [...(scope.matches?.('[data-motion]') ? [scope] : []), ...scope.querySelectorAll('[data-motion]')];
  }
  function registerMotion(scope = document) {
    const registrationGeneration = motionGeneration;
    const registrations = motionTargets(scope).filter((target) => !motionStates.has(target)).map((target) => {
      const box = target.dataset.motion === 'photo' ? target.closest('article') || target : target;
      return { target, box, rect: box.getBoundingClientRect(), focused: hasMotionFocus(target) };
    });
    registrations.forEach(({ target, box, rect, focused }) => {
      const record = { box, state: 'armed', ready: false };
      motionStates.set(target, record);
      if (!enterObserver || reducedMotion.matches) {
        target.classList.remove('motion-ready');
        revealMotion(target, focused);
        record.ready = true;
        return;
      }
      target.classList.add('motion-ready');
      if (focused || intersectsViewport(rect)) revealMotion(target, focused);
      else {
        target.classList.add('motion-resetting');
        target.classList.remove('is-revealed');
      }
      if (!observationBoxes.has(box)) {
        observationBoxes.set(box, new Set());
        enterObserver.observe(box);
        exitObserver.observe(box);
      }
      observationBoxes.get(box).add(target);
    });
    if (registrations.length && enterObserver) {
      // Let the armed style paint before an observer can begin its transition.
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        if (registrationGeneration !== motionGeneration) return;
        registrations.forEach(({ target }) => {
          const record = motionStates.get(target);
          if (!record) return;
          record.ready = true;
          pendingBoxes.add(record.box);
        });
        scheduleMotionBatch();
      }));
    }
  }

  function unregisterMotion(scope) {
    motionTargets(scope).forEach((target) => {
      const record = motionStates.get(target);
      if (!record) return;
      motionStates.delete(target);
      const targets = observationBoxes.get(record.box);
      targets?.delete(target);
      if (targets?.size) return;
      enterObserver?.unobserve(record.box);
      exitObserver?.unobserve(record.box);
      observationBoxes.delete(record.box);
      pendingBoxes.delete(record.box);
    });
  }
  function intersectsViewport(rect, inset = 0) {
    return rect.bottom > inset && rect.top < window.innerHeight - inset && rect.right > 0 && rect.left < window.innerWidth;
  }
  function entryRatio(rect) {
    const width = rect.width || rect.right - rect.left;
    const height = rect.height || rect.bottom - rect.top;
    if (width <= 0 || height <= 0) return 0;
    const visibleWidth = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
    const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight - 24) - Math.max(rect.top, 24));
    return (visibleWidth * visibleHeight) / (width * height);
  }
  function flushMotionBatch() {
    motionFrame = 0;
    const revealCurrentViewport = forceViewport;
    forceViewport = false;
    const scrollY = window.scrollY;
    if (scrollY !== lastMotionScrollY) motionDirection = scrollY > lastMotionScrollY ? 'down' : 'up';
    lastMotionScrollY = scrollY;
    const updates = [...pendingBoxes].map((box) => {
      const targets = observationBoxes.get(box);
      if (!targets) return null;
      const rect = box.getBoundingClientRect();
      return { rect, targets: [...targets].map((target) => ({ target, record: motionStates.get(target), focused: hasMotionFocus(target) })) };
    }).filter(Boolean);
    pendingBoxes.clear();
    updates.forEach(({ rect, targets }) => {
      const outside = rect.bottom <= -exitMargin || rect.top >= window.innerHeight + exitMargin || rect.right <= -exitMargin || rect.left >= window.innerWidth + exitMargin;
      const entering = entryRatio(rect) >= 0.12;
      targets.forEach(({ target, record, focused }) => {
        if (!target.isConnected) {
          unregisterMotion(target);
          return;
        }
        if (!record) return;
        if (focused) {
          revealMotion(target, true);
          return;
        }
        if (record.state === 'pinned') record.state = 'visible';
        if (revealCurrentViewport && intersectsViewport(rect)) revealMotion(target, false);
        else if (record.state === 'armed' && entering && record.ready) {
          target.dataset.motionDirection = motionDirection;
          revealMotion(target, false);
        } else if (record.state === 'visible' && outside) {
          record.state = 'armed';
          target.classList.add('motion-resetting');
          target.classList.remove('is-revealed');
        }
      });
    });
  }
  function scheduleMotionBatch() {
    if (!motionFrame && pendingBoxes.size) motionFrame = window.requestAnimationFrame(flushMotionBatch);
  }
  function queueMotionEntries(entries) {
    entries.forEach((entry) => pendingBoxes.add(entry.target));
    scheduleMotionBatch();
  }
  function revealViewport() {
    forceViewport = true;
    observationBoxes.forEach((_, box) => pendingBoxes.add(box));
    scheduleMotionBatch();
  }
  function prepareMotion() {
    ++motionGeneration;
    enterObserver?.disconnect();
    exitObserver?.disconnect();
    if (motionFrame) window.cancelAnimationFrame(motionFrame);
    motionFrame = 0;
    forceViewport = false;
    motionStates.clear();
    observationBoxes.clear();
    pendingBoxes.clear();
    enterObserver = null;
    exitObserver = null;
    if ('IntersectionObserver' in window && !reducedMotion.matches) {
      enterObserver = new IntersectionObserver(queueMotionEntries, { threshold: [0, 0.12], rootMargin: '-24px 0px -24px 0px' });
      exitObserver = new IntersectionObserver(queueMotionEntries, { threshold: 0, rootMargin: `${exitMargin}px` });
    }
    registerMotion();
  }
  document.addEventListener('focusin', (event) => {
    let target = event.target.closest('[data-motion]');
    while (target) {
      revealMotion(target, true);
      target = target.parentElement?.closest('[data-motion]');
    }
  });
  document.addEventListener('focusout', (event) => {
    let target = event.target.closest('[data-motion]');
    while (target) {
      const record = motionStates.get(target);
      if (record) pendingBoxes.add(record.box);
      target = target.parentElement?.closest('[data-motion]');
    }
    scheduleMotionBatch();
  });
  window.addEventListener('hashchange', () => window.requestAnimationFrame(revealViewport));
  window.addEventListener('pageshow', () => window.requestAnimationFrame(revealViewport));
  window.addEventListener('resize', revealViewport, { passive: true });
  reducedMotion.addEventListener('change', prepareMotion);
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
    ['dtf', 'img/DTF/IMG_7135.webp', 'DTF di punggung'],
    ['plastisol', 'img/Plastisol/IMG_5024.webp', 'Tulisan biru, Plastisol'],
    ['hoodie', 'img/Hoodie/IMG-20241109-WA0015.webp', 'Hoodie depan-belakang'],
    ['dtf', 'img/DTF/IMG_2100.webp', 'Ilustrasi DTF, dari dekat'],
    ['plastisol', 'img/Plastisol/IMG_7117.webp', 'Plastisol, dari depan'],
    ['event', 'img/Foto_bersama/Kaos_Angkatan/line_290394189065846.webp', 'Kaos angkatan'],
    ['dtf', 'img/DTF/IMG_7098.webp', 'DTF dibawa ke sawah'],
    ['dtf', 'img/DTF/IMG_7142.webp', 'DTF, dari depan'],
    ['dtf', 'img/DTF/IMG_7144.webp', 'DTF di dada, dari dekat'],
    ['dtf', 'img/DTF/IMG_7150.webp', 'Potret di kaos DTF'],
    ['dtf', 'img/DTF/IMG_7152.webp', 'DTF di punggung, dari dekat'],
    ['plastisol', 'img/Plastisol/IMG_2082.webp', 'Tulisan Plastisol, dari dekat'],
    ['plastisol', 'img/Plastisol/IMG_7114.webp', 'Plastisol, dari belakang'],
    ['hoodie', 'img/Hoodie/IMG-20241109-WA0009.webp', 'Hoodie hitam di jalan kota'],
    ['hoodie', 'img/Hoodie/IMG-20241109-WA0017.webp', 'Tulisan di punggung hoodie'],
    ['hoodie', 'img/Hoodie/IMG-20241109-WA0019.webp', 'Hoodie, dari belakang'],
    ['hoodie', 'img/Hoodie/IMG-20241109-WA0021.webp', 'Punggung hoodie, dari dekat'],
    ['hoodie', 'img/Hoodie/IMG-20241109-WA0023.webp', 'Tulisan di dada hoodie'],
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
      ? 'Kaos DTF pas dipakai.'
      : 'Sablon DTF, dari dekat.';
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
  function renderGallery() {
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
      const number = document.createElement('span');
      number.className = 'project-number';
      number.textContent = String(project.index + 1).padStart(2, '0');
      number.setAttribute('aria-hidden', 'true');
      const title = document.createElement('h3');
      title.textContent = project.title;
      const technique = document.createElement('p');
      technique.textContent = categoryNames[project.category];
      caption.append(number, title, technique);
      card.append(button, caption);
      fragment.append(card);
    });
    unregisterMotion(grid);
    grid.replaceChildren(fragment);
    registerMotion(grid);
    if (byId('gallery-count')) byId('gallery-count').textContent = `${visible.length} dari ${matching.length} foto`;
    if (byId('gallery-empty')) byId('gallery-empty').hidden = visible.length > 0;
    if (more) {
      more.hidden = filter !== 'all' || matching.length <= 6;
      more.textContent = expanded ? 'Ringkas lagi' : 'Buka semua foto';
      more.setAttribute('aria-expanded', String(expanded));
    }
    filters?.querySelectorAll('button[data-filter]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
    });
  }
  filters?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-filter]');
    if (!button || !filters.contains(button)) return;
    filter = button.dataset.filter;
    renderGallery();
  });
  more?.addEventListener('click', () => {
    expanded = !expanded;
    renderGallery();
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
    dtf: { name: 'Tele Shirt / DTF', src: 'img/DTF/IMG_7144.webp', description: 'Desain kamu dicetak di film, lalu kita pindahkan ke kaos pakai panas. Bisa buat ilustrasi atau desain dengan banyak warna.', technique: 'Direct-to-Film (DTF)', use: 'Buat ilustrasi, logo, atau desain banyak warna.' },
    plastisol: { name: 'Tele Shirt / Plastisol', src: 'img/Plastisol/IMG_2082.webp', description: 'Kita pakai tinta Plastisol buat sablonnya. Bisa buat tulisan, logo, atau bidang warna solid.', technique: 'Sablon Plastisol', use: 'Buat logo, tulisan, atau warna solid.' },
    hoodie: { name: 'Tele Hoodie', src: 'img/Hoodie/IMG-20241109-WA0017.webp', description: 'Mau hoodie pakai DTF atau Plastisol? Model, bahan, dan posisi cetaknya kita obrolin pas kamu pesan.', technique: 'Pilih DTF atau Plastisol', use: 'Bisa cetak di dada atau punggung.' }
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
    byId('brief-whatsapp').href = 'https://wa.me/6285720071185';
    byId('brief-feedback').textContent = '';
  }
  form?.addEventListener('input', (event) => {
    if (typeof event.target.setCustomValidity === 'function') event.target.setCustomValidity('');
    invalidateBrief();
  });
  form?.addEventListener('change', invalidateBrief);
  form?.addEventListener('invalid', (event) => {
    const field = event.target;
    if (typeof field.setCustomValidity !== 'function') return;
    const messages = {
      name: 'Tulis nama kamu dulu, ya.',
      message: 'Ceritain sedikit pesanan yang mau kamu bikin.',
      quantity: 'Isi jumlahnya pakai angka bulat, mulai dari 1.'
    };
    field.setCustomValidity(messages[field.name] || 'Cek bagian ini dulu, ya.');
  }, true);
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
      field.setCustomValidity(!name ? 'Tulis nama kamu dulu, ya.' : 'Ceritain sedikit pesanan yang mau kamu bikin.');
      field.reportValidity();
      return;
    }
    const typeControl = form.elements.namedItem('project-type');
    const type = typeControl?.selectedOptions?.[0]?.textContent || String(data.get('project-type') || 'Belum pilih');
    const quantity = String(data.get('quantity') || '').trim();
    brief = `Halo Telepathy, aku mau tanya soal pesanan.\n\nNama: ${name}\nProduk: ${type}\n${quantity ? `Jumlah: ${quantity}\n` : ''}\nDetail:\n${message}`;
    byId('brief-text').textContent = brief;
    byId('brief-whatsapp').href = `https://wa.me/6285720071185?text=${encodeURIComponent(brief)}`;
    byId('brief-whatsapp').target = '_blank';
    byId('brief-whatsapp').rel = 'noopener noreferrer';
    byId('brief-preview').hidden = false;
    byId('brief-feedback').textContent = 'Pesannya udah siap. Cek dulu, ya.';
    animateChange(byId('brief-preview'));
  });
  byId('brief-copy')?.addEventListener('click', async () => {
    if (!brief) return;
    const copiedBrief = brief;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(copiedBrief);
      if (brief !== copiedBrief) return;
      byId('brief-feedback').textContent = 'Pesannya udah disalin.';
    } catch {
      if (brief !== copiedBrief) return;
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(byId('brief-text'));
      selection.removeAllRanges();
      selection.addRange(range);
      byId('brief-feedback').textContent = 'Teksnya udah dipilih. Tinggal pilih Salin di perangkat kamu.';
    }
  });

  if (byId('current-year')) byId('current-year').textContent = new Date().getFullYear();
  const navLinks = [...(nav?.querySelectorAll('a[href^="#"]') || [])];
  const sections = navLinks.map((link) => byId(link.getAttribute('href').slice(1))).filter(Boolean);
  const header = byId('site-header');
  const backToTop = byId('back-to-top');
  let previousHeaderState = null;
  let previousTopState = null;
  let previousActive = null;
  let scrollQueued = false;
  function updateScroll() {
    scrollQueued = false;
    const scrollY = window.scrollY;
    const threshold = (header?.offsetHeight || 80) + 80;
    const positions = sections.map((section) => ({ id: section.id, top: section.getBoundingClientRect().top }));
    let active;
    positions.forEach((section) => { if (section.top <= threshold) active = section.id; });
    const headerState = scrollY > 20;
    const topState = scrollY > 500;
    if (headerState !== previousHeaderState) {
      header?.classList.toggle('is-scrolled', headerState);
      previousHeaderState = headerState;
    }
    if (topState !== previousTopState) {
      backToTop?.classList.toggle('is-visible', topState);
      previousTopState = topState;
    }
    if (active !== previousActive) {
      navLinks.forEach((link) => {
        if (link.getAttribute('href') === `#${active}`) {
          if (link.getAttribute('aria-current') !== 'location') link.setAttribute('aria-current', 'location');
        } else if (link.hasAttribute('aria-current')) link.removeAttribute('aria-current');
      });
      previousActive = active;
    }
  }
  window.addEventListener('scroll', () => {
    if (!scrollQueued) { scrollQueued = true; window.requestAnimationFrame(updateScroll); }
  }, { passive: true });
  window.addEventListener('resize', () => {
    if (!scrollQueued) { scrollQueued = true; window.requestAnimationFrame(updateScroll); }
  }, { passive: true });
  updateScroll();
})();
