/* Rogue em' Slash — O jogo: a tela (canvas), a câmera 2.5D e o laço principal.
   Câmera: alta, inclinada PITCH graus para baixo e sem girar (como a do lobby do RL20), em projeção ortográfica: o chão
   é um retângulo na tela, x anda para os lados, z (a profundidade) anda para cima e para baixo e y (a altura) sobe.
   A simulação roda em passos fixos (60 por segundo), separada do desenho: é o que o online vai precisar. */
(function (R) {
  'use strict';

  const RAD = Math.PI / 180;
  const PASSO = 1 / 60;
  const ALTURA_VISTA = 540;   // pixels do jogo na altura da tela (a largura acompanha o formato da tela)
  const LARGURA_MIN = 760;    // em tela estreita (celular em pé) a vista diminui para caber pelo menos isto

  /* ---------- Câmera ---------- */
  const PITCH = 30;
  const C = {
    PITCH, SEN: Math.sin(PITCH * RAD), COS: Math.cos(PITCH * RAD),
    E: 1.15,           // pixels do jogo por unidade do mundo
    x: 0,              // o x do mundo na borda esquerda da vista
    y0: 0,             // onde cai o pé da parede (z = 0, y = 0) na vista, em pixels do jogo
    escalaTela: 1,     // pixels da tela por pixel do jogo
  };
  C.sx = (x) => (x - C.x) * C.E;
  C.sy = (z, y) => C.y0 + (z * C.SEN - (y || 0) * C.COS) * C.E;
  /* resolução dos quadros do personagem: o tamanho dele na tela de verdade, para ficar nítido (até 3 pixels por
     unidade: acima disso cada quadro fica grande demais e demora para desenhar) */
  C.resolucao = () => R.clamp(Math.round(C.E * C.escalaTela * 4) / 4, 0.75, 3);
  R.Camera = C;

  const J = { canvas: null, ctx: null, w: 0, h: 0, jogadores: [], acumulado: 0, antes: 0 };

  function redimensionar() {
    const dpr = window.devicePixelRatio || 1, cw = window.innerWidth, ch = window.innerHeight;
    J.canvas.width = Math.round(cw * dpr); J.canvas.height = Math.round(ch * dpr);
    J.canvas.style.width = cw + 'px'; J.canvas.style.height = ch + 'px';
    const k = Math.min(ch / ALTURA_VISTA, cw / LARGURA_MIN);   // pixels CSS por pixel do jogo
    C.escalaTela = k * dpr;
    J.w = cw / k; J.h = ch / k;
    // o mapa fica no meio da altura: do alto da parede até a borda da frente do chão
    const m = R.Mapa.atual;
    const alto = (m.parede * C.COS + m.profundidade * C.SEN + m.espessura * C.COS) * C.E;
    C.y0 = (J.h - alto) / 2 + m.parede * C.COS * C.E;
    seguir(1);
  }

  /* a câmera segue o jogador 1 para os lados (t: quanto chega no alvo neste quadro, 1 = na hora) */
  function seguir(t) {
    const m = R.Mapa.atual, vista = J.w / C.E, p = J.jogadores[0];
    if (!p) return;
    const alvo = vista >= m.largura ? (m.largura - vista) / 2 : R.clamp(p.personagem.x - vista / 2, 0, m.largura - vista);
    C.x += (alvo - C.x) * t;
  }

  function atualizar(dt) {
    J.jogadores.forEach((j) => j.personagem.atualizar(dt, R.Input.movimento(j.slot)));
    seguir(Math.min(1, dt * 6));
  }

  function desenhar() {
    const ctx = J.ctx;
    ctx.setTransform(C.escalaTela, 0, 0, C.escalaTela, 0, 0);
    ctx.imageSmoothingEnabled = true;
    const camX = C.x;
    C.x = Math.round(C.x * C.E * C.escalaTela) / (C.E * C.escalaTela);   // a câmera no grid dos pixels da tela (nada treme)
    R.Mapa.desenhar(ctx, C, J.w, J.h);
    let podeDesenharAgora = true;
    J.jogadores.map((j) => j.personagem).sort((a, b) => a.z - b.z).forEach((p) => {   // quem está mais na frente por cima
      if (p.desenhar(ctx, C, podeDesenharAgora)) podeDesenharAgora = false;
    });
    C.x = camX;
  }

  function quadro(agora) {
    const dt = Math.min(0.1, (agora - (J.antes || agora)) / 1000);
    J.antes = agora;
    J.acumulado += dt;
    while (J.acumulado >= PASSO) { atualizar(PASSO); J.acumulado -= PASSO; }
    desenhar();
    R.Sprites.tick(4);   // os quadros que faltam vão sendo desenhados aos poucos
    requestAnimationFrame(quadro);
  }

  /* Entra no mapa de teste com o jogador 1. (Os jogadores 2 a 4, locais ou online, entram aqui no futuro.) */
  J.iniciar = function () {
    J.canvas = document.getElementById('tela');
    J.ctx = J.canvas.getContext('2d');
    const m = R.Mapa.atual;
    J.jogadores = [{ slot: 0, personagem: new R.Personagem({ x: m.inicio.x, z: m.inicio.z, dir: 2, aparencia: R.APARENCIA_PADRAO }) }];
    window.addEventListener('resize', redimensionar);
    redimensionar();
    requestAnimationFrame(quadro);
  };

  R.Jogo = J;
})(window.RES);
