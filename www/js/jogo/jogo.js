/* Rogue em' Slash — O jogo: a tela (canvas), a câmera 2.5D, os jogadores (até 4) e o laço principal.
   Câmera de beat 'em up (Streets of Rage, Castle Crashers): os personagens são vistos quase de lado (o modelo é
   desenhado com a câmera a PITCH graus, como a do jogo do RL20), mas o chão aparece como uma faixa vista de cima — a
   "trapaça" clássica do 2.5D: a profundidade (z) anda para cima e para baixo na tela a PROF × E pixels por unidade, e a altura
   (y) sobe. Projeção ortográfica: o chão é um retângulo na tela e x anda para os lados.
   Jogadores: os deste aparelho (locais, cada um com o seu dispositivo) e, numa sala online, os dos outros aparelhos
   (remotos). Até 4 no total. Com vários jogadores locais, todos dividem a mesma tela (ninguém sai dela).
   A simulação roda em passos fixos (60 por segundo), separada do desenho. */
(function (R) {
  'use strict';

  const RAD = Math.PI / 180;
  const PASSO = 1 / 60;
  const ALTURA_VISTA = 540;   // pixels do jogo na altura da tela (a largura acompanha o formato da tela)
  const LARGURA_MIN = 760;    // em tela estreita (celular em pé) a vista diminui para caber pelo menos isto
  const MARGEM_TELA = 40;     // (vários jogadores locais) quanto do mundo cada um precisa deixar até a borda da tela

  /* ---------- Câmera ---------- */
  const PITCH = 9;
  const C = {
    PITCH, COS: Math.cos(PITCH * RAD),
    YAW_LADO: 55,      // o personagem olhando para a direita: de lado, com o peito um pouco virado para a câmera
    PROF: 0.5,         // pixels da tela por unidade de profundidade (o chão "deitado" de beat 'em up)
    E: 1.3,            // pixels do jogo por unidade do mundo
    x: 0,              // o x do mundo na borda esquerda da vista
    y0: 0,             // onde cai o pé da parede (z = 0, y = 0) na vista, em pixels do jogo
    escalaTela: 1,     // pixels da tela por pixel do jogo
  };
  C.sx = (x) => (x - C.x) * C.E;
  C.sy = (z, y) => C.y0 + (z * C.PROF - (y || 0) * C.COS) * C.E;
  /* resolução dos quadros do personagem: o tamanho dele na tela de verdade, para ficar nítido (até 3 pixels por
     unidade: acima disso cada quadro fica grande demais e demora para desenhar) */
  C.resolucao = () => R.clamp(Math.round(C.E * C.escalaTela * 4) / 4, 0.75, 3);
  R.Camera = C;

  const J = {
    canvas: null, ctx: null, w: 0, h: 0, visivel: false, acumulado: 0, antes: 0,
    locais: [{ i: 0, dispositivo: 'qualquer' }],   // os jogadores deste aparelho: índice (0 a 3) e dispositivo
    jogadores: new Map(),                           // chave ('dono:i') → { chave, slot, dono, i, nome, local, personagem }
  };
  const vista = () => J.w / C.E;   // largura da vista em unidades do mundo

  /* ---------- Jogadores ---------- */
  const nomeDe = (base, i) => (i > 0 ? base + ' (' + (i + 1) + ')' : base);
  J.indicesLocais = () => J.locais.map((l) => l.i);
  /* quem está jogando: sem sala, os jogadores deste aparelho (vaga = índice + 1); numa sala, o que o anfitrião decidiu */
  J.lista = function () {
    if (R.Rede.modo === 'anfitriao' || R.Rede.modo === 'cliente') return R.Rede.sala;
    const base = (R.Contas && R.Contas.nome()) || 'Jogador';
    return J.locais.map((l) => ({ slot: l.i + 1, dono: 'anfitriao', i: l.i, nome: nomeDe(base, l.i) }));
  };
  function nascer(slot) {
    const m = R.Mapa.atual, p = { x: m.inicio.x + (slot - 1) * 70, z: m.inicio.z + [0, 70, -70, 140][(slot - 1) % 4] };
    R.Mapa.limitar(p);
    return p;
  }
  /* Deixa os personagens iguais à lista: cria quem chegou, tira quem saiu, troca a cor de quem mudou de vaga. */
  J.sincronizar = function () {
    const meu = R.Rede.meuDono(), vistos = new Set();
    // onde estavam os jogadores deste aparelho (entrando ou saindo de uma sala, eles continuam no mesmo lugar)
    const antes = new Map([...J.jogadores.values()].filter((e) => e.local).map((e) => [e.i, e.personagem]));
    J.lista().forEach((j) => {
      const chave = j.dono + ':' + j.i, local = j.dono === meu;
      vistos.add(chave);
      let e = J.jogadores.get(chave);
      if (e && e.local !== local) { J.jogadores.delete(chave); e = null; }
      if (!e) {
        const a = local && antes.get(j.i), p = a ? { x: a.x, z: a.z, dir: a.dir } : nascer(j.slot);
        e = { chave, personagem: new R.Personagem({ x: p.x, z: p.z, dir: p.dir != null ? p.dir : 2, slot: j.slot, nome: j.nome, remoto: !local }) };
        J.jogadores.set(chave, e);
      }
      Object.assign(e, { slot: j.slot, dono: j.dono, i: j.i, nome: j.nome, local });
      e.personagem.nome = j.nome;
      e.personagem.definirSlot(j.slot);
    });
    [...J.jogadores.keys()].forEach((k) => { if (!vistos.has(k)) J.jogadores.delete(k); });
  };

  /* Pôr e tirar jogadores deste aparelho (menu). O novo pega um dispositivo livre: um controle conectado, as setas, o
     WASD ou o toque. */
  J.podeAdicionar = function () {
    if (J.locais.length >= R.Rede.MAX) return false;
    if (R.Rede.modo !== 'offline') return R.Rede.sala.length < R.Rede.MAX && R.Rede.fora === 0;
    return true;
  };
  J.adicionarLocal = function () {
    if (!J.podeAdicionar()) return false;
    let i = 0;
    while (J.locais.some((l) => l.i === i)) i++;
    const usados = new Set(J.locais.map((l) => l.dispositivo));
    const ordem = [0, 1, 2, 3].filter((k) => R.Input.controleConectado(k)).map((k) => 'controle' + k)
      .concat(['tecladoB', 'tecladoA'], R.Input.temToque ? ['toque'] : [], ['controle0', 'controle1', 'controle2', 'controle3']);
    const d = ordem.find((x) => !usados.has(x)) || 'controle3';
    J.locais.push({ i, dispositivo: d });
    J.locais.sort((a, b) => a.i - b.i);
    J.sincronizar(); R.Rede.locaisMudaram();
    return true;
  };
  J.removerLocal = function (i) {
    if (J.locais.length <= 1) return;   // pelo menos um jogador neste aparelho
    J.locais = J.locais.filter((l) => l.i !== i);
    J.sincronizar(); R.Rede.locaisMudaram();
  };
  J.definirDispositivo = function (i, d) {
    const l = J.locais.find((x) => x.i === i);
    if (l) l.dispositivo = d;
  };

  /* ---------- Rede ---------- */
  /* o estado dos jogadores, para mandar: [[chave, x, z, direção, andando, ritmo], …] (dono: só os desse aparelho).
     O remoto vai com o último estado que chegou dele (sem o atraso da suavização). */
  J.estados = function (dono) {
    const out = [];
    J.jogadores.forEach((e) => {
      if (dono && e.dono !== dono) return;
      const p = e.personagem, b = p.remoto && p.remoto.buf;
      const s = p.remoto ? (b.length ? [b[b.length - 1].x, b[b.length - 1].z, b[b.length - 1].dir, b[b.length - 1].a, b[b.length - 1].r] : null) : p.estado();
      if (s) out.push([e.chave].concat(s));
    });
    return out;
  };
  /* chegou o estado de um jogador de outro aparelho. conferir: o anfitrião confere (dentro do mapa e sem andar mais
     rápido que o passo) antes de aceitar */
  J.receberEstado = function (chave, s, conferir) {
    const e = J.jogadores.get(chave);
    if (!e || e.local || !e.personagem.remoto) return;
    let x = +s[0], z = +s[1];
    if (!isFinite(x) || !isFinite(z)) return;
    const agora = performance.now() / 1000, p = e.personagem, b = p.remoto.buf;
    if (conferir) {
      const q = { x, z };
      R.Mapa.limitar(q);
      const u = b[b.length - 1];
      if (u) {
        const max = R.POSES.ritmo.walk.vel()[0] * 1.6 * Math.max(0.05, agora - u.t) + 15, d = Math.hypot(q.x - u.x, q.z - u.z);
        if (d > max) { q.x = u.x + ((q.x - u.x) / d) * max; q.z = u.z + ((q.z - u.z) / d) * max; }
      }
      x = q.x; z = q.z;
    }
    p.receber([x, z, s[2], s[3], s[4]], agora);
  };

  /* ---------- Tela ---------- */
  function redimensionar() {
    const dpr = window.devicePixelRatio || 1, cw = window.innerWidth, ch = window.innerHeight;
    J.canvas.width = Math.round(cw * dpr); J.canvas.height = Math.round(ch * dpr);
    J.canvas.style.width = cw + 'px'; J.canvas.style.height = ch + 'px';
    const k = Math.min(ch / ALTURA_VISTA, cw / LARGURA_MIN);   // pixels CSS por pixel do jogo
    C.escalaTela = k * dpr;
    J.w = cw / k; J.h = ch / k;
    // o chão fica embaixo da tela (a borda da frente quase encostando nela) e a parede do fundo sobe atrás dele
    const m = R.Mapa.atual;
    C.y0 = J.h - 12 - (m.profundidade * C.PROF + m.espessura * C.COS) * C.E;
    seguir(1);
  }

  /* A câmera segue os jogadores deste aparelho para os lados (o meio deles), sem deixar nenhum sair da tela.
     t: quanto chega no alvo neste quadro (1 = na hora). */
  function seguir(t) {
    const m = R.Mapa.atual, v = vista();
    const meus = [...J.jogadores.values()].filter((e) => e.local).map((e) => e.personagem.x);
    if (!meus.length) return;
    const a = Math.min(...meus), b = Math.max(...meus);
    let alvo = (a + b) / 2 - v / 2;
    alvo = R.clamp(alvo, b + MARGEM_TELA - v, a - MARGEM_TELA);   // todos dentro da tela
    alvo = v >= m.largura ? (m.largura - v) / 2 : R.clamp(alvo, 0, m.largura - v);
    C.x += (alvo - C.x) * t;
  }

  function atualizar(dt) {
    const agora = performance.now() / 1000;
    const escolhidos = J.locais.map((l) => l.dispositivo).filter((d) => d !== 'qualquer');
    const meus = [];
    J.jogadores.forEach((e) => {
      if (!e.local) { e.personagem.atualizarRemoto(dt, agora); return; }
      const l = J.locais.find((x) => x.i === e.i);
      const mov = l ? R.Input.movimento(l.dispositivo, l.dispositivo === 'qualquer' ? new Set(escolhidos) : null) : { x: 0, y: 0 };
      e.personagem.atualizar(dt, mov);
      meus.push(e.personagem);
    });
    if (meus.length > 1) {   // tela dividida por todos deste aparelho: ninguém passa da borda
      const a = C.x + MARGEM_TELA, b = C.x + vista() - MARGEM_TELA;
      meus.forEach((p) => { if (p.x < a) { p.x = a; p.vx = Math.max(0, p.vx); } if (p.x > b) { p.x = b; p.vx = Math.min(0, p.vx); } });
    }
    seguir(Math.min(1, dt * 6));
  }

  function desenhar() {
    const ctx = J.ctx;
    ctx.setTransform(C.escalaTela, 0, 0, C.escalaTela, 0, 0);
    ctx.imageSmoothingEnabled = true;
    const camX = C.x;
    C.x = Math.round(C.x * C.E * C.escalaTela) / (C.E * C.escalaTela);   // a câmera no grid dos pixels da tela (nada treme)
    R.Mapa.desenhar(ctx, C, J.w, J.h);
    const ps = [...J.jogadores.values()].map((e) => e.personagem).sort((a, b) => a.z - b.z);   // quem está na frente por cima
    let podeDesenharAgora = true;
    ps.forEach((p) => { if (p.desenhar(ctx, C, podeDesenharAgora)) podeDesenharAgora = false; });
    C.x = camX;
  }

  function quadro(agora) {
    const dt = Math.min(0.1, (agora - (J.antes || agora)) / 1000);
    J.antes = agora;
    R.Input.atualizar();
    J.acumulado += dt;
    while (J.acumulado >= PASSO) { atualizar(PASSO); J.acumulado -= PASSO; }
    R.Rede.tick(dt);
    if (J.visivel) {
      desenhar();
      R.Sprites.tick(4);   // os quadros que faltam vão sendo desenhados aos poucos
    }
    requestAnimationFrame(quadro);
  }

  /* Mostra o jogo (true) ou o menu (false). O jogo continua rodando por trás do menu (a sala online não para). */
  J.mostrar = function (v) {
    J.visivel = !!v;
    document.body.classList.toggle('jogando', J.visivel);
    R.Input.ativo = J.visivel;
    if (!J.visivel) R.Input.soltarTudo();
    if (J.visivel) { redimensionar(); seguir(1); }
  };

  /* Monta o mapa de teste com os jogadores deste aparelho e começa o laço (com o jogo escondido, atrás do menu). */
  J.iniciar = function () {
    J.canvas = document.getElementById('tela');
    J.ctx = J.canvas.getContext('2d');
    J.sincronizar();
    window.addEventListener('resize', redimensionar);
    redimensionar();
    requestAnimationFrame(quadro);
  };

  R.Jogo = J;
})(window.RES);
