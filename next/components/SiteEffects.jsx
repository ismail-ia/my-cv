'use client';

import { useEffect, useRef, useCallback } from 'react';

/**
 * SiteEffects - Client component that handles all global DOM behaviours
 * previously in site.js. Renders nothing visible; just runs effects.
 *
 * Behaviours ported:
 * 1. Nav hairline (is-stuck) via IntersectionObserver on a sentinel
 * 2. Entrance sequence (is-ready on body + .hero)
 * 3. Stagger delays (--rv-delay on [data-stagger] children)
 * 4. Reveal on scroll (.is-in on .rv elements)
 * 5. Metric counter animation ([data-count] elements)
 * 6. Headline optical rhythm tuning (.ln elements in .hero h1)
 * 7. Hero video lazy load with dwell requirement
 */
export default function SiteEffects() {
  const cleanupRef = useRef([]);

  const addCleanup = useCallback((fn) => {
    cleanupRef.current.push(fn);
  }, []);

  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => [...r.querySelectorAll(s)];

    /* ------------------------------------------------------------------ *
     * 1. Nav hairline: appears once the page has scrolled
     * ------------------------------------------------------------------ */
    const nav = $('#nav');
    if (nav) {
      const sentinel = document.createElement('div');
      sentinel.style.cssText = 'position:absolute;top:0;height:1px;width:1px';
      document.body.prepend(sentinel);
      const navObs = new IntersectionObserver(
        ([e]) => nav.classList.toggle('is-stuck', !e.isIntersecting)
      );
      navObs.observe(sentinel);
      addCleanup(() => {
        navObs.disconnect();
        sentinel.remove();
      });
    }

    /* ------------------------------------------------------------------ *
     * 2. Entrance sequence: body.is-ready + .hero.is-ready
     * ------------------------------------------------------------------ */
    const hero = $('.hero');
    const ready = () => {
      document.body.classList.add('is-ready');
      hero?.classList.add('is-ready');
    };
    if (reduced.matches) {
      ready();
    } else if (document.readyState === 'complete') {
      requestAnimationFrame(ready);
    } else {
      const onLoad = () => requestAnimationFrame(ready);
      addEventListener('load', onLoad, { once: true });
      addCleanup(() => removeEventListener('load', onLoad));
    }
    addCleanup(() => {
      document.body.classList.remove('is-ready');
      hero?.classList.remove('is-ready');
    });

    /* ------------------------------------------------------------------ *
     * 3. Stagger delays: set --rv-delay on children of [data-stagger]
     * ------------------------------------------------------------------ */
    $$('[data-stagger]').forEach((group) => {
      const step = +group.dataset.stagger || 80;
      $$(':scope > .rv', group).forEach((el, i) =>
        el.style.setProperty('--rv-delay', i * step + 'ms')
      );
    });

    /* ------------------------------------------------------------------ *
     * 4. Reveal on scroll: add .is-in when .rv enters viewport
     * ------------------------------------------------------------------ */
    const rvEls = $$('.rv');
    if (reduced.matches) {
      rvEls.forEach((el) => el.classList.add('is-in'));
    } else {
      const rvObs = new IntersectionObserver(
        (entries, obs) => {
          entries.forEach((e) => {
            if (!e.isIntersecting) return;
            e.target.classList.add('is-in');
            obs.unobserve(e.target);
            setTimeout(() => e.target.style.removeProperty('--rv-delay'), 1200);
          });
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.06 }
      );
      rvEls.forEach((el) => rvObs.observe(el));
      addCleanup(() => rvObs.disconnect());
    }

    /* ------------------------------------------------------------------ *
     * 5. Metric counters: animate [data-count] elements on scroll
     * ------------------------------------------------------------------ */
    const counters = $$('[data-count]');
    if (counters.length && !reduced.matches) {
      const fmt = (v, dec) => v.toFixed(dec);
      const countObs = new IntersectionObserver(
        (entries, obs) => {
          entries.forEach((e) => {
            if (!e.isIntersecting) return;
            const el = e.target;
            obs.unobserve(el);
            const end = parseFloat(el.dataset.count);
            const dec = (el.dataset.count.split('.')[1] || '').length;
            const pre = el.dataset.prefix || '';
            const suf = el.dataset.suffix || '';
            const t0 = performance.now(),
              dur = 900;
            const tick = (now) => {
              const p = Math.min((now - t0) / dur, 1);
              const eased = 1 - Math.pow(1 - p, 3);
              el.textContent = pre + fmt(end * eased, dec) + suf;
              if (p < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          });
        },
        { threshold: 0.5 }
      );
      counters.forEach((c) => countObs.observe(c));
      addCleanup(() => countObs.disconnect());
    }

    /* ------------------------------------------------------------------ *
     * 6. Headline optical rhythm: equalise visual white-space between lines
     * ------------------------------------------------------------------ */
    const tuneHeadline = () => {
      const h1 = $('.hero h1');
      if (!h1) return;
      const lns = $$('.ln', h1);
      if (lns.length < 2) return;
      const cs = getComputedStyle(h1);
      const fs = parseFloat(cs.fontSize),
        lh = parseFloat(cs.lineHeight);
      if (!fs || !lh) return;
      const cx = document.createElement('canvas').getContext('2d');
      cx.font = `${cs.fontWeight} ${fs}px ${cs.fontFamily}`;
      if ('letterSpacing' in cx) cx.letterSpacing = cs.letterSpacing;

      const m = lns.map((ln) => cx.measureText(ln.textContent.trim()));
      if (m.some((x) => !x.actualBoundingBoxAscent)) return;

      const gaps = m
        .slice(1)
        .map((mm, i) => lh - m[i].actualBoundingBoxDescent - mm.actualBoundingBoxAscent);
      const target = gaps.reduce((a, b) => a + b, 0) / gaps.length;

      lns.forEach((ln, i) => {
        if (!i) return;
        const delta = (target - gaps[i - 1]) / fs;
        ln.style.marginTop = `calc(-.08em + ${delta.toFixed(4)}em)`;
      });
    };

    if (document.fonts && document.fonts.ready) document.fonts.ready.then(tuneHeadline);
    else tuneHeadline();
    let tuneTimer;
    const onResize = () => {
      clearTimeout(tuneTimer);
      tuneTimer = setTimeout(tuneHeadline, 120);
    };
    addEventListener('resize', onResize);
    addCleanup(() => {
      removeEventListener('resize', onResize);
      clearTimeout(tuneTimer);
    });

    /* ------------------------------------------------------------------ *
     * 7. Hero video: lazy-load with dwell requirement
     * ------------------------------------------------------------------ */
    const vid = $('#heroVideo');
    if (vid) {
      let started = false;
      const startVideo = () => {
        if (started) return;
        started = true;
        for (const [type, key] of [
          ['video/webm', 'srcWebm'],
          ['video/mp4', 'srcMp4'],
        ]) {
          const src = vid.dataset[key];
          if (!src) continue;
          const s = document.createElement('source');
          s.src = src;
          s.type = type;
          vid.append(s);
        }
        vid.load();
        vid.play().catch(() => {});
      };

      if (!reduced.matches) {
        let dwell = null;
        const vidObs = new IntersectionObserver(
          ([e], obs) => {
            if (e.isIntersecting) {
              dwell = setTimeout(() => {
                obs.disconnect();
                startVideo();
              }, 400);
            } else {
              clearTimeout(dwell);
              dwell = null;
            }
          },
          { threshold: 0.25 }
        );
        const watch = () =>
          requestAnimationFrame(() => requestAnimationFrame(() => vidObs.observe(vid)));
        if (document.readyState === 'complete') watch();
        else addEventListener('load', watch, { once: true });
        addCleanup(() => {
          vidObs.disconnect();
          clearTimeout(dwell);
        });
      }
    }

    /* ------------------------------------------------------------------ *
     * Cleanup on unmount (HMR, navigation, etc.)
     * ------------------------------------------------------------------ */
    return () => {
      cleanupRef.current.forEach((fn) => fn());
      cleanupRef.current = [];
    };
  }, [addCleanup]);

  // This component renders nothing - it only runs effects
  return null;
}
