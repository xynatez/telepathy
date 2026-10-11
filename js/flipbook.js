(() => {
  'use strict';

  const byId = (id) => document.getElementById(id);
  const booklet = byId('booklet');
  const reader = byId('book-reader');
  const slot = byId('book-reader-slot');
  const stage = byId('book-stage');
  const sheet = stage?.querySelector('.book-sheet');
  let pageImage = byId('book-image');
  const title = byId('book-title');
  const pageLabel = byId('book-page-label');
  const loading = byId('book-loading');
  const error = byId('book-error');
  const retry = byId('book-retry');
  const previous = byId('book-prev');
  const next = byId('book-next');
  const pageSelect = byId('book-page-select');
  const zoom = byId('book-zoom');
  const expand = byId('book-expand');
  const download = byId('book-download');
  const pageText = byId('book-page-text');
  const help = byId('book-help');
  const dialog = byId('book-dialog');
  const dialogMount = byId('book-dialog-mount');
  const close = byId('book-close');
  const choices = [...(booklet?.querySelectorAll('.book-choice[data-book]') || [])];
  if (![booklet, reader, slot, stage, sheet, pageImage, title, pageLabel, loading,
    error, retry, previous, next, pageSelect, zoom, expand, download, pageText].every(Boolean)
    || !choices.length) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const imageClass = pageImage.className;
  const imageCache = new Map();
  const cachedPageLimit = 6;
  const fallbackBooks = new Map();
  const defaultTitles = {
    pricelist: 'Pricelist',
    sizechart: 'Size chart',
    handbook: 'Customwear handbook'
  };
  choices.forEach((button) => {
    const id = button.dataset.book;
    const fallback = [...booklet.querySelectorAll('a[data-book][download]')]
      .find((link) => link.dataset.book === id);
    fallbackBooks.set(id, {
      title: button.dataset.title || defaultTitles[id] || button.textContent.trim(),
      pdf: button.dataset.pdf || fallback?.getAttribute('href')
        || (button.getAttribute('aria-pressed') === 'true' ? download.getAttribute('href') : '')
    });
  });

  let books = null;
  let manifestPromise = null;
  let manifestState = 'idle';
  let selectedBook = choices.find((button) => button.getAttribute('aria-pressed') === 'true')?.dataset.book
    || choices[0].dataset.book;
  let activated = false;
  let targetPage = 0;
  let displayedPage = null;
  let generation = 0;
  let turnAnimation = null;
  let turnGeneration = 0;
  let failure = null;
  let returnFocus = null;
  let touchStart = null;
  let nearObserver = null;
  let visibleObserver = null;
  let wheelDelta = 0;
  let wheelDirection = 0;
  let wheelLastAt = 0;
  let wheelCooldownUntil = 0;
  let wheelHandled = false;

  function cancelTurn() {
    ++turnGeneration;
    if (turnAnimation) {
      turnAnimation.cancel();
      turnAnimation = null;
    }
    sheet.style.removeProperty('transform-origin');
  }

  function resetWheel() {
    wheelDelta = 0;
    wheelDirection = 0;
    wheelLastAt = 0;
    wheelCooldownUntil = 0;
    wheelHandled = false;
  }

  function updateHelp() {
    if (!help) return;
    help.textContent = reader.classList.contains('is-zoomed')
      ? 'Geser halamannya buat baca detailnya.'
      : dialog?.open ? 'Scroll atau geser buat pindah halaman.'
        : 'Geser ke samping atau pakai panah buat pindah halaman.';
  }

  function setZoom(value) {
    reader.classList.toggle('is-zoomed', value);
    zoom.setAttribute('aria-pressed', String(value));
    zoom.textContent = value ? 'Ukuran biasa' : 'Perbesar';
    stage.scrollTop = 0;
    stage.scrollLeft = 0;
    resetWheel();
    updateHelp();
    if (value) cancelTurn();
  }

  function setStatus(state, message = '') {
    loading.hidden = state !== 'loading';
    error.hidden = state !== 'error';
    if (state === 'loading') loading.textContent = message;
    if (state === 'error') {
      const errorText = error.querySelector('p');
      if (errorText) errorText.textContent = message;
    }
    reader.classList.toggle('is-loading', state === 'loading');
    reader.classList.toggle('has-error', state === 'error');
    reader.setAttribute('aria-busy', String(state === 'loading'));
    stage.setAttribute('aria-busy', String(state === 'loading'));
  }

  function updateControls() {
    const book = books?.get(selectedBook);
    const ready = Boolean(book && activated);
    previous.disabled = !ready || targetPage <= 0;
    next.disabled = !ready || targetPage >= book.pageCount - 1;
    pageSelect.disabled = !ready;
    zoom.disabled = !displayedPage || displayedPage.book !== selectedBook;
    expand.disabled = !book || !dialogMount || typeof dialog?.showModal !== 'function';
    if (book) {
      pageSelect.value = String(targetPage + 1);
      const page = displayedPage?.book === selectedBook ? displayedPage.index : targetPage;
      pageLabel.textContent = `Halaman ${page + 1} dari ${book.pageCount}`;
    } else {
      pageLabel.textContent = 'Buku belum terbuka';
    }
  }

  function updateBook() {
    const book = books?.get(selectedBook) || fallbackBooks.get(selectedBook);
    if (book) {
      title.textContent = book.title;
      if (book.pdf) download.setAttribute('href', book.pdf);
      download.setAttribute('aria-label', `Unduh ${book.title} sebagai PDF`);
    }
    choices.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.book === selectedBook));
      const metadata = books?.get(button.dataset.book);
      const count = button.querySelector('[data-book-pages], .book-page-count, .book-pages');
      if (metadata && count) count.textContent = `${metadata.pageCount} halaman`;
    });
    if (books) {
      const options = books.get(selectedBook).pages.map((page, index) => {
        const option = document.createElement('option');
        option.value = String(index + 1);
        option.textContent = `Halaman ${index + 1}`;
        return option;
      });
      pageSelect.replaceChildren(...options);
    }
    updateControls();
  }

  function localPath(value) {
    return typeof value === 'string' && value.trim() !== ''
      && !/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value.trim());
  }

  function readManifest(data) {
    if (!Array.isArray(data?.books)) throw new Error('Books unavailable');
    const parsed = new Map();
    choices.forEach((button) => {
      const book = data.books.find((entry) => entry.id === button.dataset.book);
      if (!book || typeof book.title !== 'string' || !book.title.trim() || !localPath(book.pdf)
        || !Number.isInteger(book.pageCount) || book.pageCount < 1
        || !Array.isArray(book.pages) || book.pages.length !== book.pageCount
        || book.pages.some((page) => !localPath(page.src) || !Number.isFinite(page.width)
          || page.width <= 0 || !Number.isFinite(page.height) || page.height <= 0)) {
        throw new Error('Book pages unavailable');
      }
      parsed.set(book.id, book);
    });
    return parsed;
  }

  function ensureManifest() {
    if (books || manifestPromise) return manifestPromise;
    manifestState = 'loading';
    failure = null;
    if (activated) setStatus('loading', 'Bukunya lagi dibuka...');
    manifestPromise = (async () => {
      try {
        const response = await fetch('assets/books/manifest.json', { credentials: 'same-origin' });
        if (!response.ok) throw new Error('Books unavailable');
        books = readManifest(await response.json());
        manifestState = 'ready';
        updateBook();
        if (activated) requestPage(targetPage);
      } catch {
        manifestState = 'error';
        failure = 'manifest';
        setStatus('error', 'Bukunya belum bisa dibuka. Coba lagi, atau unduh PDF-nya.');
        updateControls();
      } finally {
        manifestPromise = null;
      }
    })();
    return manifestPromise;
  }

  function loadImage(src) {
    const cached = imageCache.get(src);
    if (cached) {
      imageCache.delete(src);
      imageCache.set(src, cached);
      return cached.promise;
    }
    const image = new Image();
    image.decoding = 'async';
    image.className = imageClass;
    const entry = { image, promise: null, loaded: false };
    entry.promise = new Promise((resolve, reject) => {
      let decoding = false;
      let settled = false;
      function fail() {
        if (settled) return;
        settled = true;
        image.onload = null;
        image.onerror = null;
        if (imageCache.get(src) === entry) imageCache.delete(src);
        reject(new Error('Page unavailable'));
      }
      image.onerror = fail;
      image.onload = async () => {
        if (decoding || settled) return;
        decoding = true;
        try {
          if (typeof image.decode === 'function') await image.decode();
          if (settled) return;
          if (!image.naturalWidth) throw new Error('Page unavailable');
          settled = true;
          image.onload = null;
          image.onerror = null;
          entry.loaded = true;
          for (const [oldSrc, oldEntry] of imageCache) {
            if (imageCache.size <= cachedPageLimit) break;
            if (oldEntry.loaded && oldEntry.image !== pageImage && oldEntry !== entry) imageCache.delete(oldSrc);
          }
          resolve(image);
        } catch {
          fail();
        }
      };
    });
    imageCache.set(src, entry);
    image.src = src;
    return entry.promise;
  }

  async function turnPage(direction, outgoing, token) {
    if (!direction || token !== turnGeneration || reducedMotion.matches || document.hidden || reader.classList.contains('is-zoomed')
      || typeof sheet.animate !== 'function') return;
    sheet.style.transformOrigin = direction > 0 ? 'left center' : 'right center';
    const angle = outgoing ? (direction > 0 ? -80 : 80) : (direction > 0 ? 65 : -65);
    const flat = { transform: 'perspective(1400px) rotateY(0deg)', opacity: 1 };
    const turned = { transform: `perspective(1400px) rotateY(${angle}deg)`, opacity: 0.6 };
    const animation = sheet.animate([
      outgoing ? flat : turned,
      outgoing ? turned : flat
    ], { duration: outgoing ? 180 : 300, easing: 'cubic-bezier(.22,.61,.36,1)' });
    turnAnimation = animation;
    try {
      await animation.finished;
    } catch {
      // A cancelled turn leaves the current sheet visible and lets the latest request continue.
    } finally {
      if (turnAnimation === animation) {
        turnAnimation = null;
        sheet.style.removeProperty('transform-origin');
      }
    }
  }

  async function requestPage(index) {
    const book = books?.get(selectedBook);
    if (!book) return;
    const bookId = selectedBook;
    targetPage = Math.max(0, Math.min(book.pageCount - 1, index));
    const requestedPage = targetPage;
    const token = ++generation;
    cancelTurn();
    const motionToken = turnGeneration;
    failure = null;
    updateControls();
    if (displayedPage?.book === bookId && displayedPage.index === requestedPage) {
      setStatus('idle');
      return;
    }
    setStatus('loading', `Lagi buka halaman ${requestedPage + 1}...`);
    const page = book.pages[requestedPage];
    try {
      const image = await loadImage(page.src);
      if (token !== generation || selectedBook !== bookId) return;
      const direction = displayedPage?.book === bookId ? Math.sign(requestedPage - displayedPage.index) : 0;
      await turnPage(direction, true, motionToken);
      if (token !== generation || selectedBook !== bookId) return;
      image.id = 'book-image';
      image.alt = `${book.title}, halaman ${requestedPage + 1} dari ${book.pageCount}`;
      image.width = page.width;
      image.height = page.height;
      image.hidden = false;
      if (image !== pageImage) {
        pageImage.removeAttribute('id');
        pageImage.replaceWith(image);
        pageImage = image;
      }
      sheet.style.setProperty('--book-ratio', `${page.width} / ${page.height}`);
      reader.style.setProperty('--page-ratio', String(page.width / page.height));
      sheet.hidden = false;
      reader.classList.add('has-page');
      displayedPage = { book: bookId, index: requestedPage };
      const extractedText = typeof page.text === 'string' ? page.text.trim() : '';
      pageText.textContent = `${book.title}. Halaman ${requestedPage + 1} dari ${book.pageCount}. ${extractedText
        || 'PDF-nya bisa kamu unduh.'}`;
      stage.scrollTop = 0;
      stage.scrollLeft = 0;
      setStatus('idle');
      updateControls();
      turnPage(direction, false, motionToken);
    } catch {
      if (token !== generation || selectedBook !== bookId) return;
      failure = 'page';
      setStatus('error', `Halaman ${requestedPage + 1} belum bisa dibuka. Coba lagi, atau unduh PDF-nya.`);
      updateControls();
    }
  }

  function activate() {
    if (activated) return;
    activated = true;
    nearObserver?.disconnect();
    visibleObserver?.disconnect();
    if (books) {
      updateControls();
      requestPage(targetPage);
    } else if (manifestState === 'error') {
      ensureManifest();
    } else {
      setStatus('loading', 'Bukunya lagi dibuka...');
      ensureManifest();
    }
  }

  function selectBook(id) {
    if (!fallbackBooks.has(id)) return;
    const changed = selectedBook !== id;
    selectedBook = id;
    targetPage = 0;
    ++generation;
    cancelTurn();
    setZoom(false);
    if (changed) {
      displayedPage = null;
      sheet.hidden = true;
      reader.classList.remove('has-page');
      pageText.textContent = '';
    }
    failure = null;
    updateBook();
    if (!activated) activate();
    else if (books) requestPage(0);
    else {
      setStatus('loading', 'Bukunya lagi dibuka...');
      ensureManifest();
    }
  }

  function restoreReader() {
    if (reader.parentElement !== slot) slot.appendChild(reader);
    reader.classList.remove('is-expanded');
    setZoom(false);
    cancelTurn();
    const focus = returnFocus?.isConnected ? returnFocus : expand;
    returnFocus = null;
    focus?.focus({ preventScroll: true });
  }

  choices.forEach((button) => button.addEventListener('click', () => selectBook(button.dataset.book)));
  previous.addEventListener('click', () => requestPage(targetPage - 1));
  next.addEventListener('click', () => requestPage(targetPage + 1));
  pageSelect.addEventListener('change', () => {
    const page = Number(pageSelect.value);
    if (Number.isInteger(page)) requestPage(page - 1);
  });
  retry.addEventListener('click', () => {
    if (failure === 'manifest' || !books) {
      activated = true;
      ensureManifest();
    } else {
      requestPage(targetPage);
    }
  });
  zoom.addEventListener('click', () => {
    if (!zoom.disabled) setZoom(!reader.classList.contains('is-zoomed'));
  });
  expand.addEventListener('click', () => {
    if (expand.disabled || dialog.open) return;
    returnFocus = document.activeElement;
    cancelTurn();
    dialogMount.appendChild(reader);
    reader.classList.add('is-expanded');
    try {
      dialog.showModal();
      resetWheel();
      updateHelp();
    } catch {
      restoreReader();
    }
  });
  close?.addEventListener('click', () => dialog?.close());
  dialog?.addEventListener('close', restoreReader);
  dialog?.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right
      || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });

  reader.addEventListener('focusin', activate);
  reader.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.target.isContentEditable
      || event.target.closest('select, input, textarea')) return;
    const book = books?.get(selectedBook);
    if (!book) return;
    let page;
    if (event.key === 'ArrowRight') page = targetPage + 1;
    else if (event.key === 'ArrowLeft') page = targetPage - 1;
    else if (event.key === 'Home') page = 0;
    else if (event.key === 'End') page = book.pageCount - 1;
    if (page === undefined) return;
    event.preventDefault();
    requestPage(page);
  });

  stage.addEventListener('wheel', (event) => {
    const book = books?.get(selectedBook);
    if (!dialog?.open || reader.classList.contains('is-zoomed') || event.ctrlKey || !book || !activated) return;
    let delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (!Number.isFinite(delta) || delta === 0) return;
    if (event.deltaMode === 1) delta *= 16;
    else if (event.deltaMode === 2) delta *= stage.clientHeight || window.innerHeight;
    const direction = Math.sign(delta);
    const page = targetPage + direction;
    if (page < 0 || page >= book.pageCount) {
      wheelDelta = 0;
      wheelDirection = 0;
      return;
    }
    const now = Date.now();
    if (now - wheelLastAt > 180) {
      wheelDelta = 0;
      wheelHandled = false;
    }
    wheelLastAt = now;
    event.preventDefault();
    if (wheelHandled || now < wheelCooldownUntil) return;
    if (direction !== wheelDirection) wheelDelta = 0;
    wheelDirection = direction;
    wheelDelta += Math.abs(delta);
    if (wheelDelta >= 75) {
      wheelDelta = 0;
      wheelHandled = true;
      wheelCooldownUntil = now + 420;
      requestPage(page);
    }
  }, { passive: false });

  stage.addEventListener('touchstart', (event) => {
    touchStart = event.touches.length === 1 && !reader.classList.contains('is-zoomed')
      ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
  }, { passive: true });
  stage.addEventListener('touchmove', (event) => {
    if (!touchStart) return;
    const touch = event.touches[0];
    if (event.touches.length !== 1 || Math.abs(touch.clientY - touchStart.y) > 35) touchStart = null;
  }, { passive: true });
  stage.addEventListener('touchend', (event) => {
    if (!touchStart || !event.changedTouches.length) return;
    const touch = event.changedTouches[0];
    const x = touch.clientX - touchStart.x;
    const y = touch.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(x) >= 60 && Math.abs(x) > Math.abs(y) * 1.8 && !reader.classList.contains('is-zoomed')) {
      requestPage(targetPage + (x < 0 ? 1 : -1));
    }
  }, { passive: true });
  stage.addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });

  const motionChange = () => { if (reducedMotion.matches) cancelTurn(); };
  if (typeof reducedMotion.addEventListener === 'function') reducedMotion.addEventListener('change', motionChange);
  else reducedMotion.addListener(motionChange);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelTurn(); });

  sheet.hidden = true;
  pageImage.hidden = true;
  retry.textContent = 'Coba lagi';
  pageLabel.setAttribute('aria-live', 'polite');
  pageLabel.setAttribute('aria-atomic', 'true');
  setZoom(false);
  setStatus('idle');
  updateBook();
  if ('IntersectionObserver' in window) {
    nearObserver = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      nearObserver.disconnect();
      ensureManifest();
    }, { rootMargin: '240px 0px', threshold: 0 });
    visibleObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) activate();
    }, { threshold: 0 });
    nearObserver.observe(booklet);
    visibleObserver.observe(stage);
  } else {
    function checkVisibility() {
      const rect = booklet.getBoundingClientRect();
      if (rect.top <= window.innerHeight + 240 && rect.bottom >= -240) ensureManifest();
      const stageRect = stage.getBoundingClientRect();
      if (stageRect.top <= window.innerHeight && stageRect.bottom >= 0) {
        activate();
        window.removeEventListener('scroll', checkVisibility);
        window.removeEventListener('resize', checkVisibility);
      }
    }
    window.addEventListener('scroll', checkVisibility, { passive: true });
    window.addEventListener('resize', checkVisibility, { passive: true });
    checkVisibility();
  }
})();
