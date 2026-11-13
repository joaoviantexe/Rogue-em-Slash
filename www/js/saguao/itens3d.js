/* Rogue em' Slash — Os itens do bazar em 3D (chapéus, óculos, máscaras e capacetes, na cabeça; asas e camisas, no corpo
   do boneco da sala), montados com formas simples (sólidos de revolução, esferas e caixas) no renderizador da sala
   (aero3d.js). Cada item tem uma cor que o jogador escolhe; algumas peças têm cor fixa (as lentes, a tela da TV).
   Medidas: os itens da cabeça em "cabeças" (a cabeça tem raio 1 e o centro dela é a origem); os do corpo em metros, a
   partir da base do corpo (y para cima, z para a frente do boneco). */
(function (R) {
  'use strict';

  /* id → { nome, tipo (o encaixe), cor padrão }. Os preços ficam no banco (tabela itens_bazar). */
  const ITENS = {
    cowboy: { nome: 'Chapéu de Cowboy', tipo: 'chapeu', cor: '#8a5a2b' },
    bruxo: { nome: 'Chapéu de Bruxo', tipo: 'chapeu', cor: '#5a3aa8' },
    pirata: { nome: 'Chapéu de Pirata', tipo: 'chapeu', cor: '#26262e' },
    cartola: { nome: 'Cartola', tipo: 'chapeu', cor: '#1e1e26' },
    bone: { nome: 'Boné', tipo: 'chapeu', cor: '#e03030' },
    fazendeiro: { nome: 'Chapéu de Fazendeiro', tipo: 'chapeu', cor: '#e8c860' },
    boina: { nome: 'Boina', tipo: 'chapeu', cor: '#c03050' },
    oculos: { nome: 'Óculos', tipo: 'oculos', cor: '#202028' },
    oculos3d: { nome: 'Óculos 3D', tipo: 'oculos', cor: '#f4f4f4' },
    ski: { nome: 'Óculos de Ski', tipo: 'oculos', cor: '#30a0ff' },
    motoqueiro: { nome: 'Capacete de Motoqueiro', tipo: 'capacete', cor: '#e02828' },
    tv: { nome: 'TV de Tubo', tipo: 'capacete', cor: '#c8c0a8' },
    hoquei: { nome: 'Máscara de Hóquei', tipo: 'mascara', cor: '#f2efe6' },
    anjo: { nome: 'Asas de Anjo', tipo: 'asas', cor: '#f6f8ff', corpo: true },
    borboleta: { nome: 'Asas de Borboleta', tipo: 'asas', cor: '#f07ac8', corpo: true },
    morcego: { nome: 'Asas de Morcego', tipo: 'asas', cor: '#4a2a5a', corpo: true },
    camiseta: { nome: 'Camiseta', tipo: 'camisa', cor: '#f4f4f4', corpo: true },
  };

  /* as malhas (feitas uma vez, no primeiro desenho) */
  let M = null;
  function malhas(r) {
    if (M && M.r === r) return M;
    const A = R.Aero3D, t = (p, s) => r.malha(A.torno(p, s || 36));
    M = {
      r, esfera: r.malha(A.esfera(28, 18)), caixa: r.malha(A.caixa()),
      cowboy: t([[0, 0.5], [0.98, 0.5], [1.6, 0.54], [1.72, 0.7], [1.64, 0.76], [1.42, 0.65], [1.0, 0.64], [0.95, 0.66], [0.9, 1.25], [0.75, 1.38], [0.35, 1.3], [0, 1.36]]),
      bruxo: t([[0, 0.45], [0.95, 0.45], [1.5, 0.5], [1.55, 0.58], [1.0, 0.58], [0.92, 0.62], [0.6, 1.3], [0.3, 2.0], [0.08, 2.5], [0, 2.55]]),
      pirata: t([[0, 0.5], [0.95, 0.5], [1.55, 0.6], [1.7, 1.05], [1.55, 1.1], [1.3, 0.8], [0.95, 0.75], [0.92, 1.2], [0.6, 1.32], [0, 1.35]]),
      cartola: t([[0, 0.55], [0.92, 0.55], [1.5, 0.57], [1.55, 0.64], [1.45, 0.68], [0.95, 0.68], [0.9, 0.72], [0.95, 1.95], [0.97, 2.0], [0, 2.0]]),
      cartolaFaixa: t([[0.93, 0.72], [0.935, 1.0]]),
      bone: t([[0, 0.2], [1.03, 0.2], [1.05, 0.4], [0.97, 0.75], [0.72, 1.0], [0.36, 1.1], [0, 1.12]]),
      fazendeiro: t([[0, 0.5], [0.95, 0.5], [1.9, 0.4], [1.95, 0.46], [1.86, 0.52], [1.0, 0.62], [0.95, 0.66], [0.92, 1.15], [0.6, 1.32], [0, 1.34]]),
      faixaChapeu: t([[0.965, 0.66], [0.95, 0.88]]),
      boina: t([[0, 0.55], [0.9, 0.58], [1.18, 0.78], [1.15, 0.95], [0.75, 1.12], [0, 1.15]]),
      faixaSki: t([[1.04, -0.14], [1.04, 0.3]], 40),
      faixaHoquei: t([[1.03, 0.05], [1.03, 0.22]], 40),
      // a camiseta: a casca do corpo um pouco maior, da barra até a gola (aberta embaixo e no pescoço)
      camiseta: t([[0.44, 0.11], [0.445, 0.17], [0.437, 0.28], [0.405, 0.385], [0.348, 0.465], [0.262, 0.522], [0.16, 0.552], [0.14, 0.558]], 40),
      gola: t([[0.15, 0.548], [0.142, 0.578]], 32),
    };
    return M;
  }

  /* As peças de um item: [{ malha, p: [x, y, z] (centro), e: [sx, sy, sz], rx, rz, cor ('item' ou '#rrggbb'), tipo, realce }].
     esconde: o item cobre a cabeça (ela nem é desenhada). */
  function pecas(r, id) {
    const m = malhas(r), I = 'item';
    const lente = (x, cor, e) => ({ malha: m.esfera, p: [x, 0.08, 0.98], e: e || [0.34, 0.3, 0.1], cor, tipo: 'aero' });
    const hastes = (cor) => [-1, 1].map((l) => ({ malha: m.caixa, p: [l * 0.97, 0.1, 0.5], e: [0.05, 0.06, 0.56], cor, tipo: 'aero' }));
    const asa = (l, pecasLado) => pecasLado.map((q) => Object.assign({}, q, { p: [l * q.p[0], q.p[1], q.p[2]], rz: l * (q.rz || 0), ry: l * (q.ry || 0) }));
    const duasAsas = (lado) => asa(-1, lado).concat(asa(1, lado));
    const membrana = (x, y, sx, sy, rz, cor) => ({ malha: m.esfera, p: [x, y, -0.36 - x * 0.12], e: [sx, sy, 0.026], rz, ry: -0.28, cor: cor || I, tipo: 'aero' });
    switch (id) {
      case 'hoquei': return { pecas: [{ malha: m.faixaHoquei, cor: '#2a2a30', tipo: 'aero' },
        { malha: m.esfera, p: [0, 0.0, 0.5], e: [0.86, 0.98, 0.56], cor: I, tipo: 'aero' },
        { malha: m.esfera, p: [-0.34, 0.2, 1.03], e: [0.17, 0.11, 0.03], cor: '#15151c', tipo: 'fosco' },
        { malha: m.esfera, p: [0.34, 0.2, 1.03], e: [0.17, 0.11, 0.03], cor: '#15151c', tipo: 'fosco' },
        ...[[-0.18, -0.25], [0, -0.3], [0.18, -0.25], [-0.1, -0.5], [0.1, -0.5], [0, -0.66], [-0.5, -0.15], [0.5, -0.15]].map(([x, y]) =>
          ({ malha: m.esfera, p: [x, y, 1.0 - Math.abs(x) * 0.25 - Math.max(0, -y - 0.4) * 0.3], e: [0.075, 0.075, 0.025], cor: '#15151c', tipo: 'fosco' }))] };
      // asas: presas nas costas, abrindo para os lados e para cima (os dois lados iguais, espelhados)
      case 'anjo': return { pecas: duasAsas([membrana(0.3, 0.5, 0.24, 0.17, 0.5), membrana(0.46, 0.6, 0.24, 0.13, 0.62), membrana(0.6, 0.72, 0.2, 0.1, 0.75),
        membrana(0.36, 0.38, 0.17, 0.08, 0.15), membrana(0.5, 0.44, 0.15, 0.065, 0.2)]) };
      case 'borboleta': return { pecas: duasAsas([membrana(0.36, 0.64, 0.3, 0.24, 0.55), membrana(0.3, 0.36, 0.2, 0.16, -0.45),
        { malha: m.esfera, p: [0.44, 0.7, -0.43], e: [0.08, 0.08, 0.03], ry: -0.28, cor: '#ffffff', tipo: 'aero' }]) };
      case 'morcego': return { pecas: duasAsas([membrana(0.3, 0.52, 0.2, 0.19, 0.15), membrana(0.47, 0.56, 0.19, 0.2, 0.35), membrana(0.64, 0.62, 0.16, 0.19, 0.55),
        { malha: m.caixa, p: [0.45, 0.71, -0.42], e: [0.56, 0.03, 0.03], rz: 0.32, ry: -0.28, cor: '#1e1426', tipo: 'fosco' }]) };
      case 'camiseta': return { pecas: [{ malha: m.camiseta, cor: I, tipo: 'fosco' }, { malha: m.gola, cor: I, tipo: 'fosco' },
        { malha: m.esfera, p: [-0.375, 0.37, 0], e: [0.1, 0.085, 0.13], rz: 0.5, cor: I, tipo: 'fosco' },
        { malha: m.esfera, p: [0.375, 0.37, 0], e: [0.1, 0.085, 0.13], rz: -0.5, cor: I, tipo: 'fosco' }] };
      case 'cowboy': return { pecas: [{ malha: m.cowboy, cor: I, tipo: 'aero' }] };
      case 'bruxo': return { pecas: [{ malha: m.bruxo, cor: I, tipo: 'aero', rx: -0.18 }] };
      case 'pirata': return { pecas: [{ malha: m.pirata, e: [1.1, 1, 0.85], cor: I, tipo: 'aero' }, { malha: m.esfera, p: [0, 0.98, 0.86], e: [0.16, 0.16, 0.06], cor: '#f4f0e8', tipo: 'aero' }] };
      case 'cartola': return { pecas: [{ malha: m.cartola, cor: I, tipo: 'aero' }, { malha: m.cartolaFaixa, cor: '#b01e2e', tipo: 'aero' }] };
      case 'bone': return { pecas: [{ malha: m.bone, cor: I, tipo: 'aero' }, { malha: m.caixa, p: [0, 0.27, 1.12], e: [1.25, 0.07, 0.85], rx: 0.14, cor: I, tipo: 'aero' },
        { malha: m.esfera, p: [0, 1.12, 0], e: [0.1, 0.07, 0.1], cor: I, tipo: 'aero' }] };
      case 'fazendeiro': return { pecas: [{ malha: m.fazendeiro, cor: I, tipo: 'aero' }, { malha: m.faixaChapeu, cor: '#7a3a20', tipo: 'aero' }] };
      case 'boina': return { pecas: [{ malha: m.boina, p: [-0.1, 0, 0], rz: 0.22, cor: I, tipo: 'aero' }, { malha: m.esfera, p: [-0.35, 1.13, 0], e: [0.12, 0.1, 0.12], cor: I, tipo: 'aero' }] };
      case 'oculos': return { pecas: [lente(-0.42, I, [0.39, 0.35, 0.08]), lente(0.42, I, [0.39, 0.35, 0.08]), lente(-0.42, '#1a2a48'), lente(0.42, '#1a2a48'),
        { malha: m.caixa, p: [0, 0.14, 1.03], e: [0.22, 0.06, 0.06], cor: I, tipo: 'aero' }, ...hastes(I)] };
      case 'oculos3d': return { pecas: [{ malha: m.caixa, p: [0, 0.08, 0.98], e: [1.55, 0.44, 0.08], cor: I, tipo: 'aero' },
        { malha: m.caixa, p: [-0.38, 0.08, 1.03], e: [0.54, 0.28, 0.04], cor: '#e02020', tipo: 'aero' },
        { malha: m.caixa, p: [0.38, 0.08, 1.03], e: [0.54, 0.28, 0.04], cor: '#20d0e0', tipo: 'aero' }, ...hastes(I)] };
      case 'ski': return { pecas: [{ malha: m.faixaSki, cor: '#22242c', tipo: 'aero' }, { malha: m.esfera, p: [0, 0.08, 0.7], e: [0.98, 0.44, 0.44], cor: I, tipo: 'aero' }] };
      case 'motoqueiro': return { esconde: true, pecas: [{ malha: m.esfera, p: [0, 0.08, -0.04], e: [1.28, 1.28, 1.28], cor: I, tipo: 'aero' },
        { malha: m.esfera, p: [0, 0.06, 0.72], e: [1.0, 0.55, 0.62], cor: '#1a1e2a', tipo: 'aero' }] };
      case 'tv': return { esconde: true, pecas: [{ malha: m.caixa, p: [0, 0.05, -0.15], e: [2.3, 1.85, 1.7], cor: I, tipo: 'fosco' },
        { malha: m.caixa, p: [0, 0.05, -1.25], e: [1.6, 1.3, 0.9], cor: I, tipo: 'fosco' },
        { malha: m.caixa, p: [0, 0.08, 0.71], e: [1.85, 1.4, 0.04], cor: '#9ff0ff', tipo: 'fosco', realce: 0.35 },
        { malha: m.caixa, p: [-0.38, 1.38, -0.3], e: [0.05, 1.0, 0.05], rz: 0.45, cor: '#2a2a30', tipo: 'fosco' },
        { malha: m.caixa, p: [0.38, 1.38, -0.3], e: [0.05, 1.0, 0.05], rz: -0.45, cor: '#2a2a30', tipo: 'fosco' }] };
    }
    return { pecas: [] };
  }

  /* Põe as peças de um item na lista de desenho, presas à cabeça (ou ao corpo). cab: { x, y, z, r (raio da cabeça; no
     corpo, 1), ry, rx (inclinação do boneco), esc ([x, y, z]: o corpo esticado ou achatado no passo) }; cor: a cor do
     item. Devolve true se o item cobre a cabeça. */
  function desenhar(lista, r, id, cor, cab) {
    const def = pecas(r, id), hex = R.Aero3D.hex, k = cab.esc || [1, 1, 1];
    const cy = Math.cos(cab.ry), sy = Math.sin(cab.ry), cx = Math.cos(cab.rx || 0), sx = Math.sin(cab.rx || 0);
    def.pecas.forEach((p) => {
      const v = (p.p || [0, 0, 0]).map((a, i) => a * cab.r * k[i]), e = (p.e || [1, 1, 1]).map((a, i) => a * k[i]);
      // girar o ponto como o boneco: primeiro a inclinação (x), depois para onde olha (y)
      const y1 = cx * v[1] - sx * v[2], z1 = sx * v[1] + cx * v[2];
      const wx = cy * v[0] + sy * z1, wz = -sy * v[0] + cy * z1;
      lista.push({ malha: p.malha, tipo: p.tipo, realce: p.realce || 0, cor: hex(p.cor === 'item' ? cor : p.cor),
        t: { x: cab.x + wx, y: cab.y + y1, z: cab.z + wz, ry: cab.ry + (p.ry || 0), rx: (cab.rx || 0) + (p.rx || 0), rz: p.rz || 0, sx: e[0] * cab.r, sy: e[1] * cab.r, sz: e[2] * cab.r } });
    });
    return !!def.esconde;
  }

  R.Itens3D = { ITENS, desenhar };
})(window.RES);
