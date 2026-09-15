'use client';

import { profile } from '@/lib/profile';

import { useEffect, useRef, useCallback } from 'react';

/**
 * Navigation - Client component.
 * Handles the Bootstrap offcanvas mobile menu close-then-navigate behaviour
 * and the scroll-spy for current section highlighting.
 */
export default function Navigation() {
  const menuRef = useRef(null);
  const navLinksRef = useRef(null);

  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const menu = menuRef.current;

    /* ---- mobile menu: close first, then navigate ----
       Bootstrap's data-bs-dismiss handler calls preventDefault() on anchors,
       so the hash never applies; and the body is still scroll-locked while the
       panel animates out, which swallows the jump. Own both steps instead. */
    const handleMenuClick = (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      e.preventDefault();
      const target = document.querySelector(a.getAttribute('href'));
      menu.addEventListener(
        'hidden.bs.offcanvas',
        () => {
          if (!target) return;
          target.scrollIntoView({
            behavior: reduced.matches ? 'auto' : 'smooth',
            block: 'start',
          });
          target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: true });
        },
        { once: true }
      );
      if (typeof window !== 'undefined' && window.bootstrap) {
        window.bootstrap.Offcanvas.getOrCreateInstance(menu).hide();
      }
    };

    if (menu) {
      menu.addEventListener('click', handleMenuClick);
    }

    /* ---- current section in the nav ---- */
    const allLinks = document.querySelectorAll('.nav-b__links a[href^="#"]');
    const links = [...allLinks];
    const targets = links
      .map((a) => document.querySelector(a.getAttribute('href')))
      .filter(Boolean);
    let spyObs;

    if (targets.length) {
      const seen = new Set();
      spyObs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) =>
            e.isIntersecting ? seen.add(e.target.id) : seen.delete(e.target.id)
          );
          const first = targets.find((t) => seen.has(t.id));
          links.forEach((a) =>
            a.setAttribute(
              'aria-current',
              first && a.getAttribute('href') === '#' + first.id ? 'true' : 'false'
            )
          );
        },
        { rootMargin: '-45% 0px -50% 0px' }
      );
      targets.forEach((t) => spyObs.observe(t));
    }

    return () => {
      if (menu) menu.removeEventListener('click', handleMenuClick);
      if (spyObs) spyObs.disconnect();
    };
  }, []);

  return (
    <>
      <header className="nav-b" id="nav">
        <div className="shell nav-b__in">
          <a className="lockup" href="#top" aria-label={`${profile.name}, home`}>
            <img src="/assets/logo/mark.svg" alt="" width="28" height="28" />
            <span>{profile.name}</span>
          </a>
          <nav className="nav-b__links" aria-label="Sections" ref={navLinksRef}>
            <a href="#ask">Ask</a>
            <a href="#approach">Approach</a>
            <a href="#work">Work</a>
            <a href="#ai">AI</a>
            <a href="#contact">Contact</a>
          </nav>
          <div className="nav-b__cta">
            <a className="btn-b btn-b--primary" href="#contact">
              Get in touch
            </a>
          </div>
          <button
            className="nav-b__toggle"
            type="button"
            data-bs-toggle="offcanvas"
            data-bs-target="#menu"
            aria-controls="menu"
            aria-label="Open menu"
          >
            <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true">
              <g fill="currentColor">
                <rect width="18" height="2" rx="1" />
                <rect y="5" width="18" height="2" rx="1" />
                <rect y="10" width="18" height="2" rx="1" />
              </g>
            </svg>
          </button>
        </div>
      </header>

      <div
        className="offcanvas offcanvas-end"
        tabIndex={-1}
        id="menu"
        aria-labelledby="menuTitle"
        ref={menuRef}
      >
        <div className="offcanvas-header">
          <h2
            className="offcanvas-title t-h2"
            id="menuTitle"
            style={{ fontSize: 'var(--t-h3)' }}
          >
            Menu
          </h2>
          <button
            type="button"
            className="btn-close"
            data-bs-dismiss="offcanvas"
            aria-label="Close"
          ></button>
        </div>
        <div className="offcanvas-body">
          <nav className="nav-b__links" aria-label="Sections">
            <a href="#ask">Ask the avatar</a>
            <a href="#approach">Approach</a>
            <a href="#work">Work</a>
            <a href="#ai">AI</a>
            <a href="#contact">Contact</a>
          </nav>
          <div className="offcanvas-cta">
            <a className="btn-b btn-b--primary" href="#contact">
              Get in touch
            </a>
            <a
              className="btn-b btn-b--ghost"
              href={profile.cvPath}
              download
            >
              Download CV
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
