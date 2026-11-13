/* Rogue em' Slash — Entrada: teclado (2 jogadores no mesmo teclado: WASD e setas), até 4 controles (Gamepad API) e
   toque (celular/tablet). Como no RL20 (js/nucleo/entrada.js e js/nucleo/toque.js), o jogo nunca lê teclas
   diretamente: cada jogador deste aparelho tem um "dispositivo", que vira um movimento { x, y } (x para a direita, y
   para baixo na tela, de -1 a 1), mais duas ações: "interagir" (E, Enter, Espaço; A do controle; tocar na metade direita
   da tela) e "voltar" (Esc, Backspace; B ou Start do controle). */
(function (R) {
  'use strict';

  const temToque = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const I = {
    temToque,
    // celular/tablet sem teclado nem mouse (o modelo 3D desenha sem antialiasing nesses aparelhos: mais leve)
    soToque: temToque && !!(window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches),
    ativo: false,   // só lê os controles com a sala ou o jogo na tela (no login, o teclado é dos campos de texto)
    aoAcao: null,   // (nome) chamado quando aperta "interagir" ou "voltar"
  };
  const acao = (nome) => { if (I.ativo && I.aoAcao) I.aoAcao(nome); };

  /* Os dispositivos que um jogador pode usar. 'qualquer': o que nenhum outro jogador deste aparelho estiver usando. */
  I.DISPOSITIVOS = [
    ['qualquer', 'Qualquer um (o que sobrar)'],
    ['tecladoA', 'Teclado: WASD'],
    ['tecladoB', 'Teclado: setas'],
    ['controle0', 'Controle 1'], ['controle1', 'Controle 2'], ['controle2', 'Controle 3'], ['controle3', 'Controle 4'],
    ['toque', 'Toque na tela'],
  ];
  const REAIS = I.DISPOSITIVOS.map((d) => d[0]).filter((d) => d !== 'qualquer');

  /* ---------- Teclado ---------- */
  const TECLAS = {
    tecladoA: { cima: 'KeyW', baixo: 'KeyS', esquerda: 'KeyA', direita: 'KeyD' },
    tecladoB: { cima: 'ArrowUp', baixo: 'ArrowDown', esquerda: 'ArrowLeft', direita: 'ArrowRight' },
  };
  const DO_JOGO = new Set([...Object.values(TECLAS.tecladoA), ...Object.values(TECLAS.tecladoB)]);
  const apertadas = new Set();
  const TECLAS_ACAO = { KeyE: 'interagir', Enter: 'interagir', NumpadEnter: 'interagir', Space: 'interagir', Escape: 'voltar', Backspace: 'voltar' };
  window.addEventListener('keydown', (ev) => {
    if (!I.ativo) return;
    if (TECLAS_ACAO[ev.code]) { ev.preventDefault(); if (!ev.repeat) acao(TECLAS_ACAO[ev.code]); return; }
    if (!DO_JOGO.has(ev.code)) return;
    ev.preventDefault();   // (as setas não rolam a página)
    apertadas.add(ev.code);
  });
  window.addEventListener('keyup', (ev) => { apertadas.delete(ev.code); });
  window.addEventListener('blur', () => { apertadas.clear(); });   // trocou de janela: nada fica preso
  function teclado(t) {
    let x = (apertadas.has(t.direita) ? 1 : 0) - (apertadas.has(t.esquerda) ? 1 : 0);
    let y = (apertadas.has(t.baixo) ? 1 : 0) - (apertadas.has(t.cima) ? 1 : 0);
    if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }   // na diagonal, a mesma velocidade
    return { x, y };
  }

  /* ---------- Controles (Gamepad API, mapeamento "standard": Xbox / PlayStation) ----------
     Analógico esquerdo (com zona morta) ou o direcional (botões 12 a 15); A (0) interage; B (1) e Start (9) voltam. */
  const ZONA_MORTA = 0.22;
  const gamepad = (i) => { const l = navigator.getGamepads ? navigator.getGamepads() : []; const g = l && l[i]; return g && g.connected ? g : null; };
  I.controleConectado = (i) => !!gamepad(i);
  function controle(i) {
    const gp = gamepad(i);
    if (!gp) return { x: 0, y: 0 };
    const bt = (n) => !!(gp.buttons[n] && gp.buttons[n].pressed);
    let x = (bt(15) ? 1 : 0) - (bt(14) ? 1 : 0), y = (bt(13) ? 1 : 0) - (bt(12) ? 1 : 0);
    if (x || y) {
      if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
      return { x, y };
    }
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0, m = Math.hypot(ax, ay);
    if (m < ZONA_MORTA) return { x: 0, y: 0 };
    const k = Math.min(1, (m - ZONA_MORTA) / (1 - ZONA_MORTA)) / m;   // (sai do zero na borda da zona morta)
    return { x: ax * k, y: ay * k };
  }
  const BOTOES_ACAO = [[0, 'interagir'], [1, 'voltar'], [9, 'voltar']];
  const antes = [{}, {}, {}, {}];
  /* chamado a cada quadro: os botões de ação dos controles (só na hora em que aperta) */
  I.atualizar = function () {
    for (let i = 0; i < 4; i++) {
      const gp = gamepad(i);
      BOTOES_ACAO.forEach(([b, nome]) => {
        const s = !!(gp && gp.buttons[b] && gp.buttons[b].pressed);
        if (s && !antes[i][b]) acao(nome);
        antes[i][b] = s;
      });
    }
  };
  window.addEventListener('gamepadconnected', () => { if (I.aoMudarControles) I.aoMudarControles(); });
  window.addEventListener('gamepaddisconnected', () => { if (I.aoMudarControles) I.aoMudarControles(); });

  /* ---------- Toque: direcional que nasce onde o polegar encosta (metade esquerda da tela) ---------- */
  const T = { x: 0, y: 0, stick: null };
  function criarToque() {
    const el = document.createElement('div');
    el.id = 'toque';
    el.innerHTML = '<div class="tq-zona"><div class="tq-base"><div class="tq-pino"></div></div></div><div class="tq-acao"></div>';
    document.body.appendChild(el);
    el.addEventListener('touchstart', (ev) => ev.preventDefault(), { passive: false });   // sem zoom nem "clique" depois do toque
    const zona = el.querySelector('.tq-zona'), base = el.querySelector('.tq-base'), pino = el.querySelector('.tq-pino');
    const mover = (ev) => {
      const s = T.stick;
      if (!s || ev.pointerId !== s.id) return;
      let dx = (ev.clientX - s.x0) / s.raio, dy = (ev.clientY - s.y0) / s.raio;
      const mag = Math.hypot(dx, dy);
      if (mag > 1) { dx /= mag; dy /= mag; }
      pino.style.transform = 'translate(' + dx * s.raio + 'px,' + dy * s.raio + 'px)';
      if (mag < 0.18) { T.x = 0; T.y = 0; } else { T.x = dx; T.y = dy; }
    };
    const soltar = (ev) => {
      if (!T.stick || (ev && ev.pointerId !== T.stick.id)) return;
      T.stick = null; T.x = 0; T.y = 0;
      base.classList.remove('ativa');
      pino.style.transform = '';
    };
    zona.addEventListener('pointerdown', (ev) => {
      if (T.stick) return;
      const raio = base.offsetWidth / 2 || 50;
      T.stick = { id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, raio };
      try { zona.setPointerCapture(ev.pointerId); } catch (e) { /* ok */ }
      const r = zona.getBoundingClientRect();
      base.style.left = (ev.clientX - r.left) + 'px'; base.style.top = (ev.clientY - r.top) + 'px';
      base.classList.add('ativa');
      mover(ev);
    });
    el.querySelector('.tq-acao').addEventListener('pointerdown', () => acao('interagir'));   // tocar na metade direita
    zona.addEventListener('pointermove', mover);
    zona.addEventListener('pointerup', soltar);
    zona.addEventListener('pointercancel', soltar);
    I.soltarToque = () => soltar();
  }
  I.iniciar = function () { if (temToque) criarToque(); };

  /* ---------- Movimento ---------- */
  function deDispositivo(d) {
    if (d === 'tecladoA' || d === 'tecladoB') return teclado(TECLAS[d]);
    if (d === 'toque') return { x: T.x, y: T.y };
    const m = /^controle(\d)$/.exec(d);
    return m ? controle(+m[1]) : { x: 0, y: 0 };
  }
  /* O movimento de um dispositivo. ocupados: os que outros jogadores deste aparelho usam (o 'qualquer' pula esses e
     fica com o mais inclinado dos que sobram). */
  I.movimento = function (d, ocupados) {
    if (!I.ativo) return { x: 0, y: 0 };
    if (d !== 'qualquer') return deDispositivo(d);
    let melhor = { x: 0, y: 0 }, m = 0;
    for (const r of REAIS) {
      if (ocupados && ocupados.has(r)) continue;
      const c = deDispositivo(r), mc = Math.hypot(c.x, c.y);
      if (mc > m) { melhor = c; m = mc; }
    }
    return melhor;
  };
  /* solta tudo (ao abrir o menu: ninguém continua andando sozinho) */
  I.soltarTudo = function () { apertadas.clear(); if (I.soltarToque) I.soltarToque(); };

  R.Input = I;
})(window.RES);
