(() => {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fine    = window.matchMedia('(hover: hover) and (pointer: fine)');
  const stacked = window.matchMedia('(max-width: 980px)');

  const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
  const lerp  = (a, b, t) => a + (b - a) * t;

  function initReveal() {
    const pieces = document.querySelectorAll('.piece');

    if (!('IntersectionObserver' in window) || reduced.matches) {
      pieces.forEach(p => p.classList.add('is-in'));
      return;
    }

    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

    pieces.forEach(p => io.observe(p));
  }

  function initParallax() {
    if (reduced.matches) return;

    const pieces = [...document.querySelectorAll('.piece')].map(el => ({
      el,
      depth: parseFloat(el.style.getPropertyValue('--depth')) || 0.5,
      stage: el.closest('.stage'),
      px: 0, py: 0, tx: 0, ty: 0
    }));
    if (!pieces.length) return;

    let pointerX = 0, pointerY = 0;
    let scrollY  = window.scrollY;
    let running  = false;
    let idle     = 0;

    const onPointer = (e) => {
      pointerX = (e.clientX / window.innerWidth  - 0.5) * 2;
      pointerY = (e.clientY / window.innerHeight - 0.5) * 2;
      wake();
    };
    const onScroll = () => { scrollY = window.scrollY; wake(); };

    function wake() {
      idle = 0;
      if (!running) { running = true; requestAnimationFrame(tick); }
    }

    function tick() {
      let moved = false;

      for (const p of pieces) {

        const rect = p.stage.getBoundingClientRect();
        const near = rect.bottom > -200 && rect.top < window.innerHeight + 200;
        if (!near) continue;

        const drag  = p.depth * 14;
        const glide = p.depth * (scrollY - (p.stage.offsetTop || 0)) * 0.018;

        p.tx = clamp(pointerX * drag, -26, 26);
        p.ty = clamp(pointerY * drag * 0.7 + clamp(glide, -70, 70), -80, 80);

        p.px = lerp(p.px, p.tx, 0.085);
        p.py = lerp(p.py, p.ty, 0.085);

        if (Math.abs(p.px - p.tx) > 0.05 || Math.abs(p.py - p.ty) > 0.05) moved = true;

        p.el.style.setProperty('--px', p.px.toFixed(2) + 'px');
        p.el.style.setProperty('--py', p.py.toFixed(2) + 'px');
      }

      idle = moved ? 0 : idle + 1;
      if (idle > 30) { running = false; return; }
      requestAnimationFrame(tick);
    }

    if (fine.matches) window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', wake, { passive: true });
    wake();
  }

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

    const hot = 'a, button, .piece--card, .watch__scroll';
    document.addEventListener('pointerover', (e) => {
      if (e.target.closest(hot)) cursor.classList.add('is-pointing');
    });
    document.addEventListener('pointerout', (e) => {
      if (e.target.closest(hot)) cursor.classList.remove('is-pointing');
    });
    document.addEventListener('pointerdown', () => cursor.classList.add('is-pointing'));
    document.addEventListener('pointerup',   () => cursor.classList.remove('is-pointing'));
  }

  function initMat() {
    const mat = document.querySelector('.mat');
    if (!mat) return;

    numberRulers(mat);
    if (reduced.matches || !fine.matches) return;

    const surface = mat.querySelector('.mat__surface');
    if (!surface) return;

    let x = innerWidth / 2, y = innerHeight * 0.42;
    let cx = x, cy = y;
    let raf = 0;
    let primed = false;

    const draw = () => {
      cx = lerp(cx, x, 0.08);
      cy = lerp(cy, y, 0.08);

      surface.style.setProperty('--sx', ((0.5 - cx / innerWidth) * 12).toFixed(1) + 'px');
      surface.style.setProperty('--sy', ((0.5 - cy / innerHeight) * 8).toFixed(1) + 'px');

      raf = (Math.abs(cx - x) > 0.3 || Math.abs(cy - y) > 0.3)
        ? requestAnimationFrame(draw) : 0;
    };

    window.addEventListener('pointermove', (e) => {
      x = e.clientX;
      y = e.clientY;
      if (!primed) { cx = x; cy = y; primed = true; }
      if (!raf) raf = requestAnimationFrame(draw);
    }, { passive: true });
  }

  function numberRulers(mat) {
    const css = getComputedStyle(document.documentElement);
    const step = parseFloat(css.getPropertyValue('--major')) || 140;
    const unit = parseFloat(css.getPropertyValue('--minor')) || 28;
    const per  = Math.round(step / unit) || 5;

    const fill = (sel, extent, axis) => {
      const ruler = mat.querySelector(sel);
      if (!ruler) return;
      const frag = document.createDocumentFragment();
      for (let i = 1; i * step < extent; i++) {
        const tag = document.createElement('span');
        tag.className = 'mat__num';
        tag.textContent = String(i * per);
        tag.style[axis] = (i * step) + 'px';
        frag.appendChild(tag);
      }
      ruler.appendChild(frag);
    };

    const w = Math.max(screen.width || 0, innerWidth) + step;
    const h = Math.max(screen.height || 0, innerHeight) + step;
    fill('.mat__ruler--top', w, 'left');
    fill('.mat__ruler--left', h, 'top');
  }

  function initCards() {
    const cards = document.querySelectorAll('.piece--card:not(.piece--contact)');

    cards.forEach((card) => {
      const toggle = card.querySelector('.card__toggle');
      if (!toggle) return;

      const set = (open) => {
        card.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', String(open));
      };

      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        set(!card.classList.contains('is-open'));
      });

      card.addEventListener('click', (e) => {
        if (e.target.closest('a, button')) return;
        set(!card.classList.contains('is-open'));
      });
    });
  }

  function initAnchors() {
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
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
    initReveal();
    initCards();
    initAnchors();
    initYear();
    initViewport();
    if (!stacked.matches) initParallax();
    initMat();
    initCursor();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
