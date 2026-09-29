(() => {
  'use strict';

  // o movimento do site (entrada, scroll, parallax, hover) vive em motion.js e journey.js, sobre GSAP

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fine    = window.matchMedia('(hover: hover) and (pointer: fine)');

  const lerp  = (a, b, t) => a + (b - a) * t;

  function initCursor() {
    if (!fine.matches || reduced.matches) return;

    const cursor = document.querySelector('.cursor');
    const ring   = cursor?.querySelector('.cursor__ring');
    const dot    = cursor?.querySelector('.cursor__dot');
    if (!ring || !dot) return;

    document.documentElement.classList.add('has-cursor');

    let x = innerWidth / 2, y = innerHeight / 2;
    let rx = x, ry = y;
    let raf = 0;

    const draw = () => {
      rx = lerp(rx, x, 0.18);
      ry = lerp(ry, y, 0.18);
      ring.style.setProperty('--rx', rx.toFixed(2) + 'px');
      ring.style.setProperty('--ry', ry.toFixed(2) + 'px');
      dot.style.setProperty('--dx', x.toFixed(2) + 'px');
      dot.style.setProperty('--dy', y.toFixed(2) + 'px');
      raf = (Math.abs(rx - x) > 0.1 || Math.abs(ry - y) > 0.1)
        ? requestAnimationFrame(draw) : 0;
    };

    window.addEventListener('pointermove', (e) => {
      x = e.clientX; y = e.clientY;
      if (!cursor.classList.contains('is-live')) {
        rx = x; ry = y;
        document.documentElement.classList.add('cursor-live');
        cursor.classList.add('is-live');
      }
      if (!raf) raf = requestAnimationFrame(draw);
    }, { passive: true });

    const hot = 'a, button, label, input, textarea, [data-go], [data-top], [data-modal]';
    document.addEventListener('pointerover', (e) => {
      if (e.target.closest(hot)) cursor.classList.add('is-pointing');
    });
    document.addEventListener('pointerout', (e) => {
      if (e.target.closest(hot)) cursor.classList.remove('is-pointing');
    });
    document.addEventListener('pointerdown', () => cursor.classList.add('is-pointing'));
    document.addEventListener('pointerup',   () => cursor.classList.remove('is-pointing'));
  }

  function initAnchors() {
    // links com data-go voam pela câmera do journey.js; aqui só os demais
    document.querySelectorAll('a[href^="#"]:not([data-go]):not([data-modal])').forEach((link) => {
      link.addEventListener('click', (e) => {
        const id = link.getAttribute('href');
        if (!id || id === '#') return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({
          behavior: reduced.matches ? 'auto' : 'smooth',
          block: 'start'
        });
        if (history.replaceState) history.replaceState(null, '', id);
      });
    });
  }

  function initYear() {
    const el = document.getElementById('year');
    if (el) el.textContent = String(new Date().getFullYear());
  }

  function initViewport() {
    const set = () => document.documentElement.style
      .setProperty('--vh', window.innerHeight * 0.01 + 'px');
    set();
    window.addEventListener('resize', set, { passive: true });
    window.addEventListener('orientationchange', set, { passive: true });
  }

  const boot = () => {
    initAnchors();
    initYear();
    initViewport();
    initCursor();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
