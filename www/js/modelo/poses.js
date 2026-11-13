/* Rogue em' Slash — Poses e animações do modelo 3D dos heróis (copiado do RL20: js/jogo/poses.js).
   Por enquanto só o que o movimento precisa: a postura neutra, o parado e o andar do herói (os do Caçador do RL20,
   animações de hack and slash), com a dinâmica do cabelo e da capa. As outras (correr, pular, golpes...) entram aqui
   quando forem pedidas, com os mesmos nomes do RL20.
   Cada osso recebe [x, y, z] em graus. Tronco e cabeça: x+ inclina para a frente, y+ gira o ombro direito
   para a frente. Braços e pernas: x+ leva o membro para a frente, z+ abre para fora; na canela, x+ dobra o
   joelho; no antebraço, x+ dobra o cotovelo. Cabelo e capa (pendem com a gravidade): x+ balança para a frente;
   sem "capa" na pose, a capa acompanha o cabelo de trás.
   chao: true (os pés encostam no chão), 'corpo' (o ponto mais baixo do corpo encosta) ou false (no ar); alto: quanto o
   corpo sobe depois de encostar. */
(function (R) {
  'use strict';

  const Z = [0, 0, 0];
  /* postura neutra: calma, em pé, o peso numa perna, os braços soltos ao lado do corpo (um pouco abertos, para
     passarem por fora de casacos e saias) — a base de tudo e o parado do jogador */
  const BASE = {
    raiz: [1, 5, 0], tronco: [1, -3, 0], peito: [0, -2, 0], pescoco: [0, 0, 0], cabeca: [-1, 2, 0],
    bracoE: [3, 0, 13], antebracoE: [12, 0, 0], maoE: [0, 0, 0],
    bracoD: [5, 0, 13], antebracoD: [14, 0, 0], maoD: [0, 0, 0],
    coxaE: [-4, 0, 6], canelaE: [4, 0, 0], peE: Z,
    coxaD: [7, 0, 5], canelaD: [8, 0, 0], peD: Z,
    cabeloT: [-2, 0, 0], cabeloE: [0, 0, 3], cabeloD: [0, 0, 3],
    rosto: { olhos: 'aberto', boca: 'neutra' },
  };

  function com(base, mods) {
    const p = {};
    for (const k in base) p[k] = Array.isArray(base[k]) ? base[k].slice() : (base[k] && typeof base[k] === 'object' ? Object.assign({}, base[k]) : base[k]);
    for (const k in mods) p[k] = Array.isArray(mods[k]) ? mods[k].slice() : (mods[k] && typeof mods[k] === 'object' ? Object.assign({}, p[k] || {}, mods[k]) : mods[k]);
    return p;
  }
  /* soma deslocamentos em ossos */
  function mais(p, mods) {
    for (const k in mods) { const a = p[k] || Z, b = mods[k]; p[k] = [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
    return p;
  }
  /* mistura duas poses (para quadros de transição) */

  /* ajusta: o joelho da perna 'E' ou 'D' é calculado para o pé dela ficar na mesma altura do pé da outra (posturas
     abertas: a perna de trás esticada para trás, as duas no chão). Coxa 21 e canela 22 (a proporção não muda com o
     tamanho das pernas); a inclinação do quadril (raiz x) entra nas duas coxas (coxa no espaço do mundo = coxa − raiz). */
  function ajustarJoelho(p, l) {
    const o = l === 'E' ? 'D' : 'E', r = (p.raiz || Z)[0], RD = Math.PI / 180;
    const aF = ((p['coxa' + o] || Z)[0] - r) * RD, kF = ((p['canela' + o] || Z)[0]) * RD, aT = ((p['coxa' + l] || Z)[0] - r) * RD;
    const queda = 21 * Math.cos(aF) + 22 * Math.cos(aF - kF);
    const v = Math.max(-1, Math.min(1, (queda - 21 * Math.cos(aT)) / 22));
    let s = -Math.acos(v);   // canela para trás
    if (s > aT) s = Math.acos(v) <= aT ? Math.acos(v) : aT;   // (a perna não alcança: esticada)
    const c = p['canela' + l] || Z;
    p['canela' + l] = [Math.max(0, (aT - s) / RD), c[1], c[2]];
  }
  /* pés planos no chão (a não ser no ar): o pé compensa a inclinação da perna */
  function finalizar(p) {
    if (p.ajusta && p.chao !== false) ajustarJoelho(p, p.ajusta);
    delete p.ajusta;
    if (p.pePlano !== false && p.chao !== false) {
      const r = (p.raiz || Z)[0];
      ['E', 'D'].filter((l) => p.pePlano == null || p.pePlano === true || p.pePlano === l).forEach((l) => {
        const a = (p['coxa' + l] || Z)[0], k = (p['canela' + l] || Z)[0], pe = p['pe' + l] || Z;
        p['pe' + l] = [pe[0] + r + k - a, pe[1], pe[2]];
      });
    }
    // calcanhar: [lado, graus] levanta o calcanhar desse pé (fica na ponta do pé, como a perna de trás numa base aberta)
    if (p.calcanhar) { const [l, g] = p.calcanhar, pe = p['pe' + l] || Z; p['pe' + l] = [pe[0] - g, pe[1], pe[2]]; }
    delete p.calcanhar;
    return p;
  }

  const A = {};
  const ciclo = (n, f) => Array.from({ length: n }, (_, i) => f(i, (i / n) * Math.PI * 2));
  const BRAVO = { olhos: 'bravo', boca: 'neutra' };
  const K = (mods) => com(BASE, mods);   // pose-chave (parte da neutra: tem todos os ossos)

  /* ---------- Herói: parado e andar (os do Caçador do RL20) ---------- */
  /* parado: postura de caçador — o quadril de lado e o peso na perna de trás, a da frente solta com o joelho dobrado; o
     tronco um pouco à frente, os ombros voltando para a câmera e o queixo baixo, olhando a presa por baixo da franja; os
     dois braços soltos ao lado do corpo (o de longe um pouco à frente, o de perto um pouco para trás). É onde os golpes
     começam e terminam. */
  const PARADO = K({
    raiz: [4, 26, 0], tronco: [2, -8, 0], peito: [0, -6, 0], pescoco: [2, 0, 0], cabeca: [2, -14, 0],
    bracoE: [8, 0, 10], antebracoE: [22, 0, 0], maoE: [-4, 0, 0],
    bracoD: [-10, 0, 17], antebracoD: [24, 0, 0], maoD: [0, 0, 0],
    coxaE: [22, 0, 10], canelaE: [24, 0, 0], coxaD: [-8, 0, 8], canelaD: [6, 0, 0],
    cabeloT: [-4, 0, 0], cabeloE: [0, 0, 4], cabeloD: [0, 0, 4],
    rosto: BRAVO, ajusta: 'E',
  });
  /* respira devagar (o peito sobe, os ombros acompanham, o peso passa um pouco de uma perna para a outra), os braços
     balançam de leve e pisca uma vez */
  A.idle = ciclo(20, (i, t) => {
    const s = Math.sin(t), c = Math.cos(t), s2 = Math.sin(t * 2);
    return mais(com(PARADO, { rosto: { olhos: i === 15 ? 'fechado' : 'bravo', boca: 'neutra' } }), {
      peito: [-1.6 * s, 0, 0], tronco: [-0.4 * s, 1 * s, 0], cabeca: [0.6 * s, 1.2 * c, 0], raiz: [0.4 * (1 - c), -1.2 * s, 0.8 * s],
      bracoE: [1 * s, 0, 1 * s], bracoD: [-1 * s, 0, 1.6 * s], antebracoE: [3 * s2, 0, 0], antebracoD: [1.5 * s, 0, 0], maoE: [-4 * s2, 0, 0],
      coxaE: [1.2 * s2 * 0.5, 0, 0], canelaD: [1 * (1 - c), 0, 0],
    });
  });

  /* fase de uma perna numa tabela de passadas [coxa (no mundo), joelho, pé (+ a ponta sobe, − o calcanhar sobe)], com
     ph de 0 a 8 (fases interpoladas) → [coxa, canela, pe] da pose com o quadril inclinado rx (o pé já compensa a perna) */
  const fasePerna = (tab, ph, rx) => {
    const a = Math.floor(ph) % 8, b = (a + 1) % 8, u = ph - Math.floor(ph);
    const [c, j, pe] = [0, 1, 2].map((k) => tab[a][k] + (tab[b][k] - tab[a][k]) * u);
    return [c + rx, j, pe + j - c];
  };

  /* andar: passo firme e solto — o calcanhar encosta primeiro, o joelho cede um tico ao receber o peso, a perna de
     apoio passa reta por baixo do corpo e a de trás sai na ponta do pé; a que vai dobra o joelho já indo para a frente
     (o pé passa por baixo do corpo, não chuta para trás). Os braços balançam soltos ao contrário das pernas (o cotovelo
     dobra um pouco mais na frente), o quadril gira um pouco e os ombros fazem o contrário; a cabeça segura o olhar.
     12 quadros, cada perna passa pelas 8 fases da tabela. */
  const ANDAR = K({
    raiz: [4, 12, 0], tronco: [1, -5, 0], peito: [0, -4, 0], cabeca: [-4, -8, 0],
    bracoE: [6, 0, 10], antebracoE: [24, 0, 0], maoE: [0, 0, 0], bracoD: [4, 0, 13], antebracoD: [22, 0, 0], maoD: [0, 0, 0],
    coxaE: [0, 0, 4], coxaD: [0, 0, 4], canelaE: [6, 0, 0], canelaD: [6, 0, 0],
    cabeloT: [-10, 0, 0], cabeloE: [-6, 0, 4], cabeloD: [-6, 0, 4], rosto: { olhos: 'aberto', boca: 'neutra' }, pePlano: false,
  });
  const PASSO_ANDAR = [[24, 4, 10], [18, 14, 0], [6, 6, 0], [-8, 4, -4], [-18, 14, -16], [-12, 44, -22], [8, 58, -8], [24, 26, 4]];
  A.walk = ciclo(12, (i, f) => {
    const ph = (i * 8) / 12, D = fasePerna(PASSO_ANDAR, ph, ANDAR.raiz[0]), E = fasePerna(PASSO_ANDAR, (ph + 4) % 8, ANDAR.raiz[0]);
    const c = Math.cos(f), b = Math.cos(f - 0.35);   // os braços vêm um pouco atrasados
    return mais(com(ANDAR, {}), {
      coxaD: [D[0], 0, 0], canelaD: [D[1], 0, 0], peD: [D[2], 0, 0], coxaE: [E[0], 0, 0], canelaE: [E[1], 0, 0], peE: [E[2], 0, 0],
      bracoD: [-20 * b, 0, 0], bracoE: [20 * b, 0, 0], antebracoD: [10 * Math.max(0, -b), 0, 0], antebracoE: [10 * Math.max(0, b), 0, 0],
      raiz: [0, 6 * c, 0], tronco: [0, -9 * c, 0], peito: [0, -3 * c, 0], cabeca: [0, 4 * c, 0],
    });
  });

  /* =====================================================================
     DINÂMICA: o cabelo, a capa e a barra do casaco atrasados (calculada uma vez, quadro a quadro, em cada animação)
     A ponta de cada mecha (e da capa) é um pêndulo com mola que tenta voltar ao ângulo da pose: fica para trás quando a
     raiz dela acelera (o esqueleto da pose de um quadro para o outro, mais o corpo andando no mundo), passa do ponto
     quando ela para e é empurrada pelo ar (correndo vai para trás; caindo, flutua). Vira pose.cabeloTP, cabeloEP,
     cabeloDP e capaP (o modelo dobra a mecha da raiz até a ponta). A barra do casaco e das saias é outro pêndulo, preso
     ao quadril: atrasa, levanta na queda e abre com o giro do corpo — vira pose.pano ({ v: o vento, giro }).
     ===================================================================== */
  const DIN = { mola: 2 * Math.PI * 1.6, amort: 0.3, L: 28, ar: 0.0022, sub: 4, molaPano: 2 * Math.PI * 1.3, amortPano: 0.35, Lpano: 38 };
  /* quadros por segundo de cada animação no jogo (js/jogo/personagem.js) e como o corpo anda no mundo em cada quadro:
     vel(i, n) → [para a frente, para cima], em unidades por segundo */
  const RITMO = {
    idle: { fps: 12, ciclo: true }, walk: { fps: 15, ciclo: true, vel: () => [110, 0] },
  };
  const RD = Math.PI / 180, OSSOS_DIN = [['cabeloT', 1], ['cabeloE', 1], ['cabeloD', -1], ['capa', 1]];
  /* simula uma animação (lista de poses). op: { fps, ciclo, vel, estado (o de onde continua), grava } → o estado no fim */
  function dinamica(lista, op) {
    const n = lista.length;
    if (!n) return op.estado;
    const dt = 1 / op.fps, h = dt / DIN.sub, E = op.estado || {};
    const fk = lista.map((p) => R.Modelo3D.pontosDaPose(finalizar(com(p, {}))));
    const id = (i) => (op.ciclo ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i)));
    const vel = (i) => (op.vel ? op.vel(id(i), n) : [0, 0]);
    const acel = (nome, i) => {   // aceleração de um ponto do esqueleto (com o corpo andando no mundo)
      const a = fk[id(i - 1)][nome], b = fk[id(i)][nome], c = fk[id(i + 1)][nome], v0 = i === 0 && !op.ciclo ? E.vel || vel(0) : vel(i - 1), v1 = vel(i);
      return [(a[0] - 2 * b[0] + c[0]) / (dt * dt), (a[1] - 2 * b[1] + c[1]) / (dt * dt) + (v1[1] - v0[1]) / dt, (a[2] - 2 * b[2] + c[2]) / (dt * dt) + (v1[0] - v0[0]) / dt];
    };
    for (let i = 0; i < n; i++) {
      const p = lista[i], v = vel(i), sp = Math.hypot(v[0], v[1]), arZ = -DIN.ar * sp * v[0], arY = -DIN.ar * sp * v[1];
      for (const [b, lado] of OSSOS_DIN) {
        const alvo = b === 'capa' && !p.capa ? [((p.cabeloT || Z)[0]) * 0.6, 0, 0] : (p[b] || Z);
        const f0 = alvo[0] * RD, s0 = alvo[2] * RD, a = acel(b, i);
        const st = E[b] || (E[b] = { f: f0, w: 0, s: s0, ws: 0 });
        for (let k = 0; k < DIN.sub; k++) {
          const af = (-(a[2] - arZ) * Math.cos(st.f) - (a[1] - arY) * Math.sin(st.f)) / DIN.L - DIN.mola * DIN.mola * (st.f - f0) - 2 * DIN.amort * DIN.mola * st.w;
          st.w += af * h; st.f += st.w * h;
          const as = (-lado * a[0]) / DIN.L - DIN.mola * DIN.mola * (st.s - s0) - 2 * DIN.amort * DIN.mola * st.ws;
          st.ws += as * h; st.s += st.ws * h;
        }
        st.f = Math.max(-2.4, Math.min(1.6, st.f)); st.s = Math.max(-0.9, Math.min(1.2, st.s));
        if (op.grava !== false) p[b + 'P'] = [st.f / RD, 0, st.s / RD];
      }
      // a barra do casaco: pêndulo preso ao quadril (atrasa contra a aceleração e o vento), levanta caindo, abre girando
      const aq = acel('raiz', i), P = E.pano || (E.pano = { z: 0, x: 0, wz: 0, wx: 0, giro: 0 }), m = DIN.molaPano;
      for (let k = 0; k < DIN.sub; k++) {
        P.wz += (-aq[2] + arZ - m * m * P.z - 2 * DIN.amortPano * m * P.wz) * h; P.z += P.wz * h;
        P.wx += (-aq[0] - m * m * P.x - 2 * DIN.amortPano * m * P.wx) * h; P.x += P.wx * h;
      }
      const yaw0 = ((lista[id(i - 1)].raiz || Z)[1]), yaw1 = ((p.raiz || Z)[1]);
      const giro = i === 0 && !op.ciclo ? 0 : Math.min(1.3, Math.abs(yaw1 - yaw0) / dt / 900);
      P.giro += (giro - P.giro) * Math.min(1, dt * 12);
      const sobe = v[1] < 0 ? Math.min(0.6, -v[1] * 0.0008) : 0;
      if (op.grava !== false) p.pano = { v: [P.x / DIN.Lpano, sobe, P.z / DIN.Lpano], giro: Math.round(P.giro * 100) / 100 };
    }
    E.vel = vel(n - 1);
    return E;
  }

  /* ---------- Animações de cada classe ----------
     Por enquanto um conjunto só (o herói). Uma classe nova pode partir dele e trocar só algumas animações:
     CLASSES.guerreiro = Object.assign({}, A, { idle: [...] }). */
  const CLASSES = { heroi: A };
  {
    const feitas = new Set();
    for (const cl in CLASSES) {
      const C = CLASSES[cl];
      for (const nome in C) {
        if (feitas.has(C[nome])) continue;
        feitas.add(C[nome]);
        const r = RITMO[nome] || { fps: 16 };
        if (r.ciclo) {   // ciclos: dá voltas até assentar e grava a última
          let e = dinamica(C[nome], Object.assign({ grava: false }, r));
          e = dinamica(C[nome], Object.assign({ grava: false, estado: e }, r));
          dinamica(C[nome], Object.assign({ estado: e }, r));
        } else dinamica(C[nome], r);
      }
    }
  }

  /* ---------- Índice: cada quadro ganha um número (é o que vai na rede, no futuro online) ----------
     Todos os quadros de todas as classes ficam numa lista só, para o número valer igual em qualquer aparelho.
     antes: o quadro que vem antes deste na animação (os quadros rápidos esticam até ele: o smear, em modelo3d.js). */
  const ORDEM = ['idle', 'walk'];
  const META = { anims: {}, poses: [], nomes: [], classes: {}, ritmo: {} };
  const indice = new Map();   // a mesma pose em duas classes tem um número só
  const numerar = (id, nome, lista) => {
    const l = [];
    lista.forEach((p, i) => {
      let k = indice.get(p);
      if (k == null) {
        k = META.poses.length;
        META.poses.push(finalizar(com(p, {})));
        META.nomes.push(id + ' ' + nome + ' ' + i);
        indice.set(p, k);
      }
      if (i > 0 && META.poses[k].antes == null) META.poses[k].antes = l[i - 1];
      l.push(k);
    });
    return l;
  };
  for (const id in CLASSES) {
    const anims = {};
    ORDEM.forEach((nome) => { anims[nome] = numerar(id, nome, CLASSES[id][nome]); });
    META.classes[id] = { anims, poses: META.poses };
  }
  ORDEM.forEach((nome) => { META.ritmo[nome] = RITMO[nome]; });   // fps e velocidade no mundo de cada animação
  META.anims = META.classes.heroi.anims;
  /* pose neutra (em pé, calma): medidas do modelo (e, no futuro, retratos e miniaturas do criador) */
  META.neutra = finalizar(com(BASE, {}));
  /* as animações de uma classe ({ anims, poses }); classe desconhecida usa as do herói */
  META.daClasse = (id) => META.classes[id] || META.classes.heroi;
  R.POSES = META;
  R.POSES.com = com;
  R.POSES.mais = mais;
  R.POSES.finalizar = finalizar;
  R.POSES.BASE = BASE;
})(window.RES);
