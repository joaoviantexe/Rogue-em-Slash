/* Rogue em' Slash — Entrada: teclado, controles (até 4, Gamepad API) e toque (celular/tablet).
   Como no RL20 (js/nucleo/entrada.js e js/nucleo/toque.js), o jogo nunca lê teclas diretamente: cada "dispositivo"
   vira um movimento { x, y } (x para a direita, y para baixo na tela, de -1 a 1). Por enquanto só o movimento.
   Cada jogador terá o seu dispositivo (4 jogadores locais); hoje há só o jogador 1, que usa o que estiver mexendo. */
(function (R) {
  'use strict';

  const temToque = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const I = {
    temToque,
    // celular/tablet sem teclado nem mouse (o modelo 3D desenha sem antialiasing nesses aparelhos: mais leve)
    soToque: temToque && !!(window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches),
  };

  /* ---------- Teclado: WASD ou setas ---------- */
  const TECLAS = {
    cima: ['KeyW', 'ArrowUp'], baixo: ['KeyS', 'ArrowDown'], esquerda: ['KeyA', 'ArrowLeft'], direita: ['KeyD', 'ArrowRight'],
  };
  const DO_JOGO = new Set(Object.values(TECLAS).flat());
  const apertadas = new Set();
  window.addEventListener('keydown', (ev) => {
    if (!DO_JOGO.has(ev.code)) return;
    ev.preventDefault();   // (as setas não rolam a página)
    apertadas.add(ev.code);
  });
  window.addEventListener('keyup', (ev) => { apertadas.delete(ev.code); });
  window.addEventListener('blur', () => { apertadas.clear(); });   // trocou de janela: nada fica preso
  const algumaDe = (l) => l.some((c) => apertadas.has(c));
  function teclado() {
    let x = (algumaDe(TECLAS.direita) ? 1 : 0) - (algumaDe(TECLAS.esquerda) ? 1 : 0);
    let y = (algumaDe(TECLAS.baixo) ? 1 : 0) - (algumaDe(TECLAS.cima) ? 1 : 0);
    if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }   // na diagonal, a mesma velocidade
    return { x, y };
  }

  /* ---------- Controles (Gamepad API, mapeamento "standard": Xbox / PlayStation) ----------
     Analógico esquerdo (com zona morta) ou o direcional (botões 12 a 15). */
  const ZONA_MORTA = 0.22;
  function controle(i) {
    const gp = navigator.getGamepads ? navigator.getGamepads()[i] : null;
    if (!gp || !gp.connected) return null;
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

  /* ---------- Toque: direcional que nasce onde o polegar encosta (metade esquerda da tela) ---------- */
  const T = { x: 0, y: 0, stick: null };
  function criarToque() {
    const el = document.createElement('div');
    el.id = 'toque';
    el.innerHTML = '<div class="tq-zona"><div class="tq-base"><div class="tq-pino"></div></div></div>';
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
    zona.addEventListener('pointermove', mover);
    zona.addEventListener('pointerup', soltar);
    zona.addEventListener('pointercancel', soltar);
    window.addEventListener('blur', () => soltar());
  }
  I.iniciar = function () { if (temToque) criarToque(); };

  /* ---------- Movimento de um jogador ----------
     slot: 0 a 3. Por enquanto só existe o jogador 1 (slot 0), que usa qualquer dispositivo: o que estiver mais
     inclinado entre o teclado, o toque e os controles. */
  I.movimento = function (slot) {
    if (slot !== 0) return { x: 0, y: 0 };
    let melhor = teclado(), m = Math.hypot(melhor.x, melhor.y);
    const cands = [{ x: T.x, y: T.y }];
    for (let i = 0; i < 4; i++) { const c = controle(i); if (c) cands.push(c); }
    for (const c of cands) { const mc = Math.hypot(c.x, c.y); if (mc > m) { melhor = c; m = mc; } }
    return melhor;
  };

  R.Input = I;
})(window.RES);
