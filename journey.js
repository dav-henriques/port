/*
 * journey.js — "sobre mim" e a viagem horizontal: habilidades, música, projetos e github.
 * Depois dela, o contato e o rodapé (scroll vertical de novo).
 *
 * A câmera: a .journey fica presa (sticky) enquanto o scroll vertical percorre a .next.
 * Uma timeline linear move o mundo para a esquerda — e o fundo em outra velocidade.
 * Tudo o que acontece "quando algo passa pela câmera" usa
 * essa timeline como containerAnimation, com posições medidas em px do mundo.
 *
 * Ritmo do scroll dentro da .next:
 *   chegada  a folha sobe (motion.js) e a colagem é montada sobre o tapete
 *   leitura  a câmera espera; o texto se datilografa e os rabiscos se desenham
 *   viagem   sobre → habilidades → música → projetos → a foto → github
 *   íris     a cena fecha num círculo e o site volta ao scroll vertical
 *
 * Camadas de uma peça (.bit), cada uma com um dono:
 *   .bit       parallax por profundidade (x) e subida da folha (y)
 *   .bit__in   chegada, saída e hover (autoAlpha, y, yPercent, scale, rotation, rotationX/Y)
 */
(() => {
  'use strict';

  const root = document.documentElement;
  const { gsap, ScrollTrigger, SplitText, DrawSVGPlugin, ScrollToPlugin } = window;
  const journey = document.querySelector('.journey');

  if (!journey || !gsap || !ScrollTrigger || !SplitText || !DrawSVGPlugin ||
      !ScrollToPlugin || !gsap.effects.place) {
    root.classList.remove('is-journey');
    return;
  }

  gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin, ScrollToPlugin);
  root.classList.add('journey-ready');

  const MEDIA = {
    motion: '(prefers-reduced-motion: no-preference)',
    reduced: '(prefers-reduced-motion: reduce)',
    stacked: '(max-width: 980px)',
    fine: '(hover: hover) and (pointer: fine)'
  };

  const CAMERA = {
    holdIn: 0.9,  // telas de scroll lendo o "sobre mim" antes de a câmera andar
    holdOut: 0,   // a câmera para no github e o scroll volta direto a ser vertical
    pace: 1,      // px de scroll por px de câmera: a mão move a câmera na mesma medida
    scrub: 1,     // inércia da câmera, em segundos
    depth: 0.2,   // força do parallax por profundidade
    far: 0.14     // velocidade do fundo em relação ao mundo
  };

  const $ = (sel, scope = document) => scope.querySelector(sel);
  const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];
  const clamp = gsap.utils.clamp;
  const rand = (n) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  // SplitText lê "corte<br>seco" como "corteseco": o rótulo acessível é refeito com o espaço
  const splitKeepingLabel = (el, vars) => {
    const label = el.innerText.replace(/\s+/g, ' ').trim();
    const split = SplitText.create(el, { aria: 'auto', ...vars });
    el.setAttribute('aria-label', label);
    return split;
  };

  const next = $('#next');
  const lens = $('.journey__lens', journey);
  const world = $('.journey__world', journey);
  const far = $('.journey__far', journey);
  const farTrack = $('.far__track', journey);
  const bars = $$('.journey__bars .bar', journey);
  const outro = $('.outro');
  const foot = $('.site-foot');
  const scenes = $$('.scene', world);
  const scene = (id) => scenes.find((s) => s.dataset.scene === id);

  /* ---------- geometria da câmera ---------- */

  let travel = 0;
  let cam = null;  // a timeline da câmera (containerAnimation de tudo)
  let calmMode = false;

  const vw = () => window.innerWidth;
  const vh = () => journey.offsetHeight;
  const cqh = () => world.offsetHeight / 100;

  // posição de um elemento no mundo (offsetLeft ignora transforms)
  const worldX = (el) => {
    let x = 0;
    for (let n = el; n && n !== world; n = n.offsetParent) x += n.offsetLeft;
    return x;
  };

  // posição da câmera em que o ponto f do elemento (0 = borda esquerda, 1 = direita)
  // está no ponto v da viewport (0 = esquerda, 1 = direita)
  const when = (el, f = 0, v = 0) => worldX(el) + el.offsetWidth * f - vw() * v;
  const rest = (el) => clamp(0, travel, when(el, 0.5, 0.5));

  // scrub entre duas posições da câmera
  const along = (a, b, extra) => ({
    trigger: world,
    containerAnimation: cam,
    start: () => `${Math.round(a())}px left`,
    end: () => `${Math.round(b())}px left`,
    scrub: true,
    invalidateOnRefresh: true,
    ...extra
  });

  // uma posição da câmera (para gatilhos com callback)
  const past = (a) => ({
    trigger: world,
    containerAnimation: cam,
    start: () => `${Math.round(a())}px left`
  });

  // dispara ao passar por uma posição da câmera (e desfaz ao voltar)
  const at = (a, extra) => ({ ...past(a), toggleActions: 'play none none reverse', ...extra });

  /* ---------- câmera e camadas ---------- */

  function camera({ scrub, feed }) {
    // a altura da .next é o comprimento da viagem; o fundo é posicionado
    // para cobrir exatamente o caminho que a câmera vai fazer
    const measure = () => {
      // a lente sem inclinação/zoom de velocidade enquanto o ScrollTrigger mede
      gsap.set(lens, { skewX: 0, scale: 1, y: 0, rotation: 0 });
      travel = Math.max(0, world.offsetWidth - vw());
      next.style.setProperty('--room', Math.round(vh() * (CAMERA.holdIn + CAMERA.holdOut) + travel * CAMERA.pace) + 'px');
      if (farTrack) farTrack.style.width = Math.round(vw() + travel * CAMERA.far) + 'px';
    };

    measure();
    ScrollTrigger.addEventListener('refreshInit', measure);

    const tl = gsap.timeline({
      defaults: { ease: 'none', duration: 1 },
      scrollTrigger: {
        trigger: next,
        start: () => `top+=${Math.round(vh() * CAMERA.holdIn)} top`,
        end: () => `bottom-=${Math.round(vh() * CAMERA.holdOut)} ${vh()}px`,
        scrub,
        invalidateOnRefresh: true,
        onUpdate: feed
      }
    });

    tl.to(world, { x: () => -travel }, 0);
    if (farTrack) tl.to(farTrack, { x: () => -travel * CAMERA.far }, 0);

    return {
      tl,
      stop: () => ScrollTrigger.removeEventListener('refreshInit', measure)
    };
  }

  // profundidade: cada peça anda mais rápido (perto) ou mais devagar (longe) que o mundo,
  // e está exatamente no lugar desenhado quando fica centralizada na tela
  function depth() {
    for (const el of $$('[data-depth]', world)) {
      const d = parseFloat(el.dataset.depth) || 0;
      if (!d || !el.offsetParent) continue;
      const k = CAMERA.depth * d;
      gsap.fromTo(el,
        { x: () => k * (rest(el) - when(el, 0, 1)) },
        {
          x: () => -k * (when(el, 1, 0) - rest(el)),
          ease: 'none',
          scrollTrigger: along(() => when(el, 0, 1), () => when(el, 1, 0))
        });
    }
  }

  /* ---------- sobre mim ---------- */

  function about({ stacked, fine, contextSafe }) {
    const s = scene('sobre');
    if (!s) return () => {};
    const offs = [];

    const lead = $('.about__lead', s);
    const text = $('.about__text', s);
    const pics = $$('.about__pic', s);

    // chegada: a frase sobe palavra por palavra de dentro de uma máscara
    // e as fotos se revelam de baixo para cima
    const leadWords = SplitText.create(lead, { type: 'words', mask: 'words', aria: 'auto' }).words;
    const arrive = gsap.timeline({ paused: true })
      .fromTo(leadWords, { yPercent: 115 },
        { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.045 }, 0.12)
      .fromTo(text, { autoAlpha: 0, y: 18 },
        { autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out' }, 0.55);

    // a escala de repouso de cada foto vem do CSS (--cover): é a folga para o parallax interno
    const cover = new Map(pics.map((pic) => [pic, gsap.getProperty($('.about__frame img', pic), 'scale')]));

    pics.forEach((pic, k) => {
      const frame = $('.about__frame', pic);
      const img = $('img', frame);
      const t = 0.3 + k * 0.18;
      arrive
        .fromTo(frame, { clipPath: 'inset(100% 0% 0% 0%)' },
          { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'expo.inOut' }, t)
        .fromTo(img, { scale: cover.get(pic) * 1.2 }, { scale: cover.get(pic), duration: 1.8, ease: 'expo.out' }, t + 0.2);
    });

    // entra aos 55% da subida da folha e só desfaz abaixo de 15%, para não piscar no caminho
    ScrollTrigger.create({
      trigger: next,
      start: stacked ? 'top 70%' : 'top 45%',
      onEnter: () => arrive.timeScale(1).play()
    });
    ScrollTrigger.create({
      trigger: next,
      start: stacked ? 'top 95%' : 'top 85%',
      onLeaveBack: () => arrive.timeScale(1.8).reverse()
    });

    // leitura: com a câmera parada, o scroll acende o texto palavra por palavra
    // (sem invalidateOnRefresh: com stagger, ele só re-renderizaria o primeiro alvo)
    const textWords = SplitText.create(text, { type: 'words', aria: 'auto' }).words;
    gsap.fromTo(textWords, { opacity: 0.2 }, {
      opacity: 1,
      ease: 'none',
      stagger: 0.08,
      scrollTrigger: {
        trigger: next,
        start: 'top top',
        end: () => `top+=${Math.round(vh() * CAMERA.holdIn * 0.85)} top`,
        scrub: 0.4
      }
    });

    // na viagem, cada foto desliza dentro da própria moldura
    for (const pic of pics) {
      gsap.fromTo($('.about__frame img', pic), { yPercent: -4 }, {
        yPercent: 4,
        ease: 'none',
        scrollTrigger: along(() => when(pic, 0, 1), () => when(pic, 1, 0))
      });
    }

    // hover: a foto aproxima devagar dentro da moldura
    if (fine) {
      for (const pic of pics) {
        const zoom = gsap.quickTo($('.about__frame img', pic), 'scale', { duration: 1, ease: 'expo.out' });
        const enter = contextSafe(() => zoom(cover.get(pic) * 1.07));
        const leave = contextSafe(() => zoom(cover.get(pic)));
        pic.addEventListener('pointerenter', enter);
        pic.addEventListener('pointerleave', leave);
        offs.push(() => {
          pic.removeEventListener('pointerenter', enter);
          pic.removeEventListener('pointerleave', leave);
        });
      }
    }

    return () => offs.forEach((off) => off());
  }

  /* ---------- vocabulário compartilhado ---------- */

  // inclinação 3D que segue o cursor (a perspectiva precisa estar definida antes)
  function tilt(el, maxY, maxX) {
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.8, ease: 'power3' });
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.8, ease: 'power3' });
    let box = null;
    const enter = () => { box = el.getBoundingClientRect(); };
    const move = (e) => {
      if (!box) return;
      ry(((e.clientX - box.left) / box.width - 0.5) * maxY);
      rx(((e.clientY - box.top) / box.height - 0.5) * -maxX);
    };
    const leave = () => { box = null; rx(0); ry(0); };
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointermove', move, { passive: true });
    el.addEventListener('pointerleave', leave);
    return () => {
      el.removeEventListener('pointerenter', enter);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
    };
  }

  // palavras sobem de dentro de uma fenda, uma atrás da outra
  function words(el, v = 0.85) {
    if (!el) return;
    const split = SplitText.create(el, { type: 'words', mask: 'words', aria: 'auto' });
    gsap.from(split.words, {
      yPercent: 110,
      duration: 0.9,
      ease: 'expo.out',
      stagger: 0.015,
      scrollTrigger: at(() => when(el, 0, v))
    });
  }

  function meta(el) {
    if (!el) return;
    gsap.from($$('span', el), {
      autoAlpha: 0,
      x: -12,
      duration: 0.6,
      ease: 'power3.out',
      stagger: 0.08,
      scrollTrigger: at(() => when(el, 0, 0.8))
    });
  }

  // letras-recorte tremem sob o cursor, cada uma para um lado
  function tileHover(tiles, contextSafe) {
    const offs = [];
    tiles.forEach((tile, i) => {
      const face = $('.tile__face', tile);
      const base = gsap.getProperty(face, 'rotation');  // a inclinação de recorte de cada letra
      const enter = contextSafe(() => {
        gsap.to(face, { rotation: base + (rand(i + 31) - 0.5) * 24, yPercent: -8, scale: 1.06, duration: 0.5, ease: 'power3.out', overwrite: true });
      });
      const leave = contextSafe(() => {
        gsap.to(face, { rotation: base, yPercent: 0, scale: 1, duration: 1.1, ease: 'elastic.out(1, 0.45)', overwrite: true });
      });
      tile.addEventListener('pointerenter', enter);
      tile.addEventListener('pointerleave', leave);
      offs.push(() => {
        tile.removeEventListener('pointerenter', enter);
        tile.removeEventListener('pointerleave', leave);
      });
    });
    return () => offs.forEach((off) => off());
  }

  // um papel que sobe um pouco da mesa quando o cursor encosta
  function lifter(el, contextSafe, amount = -3) {
    let tween = null;
    const go = (up) => {
      if (tween) tween.kill();
      tween = gsap.to(el, { yPercent: up ? amount : 0, scale: up ? 1.03 : 1, duration: up ? 0.5 : 0.9, ease: up ? 'power3.out' : 'settle' });
    };
    const enter = contextSafe(() => go(true));
    const leave = contextSafe(() => go(false));
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointerleave', leave);
    return () => {
      el.removeEventListener('pointerenter', enter);
      el.removeEventListener('pointerleave', leave);
    };
  }

  /* ---------- 01 · habilidades ---------- */

  function skills({ fine, contextSafe }) {
    const s = scene('habilidades');
    if (!s) return () => {};
    const offs = [];

    // o chão de papel nasce como um cartão pequeno e cresce até tomar a cena
    gsap.fromTo($('.skills__paper', s), { clipPath: 'inset(36% 91% 36% 3%)' }, {
      clipPath: 'inset(0% 0% 0% 0%)',
      ease: 'power2.inOut',
      scrollTrigger: along(() => when(s, 0, 1), () => when(s, 0, 0.1))
    });

    words($('.p__desc', s));

    // título carimbado: cada letra desce com força e fica
    const titleEl = $('.skills__title', s);
    const title = splitKeepingLabel(titleEl, { type: 'chars', charsClass: 'ch' });
    gsap.from(title.chars, {
      scale: 2.6,
      autoAlpha: 0,
      yPercent: -30,
      rotation: (i) => (rand(i + 71) - 0.5) * 34,
      duration: 0.4,
      ease: 'power4.in',
      stagger: 0.05,
      scrollTrigger: at(() => when(titleEl, 0.1, 0.8))
    });

    // os cartões das linguagens são distribuídos na mesa, um de cada vez, como cartas:
    // cada um chega de baixo, girado, quando a câmera passa por ele, e assenta
    // na inclinação dele (o --cr do HTML)
    const cards = $$('.skill', s);
    gsap.set(cards, { transformPerspective: 900 });
    cards.forEach((card, i) => {
      const rest = gsap.getProperty(card, 'rotation');  // o GSAP incorpora o rotate do CSS
      gsap.fromTo(card, {
        autoAlpha: 0,
        y: () => 12 * cqh(),
        rotation: rest + (rand(i + 41) - 0.5) * 24,
        scale: 0.9
      }, {
        autoAlpha: 1,
        y: 0,
        rotation: rest,
        scale: 1,
        ease: 'power3.out',
        scrollTrigger: along(() => when(card, 0, 0.98), () => when(card, 0.5, 0.7))
      });
    });
    if (fine) cards.forEach((card) => offs.push(tilt(card, 14, 12)));

    return () => offs.forEach((off) => off());
  }

  /* ---------- 02 · música ---------- */

  // o iPod (ipod.js) funciona sozinho; aqui só se avisa quando ele entra e sai da tela,
  // para o mini-player aparecer no canto enquanto a música segue tocando
  function ipodInView(box) {
    if (!box || !window.iPod) return () => {};
    const vis = ScrollTrigger.create({
      ...past(() => when(box, 0, 1)),
      end: () => `${Math.round(when(box, 1, 0))}px left`,
      onToggle: (self) => window.iPod.setVisible(self.isActive)
    });
    return () => vis.kill();
  }

  function music({ fine, contextSafe }) {
    const s = scene('musica');
    if (!s) return () => {};
    const offs = [];

    // a madrugada cai sobre a cena, abrindo em círculo
    gsap.fromTo($('.music__floor', s), { clipPath: 'circle(0% at 14% 50%)' }, {
      clipPath: 'circle(125% at 14% 50%)',
      ease: 'power2.in',
      scrollTrigger: along(() => when(s, 0, 1), () => when(s, 0, 0.1))
    });

    words($('.p__desc', s));

    const more = $('.music__more', s);
    gsap.fromTo(more, { autoAlpha: 0, yPercent: 30 }, {
      autoAlpha: 1, yPercent: 0, duration: 0.7, ease: 'settle',
      scrollTrigger: at(() => when(more, 0, 0.85))
    });

    // as letras chegam de todos os lados, viram palavra e se espalham de novo na saída
    const title = $('.music__title', s);
    const tiles = $$('.tile', title);
    const spell = gsap.timeline({ scrollTrigger: along(() => when(title, 0, 1), () => when(title, 1, 0)) });
    tiles.forEach((t, i) => {
      const r = (k) => rand(i * 13 + k);
      spell.fromTo(t,
        {
          x: () => (r(1) - 0.5) * 70 * cqh(),
          y: () => (r(2) - 0.5) * 80 * cqh(),
          rotation: (r(3) - 0.5) * 100,
          scale: 0.4 + r(4) * 1.1,
          autoAlpha: 0
        },
        { x: 0, y: 0, rotation: 0, scale: 1, autoAlpha: 1, duration: 0.38, ease: 'power3.out' }, i * 0.025)
        .to(t, {
          x: () => (r(5) - 0.5) * 60 * cqh(),
          y: () => (i % 2 ? 1 : -1) * (25 + r(6) * 40) * cqh(),
          rotation: (r(7) - 0.5) * 80,
          scale: 0.7 + r(8) * 0.5,
          autoAlpha: 0,
          duration: 0.32,
          ease: 'power2.in'
        }, 0.64 + i * 0.02);
    });
    if (fine) offs.push(tileHover(tiles, contextSafe));

    // a capa é pousada na mesa e acende como luz de rua conforme a câmera chega
    const albumBit = $('.music__album', s);
    const album = $('.album', albumBit);
    const halo = $('.album__halo', albumBit);
    gsap.timeline({ scrollTrigger: at(() => when(albumBit, 0.1, 0.9)) })
      .place(album, { y: -40, scale: 1.1, turn: 7, duration: 1.2 });
    gsap.timeline({ defaults: { ease: 'power2.out' }, scrollTrigger: along(() => when(albumBit, 0, 0.95), () => when(albumBit, 0.45, 0.5)) })
      .fromTo($('.album__art', albumBit), { filter: 'brightness(0.2) saturate(0.6)' }, { filter: 'brightness(1) saturate(1)' }, 0)
      .fromTo(halo, { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1 }, 0);
    // o reflexo atravessa a capa enquanto ela passa pela câmera
    gsap.fromTo($('.album__sheen', albumBit), { '--sx': '100%' }, {
      '--sx': '0%',
      ease: 'none',
      scrollTrigger: along(() => when(albumBit, 0, 1), () => when(albumBit, 1, 0))
    });
    if (fine) {
      gsap.set(album, { transformPerspective: 1000 });
      offs.push(tilt(album, 10, 8));
    }

    // o iPod é posto na mesa, a tela acende e o menu monta linha por linha
    // (sem inclinar com o cursor: ali a mão está girando a roda)
    const ipodBit = $('.music__ipod', s);
    const device = $('.ipod', s);
    gsap.set(device, { transformPerspective: 1200 });
    gsap.timeline({ scrollTrigger: at(() => when(ipodBit, 0.15, 0.9)) })
      .fromTo(device, { autoAlpha: 0, yPercent: 16, rotation: -9, rotationX: 22 },
        { autoAlpha: 1, yPercent: 0, rotation: 0, rotationX: 0, duration: 1.1, ease: 'settle' }, 0)
      .fromTo($('.ipod__screen', s), { '--lit': 0 }, { '--lit': 1, duration: 0.9, ease: 'power2.out' }, 0.45)
      .fromTo([$('.ipod__bar', s), ...$$('.ipod__menu li', s), $('.menu__art', s)], { autoAlpha: 0, y: 6 },
        { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out', stagger: 0.07 }, 0.6);
    offs.push(ipodInView(device));

    return () => offs.forEach((off) => off());
  }

  /* ---------- 03 · projetos ---------- */

  function projects({ fine, contextSafe }) {
    const s = scene('projetos');
    if (!s) return () => {};
    const offs = [];

    // a luz vermelha do quarto escuro acende quando a cena chega
    gsap.fromTo($('.work__safelight', s), { autoAlpha: 0 }, {
      autoAlpha: 1,
      ease: 'none',
      scrollTrigger: along(() => when(s, 0, 1), () => when(s, 0, 0.3))
    });

    words($('.p__desc', s));

    // título exposto: um feixe de luz atravessa e deixa as letras preenchidas para trás
    const title = $('.work__title', s);
    const beam = $('.work__beam', s);
    gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: along(() => when(title, 0, 0.95), () => when(title, 1, 0.4)) })
      .fromTo($('.work__fill', s), { clipPath: 'inset(-30% 100% -30% 0%)' }, { clipPath: 'inset(-30% 0% -30% 0%)', duration: 1 }, 0)
      .fromTo(beam, { x: 0 }, { x: () => title.offsetWidth, duration: 1 }, 0)
      .fromTo(beam, { opacity: 0 }, {
        keyframes: { '0%': { opacity: 0 }, '10%': { opacity: 1 }, '88%': { opacity: 1 }, '100%': { opacity: 0 } },
        duration: 1
      }, 0);

    const more = $('.work__more', s);
    gsap.fromTo(more, { autoAlpha: 0, yPercent: 30 }, {
      autoAlpha: 1, yPercent: 0, duration: 0.7, ease: 'settle',
      scrollTrigger: at(() => when(more, 0, 0.85))
    });

    // a cópia em destaque revela na bandeja: sai do branco e o enquadramento assenta
    const feature = $('.work__feature', s);
    const print = $('.print', feature);
    const img = $('.project__img', feature);
    gsap.timeline({ scrollTrigger: along(() => when(feature, 0, 1), () => when(feature, 0.5, 0.5)) })
      .fromTo($('.print__fog', feature), { opacity: 1 }, { opacity: 0, ease: 'power1.in' }, 0)
      .fromTo(img, { scale: 1.2 }, { scale: 1, ease: 'power2.out' }, 0);
    if (fine) offs.push(lifter(print, contextSafe, -2.5));

    // o varal: as cópias são penduradas e balançam com a inércia da câmera
    const line = $('.work__line', s);
    gsap.fromTo($$('.swing', line), { y: () => -30 * cqh(), autoAlpha: 0 }, {
      y: 0, autoAlpha: 1, duration: 0.9, ease: 'back.out(1.6)', stagger: 0.12,
      scrollTrigger: at(() => when(line, 0, 1))
    });
    const prints = $$('.swing__print', line);
    const sway = gsap.to(prints, {
      rotation: (i) => (i % 2 ? 1.4 : -1.4),
      transformOrigin: '50% 0%',
      duration: (i) => 2.2 + i * 0.4,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true
    });
    if (fine) prints.forEach((p) => offs.push(lifter(p, contextSafe, -2)));

    return () => {
      sway.kill();
      offs.forEach((off) => off());
    };
  }

  /* ---------- a foto-transição e 04 · github ---------- */

  function portal() {
    const s = scene('portal');
    if (!s) return;
    const el = $('.portal', s);

    // a foto chega pequena, cresce até ser a tela inteira...
    gsap.fromTo(el, { scale: 0.3 }, {
      scale: 1,
      ease: 'power1.in',
      scrollTrigger: along(() => when(s, 0, 1), () => when(s, 0, 0))
    });
    gsap.fromTo($('.portal__img', s), { scale: 1.25 }, {
      scale: 1,
      ease: 'none',
      scrollTrigger: along(() => when(s, 0, 1), () => when(s, 0, 0) + vw())
    });

    // ...e segura, parada e se apagando na cor do papel, enquanto a cena do github entra por cima
    gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: along(() => when(s, 0, 0), () => when(s, 0, 0) + vw()) })
      .fromTo(el, { x: 0 }, { x: () => vw(), duration: 1 }, 0)
      .fromTo($('.portal__shade', s), { opacity: 0 }, { opacity: 0.8, duration: 1 }, 0)
      .fromTo(el, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.3 }, 0.7);

    // bastidores: entram as tarjas pretas de cinema
    gsap.fromTo(bars, { scaleY: 0 }, {
      scaleY: 1,
      ease: 'power2.inOut',
      scrollTrigger: along(() => when(s, 0, 0.35), () => when(s, 0, 0) + vw() * 0.4)
    });
    // ...e se recolhem quando a viagem acaba: nenhuma faixa preta sobra entre o github e o contato
    gsap.fromTo(bars, { scaleY: 1 }, {
      scaleY: 0,
      ease: 'power2.inOut',
      immediateRender: false,
      scrollTrigger: { trigger: next, start: 'bottom bottom', end: 'bottom 55%', scrub: true }
    });
  }

  function github({ fine, contextSafe }) {
    const s = scene('github');
    if (!s) return { stop: () => {}, span: () => [0, 0] };
    const offs = [];

    words($('.p__desc', s));
    meta($('.p__meta', s));

    const cta = $('.git__cta', s);
    gsap.fromTo(cta, { autoAlpha: 0, yPercent: 40, rotation: -4 }, {
      autoAlpha: 1, yPercent: 0, rotation: 0, duration: 0.8, ease: 'settle',
      scrollTrigger: at(() => when(cta, 0, 0.85))
    });

    // o título é cortado ao meio: as metades chegam de lados opostos,
    // se encaixam no centro e se partem de novo na saída
    const titleEl = $('.git__title', s);
    const title = splitKeepingLabel(titleEl, { type: 'chars', charsClass: 'slit' });
    for (const ch of title.chars) {
      const t = ch.textContent;
      ch.innerHTML = `<span class="slit__top">${t}</span><span class="slit__bot" aria-hidden="true">${t}</span>`;
    }
    const tops = title.chars.map((c) => c.firstChild);
    const bots = title.chars.map((c) => c.lastChild);
    // última cena: a câmera para aqui, então o título só chega (não há saída)
    gsap.timeline({ scrollTrigger: along(() => when(titleEl, 0, 1), () => when(titleEl, 0, 0.45), { invalidateOnRefresh: false }) })
      .fromTo(tops, { xPercent: (i) => -140 - rand(i) * 90, autoAlpha: 0 },
        { xPercent: 0, autoAlpha: 1, duration: 0.36, ease: 'power3.out', stagger: 0.015 }, 0)
      .fromTo(bots, { xPercent: (i) => 140 + rand(i + 9) * 90, autoAlpha: 0 },
        { xPercent: 0, autoAlpha: 1, duration: 0.36, ease: 'power3.out', stagger: 0.015 }, 0);

    if (fine) {
      const open = contextSafe(() => {
        gsap.to(tops, { yPercent: -7, duration: 0.4, ease: 'power3.out', stagger: 0.015, overwrite: 'auto' });
        gsap.to(bots, { yPercent: 7, duration: 0.4, ease: 'power3.out', stagger: 0.015, overwrite: 'auto' });
      });
      const shut = contextSafe(() => {
        gsap.to([...tops, ...bots], { yPercent: 0, duration: 0.8, ease: 'elastic.out(1, 0.5)', overwrite: 'auto' });
      });
      titleEl.addEventListener('pointerenter', open);
      titleEl.addEventListener('pointerleave', shut);
      offs.push(() => {
        titleEl.removeEventListener('pointerenter', open);
        titleEl.removeEventListener('pointerleave', shut);
      });
    }

    // o terminal digita conforme o scroll
    const term = $('.git__term', s);
    // reduceWhiteSpace: false mantém as quebras de linha do <pre>
    const typed = SplitText.create($('.term__type', term), { type: 'chars', aria: 'none', reduceWhiteSpace: false });
    gsap.set(typed.chars, { autoAlpha: 0 });
    // a cena é a última da viagem: tudo precisa terminar antes de a câmera parar
    const lastStop = () => travel - vw() * 0.04;
    gsap.to(typed.chars, {
      autoAlpha: 1,
      duration: 0.01,
      ease: 'none',
      stagger: 1 / typed.chars.length,
      scrollTrigger: along(() => when(term, 0, 0.95), () => Math.min(lastStop(), when(term, 0.5, 0.6)), { invalidateOnRefresh: false })
    });

    return {
      stop: () => offs.forEach((off) => off()),
      // trecho da câmera em que a cena está em quadro (para a câmera na mão)
      span: () => [when(s, 0, 0.6), when(s, 1, 0)]
    };
  }

  /* ---------- contato e rodapé ---------- */

  function magnetic(el, contextSafe, strength = 0.35) {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' });
    let box = null;
    const enter = () => { box = el.getBoundingClientRect(); };
    const move = (e) => {
      if (!box) return;
      xTo((e.clientX - (box.left + box.width / 2)) * strength);
      yTo((e.clientY - (box.top + box.height / 2)) * strength);
    };
    const leave = () => { box = null; xTo(0); yTo(0); };
    const press = contextSafe(() => gsap.fromTo(el, { scale: 0.92 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' }));
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointermove', move, { passive: true });
    el.addEventListener('pointerleave', leave);
    el.addEventListener('pointerdown', press);
    return () => {
      el.removeEventListener('pointerenter', enter);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
      el.removeEventListener('pointerdown', press);
    };
  }

  function contact({ fine, contextSafe }) {
    if (!outro) return () => {};
    const offs = [];

    const tiles = $$('.outro__tiles .tile', outro);
    const spell = gsap.timeline({ scrollTrigger: { trigger: outro, start: 'top 90%', end: 'top 30%', scrub: 0.8 } });
    tiles.forEach((t, i) => {
      const r = (k) => rand(i * 19 + k);
      spell.fromTo(t,
        { x: (r(1) - 0.5) * 300, y: 120 + r(2) * 200, rotation: (r(3) - 0.5) * 90, scale: 0.5 + r(4), autoAlpha: 0 },
        { x: 0, y: 0, rotation: 0, scale: 1, autoAlpha: 1, ease: 'power3.out' }, i * 0.06);
    });
    if (fine) offs.push(tileHover(tiles, contextSafe));

    const line = SplitText.create($('.outro__line', outro), { type: 'chars', charsClass: 'ch', mask: 'chars' });
    gsap.from(line.chars, {
      yPercent: 110,
      duration: 1,
      ease: 'expo.out',
      stagger: 0.03,
      scrollTrigger: { trigger: outro, start: 'top 55%', toggleActions: 'play none none reverse' }
    });
    gsap.from([$('.outro__lead', outro), ...$$('.outro__info li', outro)], {
      autoAlpha: 0, y: 24, duration: 0.9, ease: 'settle', stagger: 0.1,
      scrollTrigger: { trigger: outro, start: 'top 50%', toggleActions: 'play none none reverse' }
    });

    // a folha do formulário é pousada na mesa
    const form = $('.form', outro);
    if (form) {
      gsap.timeline({ scrollTrigger: { trigger: form, start: 'top 85%', toggleActions: 'play none none reverse' } })
        .place(form, { y: -30, scale: 1.08, turn: -5, duration: 1.3 });
    }

    // recortes à deriva, cada um numa profundidade
    const decos = $$('.outro__deco', outro);
    decos.forEach((d, i) => {
      gsap.fromTo(d, { y: 80 + i * 40 }, {
        y: -(40 + i * 30), ease: 'none',
        scrollTrigger: { trigger: outro, start: 'top bottom', end: 'bottom top', scrub: true }
      });
      gsap.to(d, { rotation: `+=${i % 2 ? 8 : -8}`, duration: 5 + i, ease: 'sine.inOut', repeat: -1, yoyo: true });
    });

    // o rodapé entra em colunas
    if (foot) {
      gsap.from($$('.site-foot__grid > *', foot), {
        autoAlpha: 0, y: 30, duration: 0.9, ease: 'settle', stagger: 0.12,
        scrollTrigger: { trigger: foot, start: 'top 85%', toggleActions: 'play none none reverse' }
      });
    }

    if (fine) for (const tag of $$('[data-magnetic]')) offs.push(magnetic(tag, contextSafe));

    return () => offs.forEach((off) => off());
  }

  // o topo ganha fundo quando passa por cima de texto que rola na vertical:
  // o contato e o rodapé sempre, e a abertura empilhada do celular
  function topbarBacking(stacked) {
    const triggers = [];
    if (outro) {
      triggers.push(ScrollTrigger.create({
        trigger: outro,
        start: 'top 12%',
        end: 'max',
        toggleClass: { targets: root, className: 'bar-solid' }
      }));
    }
    if (stacked) {
      triggers.push(ScrollTrigger.create({
        start: 40,
        endTrigger: next,
        end: 'top 12%',
        toggleClass: { targets: root, className: 'bar-solid' }
      }));
    }
    return () => {
      triggers.forEach((t) => t.kill());
      root.classList.remove('bar-solid');
    };
  }

  /* ---------- navegação e velocidade ---------- */

  // posição da câmera que enquadra o começo de cada cena
  const standAt = (id) => (id === 'sobre' ? 0 : clamp(0, travel, when(scene(id), 0, 0)));

  // voa até uma seção: dentro da jornada a câmera anda de lado; fora dela, o scroll desce
  function fly(id) {
    let y = null;
    const st = cam && cam.scrollTrigger;
    if (id === 'topo') {
      y = 0;
    } else if (scene(id) && st) {
      y = st.start + (travel ? standAt(id) / travel : 0) * (st.end - st.start);
    } else {
      const el = document.getElementById(id);
      if (el) y = el.getBoundingClientRect().top + window.scrollY;
    }
    if (y === null) return false;
    const distance = Math.abs(y - window.scrollY);
    gsap.to(window, {
      scrollTo: { y, autoKill: true },
      duration: calmMode ? 0 : clamp(1.1, 3.2, distance / 3000),
      ease: 'power3.inOut',
      overwrite: true
    });
    return true;
  }

  // qualquer [data-go] do site (menu, rodapé) e os botões "voltar ao começo"
  document.addEventListener('click', (e) => {
    const top = e.target.closest('[data-top]');
    const go = e.target.closest('[data-go]');
    const target = top ? 'topo' : go && go.dataset.go;
    if (!target) return;
    if (fly(target)) e.preventDefault();
  });

  // a velocidade do scroll vira linguagem: a câmera inclina e recua
  // e as cópias no varal balançam
  function velocity({ handheld }) {
    const drive = { v: 0 };
    const toV = gsap.quickTo(drive, 'v', { duration: 0.5, ease: 'power2' });
    const calm = gsap.delayedCall(0.12, () => toV(0)).pause();
    const setLens = gsap.quickSetter(lens, 'css');
    const grain = $('.grain');
    const swings = $$('.swing__body', world).map((el) =>
      gsap.quickTo(el, 'rotation', { duration: 1.8, ease: 'elastic.out(1, 0.28)' }));
    let fed = 0;
    let written = '';

    const feed = (self) => {
      const v = clamp(-1, 1, self.getVelocity() / 2400);
      toV(v);
      calm.restart(true);
      if (Math.abs(v - fed) > 0.04) {
        fed = v;
        swings.forEach((s) => s(v * -12));
      }
    };

    const tick = (time) => {
      const v = drive.v;
      const a = Math.abs(v);
      const h = handheld();
      const key = v.toFixed(3) + h.toFixed(2);
      if (key === written && h === 0) return;
      written = key;
      setLens({
        skewX: v * -2.6,
        scale: 1 - a * 0.04,
        // câmera na mão na cena do github: um respiro de operador, nunca parado
        y: h * (Math.sin(time * 1.3) * 3 + Math.sin(time * 2.9) * 1.2),
        rotation: h * Math.sin(time * 0.8) * 0.22
      });
      if (grain) grain.style.setProperty('--grain-boost', (a * 0.06).toFixed(3));
    };

    ScrollTrigger.create({
      trigger: next,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => (self.isActive ? gsap.ticker.add(tick) : gsap.ticker.remove(tick))
    });

    return {
      feed,
      stop: () => {
        gsap.ticker.remove(tick);
        calm.kill();
        if (grain) grain.style.removeProperty('--grain-boost');
      }
    };
  }

  // o cursor desloca o fundo para o lado contrário, como se a câmera olhasse em volta
  function sway() {
    const q = (el, p) => (el ? gsap.quickTo(el, p, { duration: 1.4, ease: 'power3' }) : () => {});
    const fx = q(far, 'x');
    const fy = q(far, 'y');
    const move = (e) => {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      fx(-nx * 26); fy(-ny * 14);
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }

  /* ---------- montagem ---------- */

  gsap.matchMedia().add(MEDIA, (ctx, contextSafe) => {
    const { reduced, stacked, fine } = ctx.conditions;
    const stops = [];
    const env = { stacked, fine, contextSafe };
    calmMode = reduced;

    // movimento reduzido: a viagem continua (é a navegação), mas sem inércia nem efeitos;
    // o iPod continua funcionando (ele se monta sozinho, no ipod.js)
    if (reduced) {
      const camera0 = camera({ scrub: true, feed: null });
      cam = camera0.tl;
      stops.push(camera0.stop);
      stops.push(ipodInView($('.ipod')));
      stops.push(topbarBacking(stacked));
      return () => stops.forEach((fn) => fn());
    }

    let gitSpan = () => [0, 0];
    const speed = velocity({
      handheld: () => {
        if (!cam) return 0;
        const c = cam.progress() * travel;
        const [a, b] = gitSpan();
        return clamp(0, 1, (c - a) / (vw() * 0.4)) * clamp(0, 1, (b - c) / (vw() * 0.4));
      }
    });
    stops.push(speed.stop);

    const camera1 = camera({ scrub: CAMERA.scrub, feed: speed.feed });
    cam = camera1.tl;
    stops.push(camera1.stop);

    stops.push(about(env));
    depth();
    stops.push(skills(env));
    stops.push(music(env));
    stops.push(projects(env));
    portal();
    const git = github(env);
    gitSpan = git.span;
    stops.push(git.stop);
    stops.push(contact(env));
    stops.push(topbarBacking(stacked));

    if (fine) stops.push(sway());

    return () => stops.forEach((fn) => fn());
  });
})();
