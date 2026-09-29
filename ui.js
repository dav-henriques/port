/*
 * ui.js — dados do perfil (config.js), tema claro/escuro, menu, modal e formulário de contato.
 * Roda antes do motion: os dados reais já estão no texto quando as animações dividem as letras.
 */
(() => {
  'use strict';

  const root = document.documentElement;
  const $ = (sel, scope = document) => scope.querySelector(sel);
  const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];
  const gsap = window.gsap || null;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const animate = () => gsap && !reduced.matches;
  const PERFIL = window.PERFIL || {};

  /* ---------- aviso rápido ---------- */

  let toastEl = null;
  let toastTimer = 0;
  function toast(message) {
    if (!toastEl) {
      toastEl = document.createElement('p');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
    }
    // com o modal aberto, o aviso precisa morar dentro dele (camada do topo)
    const openDialog = document.querySelector('dialog[open]');
    const host = openDialog || document.body;
    if (toastEl.parentNode !== host) host.appendChild(toastEl);
    toastEl.textContent = message;
    clearTimeout(toastTimer);
    if (animate()) {
      gsap.fromTo(toastEl, { opacity: 0, xPercent: -50, x: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power3.out', overwrite: true });
    } else {
      toastEl.style.opacity = '1';
    }
    toastTimer = setTimeout(() => {
      if (animate()) gsap.to(toastEl, { opacity: 0, y: 10, duration: 0.3, ease: 'power2.in' });
      else toastEl.style.opacity = '0';
    }, 2600);
  }

  /* ---------- dados do perfil ---------- */

  const PLACEHOLDER = {
    github: 'https://github.com/dav-henriques',
    email: 'dav.henriques.o@gmail.com',
    telefone: '+55 31 99787-4857',
    musica: 'https://dav-henriques.github.io/board/'
  };

  const withProtocol = (url) => (/^https?:\/\//i.test(url) ? url : 'https://' + url);
  const shortUrl = (url) => url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');

  const hrefFor = (key, value) => {
    if (key === 'email') return 'mailto:' + value;
    if (key === 'telefone') return 'tel:+55' + value.replace(/\D/g, '');
    return withProtocol(value);
  };

  function fillPerfil(scope = document) {
    for (const link of $$('[data-perfil]', scope)) {
      const key = link.dataset.perfil;
      const value = String(PERFIL[key] || '').trim();
      if (value) {
        link.href = hrefFor(key, value);
        if (key === 'github' || key === 'musica') {
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
        }
        link.classList.remove('is-empty');
        link.removeAttribute('aria-disabled');
      } else {
        link.setAttribute('href', '#');
        link.classList.add('is-empty');
        link.setAttribute('aria-disabled', 'true');
      }
    }
    for (const text of $$('[data-perfil-text]', scope)) {
      const key = text.dataset.perfilText;
      const value = String(PERFIL[key] || '').trim();
      if (!value) text.textContent = PLACEHOLDER[key] || text.textContent;
      else text.textContent = key === 'github' || key === 'musica' ? shortUrl(value) : value;
    }
  }

  fillPerfil();

  // um link que ainda é espaço reservado avisa em vez de navegar
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a.is-empty, a[data-placeholder]');
    if (!link) return;
    e.preventDefault();
    toast(link.hasAttribute('data-placeholder')
      ? 'link ainda não adicionado — troque no index.html'
      : 'link ainda não adicionado — preencha em config.js');
  }, true);

  /* ---------- tema claro / escuro ---------- */

  const themeBtn = $('.theme');
  const themeLabel = $('.theme__label');
  const themeMeta = $('meta[name="theme-color"]');

  const readSaved = () => {
    try { return localStorage.getItem('tema'); } catch (e) { return null; }
  };

  const syncTheme = () => {
    const light = root.getAttribute('data-theme') === 'light';
    if (themeBtn) {
      themeBtn.setAttribute('aria-pressed', String(light));
      themeBtn.setAttribute('aria-label', light ? 'ativar modo escuro' : 'ativar modo claro');
    }
    if (themeLabel) themeLabel.textContent = light ? 'claro' : 'escuro';
    if (themeMeta) themeMeta.setAttribute('content', light ? '#ebe7de' : '#090909');
  };

  const applyTheme = (theme) => {
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem('tema', theme); } catch (e) { /* navegação privada: vale só nesta visita */ }
    syncTheme();
  };

  syncTheme();

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const nextTheme = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      // a luz nova se espalha num círculo a partir do botão
      if (document.startViewTransition && !reduced.matches) {
        const box = themeBtn.getBoundingClientRect();
        const x = box.left + box.width / 2;
        const y = box.top + box.height / 2;
        const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
        const transition = document.startViewTransition(() => applyTheme(nextTheme));
        transition.ready.then(() => {
          root.animate(
            { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
            { duration: 750, easing: 'cubic-bezier(.16, .84, .34, 1)', pseudoElement: '::view-transition-new(root)' }
          );
        }).catch(() => {});
      } else {
        applyTheme(nextTheme);
      }
    });
  }

  // sem escolha salva, acompanha o sistema; com escolha, vale em todas as abas/páginas
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
    if (readSaved()) return;
    root.setAttribute('data-theme', e.matches ? 'light' : 'dark');
    syncTheme();
  });
  window.addEventListener('storage', (e) => {
    if (e.key === 'tema' && (e.newValue === 'light' || e.newValue === 'dark')) {
      root.setAttribute('data-theme', e.newValue);
      syncTheme();
    }
  });

  /* ---------- menu ---------- */

  const menu = $('#menu');
  const menuBtn = $('.menu-btn');
  let menuOpen = false;

  function openMenu() {
    if (!menu || menuOpen) return;
    menuOpen = true;
    menu.hidden = false;
    root.classList.add('menu-open');
    menuBtn.setAttribute('aria-expanded', 'true');
    const links = $$('.menu__list a', menu);
    if (animate()) {
      const b = menuBtn.getBoundingClientRect();
      const at = `${Math.round(b.left + b.width / 2)}px ${Math.round(b.top + b.height / 2)}px`;
      gsap.timeline()
        .fromTo($('.menu__paper', menu), { clipPath: `circle(0% at ${at})` },
          { clipPath: `circle(150% at ${at})`, duration: 0.8, ease: 'expo.inOut' }, 0)
        .fromTo($$('.menu__t', menu), { yPercent: 110, rotation: 4, autoAlpha: 0 },
          { yPercent: 0, rotation: 0, autoAlpha: 1, duration: 0.8, ease: 'expo.out', stagger: 0.05 }, 0.28)
        .fromTo($$('.menu__n, .menu__aside', menu), { autoAlpha: 0, y: 12 },
          { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.04 }, 0.4)
        .fromTo($$('.menu__deco', menu), { scale: 0.4, rotation: '-=40', autoAlpha: 0 },
          { scale: 1, rotation: '+=40', autoAlpha: 1, duration: 1, ease: 'expo.out', stagger: 0.1 }, 0.35);
    }
    if (links[0]) links[0].focus({ preventScroll: true });
  }

  function closeMenu(returnFocus = true) {
    if (!menu || !menuOpen) return;
    menuOpen = false;
    root.classList.remove('menu-open');
    menuBtn.setAttribute('aria-expanded', 'false');
    const hide = () => { menu.hidden = true; };
    if (animate()) {
      gsap.timeline({ onComplete: hide })
        .to($$('.menu__t, .menu__n, .menu__aside, .menu__deco', menu), { autoAlpha: 0, y: -10, duration: 0.25, ease: 'power2.in' }, 0)
        .to($('.menu__paper', menu), { autoAlpha: 0, duration: 0.35, ease: 'power2.in' }, 0.1)
        .set($('.menu__paper', menu), { autoAlpha: 1 });
    } else {
      hide();
    }
    if (returnFocus) menuBtn.focus({ preventScroll: true });
  }

  if (menu && menuBtn) {
    menuBtn.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
    // escolher um destino fecha o menu (o voo em si é do journey.js)
    menu.addEventListener('click', (e) => {
      if (e.target.closest('a')) closeMenu(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menuOpen) closeMenu();
    });
  }

  /* ---------- modal ---------- */

  const modal = $('#modal');
  const modalBody = modal && $('.modal__body', modal);
  const modalSheet = modal && $('.modal__sheet', modal);
  let lastFocus = null;
  let closing = false;
  let waveLoop = null;

  function openModal(id, opener) {
    const tpl = document.getElementById(id);
    if (!modal || !tpl || typeof modal.showModal !== 'function') return;
    modalBody.replaceChildren(tpl.content.cloneNode(true));
    fillPerfil(modalBody);
    lastFocus = opener || document.activeElement;
    modal.showModal();
    root.classList.add('modal-open');
    modalSheet.scrollTop = 0;
    // o foco vai para a folha (e não para o X), então nenhum anel de foco aparece ao abrir com o mouse;
    // no teclado, o próximo Tab já chega ao botão de fechar
    modalSheet.focus({ preventScroll: true });

    if (animate()) {
      gsap.timeline()
        .fromTo(modalSheet, { autoAlpha: 0, y: 70, rotation: -3, scale: 0.94 },
          { autoAlpha: 1, y: 0, rotation: 0, scale: 1, duration: 0.8, ease: 'expo.out' })
        .fromTo([...modalBody.children], { autoAlpha: 0, y: 18 },
          { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.06 }, 0.15)
        // o X gira para dentro (sem a transição de hover do CSS atrapalhando o tween)
        .set($('.modal__close', modal), { transition: 'none' }, 0)
        .fromTo($('.modal__close', modal), { scale: 0, rotation: -90 },
          { scale: 1, rotation: 0, duration: 0.7, ease: 'back.out(2)', clearProps: 'transform,transition' }, 0.3);
      const bars = $$('.modal__wave i', modalBody);
      if (bars.length) {
        waveLoop = gsap.to(bars, {
          scaleY: () => 0.15 + Math.random() * 0.85,
          duration: 0.35,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
          repeatRefresh: true,
          stagger: { each: 0.04, from: 'center' }
        });
      }
    }
  }

  function closeModal() {
    if (!modal || !modal.open || closing) return;
    closing = true;
    const finish = () => {
      if (waveLoop) waveLoop.kill();
      waveLoop = null;
      modal.close();
      modal.classList.remove('is-closing');
      root.classList.remove('modal-open');
      if (gsap) gsap.set(modalSheet, { clearProps: 'all' });
      modalBody.replaceChildren();
      closing = false;
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    };
    modal.classList.add('is-closing');
    if (animate()) {
      gsap.to(modalSheet, { autoAlpha: 0, y: 40, rotation: 2, scale: 0.96, duration: 0.3, ease: 'power2.in', onComplete: finish });
    } else {
      finish();
    }
  }

  if (modal) {
    document.addEventListener('click', (e) => {
      const opener = e.target.closest('[data-modal]');
      if (!opener) return;
      e.preventDefault();
      openModal(opener.dataset.modal, opener);
    });
    $('.modal__close', modal).addEventListener('click', closeModal);
    // Esc
    modal.addEventListener('cancel', (e) => {
      e.preventDefault();
      closeModal();
    });
    // clique fora da folha (no fundo escurecido)
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  /* ---------- formulário de contato ---------- */

  const form = $('#form-contato');
  if (!form) return;

  const onlyDigits = (s) => s.replace(/\D/g, '');

  // (31) 3333-4444 ou (31) 99999-8888, montado enquanto a pessoa digita
  const maskPhone = (value) => {
    const d = onlyDigits(value).slice(0, 11);
    if (!d) return '';
    if (d.length <= 2) return `(${d}`;
    const ddd = d.slice(0, 2);
    const rest = d.slice(2);
    if (rest.length <= 4) return `(${ddd}) ${rest}`;
    if (d.length <= 10) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  };

  // coloca o cursor de texto logo depois do n-ésimo dígito
  const caretAfterDigits = (input, n) => {
    let seen = 0;
    let pos = 0;
    if (n > 0) {
      for (let i = 0; i < input.value.length; i++) {
        if (/\d/.test(input.value[i])) seen++;
        if (seen === n) { pos = i + 1; break; }
      }
    }
    input.setSelectionRange(pos, pos);
  };

  const fields = {
    nome: $('#f-nome', form),
    telefone: $('#f-tel', form),
    email: $('#f-email', form),
    mensagem: $('#f-msg', form)
  };

  const rules = {
    nome: (v) => {
      const name = v.trim();
      if (!name) return 'escreva seu nome';
      if (name.replace(/[^\p{L}]/gu, '').length < 2) return 'nome muito curto';
      if (!/^[\p{L}][\p{L}\s'-]*$/u.test(name)) return 'use só letras no nome';
      return '';
    },
    telefone: (v) => {
      const d = onlyDigits(v);
      if (!d) return 'escreva seu telefone';
      if (d.length < 10) return 'telefone incompleto — DDD + número';
      if (+d.slice(0, 2) < 11) return 'DDD inválido';
      if (d.length === 11 && d[2] !== '9') return 'celular com 11 dígitos começa com 9';
      return '';
    },
    email: (v) => {
      const email = v.trim();
      if (!email) return 'escreva seu e-mail';
      if (!/^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(email)) return 'e-mail inválido — ex.: nome@dominio.com';
      return '';
    },
    mensagem: (v) => {
      const text = v.trim();
      if (!text) return 'escreva sua mensagem';
      if (text.length < 10) return 'mensagem muito curta (mínimo de 10 caracteres)';
      return '';
    }
  };

  const touched = new Set();

  const check = (key, show = touched.has(key)) => {
    const input = fields[key];
    const field = input.closest('.field');
    const error = rules[key](input.value);
    const box = $('.field__error', field);
    if (show) {
      field.classList.toggle('is-invalid', !!error);
      field.classList.toggle('is-valid', !error);
      input.setAttribute('aria-invalid', String(!!error));
      box.textContent = error;
    }
    return !error;
  };

  // nome: só letras, espaços, hífen e apóstrofo
  fields.nome.addEventListener('input', () => {
    const input = fields.nome;
    const clean = input.value.replace(/[^\p{L}\s'-]/gu, '').replace(/\s{2,}/g, ' ').replace(/^\s+/, '');
    if (clean !== input.value) {
      const pos = input.selectionStart - (input.value.length - clean.length);
      input.value = clean;
      input.setSelectionRange(Math.max(0, pos), Math.max(0, pos));
    }
    check('nome');
  });

  // telefone: máscara brasileira ao digitar, colar e apagar
  fields.telefone.addEventListener('beforeinput', (e) => {
    const input = fields.telefone;
    if (e.inputType !== 'deleteContentBackward') return;
    const pos = input.selectionStart;
    if (pos !== input.selectionEnd || pos === 0 || /\d/.test(input.value[pos - 1])) return;
    // apagar um "(", ")", espaço ou "-" apaga o dígito anterior a ele
    e.preventDefault();
    const before = onlyDigits(input.value.slice(0, pos)).length;
    const digits = onlyDigits(input.value);
    input.value = maskPhone(digits.slice(0, Math.max(0, before - 1)) + digits.slice(before));
    caretAfterDigits(input, Math.max(0, before - 1));
    check('telefone');
  });
  fields.telefone.addEventListener('input', () => {
    const input = fields.telefone;
    const before = onlyDigits(input.value.slice(0, input.selectionStart)).length;
    input.value = maskPhone(input.value);
    caretAfterDigits(input, before);
    check('telefone');
  });

  // e-mail: sem espaços; em minúsculas ao sair do campo
  // (type="email" não expõe a posição do cursor, então só limpa o valor)
  fields.email.addEventListener('input', () => {
    const input = fields.email;
    if (/\s/.test(input.value)) input.value = input.value.replace(/\s/g, '');
    check('email');
  });
  fields.email.addEventListener('blur', () => {
    fields.email.value = fields.email.value.trim().toLowerCase();
  });

  const counter = $('#c-msg span', form);
  fields.mensagem.addEventListener('input', () => {
    if (counter) counter.textContent = String(fields.mensagem.value.length);
    check('mensagem');
  });

  for (const key of Object.keys(fields)) {
    fields[key].addEventListener('blur', () => {
      if (!fields[key].value && !touched.has(key)) return;
      touched.add(key);
      check(key);
    });
  }

  const shake = (el) => {
    if (animate()) gsap.fromTo(el, { x: 0 }, { keyframes: { x: [0, -10, 9, -6, 4, 0] }, duration: 0.45, ease: 'none' });
  };

  const status = $('.form__status', form);
  const send = $('.form__send', form);
  const sendLabel = $('.form__send-label', form);
  const done = $('.form__done', form);
  const who = $('.form__who', form);
  const note = $('.form__note', form);
  const stamp = $('.form__stamp', form);

  // a confirmação diz exatamente o que aconteceu com a mensagem
  const OUTCOME = {
    sent: ['enviado', 'sua mensagem chegou.'],
    mail: ['pronto', 'seu app de e-mail abriu com a mensagem pronta — é só enviar.'],
    demo: ['ok', 'mensagem validada. (o envio ainda não foi configurado em config.js)']
  };

  const showDone = (name, how = 'sent') => {
    form.classList.add('is-sent');
    done.hidden = false;
    who.textContent = name ? ', ' + name.split(' ')[0] : '';
    [stamp.textContent, note.textContent] = OUTCOME[how];
    if (animate()) {
      gsap.timeline()
        .fromTo($('.form__stamp', form), { scale: 2.4, rotation: -30, autoAlpha: 0 },
          { scale: 1, rotation: -9, autoAlpha: 1, duration: 0.45, ease: 'power4.in' })
        .fromTo(form, { y: 0 }, { keyframes: { y: [0, 6, -2, 0] }, duration: 0.35 })
        .fromTo([$('.form__thanks', form), $('.form__again', form)], { autoAlpha: 0, y: 14 },
          { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.1 }, '-=0.1');
    }
    $('.form__again', form).focus({ preventScroll: true });
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = '';
    for (const key of Object.keys(fields)) touched.add(key);
    const invalid = Object.keys(fields).filter((key) => !check(key, true));
    if (invalid.length) {
      const first = fields[invalid[0]];
      first.focus();
      invalid.forEach((key) => shake(fields[key].closest('.field')));
      status.textContent = invalid.length > 1 ? `confira os ${invalid.length} campos marcados` : 'confira o campo marcado';
      return;
    }

    const name = fields.nome.value.trim();

    // a armadilha foi preenchida: é robô — finge que deu certo e não envia nada
    if ($('#f-site', form).value) {
      showDone(name);
      return;
    }

    const endpoint = String(PERFIL.formulario || '').trim();
    const inbox = String(PERFIL.email || '').trim();

    // sem serviço de formulário, mas com e-mail: abre o app de e-mail com tudo preenchido
    if (!endpoint && inbox) {
      const subject = `contato pelo portfólio — ${name}`;
      const body = [
        fields.mensagem.value.trim(),
        '',
        `nome: ${name}`,
        `telefone: ${fields.telefone.value}`,
        `e-mail: ${fields.email.value.trim()}`
      ].join('\n');
      window.location.href = `mailto:${inbox}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      showDone(name, 'mail');
      return;
    }

    send.setAttribute('aria-busy', 'true');
    sendLabel.textContent = 'enviando…';
    try {
      if (endpoint) {
        const response = await fetch(endpoint, {
          method: 'POST',
          body: new FormData(form),
          headers: { Accept: 'application/json' }
        });
        if (!response.ok) throw new Error('envio falhou');
        showDone(name, 'sent');
      } else {
        // nada configurado em config.js: a mensagem não sai daqui, e a tela diz isso
        await new Promise((resolve) => setTimeout(resolve, 600));
        showDone(name, 'demo');
      }
    } catch (err) {
      status.textContent = 'não deu para enviar agora — tente de novo em instantes';
    } finally {
      send.removeAttribute('aria-busy');
      sendLabel.textContent = 'enviar';
    }
  });

  $('.form__again', form).addEventListener('click', () => {
    form.reset();
    touched.clear();
    if (counter) counter.textContent = '0';
    for (const key of Object.keys(fields)) {
      const field = fields[key].closest('.field');
      field.classList.remove('is-invalid', 'is-valid');
      fields[key].removeAttribute('aria-invalid');
      $('.field__error', field).textContent = '';
    }
    form.classList.remove('is-sent');
    done.hidden = true;
    fields.nome.focus();
  });
})();
