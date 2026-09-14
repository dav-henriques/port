(() => {
  'use strict';

  const SCATTER = {
    scrollStart: 0,
    scrollEnd: 1,
    curve: 1.5,
    smoothing: 0.16,
    originX: 0.5,
    originY: 0.5,
    distance: 0.6,
    stagger: 0.18,
    spread: 0.44,
    spin: 44,
    tilt: 27,
    sway: 30,
    gravity: 0.2,
    depthScale: 3.32,
    fadeStart: 0.74,
    fadeTo: 0.56,
    blur: 2.4
  };

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fine    = window.matchMedia('(hover: hover) and (pointer: fine)');
  const stacked = window.matchMedia('(max-width: 980px)');

  const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
  const lerp  = (a, b, t) => a + (b - a) * t;
  const rand  = (n) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const knob = (el, name, fallback) => {
    const raw = el.style.getPropertyValue(name);
    if (raw === '') return fallback;
    const v = parseFloat(raw);
    return Number.isFinite(v) ? v : fallback;
  };

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

  function initMotion() {
    if (reduced.matches) return;

    const items = [...document.querySelectorAll('.piece')].map((el, i) => ({
      el, i,
      depth: parseFloat(el.style.getPropertyValue('--depth')) || 0.5,
      ux: 0, uy: 0, w: 0, h: 0, spin: 0,
      px: 0, py: 0, tx: 0, ty: 0
    }));
    if (!items.length) return;

    let pointerX = 0, pointerY = 0;
    let eased = 0;
    let speed = 0;
    let running = false;
    let idle = 0;

    const usePointer = () => fine.matches && !stacked.matches;
    const useScroll  = () => !stacked.matches;

    const progress = () => {
      if (!useScroll()) return 0;
      const room = document.documentElement.scrollHeight - window.innerHeight;
      const raw = window.scrollY / Math.max(room, 1);
      const span = Math.max(SCATTER.scrollEnd - SCATTER.scrollStart, 0.001);
      return clamp((raw - SCATTER.scrollStart) / span, 0, 1);
    };

    const reset = (it) => {
      it.el.style.setProperty('--dx', '0px');
      it.el.style.setProperty('--dy', '0px');
      it.el.style.setProperty('--drot', '0deg');
      it.el.style.setProperty('--drx', '0deg');
      it.el.style.setProperty('--dry', '0deg');
      it.el.style.setProperty('--dscale', '1');
      it.el.style.setProperty('--dop', '1');
      if (it.blurred) { it.el.style.filter = ''; it.blurred = false; }
    };

    const measure = () => {
      for (const it of items) reset(it);

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const ox = vw * SCATTER.originX;
      const oy = vh * SCATTER.originY;

      for (const it of items) {
        const r = it.el.getBoundingClientRect();
        const cx = r.left + r.width * 0.5 - ox;
        const cy = r.top + r.height * 0.5 - oy;
        const len = Math.hypot(cx, cy);

        it.w = r.width;
        it.h = r.height;

        const r1 = rand(it.i + 1);
        const r2 = rand(it.i + 9);
        const r3 = rand(it.i + 17);
        const r4 = rand(it.i + 25);

        const base = len > 16
          ? Math.atan2(cy, cx)
          : (it.i % 2 ? -1.25 : 1.9);

        const angle = base + (r1 - 0.5) * SCATTER.spread;

        it.ux = Math.cos(angle);
        it.uy = Math.sin(angle);

        it.grow = knob(it.el, '--to-scale', 1 + (it.depth - 0.62) * SCATTER.depthScale) - 1;

        const far   = knob(it.el, '--to-far', 1);
        const reach = (0.84 + it.depth * 0.24 + r2 * 0.18) * far;
        const bulk  = Math.max(1, 1 + it.grow);

        it.gx = it.ux * (vw * SCATTER.distance + it.w * bulk) * reach;
        it.gy = it.uy * (vh * SCATTER.distance + it.h * bulk) * reach;

        const toX = knob(it.el, '--to-x', null);
        const toY = knob(it.el, '--to-y', null);

        it.anchored = toX !== null || toY !== null;

        if (it.anchored) {
          const box = it.el.offsetParent || it.el.parentElement;
          const sw = box ? box.clientWidth : vw;
          const sh = box ? box.clientHeight : vh;
          if (toX !== null) it.gx = (toX - knob(it.el, '--x', 50)) * 0.01 * sw;
          if (toY !== null) it.gy = (toY - knob(it.el, '--y', 50)) * 0.01 * sh;
        }

        it.lag   = knob(it.el, '--to-delay',
                        clamp((it.depth * 0.44 + r3 * 0.56) * SCATTER.stagger, 0, 0.5));
        it.spin  = knob(it.el, '--to-rot',
                        it.ux * SCATTER.spin * 0.55 + (r1 - 0.5) * SCATTER.spin);
        it.dim   = 1 - knob(it.el, '--to-op', SCATTER.fadeTo);
        it.tiltY = it.ux * -SCATTER.tilt + (r2 - 0.5) * SCATTER.tilt * 0.65;
        it.tiltX = it.uy * SCATTER.tilt * 0.76 + (r3 - 0.5) * SCATTER.tilt * 0.53;
        it.sway  = SCATTER.sway * (0.43 + r4 * 0.9) * (1.3 - it.depth * 0.55);
        it.wave  = 1.15 + r2 * 1.5;
        it.phase = r3 * 6.2832;
        it.fall  = (it.depth - 0.55) * 0.45 + (r4 - 0.5) * 0.34;
      }
    };

    const render = () => {
      const vh = window.innerHeight;
      const hold = 1 - eased;
      const rush = clamp(speed * 150, 0, SCATTER.blur);
      const tail = Math.max(1 - SCATTER.fadeStart, 0.001);

      for (const it of items) {
        const local = clamp((eased - it.lag) / (1 - it.lag), 0, 1);
        const e = Math.pow(local, SCATTER.curve);
        const wob = it.anchored ? Math.sin(Math.PI * local) : 1;
        const arc = Math.sin(it.phase + local * it.wave * 6.2832) * it.sway * e * wob;
        const fade = 1 - clamp((local - SCATTER.fadeStart) / tail, 0, 1) * it.dim;

        const dx = it.gx * e - it.uy * arc;
        const dy = it.gy * e + it.ux * arc + it.fall * vh * SCATTER.gravity * e * e * wob;

        it.el.style.setProperty('--dx', dx.toFixed(1) + 'px');
        it.el.style.setProperty('--dy', dy.toFixed(1) + 'px');
        it.el.style.setProperty('--drot', (it.spin * e).toFixed(2) + 'deg');
        it.el.style.setProperty('--drx', (it.tiltX * e).toFixed(2) + 'deg');
        it.el.style.setProperty('--dry', (it.tiltY * e).toFixed(2) + 'deg');
        it.el.style.setProperty('--dscale', (1 + it.grow * e).toFixed(4));
        it.el.style.setProperty('--dop', fade.toFixed(3));
        it.el.style.setProperty('--px', (it.px * hold).toFixed(2) + 'px');
        it.el.style.setProperty('--py', (it.py * hold).toFixed(2) + 'px');

        const blur = rush * Math.min(1, e * 2.4);
        if (blur > 0.08) {
          it.el.style.filter = 'blur(' + blur.toFixed(2) + 'px)';
          it.blurred = true;
        } else if (it.blurred) {
          it.el.style.filter = '';
          it.blurred = false;
        }
      }
    };

    const tick = () => {
      const target = progress();
      const before = eased;

      eased += (target - eased) * clamp(SCATTER.smoothing, 0.02, 1);
      if (Math.abs(target - eased) < 0.0006) eased = target;
      speed = lerp(speed, Math.abs(eased - before), 0.35);

      let moved = eased !== target || speed > 0.0004;

      if (usePointer()) {
        for (const it of items) {
          const drag = it.depth * 14;
          it.tx = clamp(pointerX * drag, -26, 26);
          it.ty = clamp(pointerY * drag * 0.7, -22, 22);
          it.px = lerp(it.px, it.tx, 0.085);
          it.py = lerp(it.py, it.ty, 0.085);
          if (Math.abs(it.px - it.tx) > 0.05 || Math.abs(it.py - it.ty) > 0.05) moved = true;
        }
      }

      render();

      idle = moved ? 0 : idle + 1;
      if (idle > 20) { running = false; return; }
      requestAnimationFrame(tick);
    };

    const wake = () => {
      idle = 0;
      if (!running) { running = true; requestAnimationFrame(tick); }
    };

    const remeasure = () => { measure(); wake(); };

    window.addEventListener('scroll', wake, { passive: true });
    window.addEventListener('resize', remeasure, { passive: true });
    window.addEventListener('orientationchange', remeasure, { passive: true });
    window.addEventListener('load', remeasure, { once: true });
    window.addEventListener('pointermove', (e) => {
      pointerX = (e.clientX / window.innerWidth  - 0.5) * 2;
      pointerY = (e.clientY / window.innerHeight - 0.5) * 2;
      wake();
    }, { passive: true });

    measure();
    eased = progress();
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
    initMotion();
    initMat();
    initCursor();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
