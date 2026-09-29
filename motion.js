/*
 * motion.js — o movimento do site, construído sobre GSAP + ScrollTrigger.
 *
 * Cenas, na ordem em que acontecem:
 *   intro    — a colagem é montada peça por peça, na ordem autoral de --in
 *   drift    — cada peça respira em ritmos que nunca se alinham
 *   scatter  — o scroll explode a colagem em direção à câmera (scrub)
 *   handoff  — a folha "sobre mim" sobe por cima; o hero recua e escurece (scrub)
 *
 * Daí em diante ("sobre mim", projetos e contato) quem conduz é o journey.js,
 * que reaproveita os eases e os efeitos registrados aqui.
 *
 * Cada camada de uma peça tem um único dono, para as animações nunca brigarem:
 *   .piece         → scatter  (x, y, rotation, rotationX/Y, scale, opacity)
 *   .piece__float  → drift    (xPercent, yPercent, rotation) + ponteiro (x, y)
 *   .piece__art    → intro e hover (autoAlpha, y, scale, rotation, rotationX/Y)
 */
(() => {
  'use strict';

  const root = document.documentElement;
  const release = () => root.classList.remove('motion-pending');

  const { gsap, ScrollTrigger, SplitText, CustomEase } = window;
  if (!gsap || !ScrollTrigger || !SplitText || !CustomEase) {
    release();
    return;
  }

  gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);
  ScrollTrigger.config({ ignoreMobileResize: true });

  // as curvas do style.css viram eases do GSAP: CSS e JS com a mesma assinatura
  CustomEase.create('settle', '.16,.84,.34,1'); // --ease-out
  CustomEase.create('soft', '.4,.05,.2,1');     // --ease-soft

  const MEDIA = {
    motion: '(prefers-reduced-motion: no-preference)',
    reduced: '(prefers-reduced-motion: reduce)',
    stacked: '(max-width: 980px)',
    fine: '(hover: hover) and (pointer: fine)'
  };

  const INTRO = {
    lead: 0.1,   // respiro antes da primeira peça
    spread: 1.6, // multiplica os --in do HTML para um ritmo mais cinematográfico
    wait: 900    // espera máxima (ms) pelas imagens do hero antes de começar
  };

  const SCATTER = {
    scrollEnd: 0.5,
    scrub: 1,
    originX: 0.5,
    originY: 0.5,
    distance: 0.6,
    stagger: 0.18,
    spread: 0.44,
    spin: 44,
    tilt: 27,
    gravity: 0.2,
    depthScale: 3.32,
    fadeStart: 0.74,
    fadeTo: 0.56
  };

  const clamp = gsap.utils.clamp;
  const curve = (k) => (t) => t ** k;
  const rand = (n) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const knob = (el, name, fallback) => {
    const v = parseFloat(el.style.getPropertyValue(name));
    return Number.isFinite(v) ? v : fallback;
  };
  const $ = (sel, scope = document) => scope.querySelector(sel);
  const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];

  const track = $('#track');
  const main = $('main');
  const stage = $('.stage--hero');
  const next = $('#next');

  const kindOf = (el) =>
    ['polaroid', 'wordmark', 'tagline', 'role'].find((k) => el.classList.contains('piece--' + k)) || 'scrap';

  const pieces = stage ? $$('.piece', stage).map((el, i) => ({
    el, i,
    kind: kindOf(el),
    float: $('.piece__float', el),
    art: $('.piece__art', el),
    depth: knob(el, '--depth', 0.5),
    order: knob(el, '--in', i * 0.08)
  })) : [];
  const byEl = new Map(pieces.map((p) => [p.el, p]));

  const sheet = next && {
    edge: $('.next__edge', next),
    glow: $('.next__glow', next)
  };

  /* ---------- vocabulário ---------- */

  // "pousar": papel ou objeto que cai de um palmo acima da mesa e assenta
  gsap.registerEffect({
    name: 'place',
    extendTimeline: true,
    defaults: { duration: 1.4, ease: 'settle', fade: 0.5, y: -16, scale: 1.14, turn: 8, stagger: 0 },
    effect: (targets, c) => {
      const turn = typeof c.turn === 'function' ? c.turn : () => c.turn;
      const from = { scale: c.scale, rotation: (i, el) => '+=' + turn(i, el) };
      if (c.y) from.y = c.y;
      return gsap.timeline()
        .fromTo(targets, { autoAlpha: 0 },
          { autoAlpha: 1, duration: c.fade, ease: 'power1.out', stagger: c.stagger }, 0)
        .from(targets, { ...from, duration: c.duration, ease: c.ease, stagger: c.stagger }, 0);
    }
  });

  // "emergir": letras que sobem de uma fenda e se endireitam
  gsap.registerEffect({
    name: 'rise',
    extendTimeline: true,
    defaults: { duration: 1.15, ease: 'expo.out', stagger: 0.045, tilt: 7 },
    effect: (targets, c) => gsap.from(targets, {
      yPercent: 115,
      rotation: c.tilt,
      transformOrigin: '0% 100%',
      duration: c.duration,
      ease: c.ease,
      stagger: c.stagger
    })
  });

  // "traçar": linhas que se desenham da esquerda para a direita
  gsap.registerEffect({
    name: 'draw',
    extendTimeline: true,
    defaults: { duration: 1.4, ease: 'soft' },
    effect: (targets, c) => gsap.fromTo(targets, { scaleX: 0 },
      { scaleX: 1, transformOrigin: '0% 50%', duration: c.duration, ease: c.ease })
  });

  /* ---------- hero ---------- */

  const settled = new WeakSet();

  // cada peça entra do seu jeito: papéis são pousados, a foto revela como polaroid
  // e os letreiros aparecem como tiras recortadas
  function enterPiece(p) {
    const tl = gsap.timeline({ onComplete: () => settled.add(p.el) });
    const face = p.art.firstElementChild;

    if (p.kind === 'polaroid') {
      tl.place(p.art, { y: -22, scale: 1.12, turn: 6, duration: 1.6 });
      const photo = $('.polaroid__photo', p.art);
      if (photo) {
        tl.fromTo(photo,
          { filter: 'saturate(0) contrast(0.6) brightness(1.7) sepia(0.35)' },
          { filter: 'saturate(0.92) contrast(1.04) brightness(1) sepia(0)', duration: 2.8, ease: 'soft', clearProps: 'filter' },
          0.2);
      }
    } else if (p.kind === 'wordmark') {
      tl.place(p.art, { y: 26, scale: 1.04, turn: 0, duration: 1.3, ease: 'expo.out' })
        .fromTo(face, { clipPath: 'inset(100% 0% 0% 0%)' },
          { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'expo.out', clearProps: 'clipPath' }, 0);
    } else if (p.kind === 'tagline') {
      tl.place(p.art, { y: 10, scale: 1, turn: 0, duration: 1.1, ease: 'power3.out' })
        .fromTo(face, { clipPath: 'inset(-40% 100% -40% -10%)' },
          { clipPath: 'inset(-40% -10% -40% -10%)', duration: 1.25, ease: 'soft', clearProps: 'clipPath' }, 0);
    } else if (p.kind === 'role') {
      // a linha de apresentação é datilografada, letra por letra
      const split = SplitText.create(face, { type: 'words,chars', aria: 'auto' });
      gsap.set(split.chars, { autoAlpha: 0 });
      // no layout empilhado a peça inteira começa escondida: ela volta antes das letras
      tl.set(p.art, { autoAlpha: 1 }, 0)
        .to(split.chars, { autoAlpha: 1, duration: 0.01, stagger: 0.03, ease: 'none' }, 0.1);
    } else {
      tl.place(p.art, { y: -14, scale: 1.24, turn: (rand(p.i + 3) - 0.5) * 28, duration: 1.5 });
    }
    return tl;
  }

  function intro() {
    const tl = gsap.timeline({ paused: true });
    for (const p of pieces) tl.add(enterPiece(p), INTRO.lead + p.order * INTRO.spread);
    return tl;
  }

  // no layout empilhado as peças não cabem numa tela: cada uma entra ao chegar na viewport
  function revealOnScroll(contextSafe) {
    ScrollTrigger.batch(pieces.map((p) => p.el), {
      start: 'top 97%',
      once: true,
      onEnter: contextSafe((els) => {
        const tl = gsap.timeline();
        els.forEach((el, k) => tl.add(enterPiece(byEl.get(el)), k * 0.12));
      })
    });
  }

  // respiração: três senoides com períodos diferentes, então o conjunto nunca se repete.
  // usa xPercent/yPercent para compor com o parallax de ponteiro (x/y) na mesma camada
  function drift(p, stacked) {
    const { el, float } = p;
    const px = stacked ? 4 : knob(el, '--amp', 0.5) * stage.offsetWidth / 100;
    const ampY = px / (float.offsetHeight || 1) * 100;
    const ampX = px * 0.45 / (float.offsetWidth || 1) * 100;
    const spin = knob(el, '--spin', 0.4);
    const dur = knob(el, '--dur', 12);
    const wave = { ease: 'sine.inOut', repeat: -1, yoyo: true };

    const tl = gsap.timeline({ paused: stacked })
      .fromTo(float, { yPercent: -ampY }, { yPercent: ampY, duration: dur * 0.45, ...wave }, 0)
      .fromTo(float, { xPercent: -ampX }, { xPercent: ampX, duration: dur * 0.81, ...wave }, 0)
      .fromTo(float, { rotation: -spin }, { rotation: spin, duration: dur * 0.62, ...wave }, 0);

    tl.time(Math.abs(knob(el, '--delay', 0)) + rand(p.i + 7) * dur);
    return tl;
  }

  // a colagem explode em direção à câmera; x e y usam curvas diferentes,
  // então cada peça desenha um arco próprio em vez de uma linha reta
  function scatter(hooks) {
    const plans = new Map();

    const measure = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const sw = stage.offsetWidth;
      const sh = stage.offsetHeight;

      for (const { el, i, depth } of pieces) {
        const cx = el.offsetLeft - sw * SCATTER.originX;
        const cy = el.offsetTop - sh * SCATTER.originY;
        const r1 = rand(i + 1);
        const r2 = rand(i + 9);
        const r3 = rand(i + 17);
        const r4 = rand(i + 25);

        const base = Math.hypot(cx, cy) > 16 ? Math.atan2(cy, cx) : (i % 2 ? -1.25 : 1.9);
        const angle = base + (r1 - 0.5) * SCATTER.spread;
        const ux = Math.cos(angle);
        const uy = Math.sin(angle);

        const grow = knob(el, '--to-scale', 1 + (depth - 0.62) * SCATTER.depthScale) - 1;
        const reach = (0.84 + depth * 0.24 + r2 * 0.18) * knob(el, '--to-far', 1);
        const bulk = Math.max(1, 1 + grow);

        let x = ux * (vw * SCATTER.distance + el.offsetWidth * bulk) * reach;
        let y = uy * (vh * SCATTER.distance + el.offsetHeight * bulk) * reach;

        const toX = knob(el, '--to-x', null);
        const toY = knob(el, '--to-y', null);
        if (toX !== null) x = (toX - knob(el, '--x', 50)) * 0.01 * sw;
        if (toY !== null) y = (toY - knob(el, '--y', 50)) * 0.01 * sh;
        if (toX === null && toY === null) {
          y += ((depth - 0.55) * 0.45 + (r4 - 0.5) * 0.34) * vh * SCATTER.gravity;
        }

        plans.set(el, {
          x, y,
          rotation: knob(el, '--to-rot', ux * SCATTER.spin * 0.55 + (r1 - 0.5) * SCATTER.spin),
          rotationX: uy * SCATTER.tilt * 0.76 + (r3 - 0.5) * SCATTER.tilt * 0.53,
          rotationY: ux * -SCATTER.tilt + (r2 - 0.5) * SCATTER.tilt * 0.65,
          scale: 1 + grow,
          opacity: knob(el, '--to-op', SCATTER.fadeTo)
        });
      }
    };

    measure();

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: track,
        start: 'top top',
        end: () => '+=' + Math.max(1, track.offsetHeight - window.innerHeight) * SCATTER.scrollEnd,
        scrub: SCATTER.scrub,
        invalidateOnRefresh: true,
        onRefreshInit: measure,
        onUpdate: hooks.update,
        onLeave: hooks.leave,
        onEnterBack: hooks.back
      }
    });

    for (const { el, i, depth } of pieces) {
      const lag = knob(el, '--to-delay', clamp(0, 0.5, (depth * 0.44 + rand(i + 17) * 0.56) * SCATTER.stagger));
      const span = 1 - lag;
      const goal = (key) => () => plans.get(el)[key];
      const lead = rand(i + 33) > 0.5;

      tl.fromTo(el, { x: 0 }, { x: goal('x'), duration: span, ease: curve(lead ? 1.15 : 1.9) }, lag)
        .fromTo(el, { y: 0 }, { y: goal('y'), duration: span, ease: curve(lead ? 1.9 : 1.15) }, lag)
        .fromTo(el,
          { rotation: 0, rotationX: 0, rotationY: 0, scale: 1 },
          {
            rotation: goal('rotation'),
            rotationX: goal('rotationX'),
            rotationY: goal('rotationY'),
            scale: goal('scale'),
            duration: span,
            ease: curve(1.5)
          }, lag)
        .fromTo(el, { opacity: 1 },
          { opacity: goal('opacity'), duration: span * (1 - SCATTER.fadeStart) },
          lag + span * SCATTER.fadeStart);
    }

    return tl;
  }

  // parallax de ponteiro: peças mais próximas (depth maior) acompanham mais o cursor,
  // e o efeito some conforme a colagem se desfaz
  function follow(scatterTl) {
    const movers = pieces.map((p) => ({
      depth: p.depth,
      x: gsap.quickTo(p.float, 'x', { duration: 1.2, ease: 'power3' }),
      y: gsap.quickTo(p.float, 'y', { duration: 1.2, ease: 'power3' })
    }));
    let nx = 0;
    let ny = 0;

    const apply = () => {
      const hold = 1 - scatterTl.progress();
      for (const m of movers) {
        const drag = m.depth * 14;
        m.x(clamp(-26, 26, nx * drag) * hold);
        m.y(clamp(-22, 22, ny * drag * 0.7) * hold);
      }
    };

    const move = (e) => {
      nx = (e.clientX / window.innerWidth - 0.5) * 2;
      ny = (e.clientY / window.innerHeight - 0.5) * 2;
      apply();
    };

    window.addEventListener('pointermove', move, { passive: true });
    return { apply, stop: () => window.removeEventListener('pointermove', move) };
  }

  // hover tátil: a polaroid é "pega" (endireita, sobe e inclina sob o cursor);
  // os recortes giram para longe do lado por onde o cursor chegou
  function heroHover(contextSafe) {
    const offs = [];

    for (const p of pieces) {
      if (p.kind !== 'polaroid' && p.kind !== 'scrap') continue;

      let tween = null;
      let box = null;
      const lift = (vars) => {
        if (tween) tween.kill();
        tween = gsap.to(p.art, vars);
      };
      const hush = (s) => gsap.to(p.drift, { timeScale: s, duration: 0.8, ease: 'power2.out', overwrite: true });

      // a perspectiva é fixada antes de qualquer tween nesta camada e nunca é animada
      const tilt = p.kind === 'polaroid' && {
        x: gsap.quickTo(p.art, 'rotationY', { duration: 0.8, ease: 'power3' }),
        y: gsap.quickTo(p.art, 'rotationX', { duration: 0.8, ease: 'power3' })
      };
      if (tilt) gsap.set(p.art, { transformPerspective: 900 });

      const enter = contextSafe((e) => {
        if (!settled.has(p.el)) return;
        box = p.el.getBoundingClientRect();
        hush(0.1);
        if (tilt) {
          lift({ rotation: p.rot * 0.28, y: -stage.offsetWidth * 0.007, scale: 1.028, duration: 0.9, ease: 'settle' });
        } else {
          const side = e.clientX < box.left + box.width / 2 ? 1 : -1;
          lift({ rotation: p.rot + side * (5 + rand(p.i + 41) * 5), scale: 1.06, duration: 1, ease: 'settle' });
        }
      });

      const move = (e) => {
        if (!tilt || !box) return;
        tilt.x(((e.clientX - box.left) / box.width - 0.5) * 16);
        tilt.y(((e.clientY - box.top) / box.height - 0.5) * -12);
      };

      const leave = contextSafe(() => {
        if (!box) return;
        box = null;
        hush(1);
        if (tilt) {
          tilt.x(0);
          tilt.y(0);
        }
        lift({ rotation: p.rot, y: 0, scale: 1, duration: 1.2, ease: 'settle' });
      });

      p.el.addEventListener('pointerenter', enter);
      p.el.addEventListener('pointermove', move, { passive: true });
      p.el.addEventListener('pointerleave', leave);
      offs.push(() => {
        p.el.removeEventListener('pointerenter', enter);
        p.el.removeEventListener('pointermove', move);
        p.el.removeEventListener('pointerleave', leave);
      });
    }

    return () => offs.forEach((off) => off());
  }

  /* ---------- a passagem para "sobre mim" ---------- */

  // a folha desliza por cima: o hero recua, sobe um pouco e escurece por baixo dela
  function handoff() {
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: next,
        start: 'top bottom',
        end: 'top top',
        scrub: 0.6,
        // é medido por último e se redesenha depois do refresh (ver flatten abaixo)
        refreshPriority: -1,
        invalidateOnRefresh: true
      }
    });

    // durante cada refresh a folha fica no tamanho real: a jornada, lá dentro,
    // mede suas posições com getBoundingClientRect e não pode vê-la encolhida
    const flatten = () => tl.progress(1);
    ScrollTrigger.addEventListener('refreshInit', flatten);

    if (main) {
      tl.fromTo(main, { scale: 1, yPercent: 0, '--shade': 0 },
        { scale: 0.93, yPercent: -3, '--shade': 0.6, ease: 'power1.in' }, 0);
    }
    tl.fromTo(next,
      { scale: 0.9, borderTopLeftRadius: '3rem', borderTopRightRadius: '3rem' },
      { scale: 1, borderTopLeftRadius: '0rem', borderTopRightRadius: '0rem', ease: 'power2.out' }, 0);
    if (sheet.edge) tl.fromTo(sheet.edge, { scaleX: 0, opacity: 1 }, { scaleX: 1, opacity: 0.25, ease: 'soft' }, 0);
    if (sheet.glow) tl.fromTo(sheet.glow, { opacity: 0 }, { opacity: 1, ease: 'power1.in' }, 0);

    return () => ScrollTrigger.removeEventListener('refreshInit', flatten);
  }

  // o letreiro "dev + música" nunca fica parado: de tempos em tempos uma letra
  // troca de recorte (fonte e papel), como um bilhete sendo remontado
  function shuffle() {
    const cuts = stage ? $$('.cut:not(.cut--plus)', stage) : [];
    if (!cuts.length) return null;
    const faces = ['var(--serif)', 'var(--heavy)', 'var(--cond)', 'var(--type)', 'var(--sans)'];
    const papers = [['#f3f1ec', '#111'], ['#3936ff', '#f3f1ec'], ['#f2d027', '#111'], ['#101014', '#f3f1ec'], ['#ff4fa3', '#111']];
    const original = cuts.map((c) => c.getAttribute('style'));
    const pick = (list) => list[Math.floor(Math.random() * list.length)];
    const loop = gsap.to({}, {
      duration: 0.24,
      repeat: -1,
      onRepeat: () => {
        const c = pick(cuts);
        const [bg, fg] = pick(papers);
        c.style.setProperty('--ff', pick(faces));
        c.style.setProperty('--bg', bg);
        c.style.setProperty('--fg', fg);
      }
    });
    return {
      loop,
      stop: () => {
        loop.kill();
        cuts.forEach((c, i) => c.setAttribute('style', original[i]));
      }
    };
  }

  /* ---------- atmosfera ---------- */

  // grão de filme: a textura salta de posição ~12x por segundo, como película
  function grain() {
    const el = $('.grain');
    if (!el) return null;
    const setX = gsap.quickSetter(el, 'x', 'px');
    const setY = gsap.quickSetter(el, 'y', 'px');
    const jump = gsap.utils.random(-90, 90, 1, true);
    gsap.to({}, { duration: 0.08, repeat: -1, onRepeat: () => { setX(jump()); setY(jump()); } });
    return () => gsap.set(el, { clearProps: 'transform' });
  }

  /* ---------- montagem ---------- */

  const heroReady = () => {
    const imgs = stage ? $$('img', stage) : [];
    const decoded = Promise.all(imgs.map((img) =>
      (img.decode ? img.decode() : Promise.resolve()).catch(() => {})));
    return Promise.race([decoded, new Promise((done) => setTimeout(done, INTRO.wait))]);
  };

  const ready = heroReady();
  let introduced = false;

  gsap.matchMedia().add(MEDIA, (ctx, contextSafe) => {
    const { reduced, stacked, fine } = ctx.conditions;
    const stops = [];
    let alive = true;

    if (reduced) {
      if (!introduced && pieces.length) {
        introduced = true;
        gsap.fromTo(pieces.map((p) => p.art), { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.8, ease: 'power1.out', stagger: 0.06 });
      }
      release();
      return undefined;
    }

    if (pieces.length) {
      for (const p of pieces) {
        p.rot = gsap.getProperty(p.art, 'rotation');
        p.drift = drift(p, stacked);
      }

      if (fine) stops.push(heroHover(contextSafe));

      if (introduced) {
        pieces.forEach((p) => settled.add(p.el));
      } else if (stacked) {
        gsap.set(pieces.map((p) => p.art), { autoAlpha: 0 });
        ready.then(contextSafe(() => {
          if (!alive) return;
          introduced = true;
          revealOnScroll(contextSafe);
        }));
      } else {
        const tl = intro();
        ready.then(() => {
          if (!alive) return;
          introduced = true;
          tl.play();
        });
      }

      const letters = shuffle();
      if (letters) stops.push(letters.stop);

      if (stacked) {
        for (const p of pieces) {
          ScrollTrigger.create({
            trigger: p.el,
            start: 'top bottom',
            end: 'bottom top',
            onToggle: (self) => (self.isActive ? p.drift.resume() : p.drift.pause())
          });
        }
      } else {
        gsap.set(pieces.map((p) => p.el), { xPercent: -50, yPercent: -50, x: 0, y: 0 });
        let pointer = null;
        const tl = scatter({
          update: () => pointer && pointer.apply(),
          leave: () => {
            pieces.forEach((p) => p.drift.pause());
            if (letters) letters.loop.pause();
          },
          back: () => {
            pieces.forEach((p) => p.drift.resume());
            if (letters) letters.loop.resume();
          }
        });
        if (fine) {
          pointer = follow(tl);
          stops.push(pointer.stop);
        }
      }
    }

    if (sheet && !stacked) stops.push(handoff());

    const stopGrain = grain();
    if (stopGrain) stops.push(stopGrain);

    release();

    return () => {
      alive = false;
      stops.forEach((stop) => stop());
    };
  });
})();
