(() => {
  'use strict';

  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const nativeTimeline = window.CSS?.supports('animation-timeline: view()')
    && window.CSS.supports('animation-range: entry 0% exit 100%');
  const driftItems = new Map();
  const driftFrames = new Map();
  const changes = new Map();
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const tokenNames = { micro: 'micro', ui: 'ui', reveal: 'reveal', page: 'page', exit: 'exit' };
  const defaults = { micro: 160, ui: 280, reveal: 700, page: 600, exit: 170 };
  let driftFrame = 0;
  let tokens;

  root.classList.add('js');

  function readTokens() {
    const styles = window.getComputedStyle(root);
    const speed = clamp(parseFloat(styles.getPropertyValue('--speed') || styles.getPropertyValue('--motion-speed')) || 1, 0.2, 3);
    tokens = { easing: styles.getPropertyValue('--ease-out-expo').trim() || 'cubic-bezier(.16,1,.3,1)' };
    Object.entries(tokenNames).forEach(([name, token]) => {
      const raw = styles.getPropertyValue(`--motion-${token}`).trim();
      const milliseconds = parseFloat(raw) * (raw.endsWith('ms') ? 1 : 1000);
      tokens[name] = (Number.isFinite(milliseconds) ? milliseconds : defaults[name]) * speed;
    });
  }

  function duration(name = 'ui') {
    return tokens[name] ?? tokens.ui;
  }

  function animateChange(element) {
    if (!element || element.id === 'portfolio-grid') return;
    const targets = element.id === 'product-detail'
      ? [...element.querySelectorAll('.product-photo, .product-copy')]
      : [element];
    targets.forEach((target) => {
      changes.get(target)?.cancel();
      if (reducedMotion.matches || typeof target.animate !== 'function') return;
      const frames = target.classList.contains('product-copy')
        ? [{ opacity: 0.65 }, { opacity: 1 }]
        : [{ opacity: 0.65, transform: 'translate3d(0,6px,0)' }, { opacity: 1, transform: 'translate3d(0,0,0)' }];
      const animation = target.animate(frames, { duration: duration('ui'), easing: tokens.easing });
      changes.set(target, animation);
      const cleanup = () => {
        if (changes.get(target) === animation) changes.delete(target);
      };
      animation.onfinish = cleanup;
      animation.oncancel = cleanup;
    });
  }

  function updateDriftClasses(record) {
    const enabled = !reducedMotion.matches;
    record.element.classList.toggle('drift-ready', enabled);
    record.element.classList.toggle('drift-fallback', enabled && !nativeTimeline);
    record.element.classList.toggle('drift-active', enabled && record.visible && !document.hidden);
    if (!enabled) record.element.style.removeProperty('--drift-y');
  }

  function updateDrift() {
    driftFrame = 0;
    if (reducedMotion.matches || document.hidden || nativeTimeline) return;
    const height = window.innerHeight;
    const updates = [...driftItems.values()].filter((record) => record.visible && record.element.isConnected).map((record) => {
      const rect = record.frame.getBoundingClientRect();
      const progress = clamp((height - rect.top) / (height + rect.height), 0, 1);
      return { element: record.element, offset: (1 - progress * 2) * record.amount };
    });
    updates.forEach(({ element, offset }) => element.style.setProperty('--drift-y', `${offset.toFixed(2)}px`));
  }

  function scheduleDrift() {
    if (!driftFrame && !nativeTimeline && !reducedMotion.matches && !document.hidden
      && [...driftItems.values()].some((record) => record.visible)) {
      driftFrame = window.requestAnimationFrame(updateDrift);
    }
  }

  const driftObserver = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      driftFrames.get(entry.target)?.forEach((element) => {
        const record = driftItems.get(element);
        if (!record) return;
        record.visible = entry.isIntersecting;
        updateDriftClasses(record);
      });
    });
    scheduleDrift();
  }, { rootMargin: '120px', threshold: 0 }) : null;

  function unregisterDrift(scope) {
    [...driftItems.values()].forEach((record) => {
      if (record.element !== scope && !scope.contains(record.element)) return;
      record.element.classList.remove('drift-ready', 'drift-fallback', 'drift-active');
      record.element.style.removeProperty('--drift-y');
      driftItems.delete(record.element);
      const elements = driftFrames.get(record.frame);
      elements?.delete(record.element);
      if (elements?.size) return;
      driftObserver?.unobserve(record.frame);
      driftFrames.delete(record.frame);
    });
  }

  function registerDrift(scope = document) {
    [...driftItems.keys()].filter((element) => !element.isConnected).forEach(unregisterDrift);
    const elements = [...(scope.matches?.('[data-drift]') ? [scope] : []), ...scope.querySelectorAll('[data-drift]')];
    elements.forEach((element) => {
      if (driftItems.has(element) || driftItems.size >= 4) return;
      const frame = element.closest('[data-drift-frame]') || element.parentElement;
      if (!frame) return;
      const amount = clamp(parseFloat(element.dataset.drift) || 8, -12, 12);
      const record = { element, frame, amount, visible: !driftObserver };
      driftItems.set(element, record);
      if (!driftFrames.has(frame)) {
        driftFrames.set(frame, new Set());
        driftObserver?.observe(frame);
      }
      driftFrames.get(frame).add(element);
      updateDriftClasses(record);
    });
    scheduleDrift();
  }

  window.addEventListener('scroll', scheduleDrift, { passive: true });
  window.addEventListener('resize', scheduleDrift, { passive: true });
  window.addEventListener('pageshow', scheduleDrift);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && driftFrame) {
      window.cancelAnimationFrame(driftFrame);
      driftFrame = 0;
    }
    driftItems.forEach(updateDriftClasses);
    scheduleDrift();
  });
  reducedMotion.addEventListener('change', () => {
    if (driftFrame) window.cancelAnimationFrame(driftFrame);
    driftFrame = 0;
    if (reducedMotion.matches) {
      changes.forEach((animation) => animation.cancel());
      changes.clear();
    }
    readTokens();
    driftItems.forEach(updateDriftClasses);
    scheduleDrift();
  });

  readTokens();
  window.TelepathyMotion = Object.freeze({ duration, animateChange, registerDrift, unregisterDrift });
  registerDrift();
})();
