/* =============================================================================
   ISMAIL IBRAHIM - SITE BEHAVIOUR
   Everything degrades: with JS off the page is fully readable and navigable.
   ========================================================================== */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---- nav: hairline appears once the page has moved ---------------------- */
  const nav = $('#nav');
  if (nav) {
    const sentinel = document.createElement('div');
    sentinel.style.cssText = 'position:absolute;top:0;height:1px;width:1px';
    document.body.prepend(sentinel);
    new IntersectionObserver(
      ([e]) => nav.classList.toggle('is-stuck', !e.isIntersecting)
    ).observe(sentinel);
  }

  /* ---- mobile menu: close first, then navigate ----------------------------
     Bootstrap's data-bs-dismiss handler calls preventDefault() on anchors, so
     the hash never applies; and the body is still scroll-locked while the panel
     animates out, which swallows the jump. Own both steps instead. */
  const menu = $('#menu');
  if (menu && window.bootstrap) {
    menu.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      e.preventDefault();
      const target = $(a.getAttribute('href'));
      menu.addEventListener('hidden.bs.offcanvas', () => {
        if (!target) return;
        target.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });   // land keyboard focus in the section
      }, { once: true });
      bootstrap.Offcanvas.getOrCreateInstance(menu).hide();
    });
  }

  /* ---- current section in the nav ---------------------------------------- */
  const links = $$('.nav-b__links a[href^="#"]');
  const targets = links.map(a => $(a.getAttribute('href'))).filter(Boolean);
  if (targets.length) {
    const seen = new Set();
    const spy = new IntersectionObserver(entries => {
      entries.forEach(e => e.isIntersecting ? seen.add(e.target.id) : seen.delete(e.target.id));
      const first = targets.find(t => seen.has(t.id));
      links.forEach(a => a.setAttribute('aria-current',
        first && a.getAttribute('href') === '#' + first.id ? 'true' : 'false'));
    }, { rootMargin: '-45% 0px -50% 0px' });
    targets.forEach(t => spy.observe(t));
  }

  /* ---- optical line rhythm -------------------------------------------------
     Equal line-height does NOT produce equal white space. "I make" ends on the
     baseline and "systems" starts at x-height, so that gap yawns open; then the
     y of "systems" drops toward the ascenders of "hold." and that gap closes to
     almost nothing. Measured on the hero: 31px against 4px.
     Measure each line's real ink extents and redistribute the advances so the
     white gaps match, keeping the block's total height unchanged. */
  const tuneHeadline = () => {
    const h1 = $('.hero h1');
    if (!h1) return;
    const lns = $$('.ln', h1);
    if (lns.length < 2) return;
    const cs = getComputedStyle(h1);
    const fs = parseFloat(cs.fontSize), lh = parseFloat(cs.lineHeight);
    if (!fs || !lh) return;
    const cx = document.createElement('canvas').getContext('2d');
    cx.font = `${cs.fontWeight} ${fs}px ${cs.fontFamily}`;
    if ('letterSpacing' in cx) cx.letterSpacing = cs.letterSpacing;

    const m = lns.map(ln => cx.measureText(ln.textContent.trim()));
    if (m.some(x => !x.actualBoundingBoxAscent)) return;   // metrics unavailable

    // white space each gap would have if every advance were exactly line-height
    const gaps = m.slice(1).map((mm, i) =>
      lh - m[i].actualBoundingBoxDescent - mm.actualBoundingBoxAscent);
    const target = gaps.reduce((a, b) => a + b, 0) / gaps.length;

    lns.forEach((ln, i) => {
      if (!i) return;
      const delta = (target - gaps[i - 1]) / fs;           // em to add to this advance
      ln.style.marginTop = `calc(-.08em + ${delta.toFixed(4)}em)`;
    });
  };

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(tuneHeadline);
  else tuneHeadline();
  let tuneTimer;
  addEventListener('resize', () => {
    clearTimeout(tuneTimer);
    tuneTimer = setTimeout(tuneHeadline, 120);            // font-size is fluid
  });

  /* ---- entrance sequence ---------------------------------------------------
     One orchestrated moment on load: nav settles, eyebrow, then the headline
     lines unmask, then the supporting copy. Delays live in CSS as --d so the
     choreography is readable in one place. */
  const hero = $('.hero');
  const ready = () => {
    document.body.classList.add('is-ready');
    hero?.classList.add('is-ready');
  };
  if (reduced.matches) ready();
  else if (document.readyState === 'complete') requestAnimationFrame(ready);
  else addEventListener('load', () => requestAnimationFrame(ready), { once: true });

  /* ---- stagger: siblings that enter together should not land together ----- */
  $$('[data-stagger]').forEach(group => {
    const step = +group.dataset.stagger || 80;
    $$(':scope > .rv', group).forEach((el, i) =>
      el.style.setProperty('--rv-delay', (i * step) + 'ms'));
  });

  /* ---- reveal on scroll --------------------------------------------------- */
  const rv = $$('.rv');
  if (reduced.matches) {
    rv.forEach(el => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        obs.unobserve(e.target);
        // the delay has done its job; leaving it would lag later transitions
        setTimeout(() => e.target.style.removeProperty('--rv-delay'), 1200);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    rv.forEach(el => io.observe(el));
  }

  /* ---- metric counters ----------------------------------------------------
     The final value is already in the DOM, so assistive tech and no-JS both
     read the real number. The animation only ever replaces it temporarily. */
  const counters = $$('[data-count]');
  if (counters.length && !reduced.matches) {
    const fmt = (v, dec) => v.toFixed(dec);
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const el = e.target;
        obs.unobserve(el);
        const end = parseFloat(el.dataset.count);
        const dec = (el.dataset.count.split('.')[1] || '').length;
        const pre = el.dataset.prefix || '';
        const suf = el.dataset.suffix || '';
        const t0 = performance.now(), dur = 900;
        const tick = now => {
          const p = Math.min((now - t0) / dur, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = pre + fmt(end * eased, dec) + suf;
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.5 });
    counters.forEach(c => io.observe(c));
  }

  /* ---- hero video: fetch nothing until it is on screen, then play once ----
     preload="none" + sources injected on first intersection, so the 960KB is
     never fetched for a visitor who does not scroll to it. It plays a single
     pass and rests on its final frame; the poster is frame 0 of the same clip,
     so there is no jump at either end. */
  const vid = $('#heroVideo');
  if (vid) {
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      for (const [type, key] of [['video/webm', 'srcWebm'], ['video/mp4', 'srcMp4']]) {
        const src = vid.dataset[key];
        if (!src) continue;
        const s = document.createElement('source');
        s.src = src; s.type = type;
        vid.append(s);
      }
      vid.load();
      vid.play().catch(() => {});   // poster stays if autoplay is refused
    };
    if (reduced.matches) {
      // Reduced motion keeps the still. Nothing is downloaded at all.
    } else {
      /* Dwell requirement: the hero has to actually settle in view, not merely
         sweep past. That covers a deep link to #contact (which scrolls the hero
         through the viewport on the way) and a fast flick to the footer. */
      let dwell = null;
      const io = new IntersectionObserver(([e], obs) => {
        if (e.isIntersecting) {
          dwell = setTimeout(() => { obs.disconnect(); start(); }, 400);
        } else {
          clearTimeout(dwell); dwell = null;
        }
      }, { threshold: 0.25 });
      /* Observe only after the browser has applied any #hash jump. Observing
         during parse fires against the pre-jump layout, so a deep link straight
         to #contact would still pull the video down. */
      const watch = () => requestAnimationFrame(() => requestAnimationFrame(() => io.observe(vid)));
      if (document.readyState === 'complete') watch();
      else addEventListener('load', watch, { once: true });
    }
  }

  /* CHAT logic is handled by React client component (AskChatbox.jsx) */
})();
