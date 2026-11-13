/* Rogue em' Slash — Mapa de teste: um chão limpo (ladrilhos em xadrez, para ver o movimento), a parede do fundo e mais
   nada. Mundo (como no lobby do RL20): x para a direita, y para cima, z para a câmera (0 = pé da parede do fundo);
   1 unidade = 1 pixel do herói (ele tem ~100 de altura). O chão é desenhado direto no canvas, na mesma projeção da
   câmera que desenha o personagem (js/jogo/jogo.js: R.Camera). */
(function (R) {
  'use strict';

  R.MAPA_TESTE = {
    nome: 'Mapa de teste',
    largura: 2400,       // de x = 0 até x = largura
    profundidade: 360,   // de z = 0 (a parede) até z = profundidade (a borda da frente)
    parede: 340,         // altura da parede do fundo (sobe além do alto da tela)
    espessura: 26,       // a borda do chão que aparece na frente
    ladrilho: 80,
    margem: { x: 40, fundo: 30, frente: 20 },   // até onde os pés chegam
    inicio: { x: 300, z: 190 },
    cores: {
      fundo: ['#151724', '#262a3c'], parede: '#555d74', paredeTopo: '#6c758e', painel: '#4b5268', rodape: '#3f455a',
      chao: ['#c9cfdc', '#bec5d3'], linha: '#adb5c6', borda: '#7d859a', bordaLinha: '#666e82',
    },
  };

  const M = { atual: R.MAPA_TESTE };

  /* Limita uma posição (pés) ao chão andável. */
  M.limitar = function (p) {
    const m = M.atual, g = m.margem;
    p.x = R.clamp(p.x, g.x, m.largura - g.x);
    p.z = R.clamp(p.z, g.fundo, m.profundidade - g.frente);
  };

  /* Desenha o mapa visto pela câmera (cam: R.Camera). w, h: o tamanho da vista, em pixels do jogo. */
  M.desenhar = function (ctx, cam, w, h) {
    const m = M.atual, c = m.cores, E = cam.E;
    const fundo = ctx.createLinearGradient(0, 0, 0, h);
    fundo.addColorStop(0, c.fundo[0]); fundo.addColorStop(1, c.fundo[1]);
    ctx.fillStyle = fundo; ctx.fillRect(0, 0, w, h);

    const x0 = cam.sx(0), x1 = cam.sx(m.largura);
    const yTopo = cam.sy(0, m.parede), yPe = cam.sy(0, 0), yFrente = cam.sy(m.profundidade, 0), yBase = cam.sy(m.profundidade, -m.espessura);
    const a = Math.max(x0, 0), b = Math.min(x1, w);   // só o pedaço que aparece
    if (b <= a) return;

    // parede do fundo: painéis a cada dois ladrilhos, o topo mais claro e o rodapé
    ctx.fillStyle = c.parede; ctx.fillRect(a, yTopo, b - a, yPe - yTopo);
    ctx.fillStyle = c.paredeTopo; ctx.fillRect(a, yTopo, b - a, Math.max(1, 6 * cam.COS * E));
    ctx.fillStyle = c.painel;
    const passoPainel = m.ladrilho * 2;
    for (let x = Math.floor(cam.x / passoPainel) * passoPainel; x <= m.largura; x += passoPainel) {
      const sx = cam.sx(x);
      if (sx > b) break;
      if (sx >= a - 2) ctx.fillRect(sx - 1, yTopo, 2, yPe - yTopo);
    }
    ctx.fillStyle = c.rodape; ctx.fillRect(a, yPe - 12 * cam.COS * E, b - a, 12 * cam.COS * E);

    // chão: ladrilhos em xadrez
    const L = m.ladrilho, linhas = Math.ceil(m.profundidade / L);
    for (let x = Math.max(0, Math.floor(cam.x / L) * L); x < m.largura; x += L) {
      const sxa = cam.sx(x), sxb = cam.sx(Math.min(m.largura, x + L));
      if (sxa > b) break;
      for (let j = 0; j < linhas; j++) {
        const za = j * L, zb = Math.min(m.profundidade, za + L);
        ctx.fillStyle = c.chao[((x / L) + j) & 1];
        ctx.fillRect(sxa, cam.sy(za, 0), sxb - sxa, cam.sy(zb, 0) - cam.sy(za, 0));
      }
    }
    // as juntas dos ladrilhos (1 pixel da tela)
    const px = 1 / cam.escalaTela;
    ctx.fillStyle = c.linha;
    for (let x = Math.max(0, Math.floor(cam.x / L) * L); x <= m.largura; x += L) {
      const sx = cam.sx(x);
      if (sx > b + 1) break;
      ctx.fillRect(sx, yPe, px, yFrente - yPe);
    }
    for (let j = 1; j < linhas; j++) ctx.fillRect(a, cam.sy(j * L, 0), b - a, px);

    // a sombra da parede no chão (fica mais escuro perto dela)
    const sombra = ctx.createLinearGradient(0, yPe, 0, cam.sy(70, 0));
    sombra.addColorStop(0, 'rgba(20,24,40,.22)'); sombra.addColorStop(1, 'rgba(20,24,40,0)');
    ctx.fillStyle = sombra; ctx.fillRect(a, yPe, b - a, cam.sy(70, 0) - yPe);

    // a borda da frente do chão
    ctx.fillStyle = c.borda; ctx.fillRect(a, yFrente, b - a, yBase - yFrente);
    ctx.fillStyle = c.bordaLinha; ctx.fillRect(a, yFrente, b - a, Math.max(px, 2 * cam.COS * E));
  };

  R.Mapa = M;
})(window.RES);
