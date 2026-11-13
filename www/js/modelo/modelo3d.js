/* Rogue em' Slash — copiado do RL20 (js/jogo/modelo3d.js), sem mudanças além do espaço global (window.RES) e do nome das chaves salvas no navegador.
   Modelos 3D low poly dos heróis, no estilo Megaman Legends de PS1 (e dos modelos "Legends" feitos por fãs):
   cabeça grande, mãos de punho e botas enormes, membros finos, peças rígidas presas a um esqueleto e textura
   pintada à mão em pixels grandes (sombra em tons com manchas de pincel, listras no cabelo, músculos e clavículas
   na pele, rosto com olhos de anime grandes). Um rasterizador por software desenha e pinta tudo num canvas 2D (sem
   WebGL e sem bibliotecas: o jogo continua abrindo em file://). As poses e animações ficam em poses.js.
   Unidades: 1 unidade = 1 pixel do jogo (o herói tem ~100 de altura). Eixos do modelo: y para cima,
   z para a frente do personagem, x para a esquerda dele. */
(function (R) {
  'use strict';

  const RAD = Math.PI / 180, TAU = Math.PI * 2;
  const M3 = {};

  /* =====================================================================
     MATRIZES 3×4 (rotação + translação, por linhas)
     ===================================================================== */
  function mul(a, b) {
    return [
      a[0] * b[0] + a[1] * b[4] + a[2] * b[8], a[0] * b[1] + a[1] * b[5] + a[2] * b[9], a[0] * b[2] + a[1] * b[6] + a[2] * b[10], a[0] * b[3] + a[1] * b[7] + a[2] * b[11] + a[3],
      a[4] * b[0] + a[5] * b[4] + a[6] * b[8], a[4] * b[1] + a[5] * b[5] + a[6] * b[9], a[4] * b[2] + a[5] * b[6] + a[6] * b[10], a[4] * b[3] + a[5] * b[7] + a[6] * b[11] + a[7],
      a[8] * b[0] + a[9] * b[4] + a[10] * b[8], a[8] * b[1] + a[9] * b[5] + a[10] * b[9], a[8] * b[2] + a[9] * b[6] + a[10] * b[10], a[8] * b[3] + a[9] * b[7] + a[10] * b[11] + a[11],
    ];
  }
  const rotX = (g) => { const c = Math.cos(g * RAD), s = Math.sin(g * RAD); return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0]; };
  const rotY = (g) => { const c = Math.cos(g * RAD), s = Math.sin(g * RAD); return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0]; };
  const rotZ = (g) => { const c = Math.cos(g * RAD), s = Math.sin(g * RAD); return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0]; };
  const trans = (x, y, z) => [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z];
  // rotação de um osso: primeiro torce (y), depois dobra (x), depois abre para o lado (z)
  const rot = (x, y, z) => mul(rotZ(z), mul(rotX(x), rotY(y)));
  const aplicar = (m, x, y, z) => [m[0] * x + m[1] * y + m[2] * z + m[3], m[4] * x + m[5] * y + m[6] * z + m[7], m[8] * x + m[9] * y + m[10] * z + m[11]];

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const soma = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const esc = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const pontoP = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const mistura = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  /* =====================================================================
     CORES E MATERIAIS
     ===================================================================== */
  const empacotar = (c) => ((255 << 24) | (R.clamp(Math.round(c[2]), 0, 255) << 16) | (R.clamp(Math.round(c[1]), 0, 255) << 8) | R.clamp(Math.round(c[0]), 0, 255)) >>> 0;
  const TINTA = [24, 14, 30];   // cor-base do contorno (roxo bem escuro, como tinta de anime)

  /* peças com duas cores (a principal e a dos detalhes); cada uma ganha quatro materiais: pano e metal de cada cor */
  const PARTES = {
    peito: ['corPeito', 'corPeito2'], casaco: ['corCasaco', 'corCasaco2'], capa: ['corCapa', 'corCapa2'], capuz: ['corCapuz', 'corCapuz2'],
    ombros: ['corOmbros', 'corOmbros2'], luvas: ['corLuvas', 'corLuvas2'], pernas: ['corPernas', 'corPernas2'], saia: ['corSaia', 'corSaia2'],
    meias: ['corMeias', 'corMeias2'], cinto: ['corCinto', 'corCinto2'], calcados: ['corCalcados', 'corCalcados2'], mascara: ['corMascara', 'corMascara2'],
    colar: ['corColar', 'corColar2'], joias: ['corJoias', 'corJoias2'], costas: ['corCostas', 'corCostas2'], asas: ['corAsas', 'corAsas2'],
    cauda: ['corCauda', 'corCauda2'], adorno: ['corAdorno', 'detalhes'],
  };
  const MATS = ['pele', 'rosto', 'cabelo', 'marcas', 'emblema', 'detalhes', 'metal', 'escuro', 'madeira', 'vidro', 'brilho', 'aureola',
    'tecido', 'orelhaDentro', 'corpo2', 'corpo2Metal', 'focinho', 'sola', 'lamina', 'ferro', 'cabo', 'garra', 'presa', 'trevas', 'tela'];
  for (const n in PARTES) MATS.push(n, n + '2', n + 'Metal', n + '2Metal');
  const MAT = {};
  MATS.forEach((m, i) => { MAT[m] = i; });

  /* Sombreamento de cel em três tons, como nos modelos de Megaman Legends: realce (as faces viradas para a luz),
     luz (a cor escolhida) e sombra (multiplicada por um tom arroxeado, como sombra de anime). Metal ganha um quarto
     tom (claro: o brilho). linha: a cor do contorno. cor: '#rrggbb' ou [r, g, b]. */
  const QUENTE = [255, 248, 232];   // o realce puxa para um branco quente (luz de sol)
  const FUNDO = [44, 24, 70];   // a sombra funda puxa para um roxo escuro
  /* op: tomSombra (multiplica a cor na sombra), realce, claro (quanto clareiam), pincel (força das manchas de pincel),
     vies (desloca a luz: a pele fica mais clara), brilha (usa o tom "claro": metal e cabelo), plano (cor lisa) */
  /* cor da sombra como na pintura de anime: mais escura, um pouco mais saturada e com o matiz deslocado (amarelo puxa
     para o laranja, verde para o azul, azul para o violeta, vermelho para o magenta); cores quase sem saturação (branco,
     cinza, preto) ganham a sombra lavanda. k: quanto escurece. */
  function rgbHsv(c) {
    const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; if (h < 0) h += 1; }
    return [h, mx ? d / mx : 0, mx];
  }
  function hsvRgb(h, s, v) {
    h = ((h % 1) + 1) % 1;
    const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
    return [r * 255, g * 255, b * 255];
  }
  function sombraAnime(c, k) {
    const [h, s, v] = rgbHsv(c);
    const d = h < 0.11 ? -0.022 : h < 0.2 ? -0.05 : h < 0.48 ? 0.035 : h < 0.78 ? 0.025 : -0.02;
    const hsv = hsvRgb(h + d * (1 - k) * 2.6, Math.min(1, s * 1.1 + 0.06), v * k);
    const lav = [c[0] * (k - 0.02), c[1] * (k - 0.1), c[2] * (k + 0.1)];   // sombra lavanda (cores sem saturação)
    return mistura(lav, hsv, R.clamp((s - 0.08) / 0.2, 0, 1));
  }
  function material(cor, op) {
    op = op || {};
    const c = Array.isArray(cor) ? cor : R.hexParaRgb(cor);
    const tom = op.tomSombra;
    const sombra = tom ? [c[0] * tom[0], c[1] * tom[1], c[2] * tom[2]] : sombraAnime(c, 0.72);
    const funda = tom ? mistura(esc(sombra, 0.78), FUNDO, 0.12) : sombraAnime(c, 0.52);
    return {
      luz: empacotar(c), sombra: empacotar(sombra),
      funda: empacotar(funda),
      realce: empacotar(mistura(c, QUENTE, op.realce != null ? op.realce : 0.22)),
      claro: empacotar(mistura(c, [255, 255, 255], op.claro != null ? op.claro : 0.42)),
      linha: empacotar(mistura(esc(sombra, 0.5), TINTA, 0.35)),
      plano: !!op.plano, metal: !!op.metal, brilha: !!(op.brilha || op.metal),
      pincel: op.pincel != null ? op.pincel : 0.025, vies: op.vies || 0,
      tex: op.tex || null,   // textura do cenário (M3.renderizarCena: estética PSX)
      rgb: c,
    };
  }

  function paleta(ap) {
    const P = [];
    const pele = { tomSombra: [0.88, 0.7, 0.76], realce: 0.12, vies: 0.12, pincel: 0.03 };
    P[MAT.pele] = ap.corpo === 'golem' ? material(ap.pele, { metal: true, tomSombra: [0.66, 0.64, 0.76], claro: 0.6 })
      : material(ap.pele, ap.corpo === 'osteon' ? { tomSombra: [0.76, 0.74, 0.8] } : pele);   // osso: sombra cinza, não rosada
    P[MAT.rosto] = material(ap.pele, Object.assign({}, pele, { vies: 0.3, pincel: 0.02 }));   // o rosto: quase todo claro, a sombra só nos lados
    P[MAT.cabelo] = material(ap.cabelo, { claro: 0.48, realce: 0.24, brilha: true, pincel: 0.04 });
    P[MAT.marcas] = material(ap.corMarcas, pele);
    P[MAT.emblema] = material(ap.corEmblema);
    // peças de roupa: as duas cores, em pano e em metal (armaduras)
    const metal = { metal: true, tomSombra: [0.62, 0.62, 0.76], claro: 0.55 };
    for (const n in PARTES) {
      const [c1, c2] = PARTES[n];
      P[MAT[n]] = material(ap[c1]); P[MAT[n + '2']] = material(ap[c2]);
      P[MAT[n + 'Metal']] = material(ap[c1], metal); P[MAT[n + '2Metal']] = material(ap[c2], metal);
    }
    // capa e capuz: o lado de dentro sai na cor do forro
    P[MAT.capa].verso = P[MAT.capa2]; P[MAT.capuz].verso = P[MAT.capuz2];
    P[MAT.detalhes] = material(ap.detalhes, { tomSombra: [0.78, 0.66, 0.7] });
    P[MAT.metal] = material('#b9c2d4', { tomSombra: [0.62, 0.62, 0.76] });
    P[MAT.escuro] = material('#34303e');
    P[MAT.madeira] = material('#94603a');
    P[MAT.vidro] = material('#e0485e', { tomSombra: [0.75, 0.55, 0.75] });
    P[MAT.brilho] = material('#fff2a0', { plano: true });
    // armas e partes dos monstros (js/jogo/monstros.js): lâmina, ferro, cabo de couro, garras, presas e a luz das trevas
    P[MAT.lamina] = material('#dfe5ee', { metal: true, tomSombra: [0.58, 0.62, 0.8], claro: 0.62 });
    P[MAT.ferro] = material('#6e6a7c', { metal: true, tomSombra: [0.6, 0.6, 0.74], claro: 0.5 });
    P[MAT.cabo] = material('#4e3426');
    P[MAT.garra] = material('#3e362c', { realce: 0.2 });
    P[MAT.presa] = material('#efe4c8', { tomSombra: [0.8, 0.74, 0.72] });
    P[MAT.trevas] = material('#9a5cff', { plano: true });
    P[MAT.tela] = material('#9fdcff', { plano: true });   // tela acesa do celular
    P[MAT.aureola] = material(ap.corAdorno, { plano: true });
    P[MAT.tecido] = material(ap.detalhes, { tomSombra: [0.78, 0.66, 0.7] });
    P[MAT.orelhaDentro] = material(ap.corOrelhas2, pele);
    // detalhes do corpo de raça (chifres, cascos, juntas, barriga, costelas) e o focinho do minotauro
    P[MAT.corpo2] = material(ap.corCorpo2);
    P[MAT.corpo2Metal] = material(ap.corCorpo2, { metal: true, tomSombra: [0.62, 0.62, 0.76], claro: 0.55 });
    P[MAT.focinho] = material(mistura(R.hexParaRgb(ap.pele), R.hexParaRgb(ap.corCorpo2), 0.4), pele);
    // sola grossa das botas (estilo Megaman Legends): a cor do calçado bem escura
    P[MAT.sola] = material(mistura(esc(R.hexParaRgb(ap.corCalcados), 0.42), [40, 30, 52], 0.3), { realce: 0.12 });
    return P;
  }

  /* Cores do rosto pintado */
  function coresRosto(ap) {
    const pele = R.hexParaRgb(ap.pele), olho = R.hexParaRgb(ap.olhos), cab = R.hexParaRgb(ap.cabelo);
    return {
      pele: empacotar(pele),
      peleSombra: empacotar([pele[0] * 0.86, pele[1] * 0.7, pele[2] * 0.74]),
      rubor: empacotar(mistura(pele, [228, 80, 110], 0.42)),
      ruborClaro: empacotar(mistura(pele, [240, 100, 120], 0.26)),
      narina: empacotar([pele[0] * 0.62, pele[1] * 0.42, pele[2] * 0.46]),
      branco: empacotar([255, 252, 246]),
      esclera: empacotar(R.hexParaRgb(ap.corEsclera)),
      escleraSombra: empacotar(mistura(R.hexParaRgb(ap.corEsclera), [120, 130, 178], 0.3)),   // a sombra do cílio no branco
      brilhoIris: empacotar(mistura(olho, [255, 250, 210], 0.62)),
      iris: empacotar(olho),
      irisClara: empacotar(mistura(olho, [255, 255, 255], 0.32)),
      irisEscura: empacotar(esc(olho, 0.62)),
      irisAnel: empacotar(mistura(esc(olho, 0.42), TINTA, 0.3)),
      irisMeio: empacotar(mistura(olho, [255, 255, 255], 0.14)),
      dobra: empacotar([pele[0] * 0.78, pele[1] * 0.6, pele[2] * 0.62]),
      pupila: empacotar(mistura(esc(olho, 0.34), TINTA, 0.3)),   // a pupila é a íris bem escura (não preta)
      cilio: empacotar(mistura(esc(cab, 0.32), TINTA, 0.55)),   // o cílio puxa para a cor do cabelo (loira: castanho escuro)
      cilioClaro: empacotar(mistura(pele, [150, 70, 80], 0.4)),
      sobrancelha: empacotar(mistura(esc(cab, 0.55), TINTA, 0.35)),
      mascara: empacotar(R.hexParaRgb(ap.corMascara)),
      mascaraLinha: empacotar(mistura(esc(R.hexParaRgb(ap.corMascara), 0.36), TINTA, 0.45)),
      fenda: empacotar(TINTA),
      marca: empacotar(R.hexParaRgb(ap.corMascara2)),
      brilhoOlho: empacotar(mistura(R.hexParaRgb(ap.corMascara2), [255, 255, 255], 0.55)),
      marcaPele: empacotar(R.hexParaRgb(ap.corMarcas)),
      tipoMascara: ap.mascara, olhos: ESTILOS_OLHO.finos, marcas: ap.marcas, emblema: ap.emblema, sobrancelhas: ap.sobrancelhas || 'finas',
      // a estatura muda o rosto: no adulto os olhos são menores e o nariz tem a sombra da ponte
      olhoK: estaturaDe(ap) < 0.4 ? R.lerp(1.06, 1, estaturaDe(ap) / 0.4) : R.lerp(1, 0.86, (estaturaDe(ap) - 0.4) / 0.6), adulto: estaturaDe(ap) >= 0.7,
      // músculos pintados na pele (corpos largos e de raça forte); clavículas em todos (menos ossos e constructos)
      musculo: { largo: 1, anao: 1, minotauro: 1, trog: 1 }[ap.corpo] ? 1 : ap.corpo === 'osteon' || ap.corpo === 'golem' ? -1 : 0,
      ombro: proporcoes(ap).ombro, braco: proporcoes(ap).braco, perna: proporcoes(ap).perna, troncoK: proporcoes(ap).troncoK,
      corpo2: empacotar(R.hexParaRgb(ap.corCorpo2)), osso: empacotar(mistura(pele, [255, 255, 255], 0.25)),
      visor: empacotar(mistura(olho, [255, 255, 255], 0.45)),
      tipo: ap.corpo, quatro: ap.olhosQtd === '4', raca: ROSTO_RACA[ap.corpo] || ROSTO_RACA.padrao,
      // franja na testa: pinta a sombra dela (sem franja, careca ou penteado para trás, não)
      franja: ap.cabeloTras !== 'careca' && ap.cabeloFrente !== 'nenhum' && ap.cabeloFrente !== 'testa' && ap.capuz !== 'levantado' && !ROSTO_RACA[ap.corpo],
    };
  }
  /* rostos de raça: onde ficam os olhos (centro e tamanho), se há nariz e rubor (ninguém tem boca) */
  const ROSTO_RACA = {
    padrao: { ox: 0.41, oy: -0.12, ok: 1, nariz: true, rubor: true },
    goblin: { ox: 0.41, oy: -0.09, ok: 1.08, nariz: false, rubor: true },
    minotauro: { ox: 0.5, oy: 0.04, ok: 0.62, nariz: false, rubor: false },
    trog: { ox: 0.56, oy: 0.06, ok: 0.58, nariz: false, rubor: false, pupilaFenda: true },
    osteon: { caveira: true }, golem: { golem: true },
  };

  /* =====================================================================
     CONSTRUÇÃO DAS MALHAS
     Cada peça fica presa a um osso (como nos modelos de PS1). Triângulos: [a, b, c, material, efeito].
     Efeito 1 = rosto pintado; 2 = brilho do cabelo; 3 = máscara pintada. Peças "abertas" (saias, mangas largas, laços)
     desenham os dois lados; o lado de dentro sai na cor da sombra.
     ===================================================================== */
  function novaPeca(m, osso, grupo, op) {
    const p = Object.assign({ osso: m.idx[osso], grupo, v: [], t: [], uv: [], uvA: null, aberta: false, prop: null, chao: true }, op || {});
    m.pecas.push(p);
    return p;
  }
  function vert(p, x, y, z) { p.v.push(x, y, z); if (p.uv) p.uv.push(p.uvA ? p.uvA[0] : 0, p.uvA ? p.uvA[1] : 0); return p.v.length / 3 - 1; }   // (as peças do cenário não têm uv)
  function vertA(p, a) { return vert(p, a[0], a[1], a[2]); }
  function pv(p, i) { return [p.v[i * 3], p.v[i * 3 + 1], p.v[i * 3 + 2]]; }
  /* triângulo virado para fora: "ref" é um ponto do lado de dentro */
  function tri(p, a, b, c, mat, ef, ref) {
    if (ref) {
      const A = pv(p, a), n = cruz(sub(pv(p, b), A), sub(pv(p, c), A));
      const cen = esc(soma(soma(A, pv(p, b)), pv(p, c)), 1 / 3);
      if (pontoP(n, sub(cen, ref)) < 0) { const t = b; b = c; c = t; }
    }
    p.t.push(a, b, c, mat, ef || 0);
  }
  function quad(p, a, b, c, d, mat, ef, ref) { tri(p, a, b, c, mat, ef, ref); tri(p, a, c, d, mat, ef, ref); }

  /* Tubo ao longo de y: anéis {y, rx, rz, x, z}. mat pode ser função (segmento, lado, ângulo) → mat ou [mat, efeito]. */
  /* mais lados nos tubos (formas lisas, como os modelos do estilo Legends); as camadas de roupa continuam encaixadas
     porque a troca é a mesma para todas as peças com o mesmo número de lados */
  const LISO = { 5: 7, 6: 9, 7: 10, 8: 12, 9: 13, 10: 14, 11: 15, 12: 16, 14: 18, 16: 20 };
  /* op.caixa: anéis em forma de caixa de cantos redondos (superelipse com esse expoente: 2 = oval, 4 a 6 = quase
     quadrado), para botas, armaduras e blocos do estilo Legends; um anel pode ter o seu (r.caixa) */
  const potS = (v, e) => (v < 0 ? -Math.pow(-v, e) : Math.pow(v, e));
  function tubo(p, aneis, lados, mat, op) {
    op = op || {};
    if (!op.duro && LISO[lados]) lados = LISO[lados];
    const a0 = op.a0 != null ? op.a0 : 0;
    const tf = op.tf || ((x, y, z) => [x, y, z]);
    const anel = aneis.map((r) => {
      const l = [], cx = r.caixa || op.caixa, e = cx ? 2 / cx : 1;
      for (let k = 0; k < lados; k++) {
        const a = a0 + (k / lados) * TAU, sa = Math.sin(a), ca = Math.cos(a);
        l.push(vertA(p, tf((r.x || 0) + (cx ? potS(sa, e) : sa) * r.rx, r.y, (r.z || 0) + (cx ? potS(ca, e) : ca) * (r.rz != null ? r.rz : r.rx))));
      }
      return l;
    });
    const centro = (r) => tf(r.x || 0, r.y, r.z || 0);
    for (let s = 0; s < aneis.length - 1; s++) {
      const ref = mistura(centro(aneis[s]), centro(aneis[s + 1]), 0.5);
      for (let k = 0; k < lados; k++) {
        const k2 = (k + 1) % lados;
        let mm = typeof mat === 'function' ? mat(s, k, a0 + ((k + 0.5) / lados) * TAU) : mat;
        if (mm == null) continue;
        const ef = Array.isArray(mm) ? mm[1] : 0;
        if (Array.isArray(mm)) mm = mm[0];
        quad(p, anel[s][k], anel[s][k2], anel[s + 1][k2], anel[s + 1][k], mm, ef, ref);
      }
    }
    // tampa: leque até o centro do anel (ou até uma ponta); "dentro" é o centro do anel vizinho
    const tampa = (anelI, r, vizinho, ponta, mm) => {
      const c = ponta ? vertA(p, tf(ponta[0], ponta[1], ponta[2])) : vertA(p, centro(r));
      const ref = centro(vizinho);
      for (let k = 0; k < lados; k++) tri(p, anelI[k], anelI[(k + 1) % lados], c, mm, 0, ref);
    };
    const mIni = op.matIni != null ? op.matIni : (typeof mat === 'function' ? null : mat);
    const mFim = op.matFim != null ? op.matFim : (typeof mat === 'function' ? null : mat);
    const n = aneis.length - 1;
    if (op.tampaIni && mIni != null) tampa(anel[0], aneis[0], aneis[1], op.tampaIni === true ? null : op.tampaIni, mIni);
    if (op.tampaFim && mFim != null) tampa(anel[n], aneis[n], aneis[n - 1], op.tampaFim === true ? null : op.tampaFim, mFim);
    return anel;
  }

  /* Tubo ao longo de pontos quaisquer (chifres, mechas largas, arco da besta). seção: raio por ponto. */
  function tuboLivre(p, pontos, raios, lados, mat, op) {
    op = op || {};
    const n = pontos.length;
    const aneis = [];
    let ref = op.cima || [0, 1, 0];
    for (let i = 0; i < n; i++) {
      const t = norm(sub(pontos[Math.min(n - 1, i + 1)], pontos[Math.max(0, i - 1)]));
      let u = cruz(t, ref);
      if (Math.hypot(u[0], u[1], u[2]) < 1e-4) u = cruz(t, [1, 0, 0]);
      u = norm(u);
      const w = norm(cruz(u, t));
      const r = raios[i];
      const l = [];
      if (r <= 0.001) l.push(vertA(p, pontos[i]));
      else for (let k = 0; k < lados; k++) {
        const a = (op.a0 || 0) + (k / lados) * TAU;
        const rr = Array.isArray(r) ? r : [r, r];
        l.push(vertA(p, soma(pontos[i], soma(esc(u, Math.cos(a) * rr[0]), esc(w, Math.sin(a) * rr[1])))));
      }
      aneis.push(l);
    }
    for (let i = 0; i < n - 1; i++) {
      const A = aneis[i], B = aneis[i + 1], ref2 = mistura(pontos[i], pontos[i + 1], 0.5);
      if (A.length === 1 && B.length === 1) continue;
      for (let k = 0; k < Math.max(A.length, B.length); k++) {
        const a1 = A[k % A.length], a2 = A[(k + 1) % A.length], b1 = B[k % B.length], b2 = B[(k + 1) % B.length];
        if (A.length === 1) tri(p, a1, b2, b1, mat, 0, ref2);
        else if (B.length === 1) tri(p, a1, a2, b1, mat, 0, ref2);
        else quad(p, a1, a2, b2, b1, mat, 0, ref2);
      }
    }
    if (op.tampa && aneis[0].length > 1) { const c = vertA(p, pontos[0]); for (let k = 0; k < aneis[0].length; k++) tri(p, aneis[0][k], aneis[0][(k + 1) % aneis[0].length], c, mat, 0, pontos[1]); }
  }

  /* cabelo do estilo Legends: mechas largas e chatas (lâminas), num volume maior em volta da cabeça */
  const MECHA_LARG = 1.75, MECHA_ESP = 1.0, VOLUME = 1.17, VOL_MECHA = 0.12;
  /* Mecha de cabelo: lâmina facetada (seção em losango) numa curva de Bézier, afinando até a ponta.
     fora: direção "para fora" da cabeça (define o lado chato da mecha). */
  function mecha(p, P0, P1, P2, larg, esp, op) {
    op = op || {};
    const mat = op.mat != null ? op.mat : MAT.cabelo;
    const cabelo = p.mecha && mat === MAT.cabelo;
    if (cabelo) { larg *= MECHA_LARG; esp *= MECHA_ESP; }   // cabelo em lâminas largas (Megaman Legends)
    const N = op.segs || 4;
    const centro = op.centro || [0, 10, 0.3];
    // onda: desvio de lado ao longo da mecha (cabelo ondulado)
    const onda = (t) => (op.onda ? esc(op.onda[0], Math.sin(t * Math.PI * op.onda[1]) * t) : [0, 0, 0]);
    const bez = (t) => soma(soma(soma(esc(P0, (1 - t) * (1 - t)), esc(P1, 2 * (1 - t) * t)), esc(P2, t * t)), onda(t));
    const der = (t) => soma(esc(sub(P1, P0), 2 * (1 - t)), esc(sub(P2, P1), 2 * t));
    const aneis = [];
    for (let i = 0; i < N; i++) {
      const t = i / N;
      const c = bez(t), tg = norm(der(t));
      let fora = op.fora ? norm(op.fora) : norm(c[1] < 4 || c[1] > 30 ? [c[0] - centro[0], 0, c[2] - centro[2]] : sub(c, centro));
      let w = cruz(tg, fora);
      if (Math.hypot(w[0], w[1], w[2]) < 1e-3) w = cruz(tg, [0, 0, 1]);
      w = norm(w);
      const th = norm(cruz(w, tg));
      // largura ao longo da mecha: afina até a ponta (as de cabelo ficam largas por mais tempo: lâminas) ou o perfil pedido
      const k = op.perfil ? op.perfil(t) : Math.pow(1 - t, (op.afina || 0.8) * (cabelo ? 0.72 : 1));
      const L = larg * k * 0.5, E = esp * k * 0.5;
      const anel = [];
      [[w, L, 0], [th, E, 0.5], [w, -L, 1], [th, -E * 0.35, 0.5]].forEach(([d, k2, u]) => { p.uvA = [u, t]; anel.push(vertA(p, soma(c, esc(d, k2)))); });
      aneis.push(anel);
      if (i === 0) {
        p.uvA = [0.5, 0];
        const cc = vertA(p, soma(c, esc(tg, -0.4)));
        for (let q = 0; q < 4; q++) tri(p, aneis[0][q], aneis[0][(q + 1) % 4], cc, mat, 0, soma(c, esc(tg, 1)));
      }
    }
    p.uvA = [0.5, 1];
    const ponta = vertA(p, bez(1));
    p.uvA = null;
    for (let i = 0; i < N; i++) {
      const A = aneis[i], B = aneis[i + 1];
      const ref = bez((i + 0.5) / N);
      for (let q = 0; q < 4; q++) {
        if (B) quad(p, A[q], A[(q + 1) % 4], B[(q + 1) % 4], B[q], mat, 0, ref);
        else tri(p, A[q], A[(q + 1) % 4], ponta, mat, 0, ref);
      }
    }
  }

  /* Esfera low poly (bolinhas, coque, orbe) */
  function esfera(p, c, r, mat, lados, aneisN) {
    lados = lados || 6; aneisN = aneisN || 4;
    const rr = Array.isArray(r) ? r : [r, r, r];
    const aneis = [];
    for (let i = 1; i < aneisN; i++) {
      const b = Math.PI * (i / aneisN - 0.5);
      aneis.push({ y: c[1] + Math.sin(b) * rr[1], rx: Math.cos(b) * rr[0], rz: Math.cos(b) * rr[2], x: c[0], z: c[2] });
    }
    tubo(p, aneis, lados, mat, { tampaIni: [c[0], c[1] - rr[1], c[2]], tampaFim: [c[0], c[1] + rr[1], c[2]] });
  }

  /* Caixa alinhada aos eixos, com os seis lados virados para fora (celular, móveis do lobby); tf: transforma cada ponto */
  function caixa(p, x0, x1, y0, y1, z0, z1, mat, tf) {
    tf = tf || ((q) => q);
    const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]].map((q) => vertA(p, tf(q)));
    const ref = tf([(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]);
    [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [3, 2, 6, 7], [0, 3, 7, 4], [1, 2, 6, 5]].forEach(([a, b, c, d]) => quad(p, v[a], v[b], v[c], v[d], mat, 0, ref));
  }

  /* ---------- Proporções ---------- */
  /* Corpos (os de raça também mudam o tamanho dos membros e da cabeça). perna, bracoL: comprimento das pernas e dos
     braços; ante, canela, mao, pe: grossura do antebraço e da canela e tamanho da mão e do pé; cabeca: tamanho da cabeça. */
  const CORPOS = {
    esguio: { ombro: 9.0, peito: 7.9, peitoZ: 5.9, cintura: 5.7, quadril: 8.6, braco: 2.7, coxa: 4.9 },
    largo: { ombro: 10.8, peito: 9.6, peitoZ: 6.3, cintura: 7.2, quadril: 8.0, braco: 3.2, coxa: 5.1 },
    anao: { ombro: 11.2, peito: 10.2, peitoZ: 6.9, cintura: 8.6, quadril: 9.2, braco: 3.6, coxa: 5.8, perna: 0.6, bracoL: 0.8, ante: 1.3, canela: 1.3, mao: 1.12, pe: 1.1, cabeca: 1.08 },
    goblin: { ombro: 7.8, peito: 6.9, peitoZ: 5.2, cintura: 5.3, quadril: 7.0, braco: 2.2, coxa: 3.9, perna: 0.6, bracoL: 0.86, ante: 0.85, canela: 0.85, mao: 1.1, pe: 1.15, cabeca: 1.22 },
    hynne: { ombro: 8.2, peito: 7.3, peitoZ: 5.5, cintura: 5.8, quadril: 7.7, braco: 2.6, coxa: 4.7, perna: 0.6, bracoL: 0.72, ante: 0.95, canela: 1.0, pe: 1.12, cabeca: 1.14 },
    minotauro: { ombro: 12.8, peito: 11.4, peitoZ: 7.3, cintura: 8.2, quadril: 9.2, braco: 4.1, coxa: 6.3, perna: 1.05, bracoL: 1.05, ante: 1.45, canela: 1.35, mao: 1.15, pe: 1.1, cabeca: 0.92 },
    trog: { ombro: 10.4, peito: 9.0, peitoZ: 6.1, cintura: 6.0, quadril: 8.0, braco: 3.1, coxa: 5.1, bracoL: 1.06, ante: 1.15, canela: 1.1, mao: 1.1, pe: 1.1, cabeca: 0.95 },
    osteon: { ombro: 9.0, peito: 7.9, peitoZ: 5.9, cintura: 5.7, quadril: 8.6, braco: 2.7, coxa: 4.9 },
    golem: { ombro: 11.0, peito: 9.6, peitoZ: 6.4, cintura: 6.6, quadril: 8.2, braco: 3.2, coxa: 5.1, perna: 1.04, bracoL: 1.06, ante: 1.2, canela: 1.15, mao: 1.1 },
  };
  /* Estilo Megaman Legends: mãos de luva enormes, botas pesadas, membros com volume de boneco. São fatores por cima
     das proporções de cada corpo (as raças continuam diferentes entre si). */
  const ESTILO = { quadril: 1.12, cintura: 1.06 };
  /* Estatura (aparência "estatura", de 0 a 1), medida nos modelos de referência do estilo Legends: jovem (0: ~4,2
     cabeças de altura, cabeça grande e tronco curto), padrão (0,4: ~5 cabeças, como os heróis do Megaman Legends) e
     adulto (1: ~6,3 cabeças, ombros largos, braços e pernas compridos). Cada medida: [jovem, padrão, adulto]
     (multiplica a do corpo). */
  const ESTATURA = {
    cabeca: [1.19, 1.08, 0.965], perna: [0.97, 1.14, 1.42], tronco: [0.82, 0.9, 1.1], bracoL: [1.02, 1.13, 1.34],
    ombro: [1.1, 1.26, 1.4], peito: [1.04, 1.13, 1.24], braco: [1.14, 1.22, 1.34], ante: [1.18, 1.26, 1.38],
    coxa: [1.06, 1.12, 1.18], canela: [1.16, 1.22, 1.28], mao: [1.72, 1.72, 1.64], pe: [1.74, 1.76, 1.72],
  };
  const daEstatura = (k, e) => { const v = ESTATURA[k]; return e < 0.4 ? R.lerp(v[0], v[1], e / 0.4) : R.lerp(v[1], v[2], (e - 0.4) / 0.6); };
  /* estatura da aparência (0 = jovem, 0,4 = padrão, 1 = adulto), em passos de 0,1 (a malha é guardada assim) */
  const estaturaDe = (ap) => Math.round(R.clamp(ap.estatura != null ? +ap.estatura : 0.4, 0, 1) * 10) / 10;
  /* curvas do tronco (aparência "curvas", de 0 a 1, em passos de 0,1): 0,75 é a silhueta de boneca de sempre (cintura
     fina, quadril cheio); para baixo a cintura alarga e o quadril estreita até o tronco reto, masculino (0); para cima,
     ainda mais marcadas. A barriga, o quadril e tudo o que se veste por cima (casacos, calças, saias, cintos) acompanham. */
  const CURVAS_PADRAO = 0.75;
  const curvasDe = (ap) => Math.round(R.clamp(ap.curvas != null ? +ap.curvas : CURVAS_PADRAO, 0, 1) * 10) / 10;
  function aplicarCurvas(c, cv) {
    if (cv < CURVAS_PADRAO) {
      const t = 1 - cv / CURVAS_PADRAO;   // 0: como sempre; 1: reto
      const cin = Math.max(c.cintura, c.peito * 0.8), qua = Math.min(c.quadril, Math.max(cin * 1.04, c.quadril * 0.8));
      c.cintura = R.lerp(c.cintura, cin, t); c.quadril = R.lerp(c.quadril, qua, t);
      c.coxa *= R.lerp(1, 0.94, t); c.pernaX = R.lerp(1, 0.9, t);   // as coxas mais juntas e o alto delas mais fino: sem "quadril" nas calças
    } else if (cv > CURVAS_PADRAO) {
      const t = (cv - CURVAS_PADRAO) / (1 - CURVAS_PADRAO);
      c.cintura *= 1 - 0.08 * t; c.quadril *= 1 + 0.06 * t;
    }
  }
  /* proporções com o busto escolhido (0 a 1) */
  function proporcoes(ap) {
    const b = Math.round(R.clamp(+ap.busto || 0, 0, 1) * 10) / 10;
    const c = Object.assign({ perna: 1, bracoL: 1, ante: 1, canela: 1, mao: 1, pe: 1, cabeca: 1 }, CORPOS[ap.corpo] || CORPOS.esguio);
    c.busto = b * 3.0; c.peitoZ += b * 0.9;
    c.tipo = ap.corpo;
    const e = estaturaDe(ap);
    c.estatura = e;
    ['cabeca', 'mao', 'pe', 'perna', 'bracoL', 'coxa', 'braco', 'canela', 'ante', 'ombro', 'peito'].forEach((k) => { c[k] *= daEstatura(k, e); });
    c.troncoK = daEstatura('tronco', e);
    c.quadril *= ESTILO.quadril; c.cintura *= ESTILO.cintura;   // quadril e cintura cheios, de boneco
    aplicarCurvas(c, curvasDe(ap));
    if (ap.calcados === 'descalco') c.pe *= 0.74;   // o pé grande é o da bota; descalço (ou de sandália e de sapato), um pé normal
    else if (ap.calcados === 'sandalias' || ap.calcados === 'sapatos') c.pe *= 0.8;
    return c;
  }
  /* escala das peças de cada osso (feita depois de montar: as roupas acompanham o membro) */
  function escalaDoOsso(c, nome) {
    const n = nome.replace(/[ED]$/, '');
    if (n === 'tronco' || n === 'peito') return [1, c.troncoK, 1];   // tronco curto (os ossos presos a ele descem junto)
    if (n === 'braco') return [1, c.bracoL, 1];
    if (n === 'antebraco') return [c.ante, c.bracoL, c.ante];
    if (n === 'mao') return [c.mao, c.mao, c.mao];
    if (n === 'coxa' || n === 'saia') return [1, c.perna, 1];
    if (n === 'canela') return [c.canela, c.perna, c.canela];
    if (n === 'pe') return [c.pe, c.pe, c.pe];
    if (n === 'capa') { const k = (17 + 43 * c.perna) / 60; return [1, k, 1]; }
    return null;
  }

  /* Cabeça (espaço do osso da cabeça: origem no queixo/nuca). Anéis do topo ao queixo, 10 lados com a face da
     frente reta (é nela que vai o rosto pintado). */
  /* Cabeça no estilo Megaman Legends: crânio grande e redondo, bochechas largas na altura dos olhos, o rosto quase
     reto na frente e o queixo pequeno. CABECA_FORMA é o perfil fino (a malha da cabeça e a superfície onde o cabelo
     se apoia); CABECA é o mesmo perfil medido nas seis alturas de antes (a touca, o capuz e as máscaras usam estes). */
  const CABECA_FORMA = [
    { y: 19.3, rx: 4.0, rz: 4.4, z: -0.7 },
    { y: 18.3, rx: 6.4, rz: 6.9, z: -0.6 },
    { y: 16.6, rx: 8.1, rz: 8.4, z: -0.5 },
    { y: 14.2, rx: 8.95, rz: 9.0, z: -0.3 },
    { y: 11.4, rx: 9.1, rz: 9.0, z: -0.05 },
    { y: 8.8, rx: 8.75, rz: 8.5, z: 0.3 },
    { y: 6.6, rx: 7.9, rz: 7.6, z: 0.7 },
    { y: 4.6, rx: 6.3, rz: 6.6, z: 1.25 },
    { y: 2.8, rx: 4.2, rz: 5.3, z: 2.1 },
    { y: 1.5, rx: 2.3, rz: 3.9, z: 2.9 },
  ];
  /* o anel da cabeça na altura y (entre os anéis do perfil fino) */
  function anelCabeca(y) {
    const L = CABECA_FORMA;
    if (y >= L[0].y) return { y, rx: L[0].rx, rz: L[0].rz, z: L[0].z };
    for (let i = 0; i < L.length - 1; i++) if (y <= L[i].y && y >= L[i + 1].y) {
      const t = (L[i].y - y) / (L[i].y - L[i + 1].y);
      return { y, rx: R.lerp(L[i].rx, L[i + 1].rx, t), rz: R.lerp(L[i].rz, L[i + 1].rz, t), z: R.lerp(L[i].z, L[i + 1].z, t) };
    }
    const u = L[L.length - 1];
    return { y, rx: u.rx, rz: u.rz, z: u.z };
  }
  const CABECA = [18.6, 16.2, 12.4, 8.4, 4.8, 2.2].map(anelCabeca);
  const TOPO_CABECA = [0, 19.9, -0.7], QUEIXO = [0, 0.5, 4.4];
  const CENTRO_CABECA = [0, 10, 0.3];
  const ROSTO_X = 8.9;   // meia largura do rosto pintado (o rosto vai de -1 a 1 em u = x / ROSTO_X)
  const K_ORELHA = 1.06;   // as orelhas saem da cabeça (mais larga que a de antes)
  /* ponto na superfície da cabeça (ângulo em graus: 0 = frente, 90 = esquerda), inflada por s */
  function sup(a, y, s) {
    s = s || 1;
    const r = anelCabeca(R.clamp(y, 4.6, 30));
    const ar = a * RAD;
    return [Math.sin(ar) * r.rx * s, CENTRO_CABECA[1] + (y - CENTRO_CABECA[1]) * s, r.z + Math.cos(ar) * r.rz * s];
  }

  /* ---------- Esqueleto ----------
     tipo 'cima': tronco/cabeça (x+ = inclina para a frente); 'membro': braços e pernas (x+ = para a frente,
     z+ = abre para fora; na canela, x+ dobra o joelho); 'cabelo': mechas que pendem com a gravidade. */
  function esqueleto(c, ap) {
    const O = [];
    const add = (nome, pai, off, tipo, lado, sx) => O.push({ nome, pai, off, tipo, lado: lado || 1, sx: sx || 1 });
    add('raiz', null, [0, 48, 0], 'cima');
    add('tronco', 'raiz', [0, 6.2, 0], 'cima');
    add('peito', 'tronco', [0, 7, 0], 'cima');
    add('pescoco', 'peito', [0, 13, -0.6], 'cima');
    add('cabeca', 'pescoco', [0, 3.1, 0.8], 'cima');
    [['E', 1], ['D', -1]].forEach(([l, s]) => {
      add('braco' + l, 'peito', [s * (c.ombro - 2.4), 10.2, -0.5], 'membro', s, -1);
      add('antebraco' + l, 'braco' + l, [0, -14 * c.bracoL, 0], 'membro', s, -1);
      add('mao' + l, 'antebraco' + l, [0, -12 * c.bracoL, 0], 'membro', s, -1);
    });
    [['E', 1], ['D', -1]].forEach(([l, s]) => {
      add('coxa' + l, 'raiz', [s * 4.3 * Math.sqrt(ESTILO.quadril) * (c.pernaX || 1), -1.5, 0], 'membro', s, -1);
      add('canela' + l, 'coxa' + l, [0, -21 * c.perna, 0], 'membro', s, 1);
      add('pe' + l, 'canela' + l, [0, -22 * c.perna, 0], 'membro', s, -1);
    });
    // metades da saia: seguem (em parte) a coxa do mesmo lado
    O.push({ nome: 'saiaE', pai: 'raiz', off: [1.2, 2, 0], tipo: 'segue', ref: 'coxaE', lado: 1, sx: -1 });
    O.push({ nome: 'saiaD', pai: 'raiz', off: [-1.2, 2, 0], tipo: 'segue', ref: 'coxaD', lado: -1, sx: -1 });
    // capa: pende das costas com a gravidade, como o cabelo; asas e cauda presas às costas e ao quadril
    add('capa', 'peito', [0, 11.6, -4.7], 'cabelo');
    add('asas', 'peito', [0, 8.6, -4.8], 'cima');
    add('cauda', 'raiz', [0, 0.5, -5.4], 'cima');
    // forma aquática (sereia/tritão na água): a cauda de peixe no lugar das pernas, dobrando como a média das pernas
    add('peixe', 'raiz', [0, -1.5, 0], 'media');
    add('peixe2', 'peixe', [0, -21 * c.perna, 0], 'media');
    const est = trasDe(ap);
    add('cabeloT', 'cabeca', est === 'rabo' ? [0, 16.4, -8.2] : est === 'zero' ? [0, 17.4, -8.8] : [0, 12.5, -7.4], 'cabelo');
    const altas = est === 'marias_longas';   // as marias longas saem mais alto e mais para trás
    add('cabeloE', 'cabeca', altas ? [7.4, 17.2, -4.8] : [7.6, 14.6, -3.4], 'cabelo', 1);
    add('cabeloD', 'cabeca', altas ? [-7.4, 17.2, -4.8] : [-7.6, 14.6, -3.4], 'cabelo', -1);
    O.forEach((o) => { o.paiI = o.pai == null ? -1 : O.findIndex((x) => x.nome === o.pai); });
    // tronco curto: o que está preso à barriga e ao peito desce na mesma proporção das peças (escalaDoOsso)
    O.forEach((o) => { if (o.pai === 'tronco' || o.pai === 'peito') o.off = [o.off[0], o.off[1] * c.troncoK, o.off[2]]; });
    return O;
  }

  /* ---------- Corpo e roupas ----------
     O corpo é sempre o mesmo; as roupas são quatro peças que se combinam: peito (blusa, camisa…), casaco (por
     cima de tudo), pernas (calça, saia…) e calçados. Cada uma tem a sua cor. Camadas de pano, de dentro para fora:
     pernas → peito → casaco (os raios crescem para uma não atravessar a outra). */
  const angAbs = (ang) => Math.abs(((ang / RAD + 180) % 360 + 360) % 360 - 180);   // 0 = frente, 180 = costas
  const naFrente = (ang, lim) => angAbs(ang) < lim;
  const entre = (ang, a, b) => { const g = angAbs(ang); return g >= a && g <= b; };

  function aneisTronco(c) {
    return {
      quadril: [
        { y: -7.4, rx: 2.8, rz: 2.6, z: 0.3 }, { y: -4.6, rx: c.quadril * 0.86, rz: 5.0, z: 0.2 }, { y: 0, rx: c.quadril, rz: 5.6 },
        { y: 3.6, rx: (c.quadril + c.cintura) / 2, rz: 5.0 }, { y: 6.6, rx: c.cintura, rz: 4.4 }],
      barriga: [{ y: -0.6, rx: c.cintura, rz: 4.4 }, { y: 3.6, rx: c.cintura * 1.04, rz: 4.6, z: 0.15 }, { y: 7.2, rx: (c.cintura + c.peito) / 2, rz: 5.0, z: 0.2 }],
      peito: [
        { y: -0.6, rx: (c.cintura + c.peito) / 2, rz: 5.0, z: 0.2 }, { y: 3.8, rx: c.peito, rz: c.peitoZ, z: 0.2 + c.busto },
        { y: 7.6, rx: c.peito + 0.6, rz: 5.5, z: 0.25 + c.busto * 0.4 }, { y: 10.8, rx: c.ombro, rz: 4.4, z: -0.4 }, { y: 13.2, rx: 4.0, rz: 3.2, z: -0.6 }],
    };
  }
  /* casca de roupa por cima de uma parte do corpo */
  const inflar = (aneis, k, mais) => aneis.map((r) => ({ y: r.y, rx: r.rx * k + (mais || 0), rz: (r.rz != null ? r.rz : r.rx) * k + (mais || 0), x: r.x, z: r.z }));
  const COXA = (X) => [{ y: 2.6, rx: X * 0.85 }, { y: -1, rx: X, rz: X * 1.02 }, { y: -10, rx: X * 0.9, rz: X * 0.95 }, { y: -19.6, rx: X * 0.68 }, { y: -21.6, rx: X * 0.6 }];
  const CANELA = [{ y: 1.6, rx: 3.1 }, { y: -4.2, rx: 3.5, z: -0.5 }, { y: -12, rx: 2.7 }, { y: -20.4, rx: 2.0 }, { y: -22, rx: 1.95 }];
  /* raio de um perfil (lista de anéis de cima para baixo) na altura y */
  function noPerfil(L, y) {
    if (y >= L[0].y) return L[0];
    for (let i = 0; i < L.length - 1; i++) if (y <= L[i].y && y >= L[i + 1].y) {
      const t = (L[i].y - y) / (L[i].y - L[i + 1].y), a = L[i], b = L[i + 1];
      return { y, rx: R.lerp(a.rx, b.rx, t), rz: R.lerp(a.rz != null ? a.rz : a.rx, b.rz != null ? b.rz : b.rx, t), z: R.lerp(a.z || 0, b.z || 0, t) };
    }
    return L[L.length - 1];
  }
  /* cano (de bota, de meia…) que acompanha um perfil de topo até baixo, um pouco mais largo. abre(y): folga a mais
     (o cano das botas abre perto do tornozelo, como as botas pesadas do Megaman Legends) */
  function cano(L, topo, baixo, folga, abre) {
    const ys = [topo, topo - 1.3, ...L.map((r) => r.y).filter((y) => y < topo - 1.3 && y > baixo), baixo];
    return ys.map((y, i) => { const r = noPerfil(L, y), f = folga + (i === 0 ? 0.3 : 0) + (abre ? abre(y) : 0); return { y, rx: r.rx + f, rz: (r.rz != null ? r.rz : r.rx) + f, z: r.z }; });
  }
  /* quanto o cano da bota (que começa em topo) abre na altura y da canela */
  /* bloco de quatro lados entre seções (cada seção: [x, y0, y1, z, meia largura]); ref: um ponto de dentro */
  function bloco(p, secoes, mat, ref) {
    const an = secoes.map(([x, y0, y1, z, w]) => [vert(p, x - w, y0, z), vert(p, x + w, y0, z), vert(p, x + w, y1, z), vert(p, x - w, y1, z)]);
    for (let i = 0; i < an.length - 1; i++) for (let k = 0; k < 4; k++) quad(p, an[i][k], an[i][(k + 1) % 4], an[i + 1][(k + 1) % 4], an[i + 1][k], mat, 0, ref);
    [0, an.length - 1].forEach((i) => quad(p, an[i][0], an[i][1], an[i][2], an[i][3], mat, 0, ref));
  }

  /* borda rasgada: dentes de pano pendurados em volta de um anel (y, raio), de comprimentos diferentes */
  function rasgado(p, y, r, comp, mat) {
    const N = 7, pts = [];
    for (let k = 0; k < N; k++) { const a = (k / N) * TAU; pts.push(vertA(p, [Math.sin(a) * r, y, Math.cos(a) * r])); }
    for (let k = 0; k < N; k++) {
      const a = ((k + 0.5) / N) * TAU, l = comp * (0.45 + ((k * 37) % 10) / 14);
      const ponta = vertA(p, [Math.sin(a) * r * 0.92, y - l, Math.cos(a) * r * 0.92]);
      tri(p, pts[k], pts[(k + 1) % N], ponta, mat);
    }
  }
  /* pontas penduradas na última volta de um tubo (folhas, rasgos): uma por face incluída. Devolve [ponta, a, b] de
     cada uma (os dois vértices da barra de onde ela pende: no pano, a ponta acompanha a barra) */
  function pontas(p, anel, lados, incluir, comp, mat, irregular) {
    lados = anel.length;   // (o tubo pode ter ganho lados: ver LISO)
    // o lado de fora fica virado para longe do centro do anel
    const cen = esc(anel.reduce((a, i) => soma(a, pv(p, i)), [0, 0, 0]), 1 / anel.length);
    const feitas = [];
    for (let k = 0; k < lados; k++) {
      if (!incluir(((k + 0.5) / lados) * TAU)) continue;
      const A = pv(p, anel[k]), B = pv(p, anel[(k + 1) % lados]);
      const l = comp * (irregular ? 0.4 + ((k * 37 + lados * 11) % 10) / 12 : 1);
      const ponta = vertA(p, soma(mistura(A, B, 0.5), [0, -l, 0]));
      tri(p, anel[k], anel[(k + 1) % lados], ponta, mat, 0, soma(cen, [0, -l * 0.5, 0]));
      feitas.push([ponta, anel[k], anel[(k + 1) % lados]]);
    }
    return feitas;
  }
  /* superfície da frente do peito (espaço do osso do peito): z na altura y, a x do meio */
  function frenteZ(c, y, x) {
    const r = noPerfil(aneisTronco(c).peito.slice().reverse(), y);
    return (r.z || 0) + r.rz * Math.sqrt(Math.max(0, 1 - sq(x / r.rx)));
  }
  /* cadarço: zigue-zague na frente de um perfil (canela, espartilho), de y0 até y1 */
  function cadarco(p, L, y0, y1, folga, larg, mat) {
    const pts = [], n = Math.max(2, Math.round((y0 - y1) / 1.5));
    for (let i = 0; i <= n; i++) {
      const y = R.lerp(y0, y1, i / n), r = noPerfil(L, y), x = (i % 2 ? 1 : -1) * larg;
      pts.push([x, y, (r.z || 0) + (r.rz != null ? r.rz : r.rx) * Math.sqrt(Math.max(0, 1 - sq(x / r.rx))) + folga]);
    }
    tuboLivre(p, pts, pts.map(() => 0.32), 3, mat, { cima: [0, 0, 1] });
  }
  /* continhas em volta de um anel (pérolas, contas): centro, raios do anel, quantas */
  function contas(p, c, rx, rz, n, r, mat) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      esfera(p, [c[0] + Math.sin(a) * rx, c[1], c[2] + Math.cos(a) * rz], r, mat, 4, 3);
    }
  }

  const COBRE_ANTEBRACO = { longas: 1, faixas: 1, manguitos: 1 };

  function construirCorpo(m, c, ap) {
    const T = aneisTronco(c);
    const P = ap.peito, CS = ap.casaco, PE = ap.pernas, CA = ap.calcados, LU = ap.luvas;
    const MANTO = CS === 'manto', JAQ = CS === 'jaqueta' || CS === 'sobretudo' || CS === 'sobretudo_mangas';
    const NU = P === 'nenhum';   // sem camisa
    const EMB = ap.emblema !== 'nenhum';
    // o emblema vai na frente do peito da peça de fora (o manto, que é fechado, ou a do peito)
    const comEmblema = (mat, s, ang) => (EMB && s <= 2 && naFrente(ang, 62) ? [Array.isArray(mat) ? mat[0] : mat, 4] : mat);

    // ---- corpo: quadril (pernas), barriga e peito (peça do peito), pescoço ----
    tubo(novaPeca(m, 'raiz', 1), T.quadril, 8, MAT.pernas, { tampaIni: [0, -8, 0.3], tampaFim: true });
    const TIPO = c.tipo;
    const matTronco = (s, k, ang) => {
      if (NU && TIPO === 'osteon') return [MAT.pele, 8];
      if (NU && TIPO === 'trog' && naFrente(ang, 50)) return MAT.corpo2;
      if (NU) return MAT.pele;
      if (P === 'cota') return [MAT.peitoMetal, 6];
      return MAT.peito;
    };
    const fechaTronco = NU ? MAT.pele : MAT.peito;
    tubo(novaPeca(m, 'tronco', 1), T.barriga, 8, matTronco, { tampaIni: true, matIni: fechaTronco, tampaFim: true, matFim: fechaTronco });
    const matPeito = (s, k, ang) => {
      if (NU && TIPO === 'osteon' && s <= 2) return [MAT.pele, 7];
      if (NU && TIPO === 'trog' && s <= 1 && naFrente(ang, 50)) return MAT.corpo2;
      if (NU) return MAT.pele;
      if (s === 3) {   // ombros e decote
        if (P === 'regata') return naFrente(ang, 45) || entre(ang, 55, 125) ? MAT.pele : MAT.peito;
        if (P === 'camiseta') return naFrente(ang, 20) ? MAT.pele : MAT.peito;
        if (P === 'espartilho') return angAbs(ang) < 125 ? MAT.pele : MAT.peito;
      }
      if (P === 'cota') return [MAT.peitoMetal, 6];
      return MAT.peito;
    };
    tubo(novaPeca(m, 'peito', 1), T.peito, 8, MANTO ? matPeito : (s, k, ang) => comEmblema(matPeito(s, k, ang), s, ang),
      { tampaIni: true, matIni: NU ? MAT.pele : MAT.peito, tampaFim: [0, 13.8, -0.6], matFim: MAT.pele });
    // sem camisa e com busto: uma faixa no peito (na cor da peça do peito)
    if (NU && c.busto >= 0.9) tubo(novaPeca(m, 'peito', 1), cano(T.peito.slice().reverse(), 8.6, 1.4, 0.24), 8, MAT.peito, { tampaIni: true, tampaFim: true });
    tubo(novaPeca(m, 'pescoco', 1, { sombraTopo: 1.2 }), [{ y: -1.2, rx: 2.5, rz: 2.6 }, { y: 2.0, rx: 2.3, rz: 2.4, z: 0.1 }, { y: 5.4, rx: 2.2, rz: 2.3, z: 0.3 }], 6, MAT.pele, { tampaFim: true });   // a sombra do queixo no pescoço

    // ---- braços ----
    const longa = P === 'camisa' || P === 'tunica';
    const matManga = MAT.peito;
    const matMao = { curtas: MAT.luvas, longas: MAT.luvas, sem_dedos: MAT.luvas, faixas: MAT.luvas }[LU] || MAT.pele;
    const matDedos = LU === 'sem_dedos' || LU === 'faixas' ? MAT.pele : matMao;
    [['E', 1], ['D', -1]].forEach(([l, s]) => {
      const g = l === 'E' ? 10 : 11, B = c.braco;
      const mBraco = (sg) => (longa ? matManga : P === 'camiseta' && sg <= 1 ? MAT.peito : P === 'cota' ? [MAT.peitoMetal, 6] : MAT.pele);
      const fecho = (sg) => { const x = mBraco(sg); return Array.isArray(x) ? x[0] : x; };
      tubo(novaPeca(m, 'braco' + l, g), [{ y: 2.2, rx: B * 0.75 }, { y: 0.4, rx: B * 1.08 }, { y: -6, rx: B * 0.98 }, { y: -13, rx: B * 0.8 }, { y: -14.8, rx: B * 0.62 }], 6,
        mBraco, { tampaIni: true, matIni: fecho(0), tampaFim: true, matFim: fecho(3) });
      if (P === 'camiseta') {   // barra da manga curta
        tubo(novaPeca(m, 'braco' + l, g), [{ y: 2.6, rx: B * 0.95 }, { y: 0.3, rx: B * 1.18 }, { y: -6.2, rx: B * 1.1 }, { y: -6.9, rx: B * 0.92 }], 6, MAT.peito, { tampaIni: true, tampaFim: true });
        tubo(novaPeca(m, 'braco' + l, g), [{ y: -4.9, rx: B * 1.12 }, { y: -5.4, rx: B * 1.24 }, { y: -7.0, rx: B * 1.2 }, { y: -7.4, rx: B * 1.0 }], 6, MAT.peito2, { tampaIni: true, tampaFim: true });   // barra grossa
      }
      if (P === 'cota') {   // barra da manga de malha, no cotovelo
        tubo(novaPeca(m, 'braco' + l, g), [{ y: -9.6, rx: B * 0.92 + 0.3 }, { y: -12.6, rx: B * 0.84 + 0.45 }, { y: -13.4, rx: B * 0.76 + 0.3 }], 6, MAT.peito2, { tampaIni: true, tampaFim: true });
      }
      tubo(novaPeca(m, 'antebraco' + l, g), [{ y: 1.6, rx: 2.2 }, { y: -2, rx: 2.35 }, { y: -10.6, rx: 1.75 }, { y: -12.4, rx: 1.6 }], 6,
        longa ? matManga : MAT.pele, { tampaIni: true, tampaFim: true });
      if (P === 'camisa') {   // punho
        tubo(novaPeca(m, 'antebraco' + l, g), [{ y: -8.8, rx: 2.15 }, { y: -9.4, rx: 2.2 }, { y: -12.1, rx: 1.95 }, { y: -12.6, rx: 1.75 }], 6, MAT.peito2, { tampaIni: true, tampaFim: true });
      }
      if (P === 'tunica' && !COBRE_ANTEBRACO[LU]) {   // braçadeira de couro
        tubo(novaPeca(m, 'antebraco' + l, g), [{ y: -3.6, rx: 2.55 }, { y: -5, rx: 2.6 }, { y: -10.6, rx: 2.15 }, { y: -11.8, rx: 2.0 }], 6,
          MAT.peito2, { tampaIni: true, tampaFim: true });
      }
      // mão em bloco (como os punhos do Megaman Legends): a palma, os dedos dobrados para dentro (com os vãos pintados:
      // efeito 10) e o polegar grosso na frente
      const mo = novaPeca(m, 'mao' + l, g);
      tubo(mo, [{ y: 0.9, rx: 1.25, rz: 1.0 }, { y: -0.9, rx: 1.12, rz: 1.62 }, { y: -2.3, rx: 1.18, rz: 1.78 }], 6, matMao,
        { a0: Math.PI / 6, tampaIni: true });
      tubo(mo, [{ y: -2.0, rx: 1.16, rz: 1.74, x: s * -0.05 }, { y: -3.6, rx: 1.06, rz: 1.66, x: s * -0.4 }, { y: -4.5, rx: 0.86, rz: 1.5, x: s * -0.75 }], 6, [matDedos, 10],
        { a0: Math.PI / 6, tampaFim: [s * -0.95, -4.9, 0], matFim: matDedos });
      tuboLivre(mo, [[s * -0.15, -0.5, 1.1], [s * -0.45, -2.1, 2.3], [s * -0.65, -3.3, 2.5]], [0.82, 0.68, 0], 5, matDedos, { tampa: true });
      if (TIPO === 'trog' && matDedos === MAT.pele) [-0.6, 0, 0.6].forEach((dx) => tuboLivre(novaPeca(m, 'mao' + l, g), [[dx, -4.3, 0.6], [dx, -5.4, 1.3], [dx, -5.9, 2.0]], [0.36, 0.22, 0], 3, MAT.corpo2, { tampa: true, cima: [1, 0, 0] }));
      if (TIPO === 'golem') {   // juntas de cotovelo e punho
        esfera(novaPeca(m, 'antebraco' + l, g), [0, 0.2, 0], 2.3, MAT.corpo2Metal, 6, 3);
        tubo(novaPeca(m, 'antebraco' + l, g), [{ y: -5.4, rx: 2.6 }, { y: -9.2, rx: 2.3 }], 6, MAT.corpo2Metal, { tampaIni: true, tampaFim: true });
      }
      construirLuvas(m, c, ap, l, s, g);
    });

    // ---- pernas, meias e calçados ----
    const meiaNoPe = { longas: 1, listradas: 1, curtas: 1 }[ap.meias];
    [['E', 1], ['D', -1]].forEach(([l, s]) => {
      const g = l === 'E' ? 12 : 13, X = c.coxa;
      const mCoxa = (sg) => (PE === 'armadura' ? MAT.pernasMetal : PE === 'calca' || PE === 'larga' || PE === 'rasgada' || (PE === 'bermuda' && sg <= 1) ? MAT.pernas : MAT.pele);
      tubo(novaPeca(m, 'coxa' + l, g), COXA(X), 8, mCoxa, { tampaIni: true, matIni: MAT.pernas, tampaFim: true, matFim: mCoxa(3) });
      if (PE === 'bermuda') {   // barra da bermuda
        tubo(novaPeca(m, 'coxa' + l, g), cano(COXA(X), -6.5, -10.8, 0.45), 8, MAT.pernas2, { tampaIni: true, tampaFim: true });
      }
      const mCanela = (sg) => (PE === 'armadura' ? MAT.pernasMetal : PE === 'calca' || PE === 'larga' || (PE === 'rasgada' && sg === 0) ? MAT.pernas : MAT.pele);
      tubo(novaPeca(m, 'canela' + l, g), CANELA, 8, mCanela, { tampaIni: true, matIni: mCanela(0), tampaFim: true, matFim: mCanela(3) });
      if (PE === 'rasgada') {   // barra recortada, logo abaixo do joelho
        tubo(novaPeca(m, 'canela' + l, g), cano(CANELA, -3.6, -6, 0.3), 8, MAT.pernas2, { tampaIni: true, tampaFim: true });
        rasgado(novaPeca(m, 'canela' + l, g, { aberta: true }), -6, noPerfil(CANELA, -6).rx + 0.45, 3.6, MAT.pernas2);
      }
      if (PE === 'larga') {   // calça larga (de kung fu): bem folgada na coxa e na canela, franzida no tornozelo com a barra
        const L = COXA(X);
        tubo(novaPeca(m, 'coxa' + l, g), [2.6, -1, -8, -15, -21.6].map((y, i) => { const r = noPerfil(L, y), k = [1.2, 1.32, 1.34, 1.3, 1.24][i]; return { y, rx: r.rx * k + 0.9, rz: (r.rz != null ? r.rz : r.rx) * k + 0.8 }; }), 10,
          MAT.pernas, { tampaIni: true, tampaFim: true });
        tubo(novaPeca(m, 'canela' + l, g), [{ y: 2.0, rx: 4.3, rz: 4.1 }, { y: -4, rx: 4.7, rz: 4.5, z: -0.2 }, { y: -12, rx: 4.6, rz: 4.4, z: -0.1 }, { y: -17.6, rx: 3.6, rz: 3.4 }, { y: -19.2, rx: 2.6, rz: 2.5 }], 10,
          MAT.pernas, { tampaIni: true, tampaFim: true });
        tubo(novaPeca(m, 'canela' + l, g), [{ y: -18.4, rx: 2.75, rz: 2.65 }, { y: -18.9, rx: 2.85, rz: 2.75 }, { y: -21.4, rx: 2.6, rz: 2.5 }, { y: -21.8, rx: 2.3, rz: 2.2 }], 8, MAT.pernas2, { tampaIni: true, tampaFim: true });   // barra
      }
      if (PE === 'armadura') {   // a coxa em bloco (na cor principal), a junta escura do joelho e a joelheira (segunda cor)
        const L = COXA(X);
        tubo(novaPeca(m, 'coxa' + l, g), [-1.2, -8, -15, -19.4].map((y) => { const r = noPerfil(L, y); return { y, rx: r.rx + 0.55, rz: (r.rz != null ? r.rz : r.rx) + 0.55, z: 0.1 }; }), 12,
          MAT.pernasMetal, { caixa: 3.4, tampaIni: true, tampaFim: true });
        tubo(novaPeca(m, 'canela' + l, g), [{ y: 1.8, rx: 2.9, rz: 2.9 }, { y: -1.6, rx: 3.1, rz: 3.1 }], 8, MAT.escuro, { tampaIni: true, tampaFim: true });
        if (CA !== 'grevas') tubo(novaPeca(m, 'canela' + l, g), [{ y: 2.2, rx: 2.2, rz: 0.9, z: 2.8 }, { y: 1.2, rx: 2.7, rz: 1.3, z: 3.1 }, { y: -2.2, rx: 2.6, rz: 1.2, z: 3.2 }, { y: -3.2, rx: 2.0, rz: 0.9, z: 3.0 }], 8,
          MAT.pernas2Metal, { caixa: 3.5, tampaIni: true, tampaFim: true });
      }
      construirMeias(m, c, ap, l, g);
      construirCalcado(m, c, ap, l, g, X, meiaNoPe);
      if (CA === 'descalco' && TIPO === 'trog') [-1.2, 0, 1.2].forEach((dx) => tuboLivre(novaPeca(m, 'pe' + l, g), [[dx, -2.4, 6.0], [dx, -2.9, 8.2], [dx, -3.4, 9.4]], [0.5, 0.3, 0], 3, MAT.corpo2, { tampa: true, cima: [0, 1, 0] }));
      if (TIPO === 'golem') {   // joelho e canela
        esfera(novaPeca(m, 'canela' + l, g), [0, 0.2, 0.6], 2.9, MAT.corpo2Metal, 6, 3);
        tubo(novaPeca(m, 'canela' + l, g), [{ y: -8.0, rx: 3.5 }, { y: -12.6, rx: 3.15 }], 6, MAT.corpo2Metal, { tampaIni: true, tampaFim: true });
      }
    });

    /* camadas do quadril: cada peça que veste o quadril guarda o seu contorno (anéis {y, rx, rz, z} no espaço da raiz)
       e a próxima cresce até ficar por fora de todos eles, então nenhuma combinação fura a outra. De dentro para fora:
       calça → saia → túnica → cinto (por baixo do casaco) → casaco → cinto (por cima de tudo) */
    const FOLGA = 1.06;   // de uma camada para a de fora (os tubos são polígonos: o meio da face fica para dentro do vértice)
    const contornos = [];
    const contorno = (aneis) => contornos.push(aneis.map((r) => ({ y: r.y, rx: r.rx, rz: r.rz != null ? r.rz : r.rx, z: r.z || 0 })).sort((a, b) => b.y - a.y));
    const escalado = (aneis, k) => aneis.map((r) => ({ y: r.y, rx: r.rx * k, rz: r.rz * k, z: r.z }));
    // o menor k (a partir de k0) que deixa os anéis base·k por fora de todos os contornos, com folga
    const kPorFora = (base, k0) => {
      let k = k0;
      base = base.slice().sort((a, b) => b.y - a.y);
      for (const L of contornos) {
        const topo = Math.min(base[0].y, L[0].y), fundo = Math.max(base[base.length - 1].y, L[L.length - 1].y);
        for (const y of base.map((r) => r.y).concat(L.map((r) => r.y))) {
          if (y > topo || y < fundo) continue;
          const b = noPerfil(base, y), o = noPerfil(L, y);
          k = Math.max(k, (o.rx * FOLGA) / b.rx, ((o.rz + Math.abs(o.z - (b.z || 0))) * FOLGA) / b.rz);
        }
      }
      return k;
    };
    contorno(T.quadril);
    contorno(T.barriga.map((r) => ({ y: 6.2 + r.y * c.troncoK, rx: r.rx, rz: r.rz, z: r.z })));   // (a barriga, no espaço da raiz)

    // ---- calça folgada no quadril ----
    if (PE === 'larga') {   // a calça larga também é folgada no quadril
      const L = T.quadril.slice(1, 5).map((r) => ({ y: r.y, rx: r.rx * 1.12 + 0.7, rz: (r.rz != null ? r.rz : r.rx) * 1.12 + 0.7, z: r.z || 0 }));
      tubo(novaPeca(m, 'raiz', 1), L, 10, MAT.pernas, { tampaIni: [0, -6.6, 0.3], tampaFim: true });
      contorno(L);
    }
    if (PE === 'armadura') {   // placa do quadril em bloco (segunda cor), como um calção de armadura
      const L = T.quadril.slice(1, 5).map((r, i) => ({ y: r.y, rx: r.rx * 1.08 + 0.6, rz: (r.rz != null ? r.rz : r.rx) * 1.08 + 0.6 + (i === 1 ? 0.2 : 0), z: (r.z || 0) + 0.1 }));
      tubo(novaPeca(m, 'raiz', 1), L, 12, (sg) => (sg === 2 ? MAT.pernasMetal : MAT.pernas2Metal), { caixa: 3.2, tampaIni: [0, -6.4, 0.4], matIni: MAT.pernas2Metal, tampaFim: true });
      contorno(escalado(L, 1.14));   // em caixa: os cantos vão mais longe que a elipse
    }

    /* saia: faixa da cintura presa ao quadril + duas metades de pano (peças "pano", nos ossos saiaE/saiaD): cada
       coluna da metade cai da cintura em segmentos que desviam das pernas (renderizar → panoDaPose), então a perna
       nunca atravessa o pano ao andar ou chutar, e ele balança com o vento e os giros que a pose traz (pose.pano).
       k0: camada mínima (cresce até ficar por fora do que já está no quadril; devolve a que ficou). op: frente
       (abertura na frente, em graus: casacos), paineis (só frente e trás: tabardo), pontas (folhas ou rasgos pendurados
       na barra), irregular, n (quantos lados) */
    const perfilSaia = (comp, aba, abre) => [{ y: 5.2, rx: c.cintura + 0.8, rz: 5.0, z: 0.1 }, { y: 1.5, rx: c.quadril + 1.1, rz: 6.6, z: 0 },
      { y: -comp + aba, rx: c.quadril + 1.2 + abre * 0.85, rz: 6.6 + abre * 0.8, z: -0.3 }, { y: -comp, rx: c.quadril + 1.2 + abre, rz: 6.6 + abre, z: -0.4 }];
    const saia = (comp, aba, abre, mat, faixa, k0, op) => {
      op = op || {};
      const n = op.n || 12, base = perfilSaia(comp, aba, abre), k = kPorFora(base, k0);
      const fora = (ang) => (op.frente && angAbs(ang) < op.frente) || (op.paineis && entre(ang, op.paineis, 180 - op.paineis));
      tubo(novaPeca(m, 'raiz', 2, { aberta: true, chao: false }), escalado(base.slice(0, 2), k), n, (sg, kk, ang) => (fora(ang) ? null : mat));
      [['E', 1, 1], ['D', -1, 0.985]].forEach(([l, sd, kk2]) => {
        const o = m.esqueleto[m.idx['saia' + l]].off, B = escalado(base, k * kk2);
        const usa = (ang) => {
          const gr = ((ang / RAD) % 360 + 360) % 360;   // 0 = frente, 90 = esquerda
          return (sd > 0 ? (gr <= 195 || gr >= 345) : (gr >= 165 || gr <= 15)) && !fora(ang);
        };
        const p = novaPeca(m, 'saia' + l, 2, { aberta: true, chao: false });
        const topo = B[1], barra = B[2];
        // anéis no meio (um a cada ~8): é onde o pano dobra para passar por cima do joelho
        const aneis = [topo], nMeio = R.clamp(Math.round((topo.y - barra.y) / 8), 0, 4);
        for (let i = 1; i <= nMeio; i++) {
          const t = i / (nMeio + 1);
          aneis.push({ y: R.lerp(topo.y, barra.y, t), rx: R.lerp(topo.rx, barra.rx, t), rz: R.lerp(topo.rz, barra.rz, t), z: barra.z * t });
        }
        aneis.push(barra, B[3]);
        const sgFaixa = aneis.length - 2;
        const anel = tubo(p, aneis, n, (sg, kk3, ang) => (usa(ang) ? (sg === sgFaixa ? faixa : mat) : null), { tf: (x, y, z) => [x - o[0], y - o[1], z - o[2]] });
        p.pano = { aneis: anel, o: o.slice(), pontas: op.pontas ? pontas(p, anel[anel.length - 1], n, usa, op.pontas, op.matPontas || mat, op.irregular) : [] };
      });
      contorno(escalado(base, k));
      return k;
    };
    const SA = ap.saia;
    if (SA === 'curta') saia(14.5, 2, 4.2, MAT.saia, MAT.saia2, 1);
    if (SA === 'longa') saia(39, 2.4, 7, MAT.saia, MAT.saia2, 1);
    if (SA === 'folhas') saia(10, 1.6, 3.4, MAT.saia, MAT.saia, 1.04, { pontas: 4.6, matPontas: MAT.saia2 });
    if (SA === 'tabardo') {   // panos na frente e atrás, presos dos lados por um cordão
      const k = saia(30, 2.2, 1.2, MAT.saia, MAT.saia2, 1.03, { paineis: 34 });
      tubo(novaPeca(m, 'raiz', 1), [{ y: 4.0, rx: (c.cintura + 1.0) * k, rz: 5.3 * k / 1.03 }, { y: 5.0, rx: (c.cintura + 0.95) * k, rz: 5.15 * k / 1.03 }], 8, MAT.saia2, { tampaIni: true, tampaFim: true });
    }
    // a túnica e a cota descem até o quadril, por cima da saia
    if (P === 'tunica') saia(7.5, 1.3, 1.6, MAT.peito, MAT.peito, 1.06);
    if (P === 'cota') saia(9.5, 1.4, 1.6, [MAT.peitoMetal, 6], MAT.peito2, 1.06);

    // ---- detalhes do peito ----
    if (P === 'camisa' && !JAQ && !MANTO) {   // gola
      tubo(novaPeca(m, 'peito', 3), [{ y: 11.6, rx: 4.6, rz: 3.9, z: -0.3 }, { y: 13.4, rx: 4.3, rz: 3.7, z: -0.4 }, { y: 14.6, rx: 3.0, rz: 2.9, z: -0.2 }], 8, MAT.peito, { tampaIni: true, tampaFim: true });
    }
    if (P === 'espartilho') {   // renda na borda de cima e o cordão da frente
      tubo(novaPeca(m, 'peito', 1), cano(T.peito.slice().reverse(), 10.9, 9.6, 0.22), 8, MAT.peito2, { tampaIni: true, tampaFim: true });
      cadarco(novaPeca(m, 'peito', 1), T.peito.slice().reverse(), 9.2, -0.4, 0.35, 0.75, MAT.peito2);
      cadarco(novaPeca(m, 'tronco', 1), T.barriga.slice().reverse(), 6.6, -0.4, 0.3, 0.75, MAT.peito2);
    }

    /* ---- cinto ----
       cintoPos: dentro (por baixo da camisa: a túnica e a cota cobrem a cintura, então ele nem aparece), baixo (por
       cima da camisa, da saia e da túnica, por baixo do casaco) ou cima (por cima de tudo). Cada anel do cinto é
       empurrado para fora do que ele cobre (o cinto aperta por cima da roupa sem furá-la, até os inclinados, que descem
       pelo quadril até a saia); fivelas, bolsas e o nó vão junto com o pedaço do cinto onde encostam */
    const CI = ap.cinto, CPOS = ap.cintoPos;
    const cinto = () => {
      const kc = 1.02, coberto = (JAQ || MANTO) && CPOS !== 'cima';   // o casaco cobre os lados (e o manto, a frente também)
      // o contorno de fora do que o cinto cobre, na altura y
      const envolta = (y) => {
        let rx = 0, rz = 0;
        for (const L of contornos) {
          if (y > L[0].y + 0.3 || y < L[L.length - 1].y - 0.3) continue;
          const o = noPerfil(L, y);
          rx = Math.max(rx, o.rx); rz = Math.max(rz, o.rz + Math.abs(o.z));
        }
        return [rx, rz];
      };
      const saiu = new Map();   // quanto o cinto ficou fora do contorno, por altura: vira o contorno dele (para o casaco)
      const empurra = (x, y, z, folga) => {
        const [ex, ez] = envolta(y), f = folga || FOLGA;
        if (!ex) return [x, y, z];
        const e = Math.hypot(x / ex, z / ez), s = e >= f || e < 1e-6 ? 1 : f / e, i = Math.round(y * 2) / 2;
        saiu.set(i, Math.max(saiu.get(i) || 0, e * s));
        return [x * s, y, z * s];
      };
      const tf = (antes, folga) => (x, y, z) => { const p = antes ? antes(x, y, z) : [x, y, z]; return empurra(p[0], p[1], p[2], folga); };
      // quanto andou o ponto p do cinto, e uma peça que anda junto
      const desloca = (p, folga) => { const q = empurra(p[0], p[1], p[2], folga); return [q[0] - p[0], 0, q[2] - p[2]]; };
      const move = (d, antes) => (x, y, z) => { const p = antes ? antes(x, y, z) : [x, y, z]; return [p[0] + d[0], p[1], p[2] + d[2]]; };
      // cintos inclinados acompanham o quadril (o anel encolhe onde o corpo afina)
      const PERFIL_QUADRIL = T.quadril.slice().reverse();
      const inclinado = (f) => (x, y, z) => { const ny = y + x * f, k = noPerfil(PERFIL_QUADRIL, ny).rx / noPerfil(PERFIL_QUADRIL, y).rx; return [x * k, ny, z * k]; };
      const cintura = (dy, larg) => [{ y: 3.6 + dy, rx: ((c.quadril + c.cintura) / 2 + 0.5) * kc + larg, rz: 5.5 * kc + larg }, { y: 6.4 + dy, rx: (c.cintura + 0.55) * kc + larg, rz: 4.95 * kc + larg }];
      // fivela em (x, y), na altura z; zc: onde ela encosta no cinto
      const fivela = (y, z, w, x, antes, zc, folga) => {
        x = x || 0;
        const d = desloca(antes ? antes(x, y, zc != null ? zc : z - 0.2) : [x, y, zc != null ? zc : z - 0.2], folga);
        tubo(novaPeca(m, 'raiz', 1), [{ y: y - 1.6, rx: w, rz: 0.6, z: z + 0.25, x }, { y: y + 1.6, rx: w, rz: 0.6, z: z - 0.25, x }], 4, MAT.cinto2Metal,
          { a0: Math.PI / 4, tampaIni: true, tampaFim: true, tf: move(d, antes) });
      };
      if (CI === 'simples' || CI === 'bolsas') {
        tubo(novaPeca(m, 'raiz', 1), cintura(0, 0), 8, MAT.cinto, { tampaIni: true, tampaFim: true, tf: tf() });
        if (!(coberto && MANTO)) fivela(5, 5.45 * kc, 1.4);
      }
      if (CI === 'bolsas' && !coberto) {   // bolsinhas dos lados e atrás
        [[1, 70], [-1, 70], [1, 150]].forEach(([sd, a]) => {
          const ar = a * RAD, x = sd * Math.sin(ar) * (c.quadril + 1.2) * kc, z = Math.cos(ar) * 6.0 * kc;
          const d = desloca([sd * Math.sin(ar) * ((c.quadril + c.cintura) / 2 + 0.5) * kc, 3.6, Math.cos(ar) * 5.5 * kc]);
          tubo(novaPeca(m, 'raiz', 1), [{ y: 0.6, rx: 1.7, rz: 1.1, x, z }, { y: 4.6, rx: 1.8, rz: 1.2, x, z }], 4, MAT.cinto,
            { a0: Math.PI / 4, tampaIni: true, tampaFim: true, matFim: MAT.cinto2, tf: move(d) });
        });
      }
      if (CI === 'duplo') {   // um na cintura e outro caído no quadril, inclinado
        tubo(novaPeca(m, 'raiz', 1), cintura(0.6, -0.1).map((r, i) => (i === 0 ? Object.assign({}, r, { y: 5.1 }) : r)), 8, MAT.cinto, { tampaIni: true, tampaFim: true, tf: tf() });
        if (!(coberto && MANTO)) fivela(5.7, 5.25 * kc, 1.1);
        tubo(novaPeca(m, 'raiz', 1), [{ y: 0.8, rx: (c.quadril + 0.9) * kc, rz: 6.2 * kc }, { y: 2.4, rx: (c.quadril + 0.7) * kc, rz: 6.0 * kc }], 8, MAT.cinto,
          { tampaIni: true, tampaFim: true, tf: tf(inclinado(0.2)) });
      }
      if (CI === 'cruzado') {   // dois cintos caídos no quadril, cruzando na frente (o segundo um pouco mais por fora)
        [1, -1].forEach((sd, i) => {
          const incl = inclinado(sd * 0.24), kk = kc * (1 + i * 0.025), folga = FOLGA * (1 + i * 0.025);
          tubo(novaPeca(m, 'raiz', 1), [{ y: 0.9, rx: (c.quadril + 0.9) * kk, rz: 6.2 * kk }, { y: 2.5, rx: (c.quadril + 0.7) * kk, rz: 6.0 * kk }], 8, MAT.cinto,
            { tampaIni: true, tampaFim: true, tf: tf(incl, folga) });
          const rx = (c.quadril + 0.8) * kk, rz = 6.1 * kk;
          if (!coberto) fivela(1.7, 6.0 * kk + 0.2, 0.95, -sd * 3.6, incl, rz * Math.sqrt(Math.max(0, 1 - sq(3.6 / rx))), folga);
        });
      }
      if (CI === 'faixa') {   // faixa larga com nó do lado e pontas penduradas
        tubo(novaPeca(m, 'raiz', 1), [{ y: 1.8, rx: (c.quadril + 0.8) * kc, rz: 6.2 * kc }, { y: 4.2, rx: ((c.quadril + c.cintura) / 2 + 0.8) * kc, rz: 5.7 * kc }, { y: 7.2, rx: (c.cintura + 0.8) * kc, rz: 5.0 * kc }], 8,
          MAT.cinto, { tampaIni: true, tampaFim: true, tf: tf() });
        if (!coberto) {
          const no0 = [(c.quadril + 0.6) * kc * 0.92, 4.4, 2.6], no = soma(no0, desloca(no0));
          esfera(novaPeca(m, 'raiz', 1), no, [1.4, 1.5, 1.2], MAT.cinto2, 5, 3);
          [[0.6, 0], [-0.4, 1]].forEach(([dz, k]) => mecha(novaPeca(m, 'raiz', 2), no, soma(no, [1.6, -4, dz]), soma(no, [1.4 + k, -12 + k * 2, dz * 1.6 + 0.6]), 2.8, 0.7, { mat: MAT.cinto, fora: [1, 0, 0.3], segs: 3, afina: 0.3 }));
        }
      }
      // o contorno do cinto (para o casaco, se ele for por baixo)
      const L = [...saiu].map(([y, s]) => { const [ex, ez] = envolta(y); return { y, rx: ex * s, rz: ez * s }; }).filter((r) => r.rx > 0);
      if (L.length > 1) contorno(L);
    };
    const temCinto = CI !== 'nenhum' && !(CPOS === 'dentro' && (P === 'tunica' || P === 'cota'));
    if (temCinto && !(CPOS === 'cima' && (JAQ || MANTO))) cinto();

    // ---- casaco: por fora de tudo o que está no quadril (e do cinto, se ele for por baixo) ----
    if (JAQ || MANTO) {
      // tronco: aberto na frente (jaqueta, sobretudo) ou fechado (manto). 16 lados: a abertura fica estreita (o casaco
      // cobre um pouco o peito)
      const N = 16;
      const aberto = (s, k, ang) => (MANTO || angAbs(ang) >= 20 ? MAT.casaco : null);
      const kt = 1.08;
      const kq = kPorFora([{ y: 6.6, rx: c.cintura + 0.9, rz: 5.3, z: 0.1 }, { y: 3.6, rx: (c.quadril + c.cintura) / 2 + 0.9, rz: 5.9 }, { y: 0, rx: c.quadril + 1.0, rz: 6.5 }], kt * 1.04);
      const barriga = inflar(T.barriga, kt, 0.3);
      barriga[0] = { y: -0.6, rx: (c.cintura + 0.9) * kq, rz: 5.3 * kq, z: 0.1 };   // embaixo cobre o cinto e a túnica
      tubo(novaPeca(m, 'tronco', 3, { aberta: true }), barriga, N, aberto);
      tubo(novaPeca(m, 'peito', 3, { aberta: true }), inflar(T.peito.slice(0, 4), kt, 0.3), N, MANTO ? (s, k, ang) => comEmblema(MAT.casaco, s, ang) : aberto);
      const quadril = [{ y: 0, rx: (c.quadril + 1.0) * kq, rz: 6.5 * kq }, { y: 3.6, rx: ((c.quadril + c.cintura) / 2 + 0.9) * kq, rz: 5.9 * kq }, { y: 6.6, rx: (c.cintura + 0.9) * kq, rz: 5.3 * kq, z: 0.1 }];
      tubo(novaPeca(m, 'raiz', 3, { aberta: true, chao: false }), quadril, N, aberto);
      // gola alta
      tubo(novaPeca(m, 'peito', 3, { aberta: true }), [{ y: 10.4, rx: c.ombro * kt + 0.3, rz: 4.9 * kt }, { y: 12.8, rx: 5.2, rz: 4.6, z: -0.6 }, { y: 15.2, rx: 4.6, rz: 4.2, z: -0.8 }], N,
        (sg, k, ang) => (MANTO || angAbs(ang) >= 26 ? (MANTO || sg === 1 ? MAT.casaco2 : MAT.casaco) : null));
      [['E', 1], ['D', -1]].forEach(([l]) => {
        const g = l === 'E' ? 10 : 11, B = c.braco;
        if (CS === 'sobretudo_mangas') {   // sobretudo rasgado: mangas curtas (do tamanho das de camiseta), rasgadas na ponta
          tubo(novaPeca(m, 'braco' + l, g, { aberta: true }), [{ y: 2.8, rx: B * 1.0 + 0.3 }, { y: 0.4, rx: B * 1.3 + 0.4 }, { y: -6.2, rx: B * 1.3 + 0.45 }], 6, MAT.casaco);
          rasgado(novaPeca(m, 'braco' + l, g, { aberta: true }), -6.2, B * 1.3 + 0.45, 3.6, MAT.casaco);
          return;
        }
        tubo(novaPeca(m, 'braco' + l, g), [{ y: 2.8, rx: B * 1.0 + 0.3 }, { y: 0.4, rx: B * 1.3 + 0.4 }, { y: -6, rx: B * 1.3 + 0.35 }, { y: -13, rx: B * 0.98 + 0.5 }, { y: -14.8, rx: B * 0.8 + 0.5 }], 6,
          MAT.casaco, { tampaIni: true, tampaFim: true });
        if (MANTO) {   // manga larga
          tubo(novaPeca(m, 'antebraco' + l, g, { aberta: true }), [{ y: 1.4, rx: 2.9 }, { y: -6, rx: 3.5 }, { y: -10.6, rx: 4.4 }, { y: -11.6, rx: 4.6 }], 7, (sg) => (sg === 2 ? MAT.casaco2 : MAT.casaco));
        } else {
          tubo(novaPeca(m, 'antebraco' + l, g), [{ y: 1.8, rx: 2.8 }, { y: -2, rx: 2.95 }, { y: -9.4, rx: 2.4 }, { y: -10.6, rx: 2.6 }, { y: -11.6, rx: 2.5 }], 6,
            (sg) => (sg >= 2 ? MAT.casaco2 : MAT.casaco), { tampaIni: true, matIni: MAT.casaco, tampaFim: true, matFim: MAT.casaco2 });
        }
      });
      // a aba do casaco (as peças dele mesmo não se empurram: o contorno do quadril do casaco entra só depois)
      const k0 = Math.max(1.14, kq + 0.04);
      if (CS === 'sobretudo') saia(30, 2, 5, MAT.casaco, MAT.casaco2, k0, { frente: 20, n: N });
      if (CS === 'sobretudo_mangas') saia(28, 2, 5.4, MAT.casaco, MAT.casaco2, k0, { frente: 20, n: N, pontas: 7, irregular: true, matPontas: MAT.casaco });   // barra rasgada
      if (MANTO) {
        saia(40, 2.4, 9, MAT.casaco, MAT.casaco2, k0);
        const base = [{ y: 6.6, rx: c.cintura + 1.0, rz: 5.5 }, { y: 3.4, rx: (c.quadril + c.cintura) / 2 + 1.0, rz: 6.2 }], faixa = escalado(base, kPorFora(base, k0)).reverse();
        tubo(novaPeca(m, 'raiz', 3), faixa, 8, MAT.casaco2, { tampaIni: true, tampaFim: true });   // faixa
        contorno(faixa);
      }
      contorno(quadril.concat(barriga.map((r) => ({ y: 6.2 + r.y * c.troncoK, rx: r.rx, rz: r.rz, z: r.z }))));
    }
    if (temCinto && CPOS === 'cima' && (JAQ || MANTO)) cinto();
  }

  /* ---------- Calçados ----------
     Como nos modelos do estilo Legends, os calçados são BLOCOS: o cano é uma caixa de cantos redondos bem mais larga que
     a canela (o pano da calça some dentro dele), o pé é uma caixa comprida e arredondada na ponta e a sola é grossa e
     escura. Medidas no espaço da canela (que depois cresce com a perna) e do pé (que cresce com c.pe). */
  const CALCADOS = {
    // topo: onde o cano começa (canela: 0 = joelho, -22 = tornozelo); w0, w1: meia largura do cano em cima e embaixo;
    // caixa: quão quadrado; pe: tamanho do pé; cadarco e gola: os detalhes na segunda cor; ... (botas e grevas: uma cor só)
    botas: { topo: -9.2, w0: 4.7, w1: 4.35, caixa: 4.2 },
    coturnos: { topo: 0.8, w0: 3.55, w1: 3.0, caixa: 3, cadarco: true, pe: 0.92 },   // cano alto e fino, amarrado até o joelho
    sapatos: { topo: -19.6, w0: 2.85, w1: 2.95, caixa: 3, pe: 0.98, gola: true },   // (com o pé do tamanho do da sandália: proporcoes)
    grevas: { topo: 1.2, w0: 4.5, w1: 4.4, caixa: 6, metal: true, joelheira: true, biqueira: true, tornozelo: true },
    sandalias: { sandalia: true },
  };
  function construirCalcado(m, c, ap, l, g, X, meiaNoPe) {
    const CA = ap.calcados, T = CALCADOS[CA], TIPO = c.tipo;
    const tfZ = (x, y, z) => [x, z, y];   // tubo deitado ao longo de z (o pé)
    if (CA === 'descalco' || !T) {   // descalço: o pé (ou o casco do minotauro), do tamanho normal
      const pe = novaPeca(m, 'pe' + l, g), mPe = meiaNoPe ? MAT.meias : MAT.pele;
      if (TIPO === 'minotauro') tubo(pe, [{ y: -2.6, rx: 2.3, rz: 2.0, z: -1.3 }, { y: 0.8, rx: 2.6, rz: 2.6, z: -1.0 }, { y: 3.6, rx: 2.4, rz: 2.0, z: -1.7 }], 6, MAT.corpo2,
        { tf: tfZ, tampaIni: [0, -2.8, -1.3], tampaFim: [0, 4.6, -2.6] });
      else tubo(pe, [{ y: -2.9, rx: 1.95, rz: 1.8, z: -1.4 }, { y: 0.6, rx: 2.2, rz: 2.1, z: -1.1 }, { y: 4.0, rx: 2.2, rz: 1.5, z: -2.0 }, { y: 6.4, rx: 1.75, rz: 1.0, z: -2.6 }],
        6, mPe, { tf: tfZ, tampaIni: [0, -3.1, -1.4], tampaFim: [0, 7.2, -2.8] });
      return;
    }
    const mC = T.metal ? MAT.calcadosMetal : MAT.calcados, m2 = T.metal ? MAT.calcados2Metal : MAT.calcados2;
    const can = (op) => novaPeca(m, 'canela' + l, g, op);
    if (T.sandalia) {   // sandália: o pé à mostra (ou de meia) numa sola grossa, duas tiras e a faixa enrolada no tornozelo
      const pe = novaPeca(m, 'pe' + l, g), mPe = meiaNoPe ? MAT.meias : MAT.pele;
      tubo(pe, [{ y: -2.9, rx: 1.95, rz: 1.75, z: -1.3 }, { y: 0.6, rx: 2.2, rz: 2.05, z: -1.05 }, { y: 4.0, rx: 2.25, rz: 1.45, z: -1.95 }, { y: 6.4, rx: 1.8, rz: 0.95, z: -2.5 }],
        6, mPe, { tf: tfZ, tampaIni: [0, -3.1, -1.3], tampaFim: [0, 7.3, -2.7] });
      tubo(novaPeca(m, 'pe' + l, g), [[-3.4, 2.2, 0.5], [0, 2.5, 0.55], [5.5, 2.55, 0.55], [7.6, 2.1, 0.5], [8.2, 1.5, 0.45]].map(([z, w, h]) => ({ y: z, rx: w, rz: h, z: -2.95 })), 12, mC,
        { tf: tfZ, caixa: 5, tampaIni: true, tampaFim: true });
      [[1.4, 2.32, 2.0, -1.0], [4.4, 2.4, 1.5, -1.9]].forEach(([z, w, h, yc]) => tubo(novaPeca(m, 'pe' + l, g), [{ y: z - 0.5, rx: w + 0.12, rz: h + 0.15, z: yc }, { y: z + 0.5, rx: w + 0.1, rz: h + 0.12, z: yc - 0.2 }], 8, mC,
        { tf: tfZ, tampaIni: true, tampaFim: true }));
      const r0 = noPerfil(CANELA, -18.5), r1 = noPerfil(CANELA, -22);
      tubo(can(), [{ y: -17.6, rx: r0.rx + 0.35 }, { y: -18.5, rx: r0.rx + 0.45 }, { y: -21.6, rx: r1.rx + 0.5 }, { y: -22.2, rx: r1.rx + 0.4 }], 8, m2, { tampaIni: true, tampaFim: true });
      return;
    }
    // cano: caixa de cantos redondos do topo até o tornozelo, a boca um pouco mais larga
    const y0 = T.topo, y1 = -22.6, D = 0.94;
    const anel = (y, w, extra) => ({ y, rx: w + (extra || 0), rz: (w + (extra || 0)) * D, z: -0.15 });
    const ys = [y0 + 0.4, y0, R.lerp(y0, y1, 0.35), R.lerp(y0, y1, 0.75), y1];
    const ws = [T.w0 + 0.25, T.w0, R.lerp(T.w0, T.w1, 0.35), R.lerp(T.w0, T.w1, 0.75), T.w1];
    tubo(can(), ys.map((y, i) => anel(y, ws[i])), 12, mC, { caixa: T.caixa, tampaIni: true, tampaFim: true });
    if (T.cadarco) cadarco(can(), [{ y: y0, rx: T.w0, rz: T.w0 * D - 0.15 }, { y: y1, rx: T.w1, rz: T.w1 * D - 0.15 }], y0 - 1.2, -20.4, 0.25, 1.0, m2);
    if (T.joelheira) {   // joelheira em bloco
      tubo(can(), [{ y: 2.6, rx: 2.4, rz: 1.0, z: 3.0 }, { y: 1.4, rx: 3.0, rz: 1.5, z: 3.4 }, { y: -2.6, rx: 3.0, rz: 1.5, z: 3.6 }, { y: -4.2, rx: 2.2, rz: 1.0, z: 3.4 }], 8, mC,
        { caixa: 4, tampaIni: true, tampaFim: true });
    }
    // o pé: caixa comprida, alta no peito do pé e arredondada na ponta; a sola grossa e escura por baixo
    const pe = novaPeca(m, 'pe' + l, g), k = T.pe || 1;
    const secs = [[-3.3, 2.35, 1.5, -1.25], [-1.2, 2.75, 2.25, -0.85], [2.4, 3.0, 1.75, -1.35], [5.4, 2.95, 1.38, -1.72], [7.5, 2.55, 1.02, -2.06]];
    tubo(pe, secs.map(([z, w, h, yc]) => ({ y: z * k, rx: w * k, rz: h, z: yc })), 12, mC, { tf: tfZ, caixa: 3.2, tampaIni: [0, -3.6 * k, -1.3], tampaFim: [0, 8.35 * k, -2.25] });
    if (T.biqueira) tubo(novaPeca(m, 'pe' + l, g), [[3.4, 3.14, 1.62, -1.5], [5.4, 3.1, 1.5, -1.72], [7.5, 2.7, 1.14, -2.06]].map(([z, w, h, yc]) => ({ y: z * k, rx: w * k, rz: h, z: yc })), 12, mC,
      { tf: tfZ, caixa: 3.2, tampaIni: true, tampaFim: [0, 8.55 * k, -2.25] });
    if (T.gola) tubo(novaPeca(m, 'pe' + l, g), [{ y: 1.2, rx: 2.55, rz: 2.35, z: -0.6 }, { y: 0.6, rx: 2.75, rz: 2.5, z: -0.7 }], 12, MAT.calcados2, { tampaIni: true, tampaFim: true });
    tubo(novaPeca(m, 'pe' + l, g), [[-3.55, 2.55, 0.48], [-1.0, 2.95, 0.5], [5.5, 3.15, 0.5], [8.0, 2.75, 0.46], [8.8, 2.0, 0.42]].map(([z, w, h]) => ({ y: z * k, rx: w * k, rz: h, z: -2.98 })), 12, MAT.sola,
      { tf: tfZ, caixa: 5, tampaIni: true, tampaFim: true });
    if (T.tornozelo) tubo(novaPeca(m, 'pe' + l, g), [{ y: 1.4, rx: 1.9, rz: 1.9, z: -0.4 }, { y: 0.2, rx: 2.3, rz: 2.3, z: -0.5 }], 8, mC, { tampaIni: true, tampaFim: true });   // junta do tornozelo
  }

  /* ---------- Luvas (no antebraço e na mão; a mão em si é feita em construirCorpo) ---------- */
  function construirLuvas(m, c, ap, l, s, g) {
    const LU = ap.luvas, B = c.braco;
    const ante = (op) => novaPeca(m, 'antebraco' + l, g, op);
    // punho grosso e alto (como os punhos das luvas do Megaman Legends)
    const punho = (y, mat) => tubo(ante(), [{ y: y + 0.9, rx: 2.15 }, { y: y + 0.3, rx: 2.55 }, { y: y - 1.9, rx: 2.5 }, { y: y - 2.4, rx: 2.05 }], 6, mat, { tampaIni: true, tampaFim: true });
    if (LU === 'curtas' || LU === 'sem_dedos') punho(-10.6, MAT.luvas2);
    if (LU === 'longas') {   // até o cotovelo, com a boca larga
      tubo(ante(), [{ y: -1.2, rx: 2.55 }, { y: -4.6, rx: 2.3 }, { y: -10.6, rx: 1.95 }, { y: -12.5, rx: 1.75 }], 6, MAT.luvas, { tampaIni: true, tampaFim: true });
      tubo(ante({ aberta: true }), [{ y: 1.0, rx: 3.1 }, { y: -0.6, rx: 2.95 }, { y: -2.4, rx: 2.5 }], 6, (sg) => (sg === 0 ? MAT.luvas2 : MAT.luvas));
    }
    if (LU === 'faixas') {   // fitas enroladas no antebraço e no braço, com as pontas soltas
      const voltas = (osso, y0, y1, r0, r1) => {
        const n = Math.round((y0 - y1) / 1.3);
        for (let i = 0; i < n; i++) {
          const y = R.lerp(y0, y1, i / n), r = R.lerp(r0, r1, i / n) + 0.3, sd = i % 2 ? 1 : -1;
          tubo(novaPeca(m, osso, g), [{ y: y + 0.55, rx: r }, { y: y - 0.55, rx: r }], 6, MAT.luvas, { tampaIni: true, tampaFim: true, tf: (x, yy, z) => [x, yy + sd * x * 0.16, z] });
        }
      };
      voltas('antebraco' + l, -2.4, -12.2, 2.3, 1.7);
      voltas('braco' + l, -3.2, -6.4, B * 0.98, B * 0.96);
      [['antebraco' + l, [0, -11.6, -1.9]], ['braco' + l, [0, -5, -B - 0.3]]].forEach(([osso, b]) => {
        [[1, 0], [-1, 1]].forEach(([sd, k]) => mecha(novaPeca(m, osso, 2), b, soma(b, [sd * 1.2, -2.6, -1.6]), soma(b, [sd * (1.6 + k), -8 + k * 2, -2.6]), 1.8, 0.5,
          { mat: k ? MAT.luvas2 : MAT.luvas, fora: [0, 0, -1], segs: 3, afina: 0.25 }));
      });
    }
    if (LU === 'manguitos') {   // mangas soltas: do meio do braço até o pulso, com a boca larga
      tubo(novaPeca(m, 'braco' + l, g), [{ y: -4.6, rx: B * 1.0 + 0.45 }, { y: -6, rx: B * 1.0 + 0.5 }, { y: -13, rx: B * 0.82 + 0.5 }, { y: -14.8, rx: B * 0.7 + 0.4 }], 6,
        (sg) => (sg === 0 ? MAT.luvas2 : MAT.luvas), { tampaIni: true, matIni: MAT.luvas2, tampaFim: true });
      tubo(ante({ aberta: true }), [{ y: 1.6, rx: 2.6 }, { y: -2, rx: 2.75 }, { y: -9.6, rx: 3.0 }, { y: -12.2, rx: 3.6 }, { y: -12.9, rx: 3.7 }], 7,
        (sg) => (sg === 3 ? MAT.luvas2 : MAT.luvas));
    }
  }

  /* ---------- Meias (por cima da pele, por baixo das calças e dos calçados) ---------- */
  function construirMeias(m, c, ap, l, g) {
    const ME = ap.meias, PE = ap.pernas, X = c.coxa;
    if (ME === 'nenhuma' || PE === 'calca' || PE === 'larga' || PE === 'armadura') return;
    const L = COXA(X), coxa = PE === 'nenhuma';   // de bermuda (ou barra recortada) a coxa fica coberta
    const baixoCanela = PE === 'rasgada' ? -5 : 2;
    if (ME === 'longas' || ME === 'listradas') {
      const listra = ME === 'listradas';
      // anéis a cada ~2 unidades, para as listras
      const aneis = (L2, y0, y1, folga) => { const n = Math.max(1, Math.round((y0 - y1) / 2.1)); return Array.from({ length: n + 1 }, (_, i) => { const y = R.lerp(y0, y1, i / n), r = noPerfil(L2, y); return { y, rx: r.rx + folga, rz: (r.rz != null ? r.rz : r.rx) + folga, z: r.z }; }); };
      const mat = (sg) => (listra ? (sg % 2 ? MAT.meias2 : MAT.meias) : MAT.meias);
      if (coxa) {
        tubo(novaPeca(m, 'coxa' + l, g), aneis(L, -5.4, -21.6, 0.2), 8, mat, { tampaIni: true, matIni: MAT.meias, tampaFim: true, matFim: MAT.meias });
        if (!listra) tubo(novaPeca(m, 'coxa' + l, g), cano(L, -4.6, -6.6, 0.32), 8, MAT.meias2, { tampaIni: true, tampaFim: true });   // renda
      }
      tubo(novaPeca(m, 'canela' + l, g), aneis(CANELA, Math.min(1.6, baixoCanela), -22, 0.18), 8, mat, { tampaIni: true, matIni: MAT.meias, tampaFim: true, matFim: MAT.meias });
    }
    if (ME === 'curtas') {
      tubo(novaPeca(m, 'canela' + l, g), cano(CANELA, -13, -22, 0.18), 8, (sg) => (sg === 0 ? MAT.meias2 : MAT.meias), { tampaIni: true, matIni: MAT.meias, tampaFim: true, matFim: MAT.meias });
    }
    if (ME === 'faixas') {   // fitas cruzadas na canela, com um laço em cima
      for (let i = 0; i < 6; i++) {
        const y = -7.5 - i * 2.2, r = noPerfil(CANELA, y), sd = i % 2 ? 1 : -1;
        tubo(novaPeca(m, 'canela' + l, g), [{ y: y + 0.5, rx: r.rx + 0.3, z: r.z }, { y: y - 0.5, rx: r.rx + 0.3, z: r.z }], 7, MAT.meias,
          { tampaIni: true, tampaFim: true, tf: (x, yy, z) => [x, yy + sd * z * 0.32, z] });
      }
      const b = [0, -6.2, -3.4];
      [[1, 0], [-1, 1]].forEach(([sd, k]) => mecha(novaPeca(m, 'canela' + l, 2), b, soma(b, [sd * 1.4, -2.4, -1.2]), soma(b, [sd * (1.8 + k * 0.6), -7.5 + k * 2, -2.2]), 1.9, 0.5,
        { mat: MAT.meias2, fora: [0, 0, -1], segs: 3, afina: 0.25 }));
    }
  }

  /* ---------- Capa (pende das costas: osso "capa") ---------- */
  function construirCapa(m, c, ap) {
    const t = ap.capa;
    if (t === 'nenhuma') return;
    // mais larga se houver ombreiras ou casaco por baixo
    const folga = (ap.ombros !== 'nenhuma' ? 2.2 : 0) + (ap.casaco !== 'nenhum' ? 0.8 : 0);
    const O = c.ombro + folga;
    if (t === 'manto') {   // manto curto nos ombros + broche
      tubo(novaPeca(m, 'peito', 3, { aberta: true }), [{ y: 8.4, rx: O + 1.6, rz: 6.6 + folga * 0.3 }, { y: 11.2, rx: O + 0.6, rz: 5.4 + folga * 0.3, z: -0.3 }, { y: 13.6, rx: 4.8, rz: 4.2, z: -0.5 }, { y: 14.8, rx: 3.6, rz: 3.4, z: -0.4 }], 10,
        MAT.capa, { tampaFim: true });
      esfera(novaPeca(m, 'peito', 3), [0, 13.2, 4.6], [1.3, 1.3, 0.8], MAT.capa2, 5, 3);
    } else {   // presa nos ombros por dois fechos
      [1, -1].forEach((sd) => esfera(novaPeca(m, 'peito', 3), [sd * 4.4, 11.6, 3.4 + c.busto * 0.2], [1.1, 1.1, 0.7], MAT.capa2, 5, 3));
      tubo(novaPeca(m, 'peito', 3, { aberta: true }), [{ y: 10.6, rx: O + 0.8, rz: 5.4 }, { y: 12.6, rx: 5.6, rz: 4.6, z: -0.5 }, { y: 14.0, rx: 4.2, rz: 3.8, z: -0.6 }], 10,
        (sg, k, ang) => (angAbs(ang) >= 50 ? MAT.capa : null));
    }
    const comp = { manto: 44, longa: 52, curta: 24, rasgada: 46 }[t];
    const larg = t === 'longa' ? 1.5 : 1;
    const n = 14, inclui = (ang) => angAbs(ang) >= (t === 'manto' ? 70 : 58);
    const p = novaPeca(m, 'capa', 4, { aberta: true, chao: false });
    const anel = tubo(p, [
      { y: 0.6, rx: O + 0.4, rz: 5.0, z: 4.7 }, { y: -comp * 0.27, rx: O + 2.4 * larg, rz: 7.0, z: 4.2 }, { y: -comp * 0.68, rx: O + 4.6 * larg, rz: 9.4, z: 3.4 }, { y: -comp, rx: O + 6.2 * larg, rz: 10.6, z: 2.6 },
    ], n, (sg, k, ang) => (inclui(ang) ? MAT.capa : null));
    if (t === 'rasgada') pontas(p, anel[3], n, inclui, 9, MAT.capa, true);
  }

  /* ---------- Capuz ---------- */
  function construirCapuz(m, c, ap) {
    const t = ap.capuz;
    if (t === 'abaixado') {   // dobrado nas costas: gola em volta do pescoço e o capuz caído (a boca para cima mostra o forro)
      const kt = ap.casaco !== 'nenhum' ? 1.12 : 1;
      tubo(novaPeca(m, 'peito', 3, { aberta: true }), [{ y: 10.6, rx: c.ombro * kt + 0.9, rz: 5.4 * kt, z: -0.6 }, { y: 13.4, rx: 6.0, rz: 5.0, z: -1.1 }, { y: 15.2, rx: 5.0, rz: 4.4, z: -1.3 }], 10,
        (sg, k, ang) => (angAbs(ang) >= 34 ? MAT.capuz : null));
      const mago = ap.capuzForma === 'mago';   // de mago: maior, com a ponta comprida caindo nas costas
      tubo(novaPeca(m, 'peito', 3, { aberta: true }), [{ y: 14.2, rx: mago ? 6.4 : 5.4, rz: mago ? 3.0 : 2.4, z: -6.0 * kt }, { y: 11.6, rx: mago ? 6.6 : 5.6, rz: mago ? 3.4 : 2.8, z: -7.2 * kt },
        { y: 8.4, rx: mago ? 5.0 : 4.0, rz: mago ? 2.8 : 2.2, z: -7.2 * kt }].concat(mago ? [{ y: 3.0, rx: 2.6, rz: 1.8, z: -7.0 * kt }] : []), 8,
        MAT.capuz, { tampaFim: mago ? [0, -4.6, -6.6 * kt] : [0, 5.8, -6.2 * kt] });
    } else if (t === 'levantado') {   // na cabeça: casca em volta do cabelo, aberta no rosto, descendo pelos ombros
      const k = 1.36;
      const L = CABECA.slice(0, 5).map((r) => ({ y: CENTRO_CABECA[1] + (r.y - CENTRO_CABECA[1]) * k, rx: r.rx * k, rz: r.rz * k, z: r.z - 0.9 }));
      L.push({ y: -1.6, rx: 9.6, rz: 9.0, z: -1.2 }, { y: -4.4, rx: 11.2, rz: 9.6, z: -1.6 });
      const rosto = [0, 52, 62, 66, 62, 52, 40];   // abertura no rosto, por volta
      const mago = ap.capuzForma === 'mago';   // de mago: a ponta vai longe para trás e cai
      tubo(novaPeca(m, 'cabeca', 9, { aberta: true }), L, 12, (s, kk, ang) => (angAbs(ang) < rosto[s] ? null : MAT.capuz),
        { a0: Math.PI / 12, tampaIni: mago ? [0, CENTRO_CABECA[1] + 10.6 * k, -15.5] : [0, CENTRO_CABECA[1] + 10.4 * k, -4.2], matIni: MAT.capuz });
      // de mago: a ponta comprida sai para trás e cai pelas costas, grossa no começo
      if (mago) tuboLivre(novaPeca(m, 'cabeca', 9), [[0, CENTRO_CABECA[1] + 11.6 * k, -10.5], [0, CENTRO_CABECA[1] + 10 * k, -16.5], [0, 16, -20], [0, 8, -20.5], [0, 1, -19]],
        [[4.0, 3.2], [3.0, 2.4], [2.1, 1.6], [1.3, 1.0], 0], 6, MAT.capuz, { cima: [1, 0, 0] });
    }
  }

  /* ---------- Ombreiras ---------- */
  function construirOmbros(m, c, ap) {
    const t = ap.ombros;
    if (t === 'nenhuma') return;
    const B = c.braco;
    const gorjal = () => tubo(novaPeca(m, 'peito', 3), [{ y: 10.2, rx: 6.0, rz: 4.9, z: -0.2 }, { y: 12.4, rx: 5.4, rz: 4.5, z: -0.3 }, { y: 13.8, rx: 3.5, rz: 3.3 }], 8, MAT.ombrosMetal, { tampaIni: true, tampaFim: true });
    if (t === 'placas' || t === 'espinhos') {
      [['E', 1], ['D', -1]].forEach(([l]) => {
        const g = l === 'E' ? 10 : 11;
        tubo(novaPeca(m, 'braco' + l, g, { aberta: true }), [{ y: 3.4, rx: 0.6 }, { y: 2.2, rx: B * 1.45 }, { y: -1.2, rx: B * 1.75 }, { y: -3.4, rx: B * 1.8 }], 6,
          (sg) => (sg === 2 ? MAT.ombros2Metal : MAT.ombrosMetal), { tampaIni: [0, 3.8, 0], matIni: MAT.ombrosMetal });
        if (t === 'espinhos') [[0, 1.0], [-35, 0.8], [35, 0.8]].forEach(([a, k]) => {
          const ar = a * RAD, b = [Math.sin(ar) * B * 0.9, 2.6, Math.cos(ar) * B * 0.9 - 0.4];
          tuboLivre(novaPeca(m, 'braco' + l, g), [b, soma(b, [0, 3.2 * k, -0.6]), soma(b, [0, 5.2 * k, -1.2])], [0.95 * k, 0.5 * k, 0], 4, MAT.ombros2Metal, { tampa: true, cima: [0, 0, 1] });
        });
      });
      gorjal();
    }
    if (t === 'redondas') {   // cúpulas com uma lâmina embaixo
      [['E', 1], ['D', -1]].forEach(([l]) => {
        const g = l === 'E' ? 10 : 11;
        tubo(novaPeca(m, 'braco' + l, g, { aberta: true }), [{ y: 3.4, rx: B * 1.25 }, { y: 1.6, rx: B * 1.75 }, { y: -0.8, rx: B * 1.95 }, { y: -2.6, rx: B * 1.9 }], 8,
          (sg) => (sg === 2 ? MAT.ombros2Metal : MAT.ombrosMetal), { tampaIni: [0, 4.4, 0], matIni: MAT.ombrosMetal });
        tubo(novaPeca(m, 'braco' + l, g, { aberta: true }), [{ y: -1.8, rx: B * 1.7 }, { y: -4.2, rx: B * 1.66 }, { y: -4.8, rx: B * 1.56 }], 8, (sg) => (sg === 1 ? MAT.ombros2Metal : MAT.ombrosMetal));
      });
      gorjal();
    }
    if (t === 'couro') {   // uma ombreira de couro no ombro esquerdo, presa por uma correia que cruza o peito
      tubo(novaPeca(m, 'bracoE', 10, { aberta: true }), [{ y: 3.4, rx: 0.8 }, { y: 2.0, rx: B * 1.5 }, { y: -1.6, rx: B * 1.7 }, { y: -2.6, rx: B * 1.68 }], 6,
        (sg) => (sg === 2 ? MAT.ombros2 : MAT.ombros), { tampaIni: [0, 3.8, 0], matIni: MAT.ombros });
      const incl = (x, y, z) => [x, y + x * 0.62, z];
      tubo(novaPeca(m, 'peito', 3), inflar([{ y: 7.0, rx: c.peito + 0.3, rz: 5.8 + c.busto * 0.5, z: 0.3 + c.busto * 0.4 }, { y: 5.6, rx: c.peito + 0.3, rz: 5.9 + c.busto * 0.6, z: 0.3 + c.busto * 0.5 }], 1.06, 0.25), 8,
        MAT.ombros2, { tampaIni: true, tampaFim: true, tf: incl });
    }
    if (t === 'pelo') {   // gola de pelo em volta dos ombros
      const kt = ap.casaco !== 'nenhum' ? 1.1 : 1;
      tubo(novaPeca(m, 'peito', 3), [{ y: 8.6, rx: c.ombro * kt + 0.6, rz: 5.4 * kt, z: -0.4 }, { y: 10.4, rx: c.ombro * kt + 2.2, rz: 6.6 * kt, z: -0.4 }, { y: 12.8, rx: c.ombro * kt + 0.6, rz: 6.2 * kt, z: -0.8 },
        { y: 14.6, rx: 5.4, rz: 4.8, z: -1.0 }, { y: 15.2, rx: 4.2, rz: 3.8, z: -0.9 }], 11, MAT.ombros, { a0: 0.2, tampaIni: true, tampaFim: true });
      esfera(novaPeca(m, 'peito', 3), [0, 11.6, 6.4 * kt + c.busto * 0.3], [1.1, 1.1, 0.8], MAT.ombros2Metal, 5, 3);   // fecho
    }
  }

  /* ---------- Colar (no peito, em volta da base do pescoço) ---------- */
  function construirColar(m, c, ap) {
    const t = ap.colar;
    if (t === 'nenhum') return;
    if (t === 'gargantilha') {
      tubo(novaPeca(m, 'pescoco', 3), [{ y: 2.6, rx: 2.45, rz: 2.65, z: 0.1 }, { y: 1.4, rx: 2.5, rz: 2.7, z: 0.05 }], 8, MAT.colar, { tampaIni: true, tampaFim: true });
      esfera(novaPeca(m, 'pescoco', 3), [0, 1.6, 2.85], [0.7, 0.8, 0.4], MAT.colar2Metal, 5, 3);
      return;
    }
    // a volta do colar: atrás do pescoço até a frente do peito (a altura do fundo depende do colar)
    const fundo = { pingente: 8.0, cruz: 7.4, perolas: 9.0, presas: 9.2 }[t];
    const volta = (yF, n, mais) => Array.from({ length: n + 1 }, (_, i) => {
      const a = -Math.PI + (i / n) * TAU, f = (1 + Math.cos(a)) / 2;   // f = 1 na frente
      const y = R.lerp(13.3, yF, Math.pow(f, 1.6)), x = Math.sin(a) * R.lerp(3.4, 2.6, f);
      const z = f > 0.45 ? Math.max(frenteZ(c, y, x) + 0.35 + (mais || 0), R.lerp(-2.6, 2.6, f)) : R.lerp(-2.7, 2.7, f);
      return [x, y, z];
    });
    const p = novaPeca(m, 'peito', 3);
    if (t === 'perolas') {   // duas voltas de pérolas
      [[fundo, 0], [fundo - 2.6, 0.2]].forEach(([yF, mais]) => volta(yF, 18, mais).slice(0, 18).forEach((q) => esfera(p, q, 0.55, MAT.colar2, 4, 3)));
      return;
    }
    const pts = volta(fundo + 0.6, 16);
    tuboLivre(p, pts, pts.map(() => 0.26), 3, MAT.colar, { cima: [0, 0, 1] });
    const z = frenteZ(c, fundo, 0) + 0.5;
    if (t === 'pingente') {   // pedra em losango
      tuboLivre(p, [[0, fundo + 0.4, z], [0, fundo - 0.6, z + 0.3], [0, fundo - 2.2, z]], [0, [1.0, 0.5], 0], 4, MAT.colar2Metal, { cima: [0, 0, 1] });
    }
    if (t === 'cruz') {
      tuboLivre(p, [[0, fundo + 0.4, z], [0, fundo - 3.4, z + 0.2]], [[0.42, 0.28], [0.42, 0.28]], 4, MAT.colar2Metal, { cima: [0, 0, 1], tampa: true });
      tuboLivre(p, [[-1.3, fundo - 0.9, z + 0.1], [1.3, fundo - 0.9, z + 0.1]], [[0.42, 0.28], [0.42, 0.28]], 4, MAT.colar2Metal, { cima: [0, 0, 1], tampa: true });
    }
    if (t === 'presas') {   // dentes pendurados no cordão
      [-2.2, -1.1, 0, 1.1, 2.2].forEach((x, i) => {
        const y = fundo + 0.5 + Math.abs(x) * 0.35, zz = frenteZ(c, y, x) + 0.55, l = i === 2 ? 2.6 : 1.9;
        tuboLivre(p, [[x, y, zz], [x * 1.05, y - l * 0.5, zz + 0.2], [x * 1.1, y - l, zz + 0.1]], [0.5, 0.36, 0], 4, MAT.colar2, { cima: [0, 0, 1] });
      });
    }
  }

  /* ---------- Joias: brincos, pulseiras e tornozeleiras (dá para usar várias: ver R.joiasDe) ---------- */
  function construirJoias(m, c, ap) {
    const J = new Set(R.joiasDe(ap.joias));
    if (J.has('brincos')) {
      [1, -1].forEach((sd) => {
        const b = [sd * 8.6, 6.6, -0.5], pts = [];
        for (let i = 0; i <= 8; i++) { const a = (i / 8) * TAU; pts.push([b[0] + sd * Math.sin(a) * 0.25, b[1] - 0.9 + Math.cos(a) * 0.95, b[2] + Math.sin(a) * 0.95]); }
        tuboLivre(novaPeca(m, 'cabeca', 5), pts, pts.map(() => 0.24), 3, MAT.joiasMetal, { cima: [1, 0, 0] });
        esfera(novaPeca(m, 'cabeca', 5), [b[0], b[1] - 2.0, b[2]], 0.5, MAT.joias2, 4, 3);
      });
    }
    if (J.has('pulseiras')) {
      ['E', 'D'].forEach((l) => {
        const g = l === 'E' ? 10 : 11, p = novaPeca(m, 'antebraco' + l, g);
        const cobre = COBRE_ANTEBRACO[ap.luvas] ? 0.5 : 0;
        tubo(p, [{ y: -9.0, rx: 2.15 + cobre }, { y: -9.8, rx: 2.15 + cobre }], 7, MAT.joiasMetal, { tampaIni: true, tampaFim: true });
        contas(p, [0, -10.6, 0], 2.05 + cobre, 2.05 + cobre, 9, 0.42, MAT.joias2);
      });
    }
    if (J.has('tornozeleiras')) {
      ['E', 'D'].forEach((l) => {
        const g = l === 'E' ? 12 : 13, p = novaPeca(m, 'canela' + l, g);
        // por cima do cano da bota, se ela cobrir o tornozelo (o cano é uma caixa: as contas vão por fora dos cantos)
        const T = CALCADOS[ap.calcados], r = T && T.topo > -19 ? R.lerp(T.w0, T.w1, R.clamp((T.topo + 19.6) / (T.topo + 22.6), 0, 1)) * 1.12 + 0.3 : 2.25;
        contas(p, [0, -19.6, -0.15], r, r * 0.94, 12, 0.45, MAT.joias2);
        tubo(p, [{ y: -20.6, rx: r - 0.1, rz: r * 0.94 - 0.1, z: -0.15 }, { y: -21.3, rx: r - 0.13, rz: r * 0.94 - 0.13, z: -0.15 }], 7, MAT.joiasMetal, { tampaIni: true, tampaFim: true });
      });
    }
  }

  /* ---------- Nas costas: aljava, espada, escudo (presos ao peito, com a correia cruzando o peito) ---------- */
  function construirCostas(m, c, ap) {
    const t = ap.costas;
    if (t === 'nenhuma') return;
    const zc = -(5.6 + (ap.casaco !== 'nenhum' ? 0.8 : 0) + (ap.capuz === 'abaixado' ? 1.4 : 0));
    const correia = (inc) => tubo(novaPeca(m, 'peito', 3), inflar([{ y: 7.6, rx: c.peito + 0.6, rz: 5.6 + c.busto * 0.5, z: 0.25 + c.busto * 0.4 }, { y: 6.2, rx: c.peito + 0.5, rz: 5.8 + c.busto * 0.6, z: 0.25 + c.busto * 0.5 }],
      ap.casaco !== 'nenhum' ? 1.12 : 1.05, 0.25), 8, MAT.costas, { tampaIni: true, tampaFim: true, tf: (x, y, z) => [x, y + x * inc, z] });
    const p = novaPeca(m, 'peito', 34);
    if (t === 'aljava') {   // na diagonal, com as flechas para cima do ombro direito
      const a = [3.6, -4, zc - 2.2], b = [-3.6, 13.2, zc - 2.6];
      tuboLivre(p, [a, mistura(a, b, 0.5), b], [2.0, 2.2, 2.3], 7, MAT.costas, { tampa: true, cima: [0, 0, 1] });
      tuboLivre(novaPeca(m, 'peito', 34), [mistura(a, b, 0.86), mistura(a, b, 1.0)], [2.45, 2.5], 7, MAT.costas2, { cima: [0, 0, 1] });
      const dir = norm(sub(b, a));
      [[0, 0], [0.9, 0.5], [-0.9, 0.4], [0.2, -0.8]].forEach(([dx, dz], i) => {
        const base = soma(b, [dx, -1, dz]), ponta = soma(base, esc(dir, 5.4 + (i % 2) * 0.8));
        tuboLivre(novaPeca(m, 'peito', 35), [base, ponta], [0.22, 0.22], 3, MAT.madeira, { cima: [0, 0, 1] });
        const q = novaPeca(m, 'peito', 35, { aberta: true }), f0 = soma(ponta, esc(dir, -2.2));
        [[1, 0], [0, 1]].forEach(([u, w]) => tri(q, vertA(q, soma(f0, [u * 0.9, 0, w * 0.9])), vertA(q, soma(f0, [-u * 0.9, 0, -w * 0.9])), vertA(q, ponta), MAT.costas2));
      });
      correia(-0.55);
    }
    if (t === 'espada') {   // bainha na diagonal, cabo acima do ombro direito
      const a = [5.6, -6, zc - 1.4], b = [-4.2, 13.6, zc - 1.6], dir = norm(sub(b, a));
      tuboLivre(p, [a, b], [[1.5, 0.7], [1.5, 0.7]], 4, MAT.costas, { tampa: true, cima: [0, 0, 1], a0: Math.PI / 4 });
      tuboLivre(novaPeca(m, 'peito', 34), [soma(a, esc(dir, -0.4)), soma(a, esc(dir, 1.6))], [[1.7, 0.85], [1.7, 0.85]], 4, MAT.costas2Metal, { tampa: true, cima: [0, 0, 1], a0: Math.PI / 4 });
      const guarda = soma(b, esc(dir, 0.5)), lado = norm(cruz(dir, [0, 0, 1]));
      tuboLivre(novaPeca(m, 'peito', 35), [soma(guarda, esc(lado, 2.8)), soma(guarda, esc(lado, -2.8))], [0.5, 0.5], 4, MAT.costas2Metal, { tampa: true, cima: [0, 0, 1] });
      tuboLivre(novaPeca(m, 'peito', 35), [guarda, soma(guarda, esc(dir, 4.4))], [0.5, 0.45], 5, MAT.escuro, { cima: [0, 0, 1] });
      esfera(novaPeca(m, 'peito', 35), soma(guarda, esc(dir, 5.0)), 0.8, MAT.costas2Metal, 5, 3);
      correia(0.55);
    }
    if (t === 'escudo') {   // escudo redondo de frente para trás
      const tfZ = (x, y, z) => [x, z, zc - 1.0 - y];
      tubo(p, [{ y: -0.4, rx: 7.0, rz: 7.0, z: 5 }, { y: 0.6, rx: 6.9, rz: 6.9, z: 5 }, { y: 1.3, rx: 6.0, rz: 6.0, z: 5 }], 10, (sg) => (sg === 0 ? MAT.costas2Metal : MAT.costas),
        { tf: tfZ, tampaIni: true, matIni: MAT.costas, tampaFim: [0, 1.6, 5], matFim: MAT.costas });
      esfera(novaPeca(m, 'peito', 35), [0, 5, zc - 2.7], [1.6, 1.6, 0.9], MAT.costas2Metal, 6, 3);   // umbo
      correia(-0.55);
    }
  }

  /* ---------- Cabeça e rosto ---------- */
  const PROXY_CABECA = { c: [0, 10.2, -0.4], r: [9.2, 10.4, 9.4], k: 0.7 };
  function construirCabeca(m, ap) {
    const h = novaPeca(m, 'cabeca', 5, { proxy: PROXY_CABECA });
    const L = CABECA_FORMA;
    tubo(h, L, 16, (s, k, ang) => {
      const a = Math.abs(((ang / RAD) + 180) % 360 - 180), y = (L[s].y + L[s + 1].y) / 2;
      if (y < 17.4 && a <= 78) return [MAT.rosto, 1];
      return MAT.pele;
    }, { a0: Math.PI / 16, duro: true, tampaIni: TOPO_CABECA, matIni: MAT.pele, tampaFim: QUEIXO, matFim: MAT.rosto });
    // cabeças de raça: o rosto é pintado (pixelRosto) e aqui vão o focinho, os chifres, o nariz…
    const T = ap.corpo;
    if (T === 'minotauro') cabecaTouro(m);
    if (T === 'trog') cabecaLagarto(m);
    if (T === 'goblin') tuboLivre(novaPeca(m, 'cabeca', 5), [[0, 7.4, 8.0], [0, 6.0, 10.4], [0, 4.6, 12.8]], [[1.35, 1.1], [0.95, 0.8], 0], 5, MAT.pele, { tampa: true, cima: [0, 0, 1] });   // narigão
    // orelhas (caveira, golem e as cabeças de bicho não têm as orelhas comuns)
    if (T === 'osteon' || T === 'golem' || T === 'trog' || T === 'minotauro') { construirMascara(m, ap); return; }
    const bicho = ORELHAS_BICHO[ap.orelhas];
    if (bicho) [1, -1].forEach((sd) => orelhaBicho(m, sd, bicho));
    else if (ap.orelhas === 'barbatana') [1, -1].forEach((sd) => barbatana(m, sd, (ap.orelhasPos === 'baixo' ? 1 : 1.08) * K_ORELHA));
    else [1, -1].forEach((s) => {
      // base (frente-cima, trás-cima, trás-baixo, frente-baixo), meio e ponta de cada formato
      const F = ORELHAS_PELE[ap.orelhas] || ORELHAS_PELE.humanas, fx = (ap.orelhasPos === 'baixo' ? 1 : 1.1) * K_ORELHA;   // por cima do cabelo: sai mais para fora
      const o = novaPeca(m, 'cabeca', 5);
      const ib = F.base.map((b) => vertA(o, [s * b[0] * fx, b[1], b[2]]));
      const ip = vertA(o, [s * F.ponta[0] * fx, F.ponta[1], F.ponta[2]]);
      const ref = [0, 10, -0.5], dentro = F.dentro ? MAT.orelhaDentro : MAT.pele;
      if (F.meio) {
        const im = vertA(o, [s * F.meio[0] * fx, F.meio[1], F.meio[2]]);
        tri(o, ib[0], ib[1], ip, MAT.pele, 0, ref); tri(o, ib[1], ib[2], ip, MAT.pele, 0, ref);
        tri(o, ib[2], im, ip, dentro, 0, ref); tri(o, ib[0], ip, im, dentro, 0, ref);
        tri(o, ib[2], ib[3], im, dentro, 0, ref); tri(o, ib[3], ib[0], im, dentro, 0, ref);
      } else for (let k = 0; k < 4; k++) tri(o, ib[k], ib[(k + 1) % 4], ip, MAT.pele, 0, ref);
    });
    construirMascara(m, ap);
  }
  const BASE_ORELHA = [[7.6, 11.6, 0.4], [7.9, 11.0, -1.9], [7.6, 7.6, -1.2], [7.4, 7.8, 0.6]];
  const ORELHAS_PELE = {
    humanas: { base: BASE_ORELHA, ponta: [9.0, 10.0, -1.0] },
    pontudas: { base: BASE_ORELHA, meio: [9.0, 10.4, -0.9], ponta: [12.8, 14.2, -3.6] },
    kliren: { base: [[7.6, 12.4, 0.6], [7.9, 11.6, -2.2], [7.6, 6.8, -1.4], [7.4, 7.0, 0.8]], meio: [10.8, 11.2, -0.8], ponta: [17.6, 13.2, -4.4], dentro: true },
    goblin: { base: [[7.6, 13.6, 0.8], [7.9, 12.8, -2.6], [7.6, 5.8, -1.8], [7.4, 6.0, 1.0]], meio: [12.0, 11.0, -0.6], ponta: [19.0, 9.6, -4.2], dentro: true },
  };
  /* minotauro: focinho claro com as narinas, chifres (na cor dos detalhes do corpo) e orelhas de boi para os lados */
  function cabecaTouro(m) {
    const tfZ = (x, y, z) => [x, z, y];
    tubo(novaPeca(m, 'cabeca', 5), [{ y: 5.2, rx: 5.4, rz: 3.8, z: 4.8 }, { y: 9.8, rx: 4.9, rz: 3.5, z: 4.3 }, { y: 12.4, rx: 4.3, rz: 3.0, z: 4.1 }], 8, MAT.focinho,
      { tf: tfZ, tampaFim: [0, 13.1, 4.1] });
    [1, -1].forEach((sd) => {
      esfera(novaPeca(m, 'cabeca', 5), [sd * 1.5, 4.6, 12.7], [0.7, 0.55, 0.4], MAT.escuro, 5, 3);   // narina
      tuboLivre(novaPeca(m, 'cabeca', 21), [[sd * 6.6, 16.6, 0.6], [sd * 11, 18.2, 1.2], [sd * 14.4, 21.8, 2.6], [sd * 14.2, 25.6, 2.2]], [2.0, 1.5, 0.9, 0], 6, MAT.corpo2, { tampa: true });
      tuboLivre(novaPeca(m, 'cabeca', 5), [[sd * 8.4, 12.6, -1.0], [sd * 12.2, 11.8, -1.4], [sd * 14.6, 10.6, -1.8]], [[1.6, 0.6], [1.8, 0.6], 0], 4, MAT.pele, { cima: [0, 0, 1] });
    });
  }
  /* trog: focinho comprido de lagarto (a mandíbula na cor da barriga) e a crista de espinhos */
  function cabecaLagarto(m) {
    const tfZ = (x, y, z) => [x, z, y];
    tubo(novaPeca(m, 'cabeca', 5), [{ y: 4.8, rx: 5.6, rz: 4.2, z: 5.6 }, { y: 10.4, rx: 4.4, rz: 3.2, z: 4.8 }, { y: 15.6, rx: 2.8, rz: 2.1, z: 4.0 }], 8,
      (sg, k, ang) => (angAbs(ang) > 112 ? MAT.corpo2 : MAT.pele), { tf: tfZ, tampaFim: [0, 16.8, 3.8], matFim: MAT.pele });
    [1, -1].forEach((sd) => esfera(novaPeca(m, 'cabeca', 5), [sd * 1.2, 5.9, 16.2], [0.4, 0.3, 0.3], MAT.escuro, 4, 3));   // narinas
    [[0, 19.6, 3.4, 3.4], [0, 20.4, -1.2, 4.0], [0, 19.4, -5.6, 3.6], [0, 16.4, -8.6, 3.0], [0, 12.2, -9.6, 2.4]].forEach(([x, y, z, l], i) => {
      const dir = norm([0, 1, -0.5 - i * 0.15]);
      tuboLivre(novaPeca(m, 'cabeca', 21), [[x, y, z], soma([x, y, z], esc(dir, l))], [[0.6, 1.5], 0], 4, MAT.pele, { tampa: true, cima: [1, 0, 0] });
    });
  }

  /* orelha de barbatana (como a de um tubarão ou de um tritão): três varetas para trás com a membrana entre elas */
  function barbatana(m, sd, fx) {
    const p = novaPeca(m, 'cabeca', 5, { aberta: true });
    const base = [[sd * 7.7 * fx, 12.2, 0.2], [sd * 7.9 * fx, 9.6, -0.6], [sd * 7.6 * fx, 6.8, -0.2]];
    const pontas = [[sd * 11.6, 15.0, -5.6], [sd * 11.2, 10.8, -7.4], [sd * 10.0, 6.4, -5.8]];
    const ib = base.map((b) => vertA(p, b)), ip = pontas.map((q) => vertA(p, q));
    for (let i = 0; i < 2; i++) {   // membrana (dentro) entre as varetas, com a borda recortada
      const meio = vertA(p, soma(mistura(pontas[i], pontas[i + 1], 0.5), [sd * -0.9, 0, 1.4]));
      quad(p, ib[i], ib[i + 1], meio, ip[i], MAT.orelhaDentro); tri(p, ib[i + 1], ip[i + 1], meio, MAT.orelhaDentro);
    }
    base.forEach((b, i) => tuboLivre(novaPeca(m, 'cabeca', 5), [b, mistura(b, pontas[i], 0.5), pontas[i]], [0.75, 0.5, 0], 4, MAT.pele, { tampa: true, cima: [sd, 0, 0] }));
  }

  /* orelhas de bicho no alto da cabeça (por cima do cabelo): ângulo, altura, largura, profundidade, inclinação */
  const ORELHAS_BICHO = {
    gato: { a: 40, y: 18.4, alt: 6.4, larg: 3.0, prof: 1.6, incl: [0.32, 0, -0.1] },
    raposa: { a: 42, y: 18.2, alt: 8.6, larg: 3.2, prof: 1.7, incl: [0.36, 0, -0.18] },
    lobo: { a: 44, y: 18.0, alt: 7.2, larg: 3.4, prof: 2.0, incl: [0.42, 0, -0.3] },
    urso: { a: 50, y: 17.6, redonda: true },
  };
  function orelhaBicho(m, sd, b) {
    const p = novaPeca(m, 'cabeca', 40);
    const base = sup(sd * b.a, b.y, 1.0);
    if (b.redonda) {   // urso: meia bolinha
      esfera(p, soma(base, [sd * 0.4, 1.6, -0.6]), [2.8, 2.6, 1.5], MAT.cabelo, 7, 4);
      esfera(novaPeca(m, 'cabeca', 41), soma(base, [sd * 0.4, 1.7, 0.6]), [1.6, 1.5, 0.6], MAT.orelhaDentro, 6, 3);
      return;
    }
    const fora = norm([sd * b.incl[0], 1, b.incl[2]]);
    const lado = [sd, 0, 0], frente = [0, 0, 1];
    const ponta = soma(base, esc(fora, b.alt));
    const meio = soma(base, soma(esc(fora, b.alt * 0.55), esc(frente, b.curva ? -1.2 : 0)));
    const L = b.larg, P = b.prof;
    // base em losango (frente, fora, trás, dentro) e a ponta; a face da frente tem o "dentro" rosado
    const bF = vertA(p, soma(base, esc(frente, P))), bE = vertA(p, soma(base, esc(lado, L))), bT = vertA(p, soma(base, esc(frente, -P))), bD = vertA(p, soma(base, esc(lado, -L)));
    const mF = vertA(p, soma(meio, esc(frente, P * 0.7))), mE = vertA(p, soma(meio, esc(lado, L * 0.75))), mT = vertA(p, soma(meio, esc(frente, -P * 0.7))), mD = vertA(p, soma(meio, esc(lado, -L * 0.75)));
    const pt = vertA(p, ponta), ref = soma(base, esc(fora, b.alt * 0.4));
    const anelB = [bF, bE, bT, bD], anelM = [mF, mE, mT, mD];
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4, dentro = k === 3 || k === 0;   // as duas faces da frente
      quad(p, anelB[k], anelB[k2], anelM[k2], anelM[k], dentro ? MAT.orelhaDentro : MAT.cabelo, 0, mistura(base, meio, 0.5));
      tri(p, anelM[k], anelM[k2], pt, dentro ? MAT.orelhaDentro : MAT.cabelo, 0, ref);
    }
  }

  /* ---------- Máscaras ----------
     dominó: pintada no rosto. bandana: pano em volta do queixo. raposa, caveira, ferro: casca na frente do rosto,
     com os desenhos pintados (efeito 3). */
  function construirMascara(m, ap) {
    const t = ap.mascara;
    if (t === 'bandana') {
      const anel = (y, k) => { const r = sup(0, y, 1); return { y, rx: Math.abs(sup(90, y, k)[0]), rz: (r[2] - noCentro(y)) * k, z: noCentro(y) }; };
      const p = novaPeca(m, 'cabeca', 24);
      tubo(p, [anel(6.4, 1.07), anel(4.8, 1.08), anel(2.4, 1.1)], 10, MAT.mascara, { a0: Math.PI / 10, tampaIni: true, tampaFim: [0, 0.2, 3.8] });
      esfera(novaPeca(m, 'cabeca', 24), [0, 5.2, -6.4], [1.4, 1.2, 1.0], MAT.mascara2, 5, 3);   // nó atrás
      [[-1.2, 1], [1.4, -1]].forEach(([dx, sd]) => mecha(novaPeca(m, 'cabeca', 25), [dx * 0.4, 5.0, -6.6], [dx * 1.6, 1.0, -7.6], [dx * 2.2 + sd * 0.6, -3.5, -7.0], 2.2, 0.6, { mat: MAT.mascara, fora: [0, 0, -1], segs: 3, afina: 0.5 }));
    } else if (t === 'caveira' || t === 'lisa') {   // (a lisa é a Máscara de Revyiel)
      const mat = t === 'lisa' ? MAT.mascaraMetal : MAT.mascara;
      mascaraRosto(novaPeca(m, 'cabeca', 24), mat);
      if (t === 'lisa') {   // aresta do nariz, como um bico curto
        const n0 = sup(0, 10.6, 1.07), n1 = sup(0, 5.6, 1.12);
        tuboLivre(novaPeca(m, 'cabeca', 24), [n0, soma(mistura(n0, n1, 0.6), [0, 0, 1.3]), soma(n1, [0, -0.4, 0.4])], [[0.4, 0.2], [0.9, 0.6], 0], 4, mat, { tampa: true, cima: [0, 0, 1] });
      }
    }
  }
  /* casca da máscara no formato do rosto: oval, da testa até o queixo, colada na cabeça (por baixo da franja) */
  const CABECA_QUEIXO = CABECA_FORMA.concat([{ y: 0.6, rx: 1.2, rz: 2.2, z: 3.6 }]);
  function supRosto(a, y, k) {
    const L = CABECA_QUEIXO;
    let r = L[L.length - 1];
    for (let i = 0; i < L.length - 1; i++) if (y <= L[i].y && y >= L[i + 1].y) {
      const t = (L[i].y - y) / (L[i].y - L[i + 1].y);
      r = { rx: R.lerp(L[i].rx, L[i + 1].rx, t), rz: R.lerp(L[i].rz, L[i + 1].rz, t), z: R.lerp(L[i].z, L[i + 1].z, t) };
      break;
    }
    const ar = a * RAD;
    return [Math.sin(ar) * r.rx * k, CENTRO_CABECA[1] + (y - CENTRO_CABECA[1]) * k, r.z + Math.cos(ar) * r.rz * k];
  }
  function mascaraRosto(p, mat) {
    const k = 1.045, LIN = 10, COL = 10;
    const linhas = [];
    for (let i = 0; i <= LIN; i++) {
      const y = R.lerp(16.4, 1.2, i / LIN), t = (y - 9.4) / 7.6;
      const amax = Math.max(14, 84 * Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(t), 2.6))));   // oval do rosto
      const l = [];
      for (let j = 0; j <= COL; j++) l.push(vertA(p, supRosto(R.lerp(-amax, amax, j / COL), y, k)));
      linhas.push(l);
    }
    const dentro = [0, 9, -2];
    for (let i = 0; i < LIN; i++) for (let j = 0; j < COL; j++) quad(p, linhas[i][j], linhas[i][j + 1], linhas[i + 1][j + 1], linhas[i + 1][j], mat, 3, dentro);
  }
  /* centro (z) do anel da cabeça na altura y */
  function noCentro(y) { return (sup(0, y, 1)[2] + sup(180, y, 1)[2]) / 2; }

  /* ---------- Cabelos ----------
     Touca (casca da cabeça um pouco maior) + mechas. Ângulos: 0 = frente, ±90 = lados, 180 = nuca. */
  let grupoMecha = 100;
  const PROXY_CABELO = { c: [0, 11.2, -0.8], r: [10.4, 11.2, 10.6], k: 0.78 };
  function touca(m, ate) {
    const t = novaPeca(m, 'cabeca', 6, { proxy: PROXY_CABELO });
    const L = CABECA.slice(0, 5).map((r, i) => ({ y: CENTRO_CABECA[1] + (r.y - CENTRO_CABECA[1]) * (VOLUME - 0.005), rx: r.rx * VOLUME, rz: r.rz * VOLUME, z: r.z - (i === 4 ? 0.6 : 0) }));
    tubo(t, L, 10, (s, k, ang) => {
      const a = Math.abs(((ang / RAD) + 180) % 360 - 180);
      if (s === 0) return [MAT.cabelo, 2];
      if (s === 1) return a >= 54 ? [MAT.cabelo, 2] : null;
      if (s === 2) return a >= (ate.lados || 66) ? MAT.cabelo : null;   // cobre o lugar da orelha (a orelha sai por cima ou fica por baixo)
      if (s === 3) return a >= (ate.nuca || 144) ? MAT.cabelo : null;
      return null;
    }, { a0: Math.PI / 10, tampaIni: [0, CENTRO_CABECA[1] + 10.4 * VOLUME, -0.6], matIni: MAT.cabelo });
    // a frente da touca (entre a franja) cobre a testa até a linha do cabelo
    const fr = novaPeca(m, 'cabeca', 6, { proxy: PROXY_CABELO });
    tubo(fr, [
      { y: CENTRO_CABECA[1] + (CABECA[1].y - CENTRO_CABECA[1]) * (VOLUME - 0.005), rx: CABECA[1].rx * VOLUME, rz: CABECA[1].rz * VOLUME, z: CABECA[1].z },
      { y: 15.2, rx: anelCabeca(15.2).rx * 1.06, rz: anelCabeca(15.2).rz * 1.06, z: anelCabeca(15.2).z },
    ], 10, (s, k, ang) => (Math.abs(((ang / RAD) + 180) % 360 - 180) < 54 ? [MAT.cabelo, 2] : null), { a0: Math.PI / 10 });
  }
  function novaMecha(m, osso) {
    const p = novaPeca(m, osso || 'cabeca', grupoMecha++, { proxy: !osso || osso === 'cabeca' ? PROXY_CABELO : { c: [0, 0, 0], eixo: true, k: 0.62 } });
    p.mecha = true;
    return p;
  }
  /* mecha presa à cabeça, de (a0, y0) até (a1, y1), estufando "bojo" no meio */
  let FRANJA_DESCE = 0;   // quanto as mechas da frente crescem (controle "comprimento" do cabelo frontal)
  let ORELHA_POR_CIMA = false;   // orelhas por cima do cabelo: a mecha que cairia em cima da orelha não é feita
  /* ponto empurrado para fora da cabeça (pelo menos k × a superfície na mesma altura e no mesmo ângulo) */
  function foraDaCabeca(P, k) {
    const zc = noCentro(R.clamp(P[1], 4.8, 18.6)), ang = Math.atan2(P[0], P[2] - zc) / RAD;
    const S = sup(ang, P[1], k), r = Math.hypot(P[0], P[2] - zc), rs = Math.hypot(S[0], S[2] - zc);
    return r >= rs ? P : [S[0], P[1], S[2]];
  }
  function mechaCab(m, a0, y0, a1, y1, larg, op) {
    op = op || {};
    if (ORELHA_POR_CIMA && Math.abs(a1) >= 86 && Math.abs(a1) <= 105 && y1 < 12) return;
    const s0 = op.s0 || 0.97, s1 = (op.s1 || 1.14) + VOL_MECHA, sm = (op.sm || 1.2) + VOL_MECHA * 1.2;
    const P0 = sup(a0, y0, s0);
    let P2 = sup(a1, y1, s1), P1 = sup((a0 + a1) / 2 + (op.torce || 0), (y0 + y1) / 2 + (op.ym || 0), sm);
    if (op.dz) { P2[2] += op.dz; }
    if (op.dx) { P2[0] += op.dx; }
    if (op.dy) { P2[1] += op.dy; }
    if (FRANJA_DESCE) {   // cresce seguindo a curva (a franja mais que as mechas compridas) e passa por fora do rosto
      const ext = FRANJA_DESCE * R.clamp((y1 + 2) / 12, 0.35, 1), d = norm(sub(P2, P1));
      P1 = foraDaCabeca(soma(P1, esc(d, ext * 0.4)), s1 + 0.08);
      P2 = foraDaCabeca(soma(soma(P2, esc(d, ext)), [0, -ext * 0.25, 0]), s1);
    }
    mecha(novaMecha(m), P0, P1, P2, larg, op.esp || larg * 0.42, { segs: op.segs || 4, fora: op.fora, afina: op.afina });
  }
  /* franja: no estilo Megaman Legends são poucas mechas, largas e pontudas (n mechas pedidas → ~70% delas, mais largas) */
  function franja(m, n0, abre, pontas, larg0) {
    const n = Math.max(3, Math.round(n0 * 0.72)), larg = larg0 * Math.min(1.3, (n0 / n) * 0.92);
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const a = R.lerp(-abre, abre, t);
      const yp = pontas[Math.round(t * (pontas.length - 1))] - (i % 2 ? 0 : 0.6);
      mechaCab(m, a * 0.75, 17.8, a * 1.12, yp, larg, { s0: 0.95, sm: 1.17, s1: 1.1, ym: 1.6 });
    }
  }
  function laterais(m, yp, larg, fora) {
    [1, -1].forEach((s) => {
      mechaCab(m, s * 64, 16.5, s * 80, yp, larg, { s0: 0.97, sm: 1.18, s1: 1.1 + (fora || 0) });
      mechaCab(m, s * 96, 16.5, s * 104, yp + 3, larg * 0.95, { s0: 0.97, sm: 1.2, s1: 1.14 + (fora || 0) });
    });
  }
  function traseira(m, n, yp, larg, abre) {
    for (let i = 0; i < n; i++) {
      const a = 112 + (i / (n - 1)) * 136;   // de 112° a 248° (passando pela nuca)
      const y = yp + (i % 2) * 1.6;
      mechaCab(m, a, 18.6, a + (a < 180 ? -6 : a > 180 ? 6 : 0), y, larg, { s0: 0.95, sm: 1.26, s1: 1.16 + (abre || 0) });
    }
  }
  /* Cabelo em duas partes: frontal (franja e mechas do rosto) e traseiro (nuca, comprido, rabos de cavalo…).
     O traseiro decide quanto a touca cobre atrás. "careca" tira o cabelo todo (inclusive a franja). */
  const TOUCA = { curtinho: { nuca: 144 }, curto: { nuca: 144 }, espetado: { nuca: 144 }, marias: { nuca: 144 }, marias_longas: { nuca: 144 }, medusa: { nuca: 144 } };
  // com o capuz levantado, o que sairia pelo capuz vira um cabelo que cabe nele
  const SOB_CAPUZ = { espetado: 'curto', coque: 'curto', afro: 'curto', zero: 'longo', rabo: 'longo', volumoso: 'longo', medusa: 'curto', marias_longas: 'longo', armado: 'curto' };
  // com o boné, o que furaria a copa vira um cabelo que cabe nele (o armado, os rabos e as marias saem por baixo)
  const SOB_BONE = { espetado: 'curto', coque: 'curto', afro: 'curto', medusa: 'curto' };
  const trasDe = (ap) => (ap.capuz === 'levantado' ? SOB_CAPUZ[ap.cabeloTras] : ap.adorno === 'bone' ? SOB_BONE[ap.cabeloTras] : null) || ap.cabeloTras;
  /* ---------- Barba e bigode (na cor do cabelo; as tranças presas na cor dos prendedores) ---------- */
  function construirBarba(m, ap) {
    const t = ap.barba;
    if (!t || t === 'nenhuma' || ap.corpo === 'osteon' || ap.corpo === 'golem') return;
    const k = 1.06;
    if (t === 'curta' || t === 'cheia' || t === 'trancada') {   // casca na mandíbula, deixando a boca de fora
      const p = novaPeca(m, 'cabeca', 100);
      const LIN = 6, COL = 12, linhas = [];
      for (let i = 0; i <= LIN; i++) {
        const y = R.lerp(8.4, 0.8, i / LIN), l = [];
        for (let j = 0; j <= COL; j++) l.push(vertA(p, supRosto(R.lerp(-112, 112, j / COL), y, k)));
        linhas.push(l);
      }
      for (let i = 0; i < LIN; i++) for (let j = 0; j < COL; j++) {
        const a = Math.abs(R.lerp(-112, 112, (j + 0.5) / COL)), y = R.lerp(8.4, 0.8, (i + 0.5) / LIN);
        if (a < 42 && y > 2.9) continue;   // bochechas e boca de fora
        if (a < 70 && y > 6.4) continue;
        quad(p, linhas[i][j], linhas[i][j + 1], linhas[i + 1][j + 1], linhas[i + 1][j], MAT.cabelo, 0, [0, 6, -1]);
      }
    }
    if (t === 'cheia') {   // mechas caindo do queixo e da mandíbula
      [-70, -46, -22, 0, 22, 46, 70].forEach((a, i) => {
        const P0 = supRosto(a, a === 0 ? 1.6 : 3.2 - Math.abs(a) * 0.02, k);
        mecha(novaMecha(m), P0, soma(P0, [Math.sin(a * RAD) * 1.6, -4, 1.4]), soma(P0, [Math.sin(a * RAD) * 2.2, -11 + Math.abs(a) * 0.05 + (i % 2) * 1.5, 1.2]), 4.4, 1.8, { segs: 4, fora: [Math.sin(a * RAD), 0, 1], afina: 0.6 });
      });
    }
    if (t === 'cavanhaque') {
      const P0 = supRosto(0, 2.4, k);
      mecha(novaMecha(m), P0, soma(P0, [0, -2.2, 0.8]), soma(P0, [0, -5.4, 0.6]), 3.0, 1.6, { segs: 3, fora: [0, 0, 1], afina: 0.5 });
    }
    if (t === 'trancada') {   // duas tranças saindo do queixo
      [1, -1].forEach((sd) => {
        const b = soma(supRosto(sd * 18, 1.6, k), [0, 0, 0.4]), p = novaMecha(m);
        for (let i = 0; i < 9; i++) {
          const q = soma(b, [sd * (0.6 + i * 0.12) + (i % 2 ? 0.35 : -0.35) * sd, -i * 1.5, 0.6 + i * 0.1]);
          esfera(p, q, [1.35 - i * 0.05, 1.05, 1.15], MAT.cabelo, 6, 3);
        }
        const fim = soma(b, [sd * 1.7, -13.4, 1.5]);
        tubo(novaPeca(m, 'cabeca', 7), [{ y: fim[1] + 0.7, rx: 0.9, x: fim[0], z: fim[2] }, { y: fim[1] - 0.6, rx: 0.9, x: fim[0], z: fim[2] }], 6, MAT.tecido, { tampaIni: true, tampaFim: true });
        mecha(novaMecha(m), soma(fim, [0, -0.4, 0]), soma(fim, [sd * 0.5, -2.2, 0.3]), soma(fim, [sd * 0.3, -4.2, 0.2]), 2.6, 1.1, { segs: 3, fora: [0, 0, 1], afina: 0.4 });
      });
    }
    // bigode: sai de baixo do nariz para os lados (o bigodão é grosso e cai em pontas)
    if (t !== 'cavanhaque') {
      const grande = t === 'bigodao';
      [1, -1].forEach((sd) => {
        const P0 = soma(supRosto(sd * 4, 5.2, 1.0), [0, 0, 0.4]);
        const P2 = grande ? soma(supRosto(sd * 52, 2.6, 1.1), [sd * 1.6, -1.2, 1.6]) : soma(supRosto(sd * 34, 4.2, 1.08), [0, -0.4, 0.4]);
        mecha(novaMecha(m), P0, soma(mistura(P0, P2, 0.5), [0, grande ? 0.8 : 0.3, 1.0]), P2, grande ? 3.2 : 1.9, grande ? 1.7 : 0.9, { segs: 4, fora: [0, 1, 0.4], afina: 0.5 });
      });
    }
  }

  let BONE = false;   // de boné: o cabelo de cima fica escondido na copa
  function construirCabelo(m, ap) {
    grupoMecha = 100;
    BONE = ap.adorno === 'bone';
    construirBarba(m, ap);
    if (ap.cabeloTras === 'careca') return;
    const tras = trasDe(ap);
    touca(m, Object.assign({ lados: 108, nuca: 108 }, TOUCA[tras]));
    FRANJA_DESCE = Math.round(R.clamp(+ap.franja || 0, 0, 1) * 10) / 10 * 9;   // em passos de 10% (a malha é guardada assim)
    ORELHA_POR_CIMA = ap.orelhasPos !== 'baixo' && !ORELHAS_BICHO[ap.orelhas];
    cabeloFrente(m, ap.cabeloFrente, proporcoes(ap));
    FRANJA_DESCE = 0;
    cabeloTras(m, tras);
    ORELHA_POR_CIMA = false;
  }
  function cabeloFrente(m, e, c) {
    if (e === 'franja') {
      franja(m, 7, 64, [11.6, 12.6, 11.0, 12.8, 10.9, 12.4, 11.4], 4.4);
      laterais(m, 6.6, 4.2);
    } else if (e === 'mechas') {   // franja + mechas da frente até o peito
      franja(m, 7, 64, [11.2, 12.4, 10.8, 12.8, 10.8, 12.4, 11.2], 4.4);
      [1, -1].forEach((sd) => {
        mechaCab(m, sd * 66, 16.5, sd * 80, -9, 4.4, { s0: 0.97, sm: 1.16, s1: 1.18, segs: 5 });
        mechaCab(m, sd * 92, 16.5, sd * 100, -5, 4.2, { s0: 0.97, sm: 1.2, s1: 1.2, segs: 5 });
      });
    } else if (e === 'espetada') {
      franja(m, 5, 56, [12.4, 11.0, 12.6, 11.2, 12.2], 4.8);
      laterais(m, 7.4, 4.0, 0.06);
    } else if (e === 'reta') {   // corte reto (hime)
      franja(m, 8, 62, [11.8, 11.6, 11.7, 11.6, 11.6, 11.7, 11.6, 11.8], 3.8);
      [1, -1].forEach((sd) => {
        mechaCab(m, sd * 66, 16.5, sd * 78, 2.6, 4.6, { s0: 0.97, sm: 1.14, s1: 1.12 });
        mechaCab(m, sd * 92, 16.5, sd * 98, 2.0, 4.4, { s0: 0.97, sm: 1.18, s1: 1.16 });
      });
    } else if (e === 'repartida') {   // repartida de lado, jogada para um lado só
      for (let i = 0; i < 6; i++) {
        const a0 = 30 - i * 15, a1 = a0 - 22;
        mechaCab(m, a0 * 0.8, 18.2, a1, 12.6 - (i % 2) * 1.4 - i * 0.2, 4.8, { s0: 0.95, sm: 1.18, s1: 1.1, ym: 1.4 });
      }
      laterais(m, 6.0, 4.0);
    } else if (e === 'testa') {   // penteado para trás, testa à mostra
      [-40, -20, 0, 20, 40].forEach((a) => {
        const P0 = sup(a, 15.4, 1.02), P2 = sup(a * 0.7, 20.2, 1.02);
        mecha(novaMecha(m), P0, sup(a, 18.6, 1.14), soma(P2, [0, 0.6, -4]), 5.2, 1.4, { segs: 3, afina: 0.5 });
      });
      laterais(m, 7.6, 3.6);
    } else if (e === 'meio') {   // repartido no meio: duas cortinas para os lados e mechas compridas emoldurando o rosto
      [1, -1].forEach((sd) => {
        [[4, 40, 13.6, 5.0], [12, 58, 11.4, 5.2], [22, 76, 8.2, 5.0]].forEach(([a0, a1, yp, l]) => mechaCab(m, sd * a0, 19.0, sd * a1, yp, l, { s0: 0.95, sm: 1.16, s1: 1.12, ym: 1.4 }));
        mechaCab(m, sd * 60, 17, sd * 80, -8, 4.6, { s0: 0.97, sm: 1.18, s1: 1.2, segs: 5 });
        mechaCab(m, sd * 92, 16.5, sd * 100, -5, 4.2, { s0: 0.97, sm: 1.2, s1: 1.2, segs: 5 });
      });
    } else if (e === 'trancas') {   // franja e duas tranças na frente dos ombros
      franja(m, 7, 64, [11.6, 12.6, 11.0, 12.8, 10.9, 12.4, 11.4], 4.4);
      [1, -1].forEach((sd) => {
        mechaCab(m, sd * 64, 16.5, sd * 82, 7.2, 4.0, { s0: 0.97, sm: 1.18, s1: 1.12 });
        // a trança: gomos alternados descendo na frente do peito
        const zp = 4.4 + (c ? c.busto * 1.1 : 0);
        const caminho = [[sd * 7.9, 9.2, -0.6], [sd * 8.9, 2.0, 0.8], [sd * 8.2, -6, 3.2], [sd * 7.2, -13, zp], [sd * 6.8, -18.5, zp + 0.6]];
        const p = novaMecha(m);
        for (let i = 0; i < 15; i++) {
          const t = i / 15, seg = Math.min(3, Math.floor(t * 4)), f = t * 4 - seg;
          const q = mistura(caminho[seg], caminho[seg + 1], f), lado = (i % 2 ? 0.5 : -0.5) * sd;
          esfera(p, soma(q, [lado, 0, 0]), [1.7 - t * 0.45, 1.6, 1.35 - t * 0.25], MAT.cabelo, 6, 3);
        }
        const fim = caminho[4];
        tubo(novaPeca(m, 'cabeca', 7), [{ y: fim[1] + 0.8, rx: 0.95, x: fim[0], z: fim[2] }, { y: fim[1] - 0.6, rx: 0.95, x: fim[0], z: fim[2] }], 6, MAT.tecido, { tampaIni: true, tampaFim: true });
        mecha(novaMecha(m), soma(fim, [0, -0.4, 0]), soma(fim, [sd * 0.4, -2.4, 0.4]), soma(fim, [sd * 0.2, -4.6, 0.2]), 2.8, 1.2, { segs: 3, fora: [0, 0, 1], afina: 0.4 });
      });
    } else if (e === 'zero') {   // franja longa e espetada, mechas compridas dos lados (como a do Zero)
      [[-62, 6.4, 5.2], [-34, 8.6, 5.6], [-8, 10.8, 5.4], [16, 9.4, 5.6], [40, 7.6, 5.4], [64, 5.8, 5.0]].forEach(([a, yp, l]) => {
        mechaCab(m, a * 0.7, 18.2, a * 1.18, yp, l, { s0: 0.95, sm: 1.2, s1: 1.18, ym: 1.8 });
      });
      [1, -1].forEach((sd) => {
        mechaCab(m, sd * 70, 17, sd * 84, -14, 5.2, { s0: 0.97, sm: 1.2, s1: 1.22, segs: 5 });
        mechaCab(m, sd * 96, 17, sd * 104, -8, 4.8, { s0: 0.97, sm: 1.22, s1: 1.24, segs: 5 });
      });
    }
    // 'nenhum': sem franja (só a linha do cabelo)
  }
  /* cabelo puxado para trás até um prendedor (rabo, coque) */
  function puxado(m, alvo, larg) {
    for (let i = 0; i < 7; i++) {
      const a = 108 + (i / 6) * 144;
      const P0 = sup(a, 16, 0.98);
      mecha(novaMecha(m), sup(a, 6, 1.04), mistura(P0, sup(a, 11, 1.12), 0.5), alvo, larg, 1.6, { segs: 3, afina: 0.3 });
    }
  }
  function cabeloTras(m, e) {
    if (e === 'curto') {
      traseira(m, 7, 4.6, 5.2, 0.12);
      if (!BONE) [[-20, 6, -0.12], [26, 7, -0.25], [160, 5, 0]].forEach(([a, l, d]) => {   // tufos no alto (com boné, não: furariam a copa)
        const P0 = sup(a, 19, 0.92), P2 = soma(sup(a, 20, 1.1), [Math.sin(a * RAD) * 2, l * 0.5, -l * 0.8 + d]);
        mecha(novaMecha(m), P0, soma(sup(a, 20.5, 1.12), [0, 1, 0]), P2, 4, 1.8, { segs: 3 });
      });
    } else if (e === 'espetado') {
      const espinhos = [[0, 21, 1], [40, 20.5, 0.9], [-40, 20.5, 0.9], [80, 18.5, 0.85], [-80, 18.5, 0.85], [120, 17, 0.9], [-120, 17, 0.9], [160, 16.5, 1], [-160, 16.5, 1], [180, 12, 0.9], [140, 11, 0.8], [-140, 11, 0.8]];
      espinhos.forEach(([a, y, k]) => {
        const P0 = sup(a, y - 2, 0.9);
        const dir = norm(sub(sup(a, y + 3, 1.6), CENTRO_CABECA));
        const P2 = soma(sup(a, y, 1.08), soma(esc(dir, 5.6 * k), [0, 1.6, -3.6]));   // espinhos curtos e largos, como cunhas
        mecha(novaMecha(m), sup(a, y - 3, 0.82), soma(sup(a, y, 1.12), [0, 0.6, -0.5]), P2, 7.4 * k, 3.0 * k, { segs: 3, afina: 0.6 });
      });
    } else if (e === 'chanel') {
      for (let i = 0; i < 12; i++) {
        const a = 62 + (i / 11) * 236;
        const yp = 3.4 + Math.abs(Math.cos(a * RAD)) * 1.2;
        mechaCab(m, a, 18, a + (a < 180 ? 4 : -4), yp, 5.2, { s0: 0.95, sm: 1.24, s1: 1.2, dy: 0 });
      }
    } else if (e === 'longo') {
      traseira(m, 7, 3.6, 5.4, 0.18);
      for (let i = 0; i < 7; i++) {   // cortina nas costas (pende com a gravidade)
        const t = i / 6, x = R.lerp(-6.6, 6.6, t), zc = -1.6 - Math.cos((t - 0.5) * Math.PI) * 1.4;
        mecha(novaMecha(m, 'cabeloT'), [x * 0.7, 2.5, zc + 1.5], [x * 1.08, -10, zc - 1.6], [x * 1.12, -27 + (i % 2) * 2.4, zc - 1.6], 4.8, 1.8, { segs: 5, fora: [x * 0.12, 0, -1], afina: 0.6 });
      }
    } else if (e === 'volumoso') {   // comprido, cheio e ondulado, abrindo para os lados
      traseira(m, 9, 3.0, 6.0, 0.3);
      for (let i = 0; i < 9; i++) {   // cortina larga nas costas
        const t = i / 8, x = R.lerp(-8.4, 8.4, t), zc = -1.6 - Math.cos((t - 0.5) * Math.PI) * 1.8;
        mecha(novaMecha(m, 'cabeloT'), [x * 0.7, 2.5, zc + 1.5], [x * 1.5, -12, zc - 2.6], [x * 1.65, -30 + (i % 3) * 3, zc - 1.6], 6.0, 2.2,
          { segs: 6, fora: [x * 0.12, 0, -1], afina: 0.55, onda: [[1.6, 0, 0.4], 2.5 + (i % 2)] });
      }
      ['E', 'D'].forEach((l) => {   // volume dos lados
        const sd = l === 'E' ? 1 : -1;
        [[0, 0], [1, 1]].forEach(([dz, k]) => mecha(novaMecha(m, 'cabelo' + l), [0, 0, -1 - dz * 2], [sd * (6.6 + k), -8, -2 - dz * 2], [sd * (5.6 + k * 1.6), -24 + k * 3, -1.4 - dz * 2.4], 6.0, 2.2,
          { segs: 5, fora: [sd, 0, 0], afina: 0.6, onda: [[0, 0, 1.4], 2.5] }));
      });
    } else if (e === 'afro') {   // black power: nuvem grande em volta da cabeça
      esfera(novaPeca(m, 'cabeca', 8), [0, 14.2, -3.4], [12.6, 11.2, 10.2], MAT.cabelo, 10, 6);
      const tufos = [];
      for (let i = 0; i < 26; i++) {   // tufos espalhados (menos na frente, para o rosto aparecer)
        const u = (i + 0.5) / 26, el = Math.asin(1 - 2 * u) * 0.9, az = i * 2.39996;
        const a = ((az / RAD) % 360 + 360) % 360, frente = a < 52 || a > 308;
        if (frente && el < 0.55) continue;
        tufos.push([Math.sin(az) * Math.cos(el) * 12.0, 14.2 + Math.sin(el) * 10.6, -3.4 + Math.cos(az) * Math.cos(el) * 9.8]);
      }
      tufos.forEach((q, i) => esfera(novaMecha(m), q, 3.4 + (i % 3) * 0.6, MAT.cabelo, 6, 4));
    } else if (e === 'rabo') {
      puxado(m, [0, 16.2, -8.2], 5.6);
      esfera(novaPeca(m, 'cabeloT', 7), [0, 0.2, 0.2], [2.2, 2.0, 1.6], MAT.tecido, 6, 3);
      [[0, 0], [-2.2, 1], [2.2, 1], [0, 2]].forEach(([dx, k]) => {
        mecha(novaMecha(m, 'cabeloT'), [dx * 0.3, 0.4, -0.4], [dx * 1.3, -3, -6 - k], [dx * 1.6, -19 + k * 2.5, -4.5 - k], 5.2 - k * 0.6, 2.2, { segs: 5, fora: [dx * 0.2, 0.3, -1], afina: 0.65 });
      });
    } else if (e === 'zero') {   // rabo de cavalo do Zero: a juba atrás da cabeça e um rabo enorme que abre em leque até a panturrilha
      for (let i = 0; i < 9; i++) {   // volume atrás da cabeça, puxado para o prendedor
        const a = 100 + (i / 8) * 160;
        mecha(novaMecha(m), sup(a, 5.5, 1.04), soma(sup(a, 11.5, 1.32), [0, 0, -1.2]), [0, 17.4, -8.8], 7.4, 2.2, { segs: 4, afina: 0.25 });
      }
      tuboLivre(novaPeca(m, 'cabeloT', 7), [[0, 0.8, 1.4], [0, 0.2, -0.6], [0, -0.3, -2.0]], [[3.4, 3.0], [3.5, 3.1], [3.0, 2.6]], 8, MAT.tecido, { tampa: true, cima: [0, 1, 0] });
      tuboLivre(novaMecha(m, 'cabeloT'), [[0, -0.4, -2.2], [0, -4, -5.4], [0, -12, -8.4], [0, -22, -9.4], [0, -30, -8]], [[3.6, 3.0], [5.6, 4.6], [7.4, 5.4], [6.4, 4.4], 0], 8, MAT.cabelo, { cima: [1, 0, 0] });   // miolo
      [[14, 6.6, 10.4, 15.0, -74, 10.4, 3.4], [12, 4.0, 6.6, 10.0, -64, 9.6, 3.2], [8, 2.0, 3.0, 4.6, -52, 8.6, 3.0]].forEach(([n, r0, r1, r2, yF, larg, esp], cam) => {
        for (let i = 0; i < n; i++) {   // camadas em leque, a de fora mais larga e mais comprida
          const th = ((i + cam * 0.5) / n) * TAU, cx = Math.sin(th), cz = Math.cos(th);
          const P1 = [cx * r1 * 1.25, -11 - (i % 2) * 3, -9.5 + cz * r1 * 0.75];
          const P2 = [cx * r2 * 1.35, yF + (i % 3) * 5 + Math.abs(cx) * 6, -9 + cz * r2 * 0.6 - (1 - Math.abs(cx)) * 3];
          mecha(novaMecha(m, 'cabeloT'), [cx * r0 * 0.35, -0.6, -2.0 + cz * r0 * 0.3], P1, P2, larg, esp, { segs: 6, fora: [cx, 0.15, cz - 0.4], afina: 0.62 });
        }
      });
    } else if (e === 'medusa') {   // serpentes no lugar do cabelo: saem da cabeça, caem como mechas grossas e a cabeça vira para fora
      for (let i = 0; i < 18; i++) {
        const a = -160 + (i / 17) * 320, ar = a * RAD, frente = Math.abs(a) < 55;
        if (frente && i % 2) continue;   // na frente, poucas (o rosto aparece)
        const y0 = 18.6 - (i % 3) * 1.2, b = sup(a, y0, 0.95);
        const fora = norm([Math.sin(ar), 0, Math.cos(ar)]), lado = norm(cruz(fora, [0, 1, 0])), sd = i % 2 ? 1 : -1;
        const queda = frente ? 4 : 10 + (i % 4) * 3;   // até onde a serpente cai
        const pts = [b, soma(sup(a, y0 + 1.2, 1.3), [0, 0.6, 0]), soma(sup(a, y0 - 3, 1.55), esc(lado, sd * 1.2)),
          soma(soma(sup(a, Math.max(3, y0 - queda * 0.7), 1.5), esc(fora, 1.4)), esc(lado, -sd * 1.4)), soma(sup(a, Math.max(2, y0 - queda), 1.6), esc(fora, 3.2))];
        const p = novaMecha(m);
        tuboLivre(p, pts, [1.5, 1.45, 1.35, 1.2, 1.05], 6, MAT.cabelo, { cima: [0, 1, 0] });
        // cabeça: olha para fora e um pouco para cima, com os olhinhos
        const dir = norm(soma(fora, [0, 0.7, 0])), cab = soma(pts[4], esc(dir, 0.8));
        tuboLivre(p, [soma(cab, esc(dir, -1.2)), soma(cab, esc(dir, 0.6)), soma(cab, esc(dir, 2.4))], [[1.6, 1.1], [1.5, 1.0], 0], 6, MAT.cabelo, { tampa: true, cima: [0, 1, 0] });
        [1, -1].forEach((k) => esfera(p, soma(soma(cab, esc(lado, k * 1.05)), soma(esc(dir, 0.4), [0, 0.5, 0])), 0.32, MAT.escuro, 4, 3));
      }
    } else if (e === 'marias') {
      traseira(m, 7, 5.0, 5.0, 0.1);
      ['E', 'D'].forEach((l) => {
        const sd = l === 'E' ? 1 : -1;
        esfera(novaPeca(m, 'cabelo' + l, 7), [0, 0.2, 0], 1.9, MAT.tecido, 6, 3);
        [[0, 0], [1.6, 1], [-1.6, 1]].forEach(([dz, k]) => {
          mecha(novaMecha(m, 'cabelo' + l), [0, 0, 0], [sd * (4.2 + k), -4, dz - 1], [sd * (2.6 + k * 1.2), -21 + k * 3, dz * 1.4 - 1.5], 5.6 - k * 0.8, 2.4, { segs: 5, fora: [sd, 0, 0], afina: 0.65 });
        });
      });
    } else if (e === 'marias_longas') {   // rabos enormes até os joelhos, abrindo em leque (mais largos que o corpo), com o prendedor quadrado
      traseira(m, 7, 5.0, 5.0, 0.1);
      // a fita alarga do prendedor até perto da ponta e acaba numa ponta recortada
      const leque = (t) => (t < 0.78 ? 0.42 + 0.78 * (t / 0.78) : 1.2 * (1 - (t - 0.78) / 0.22) + 0.02);
      ['E', 'D'].forEach((l) => {
        const sd = l === 'E' ? 1 : -1;
        bloco(novaPeca(m, 'cabelo' + l, 7), [[sd * 0.4, -2.4, 2.4, -2.2, 2.3], [sd * 0.4, -2.4, 2.4, 2.2, 2.3]], MAT.tecido, [sd * 0.4, 0, 0]);   // prendedor grande
        // cinco fitas largas e chatas (a face larga para a frente), em leque: as de fora vão mais para o lado e para trás
        for (let i = 0; i < 5; i++) {
          const t = i / 4, dy = [0, -5, 3, -8, -2][i];
          mecha(novaMecha(m, 'cabelo' + l), [sd * (0.3 - t * 0.6), -0.8, R.lerp(1.0, -1.4, t)], [sd * (3.6 + 5.5 * t), -16, R.lerp(-1.8, -6.2, t)],
            [sd * (2.8 + 13 * t), -47 + dy, R.lerp(-3.4, -10.5, t)], 9.0 - t * 1.6, 1.5,
            { segs: 8, fora: [sd * (0.25 + 0.4 * t), 0, -1], perfil: leque, onda: [[sd * 0.8, 0, 1.0], 1.4 + t * 0.5] });
        }
      });
    } else if (e === 'armado') {   // armado em leque, até os ombros (como o da Roll): lâminas largas que saem para os lados e para trás
      traseira(m, 9, 6.0, 5.8, 0.24);
      const lamina = (t) => (t < 0.5 ? 0.8 + 0.45 * (t / 0.5) : 1.25 * Math.pow(1 - (t - 0.5) / 0.5, 0.85));
      // [ângulo, quanto abre, largura, altura da ponta]: as dos lados abrem mais e descem até os ombros
      [[62, 9, 1.0, -1], [84, 13, 1.2, -4.5], [106, 13, 1.15, -2], [130, 10, 1.0, -4], [155, 7, 0.9, -1.5], [180, 6, 0.85, -3],
        [-155, 7, 0.9, -1.5], [-130, 10, 1.0, -4], [-106, 13, 1.15, -2], [-84, 13, 1.2, -4.5], [-62, 9, 1.0, -1]]
        .forEach(([a, abre, k, yp]) => {
          const ar = a * RAD, fx = Math.sin(ar), fz = Math.cos(ar), zc = noCentro(10);
          const R0 = anelCabeca(6).rx;
          const P0 = sup(a, 17.4, 0.96), P1 = [fx * (R0 + 2.6 + abre * 0.25), 9.5, zc + fz * (R0 + 2.0 + abre * 0.2) - 0.6];
          const P2 = [fx * (R0 + abre), yp, zc + fz * (R0 * 0.95 + abre * 0.7) - 1.6];
          mecha(novaMecha(m), P0, P1, P2, 6.8 * k, 2.0, { segs: 7, perfil: lamina, fora: [fx, 0.25, fz] });
        });
    } else if (e === 'coque') {
      puxado(m, [0, 17, -7.6], 5.4);
      esfera(novaPeca(m, 'cabeca', 8), [0, 19.4, -7.6], [4.8, 4.4, 4.6], MAT.cabelo, 8, 4);
      tubo(novaPeca(m, 'cabeca', 7), [{ y: 16.4, rx: 3.2, z: -7.2 }, { y: 15.4, rx: 3.0, z: -7.0 }], 8, MAT.tecido, { tampaIni: true, tampaFim: true });
    }
    // 'curtinho': só a touca
  }

  /* ---------- Adornos ---------- */
  function construirAdorno(m, ap) {
    const a = ap.adorno;
    if (a === 'aureola') {   // anel com espessura (de lado continua aparecendo como um traço)
      const p = novaPeca(m, 'cabeca', 20);
      const N = 16, r = 6.4, y = 25.5, inc = -10, ci = Math.cos(inc * RAD), si = Math.sin(inc * RAD);
      const pts = [];
      for (let i = 0; i <= N; i++) { const t = (i / N) * TAU, x = Math.sin(t) * r, z = Math.cos(t) * r - 2; pts.push([x, y + z * si, z * ci]); }
      for (let i = 0; i < N; i++) tuboLivre(p, [pts[i], pts[i + 1]], [[0.55, 0.9], [0.55, 0.9]], 4, MAT.aureola, { cima: [0, 1, 0], a0: Math.PI / 4 });
    } else if (a === 'chifres') {
      [1, -1].forEach((s) => {
        const p = novaPeca(m, 'cabeca', 21);
        const base = sup(s * 38, 16.4, 1.04);
        tuboLivre(p, [base, soma(base, [s * 1.4, 4.0, -0.6]), soma(base, [s * 2.4, 7.4, -3.8]), soma(base, [s * 2.0, 8.8, -9.0])], [1.8, 1.35, 0.85, 0], 5, MAT.adorno, { tampa: true });
      });
    } else if (a === 'laco') {
      const p = novaPeca(m, 'cabeca', 22, { aberta: true });
      const c = sup(150, 18.8, 1.16);
      const n = vertA(p, c);
      [1, -1].forEach((s) => {
        const d = [s * 5.2, 2.6, -1.8], d2 = [s * 5.0, -2.2, -2.6];
        const i1 = vertA(p, soma(c, d)), i2 = vertA(p, soma(c, d2)), i3 = vertA(p, soma(c, [s * 3.2, 0.2, -3.6]));
        tri(p, n, i1, i3, MAT.adorno); tri(p, n, i3, i2, MAT.adorno); tri(p, i1, i2, i3, MAT.adorno);
        const f1 = vertA(p, soma(c, [s * 1.2, -1, -0.6])), f2 = vertA(p, soma(c, [s * 3.0, -6.4, -1.8])), f3 = vertA(p, soma(c, [s * 1.0, -5.6, -0.8]));
        tri(p, f1, f2, f3, MAT.adorno);
      });
      esfera(novaPeca(m, 'cabeca', 22), c, 1.3, MAT.adorno2, 5, 3);
    } else if (a === 'tiara') {
      const p = novaPeca(m, 'cabeca', 23);
      tubo(p, [{ y: 15.4, rx: 8.95, rz: 9.0, z: -0.1 }, { y: 16.6, rx: 8.6, rz: 8.6, z: -0.2 }], 12, MAT.adornoMetal, { a0: Math.PI / 12 });
      esfera(novaPeca(m, 'cabeca', 23), [0, 16.0, 9.3], [1.3, 1.5, 0.8], MAT.adorno2Metal, 5, 3);
    } else if (a === 'bone') {   // boné: copa grande por cima do cabelo (desce mais atrás), a faixa (segunda cor) e a aba na frente
      const k = 1.24, Y = (y) => CENTRO_CABECA[1] + (y - CENTRO_CABECA[1]) * k;
      const anelB = (y, mais) => { const r = anelCabeca(y); return { y: Y(y), rx: r.rx * k + (mais || 0), rz: r.rz * k + (mais || 0), z: r.z - 0.3 }; };
      // a boca da copa é inclinada: na testa fica alta e na nuca desce (tf: inclina o anel de baixo)
      const incl = (x, y, z) => (y < Y(13) ? [x, y + 1.8 * (z / 9.5) - 0.6, z] : [x, y, z]);
      tubo(novaPeca(m, 'cabeca', 23), [anelB(12.4), anelB(14.4), anelB(16.6), anelB(18.6), anelB(19.6)], 14, MAT.adorno,
        { tf: incl, tampaFim: [0, Y(20.2), -0.9] });
      tubo(novaPeca(m, 'cabeca', 23), [anelB(11.9, 0.3), anelB(13.0, 0.32)], 14, MAT.adorno2, { tf: incl, tampaIni: true, tampaFim: true });
      // a aba: um arco achatado na frente, com espessura, na altura da testa
      const q = novaPeca(m, 'cabeca', 23), N = 10, dentro = [], fora = [], dentro2 = [], fora2 = [];
      for (let i = 0; i <= N; i++) {
        const ang = R.lerp(-70, 70, i / N), ar = ang * RAD, r = anelCabeca(12.6), cosd = Math.cos(ar);
        const b = [Math.sin(ar) * (r.rx * k + 0.2), Y(12.6) + 1.2, r.z - 0.3 + cosd * (r.rz * k + 0.2)];
        const ext = 7.2 * Math.pow(Math.max(0, cosd), 0.9) + 0.5;
        const o = soma(b, [Math.sin(ar) * ext * 0.5, -1.4 * Math.max(0, cosd), cosd * ext]);
        dentro.push(vertA(q, b)); fora.push(vertA(q, o)); dentro2.push(vertA(q, soma(b, [0, -0.8, 0]))); fora2.push(vertA(q, soma(o, [0, -0.7, 0])));
      }
      const ref = [0, Y(12.6), 0];
      for (let i = 0; i < N; i++) {
        quad(q, dentro[i], dentro[i + 1], fora[i + 1], fora[i], MAT.adorno, 0, soma(ref, [0, -4, 0]));
        quad(q, dentro2[i], fora2[i], fora2[i + 1], dentro2[i + 1], MAT.adorno, 0, soma(ref, [0, 4, 0]));
        quad(q, fora[i], fora[i + 1], fora2[i + 1], fora2[i], MAT.adorno, 0, ref);
      }
    }
  }

  /* ---------- Asas (presas às costas: osso "asas") ---------- */
  function construirAsas(m, ap) {
    const t = ap.asas;
    if (!t || t === 'nenhuma') return;
    [1, -1].forEach((sd) => {
      const g = 26 + (sd > 0 ? 0 : 1);
      if (t === 'anjo') {   // penas em leque, presas a um "braço" da asa
        const braco = [[sd * 1.2, 0, 0], [sd * 12, 9, -6], [sd * 26, 6, -10]];
        tuboLivre(novaPeca(m, 'asas', g), braco, [1.6, 1.4, 0.6], 5, MAT.asas, { tampa: true, cima: [0, 0, 1] });
        for (let i = 0; i < 8; i++) {
          const k = i / 7, base = mistura(k < 0.5 ? braco[0] : braco[1], k < 0.5 ? braco[1] : braco[2], (k < 0.5 ? k : k - 0.5) * 2);
          const comp = 10 + k * 16, dir = norm([sd * (0.35 + k * 0.6), -1, -0.25 - k * 0.2]);
          const p = novaPeca(m, 'asas', g);
          mecha(p, base, soma(base, esc(dir, comp * 0.5)), soma(base, soma(esc(dir, comp), [0, 0, -1])), 4.6, 1.0, { mat: MAT.asas, fora: [0, 0, -1], segs: 3, afina: 0.55 });
        }
        for (let i = 0; i < 5; i++) {   // penas curtas por cima
          const k = i / 4, base = mistura(braco[0], braco[2], k * 0.85 + 0.1);
          mecha(novaPeca(m, 'asas', g), base, soma(base, [sd * 2, -3, -0.6]), soma(base, [sd * 3, -6.5, -1.2]), 4.4, 1.0, { mat: MAT.asas, fora: [0, 0, -1], segs: 2, afina: 0.5 });
        }
      } else if (t === 'demonio') {   // morcego: ossos e membrana entre os "dedos"
        const p = novaPeca(m, 'asas', g, { aberta: true });
        const ombro = [sd * 1.2, 0, 0], cot = [sd * 11, 10, -6], pulso = [sd * 22, 14, -9];
        tuboLivre(novaPeca(m, 'asas', g), [ombro, cot, pulso, [sd * 25, 18, -10]], [1.3, 1.0, 0.8, 0], 5, MAT.asas2, { tampa: true, cima: [0, 0, 1] });
        const dedos = [[sd * 30, 4, -12], [sd * 27, -6, -11], [sd * 18, -12, -8]];
        dedos.forEach((d) => tuboLivre(novaPeca(m, 'asas', g), [pulso, d], [0.6, 0], 4, MAT.asas2, { cima: [0, 0, 1] }));
        const iP = vertA(p, pulso), iO = vertA(p, ombro), iC = vertA(p, cot);
        const iD = dedos.map((d) => vertA(p, d)), iB = vertA(p, [sd * 4, -6, -2]);
        // membrana com bordas recortadas entre os dedos
        const recorte = (a, b) => vertA(p, soma(mistura(a, b, 0.5), [0, 3, 0]));
        tri(p, iP, iD[0], recorte(dedos[0], [sd * 25, 18, -10]), MAT.asas);
        tri(p, iP, iD[1], iD[0], MAT.asas); tri(p, iD[0], iD[1], recorte(dedos[0], dedos[1]), MAT.asas);
        tri(p, iP, iD[2], iD[1], MAT.asas); tri(p, iD[1], iD[2], recorte(dedos[1], dedos[2]), MAT.asas);
        tri(p, iP, iC, iD[2], MAT.asas); tri(p, iC, iB, iD[2], MAT.asas); tri(p, iC, iO, iB, MAT.asas);
      } else if (t === 'borboleta') {   // quatro lóbulos largos e redondos: o miolo na cor principal e a borda na segunda cor
        [[[sd * 1, 3, -0.4], 25, 23, 30], [[sd * 1, -0.4, -0.4], 17, 15, -52]].forEach(([b, comp, larg, ang], lobo) => {
          const p = novaPeca(m, 'asas', g, { aberta: true });
          const dir = norm([sd * Math.cos(ang * RAD), Math.sin(ang * RAD), -0.28]), perp = norm(cruz([0, 0, 1], dir));
          const N = 16, pts = [];
          for (let i = 0; i < N; i++) {   // contorno fechado: largo de um lado, mais estreito do outro, redondo na ponta
            const t2 = (i / N) * TAU, lado = Math.sin(t2) * (Math.sin(t2) > 0 ? 0.55 : 0.3) * larg;
            pts.push(soma(b, soma(esc(dir, (1 - Math.cos(t2)) * 0.5 * comp), esc(perp, lado * (lobo ? -sd : sd)))));
          }
          const cen = esc(pts.reduce((x, q) => soma(x, q), [0, 0, 0]), 1 / N);
          const c = vertA(p, cen), fora = pts.map((q) => vertA(p, q)), dentro = pts.map((q) => vertA(p, mistura(cen, q, 0.72)));
          for (let i = 0; i < N; i++) {
            const j = (i + 1) % N;
            tri(p, c, dentro[i], dentro[j], MAT.asas);
            quad(p, dentro[i], fora[i], fora[j], dentro[j], MAT.asas2);
          }
          if (!lobo) esfera(novaPeca(m, 'asas', g), soma(mistura(cen, pts[N / 2], 0.35), [0, 0, -0.2]), [2.2, 2.2, 0.3], MAT.asas2, 8, 3);   // pinta (olho)
          tuboLivre(novaPeca(m, 'asas', g), [b, mistura(b, pts[N / 2], 0.95)], [0.3, 0], 3, MAT.asas2, { cima: [0, 0, 1] });
        });
      }
    });
  }

  /* ---------- Cauda (presa ao quadril: osso "cauda") ---------- */
  function construirCauda(m, ap) {
    const t = ap.cauda;
    if (!t || t === 'nenhuma') return;
    const p = novaPeca(m, 'cauda', 28);
    if (t === 'gato') {
      tuboLivre(p, [[0, 0, 0], [0, -3, -5], [0, -3, -11], [0, 2, -16], [0, 9, -18], [0, 14, -16], [0, 15.6, -14.4]], [1.3, 1.2, 1.05, 0.95, 0.9, 0.8, 0], 6, MAT.cauda, { tampa: true, cima: [1, 0, 0] });
    } else if (t === 'raposa') {
      tuboLivre(p, [[0, 0, 0], [0, -3, -4], [0, -4, -10], [0, -1, -16]], [1.4, 3.4, 4.8, 4.4], 7, MAT.cauda, { tampa: true, cima: [1, 0, 0] });
      tuboLivre(novaPeca(m, 'cauda', 28), [[0, -1, -16], [0, 2, -19.5], [0, 5.5, -21]], [4.4, 3.0, 0], 7, MAT.cauda2, { cima: [1, 0, 0] });
    } else if (t === 'lobo') {
      tuboLivre(p, [[0, 0, 0], [0, -3, -4.5], [0, -10, -8], [0, -17, -8.5], [0, -21, -7.5]], [1.5, 3.0, 3.4, 2.6, 0], 7, MAT.cauda, { tampa: true, cima: [1, 0, 0] });
    } else if (t === 'demonio') {
      tuboLivre(p, [[0, 0, 0], [0, -6, -5], [0, -9, -13], [0, -6, -20], [0, -1, -23]], [0.9, 0.8, 0.7, 0.6, 0.5], 5, MAT.cauda, { tampa: true, cima: [1, 0, 0] });
      const q = novaPeca(m, 'cauda', 28, { aberta: true }), e = [0, -1, -23];   // ponta em forma de espada
      const a = vertA(q, soma(e, [0, 0.4, 0.6])), b = vertA(q, soma(e, [2.4, 1.6, -1.6])), c = vertA(q, soma(e, [0, 3.4, -4.4])), d = vertA(q, soma(e, [-2.4, 1.6, -1.6]));
      tri(q, a, b, c, MAT.cauda); tri(q, a, c, d, MAT.cauda);
    } else if (t === 'dragao') {
      const pts = [[0, 0, 0], [0, -4, -5], [0, -11, -10], [0, -16, -18], [0, -18, -27]];
      tuboLivre(p, pts, [3.6, 3.2, 2.4, 1.3, 0], 7, MAT.cauda, { tampa: true, cima: [1, 0, 0] });
      for (let i = 0; i < 3; i++) {   // espinhos nas costas da cauda
        const b = mistura(pts[i], pts[i + 1], 0.5), r = [3.4, 2.8, 1.8][i];
        tuboLivre(novaPeca(m, 'cauda', 28), [soma(b, [0, r * 0.7, 0]), soma(b, [0, r * 0.7 + 2.4, -1.4])], [[0.9, 1.6], 0], 4, MAT.cauda2, { tampa: true, cima: [0, 0, 1] });
      }
    } else if (t === 'coelho') {
      esfera(p, [0, 0.4, -2.2], 2.7, MAT.cauda2, 7, 4);
    } else if (t === 'touro') {   // fina, com o tufo na ponta
      const pts = [[0, 0, 0], [0, -4, -3], [0, -11, -5], [0, -18, -4.4]];
      tuboLivre(p, pts, [0.9, 0.75, 0.6, 0.5], 5, MAT.cauda, { tampa: true, cima: [1, 0, 0] });
      [[0, 0], [0.9, 1], [-0.9, 1]].forEach(([dx, k]) => mecha(novaPeca(m, 'cauda', 28), [0, -17.6, -4.4], [dx, -20, -4.6 - k * 0.4], [dx * 1.5, -24 + k, -4.2], 2.4, 1.4, { mat: MAT.cauda2, fora: [0, 0, -1], segs: 3, afina: 0.5 }));
    } else if (t === 'lagarto') {   // grossa na base, comprida, a barriga clara embaixo
      const pts = [[0, 0, 0], [0, -6, -6], [0, -14, -12], [0, -19, -22], [0, -20.5, -32]];
      tuboLivre(p, pts, [3.6, 3.0, 2.2, 1.2, 0], 7, MAT.cauda, { tampa: true, cima: [1, 0, 0] });
      tuboLivre(novaPeca(m, 'cauda', 28), pts.map((q) => soma(q, [0, -0.6, 0.3])).slice(0, 4), [[3.0, 1.6], [2.5, 1.3], [1.7, 0.9], [0.8, 0.4]], 6, MAT.cauda2, { cima: [1, 0, 0] });
    }
  }

  /* ---------- Objetos de mão (aparecem só nas poses que pedem) ---------- */
  function construirProps(m) {
    // besta (mão direita): coronha comprida do ombro até a frente, arco largo atravessado na ponta, corda e virote
    const b = novaPeca(m, 'maoD', 30, { prop: 'besta', chao: false });
    tubo(b, [{ y: 7, rx: 1.0, rz: 2.0, z: -0.2 }, { y: 3, rx: 1.0, rz: 1.6, z: 0.4 }, { y: -1, rx: 0.95, rz: 1.3, z: 0.8 }, { y: -18, rx: 0.85, rz: 1.0, z: 1.2 },
      { y: -24.5, rx: 0.75, rz: 0.85, z: 1.3 }], 4, MAT.madeira, { a0: Math.PI / 4, tampaIni: true, tampaFim: true });
    tuboLivre(b, [[0, -0.6, 0.4], [0, -1.6, -1.6], [0, -3.4, -1.4]], [0.35, 0.3, 0.25], 3, MAT.metal, { cima: [1, 0, 0] });   // gatilho
    tuboLivre(b, [[-14.5, -17.2, 1.5], [-11, -20.4, 1.5], [-6, -22.4, 1.5], [0, -23.2, 1.5], [6, -22.4, 1.5], [11, -20.4, 1.5], [14.5, -17.2, 1.5]],
      [0.45, 0.7, 0.9, 1.0, 0.9, 0.7, 0.45], 4, MAT.escuro, { cima: [0, 0, 1], tampa: true });
    tuboLivre(b, [[-14.2, -17.2, 1.6], [0, -9.4, 2.2], [14.2, -17.2, 1.6]], [0.2, 0.2, 0.2], 3, MAT.detalhes, { cima: [0, 0, 1] });
    esfera(b, [0, -23.2, 1.6], [1.5, 1.3, 1.5], MAT.metal, 5, 3);
    tuboLivre(b, [[0, -8.6, 2.6], [0, -26, 2.6], [0, -29.4, 2.6]], [0.4, 0.4, 0], 4, MAT.metal, { cima: [1, 0, 0], tampa: true });
    tri(b, vertA(b, [0, -8.8, 2.8]), vertA(b, [0, -12.4, 2.8]), vertA(b, [0, -8.2, 4.4]), MAT.detalhes);   // pena do virote
    // poção (mão direita)
    const p = novaPeca(m, 'maoD', 31, { prop: 'pocao', chao: false });
    esfera(p, [0, -3.2, 1.9], [1.9, 2.0, 1.9], MAT.vidro, 6, 4);
    tuboLivre(p, [[0, -3.2, 3.4], [0, -3.2, 4.6], [0, -3.2, 5.4]], [0.8, 0.8, 0.8], 5, MAT.madeira, { cima: [0, 1, 0], tampa: true });
    // celular (no lobby): na palma da mão direita, com a tela acesa virada para o rosto
    const c = novaPeca(m, 'maoD', 33, { prop: 'celular', chao: false });
    caixa(c, -2.1, 2.1, -9.4, -1.4, 0.2, 1.1, MAT.escuro);
    caixa(c, -1.7, 1.7, -8.8, -2.0, 1.1, 1.3, MAT.tela);
    // orbe de magia (na mão erguida)
    const o = novaPeca(m, 'maoD', 32, { prop: 'orbe', chao: false });
    esfera(o, [0, -9.4, 1.2], 4.6, MAT.brilho, 8, 5);
    // raios de luz em volta
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + 0.3, r1 = 5.4, r2 = i % 2 ? 8.6 : 11.4, c = [0, -9.4, 1.2];
      const d = [Math.cos(a), Math.sin(a) * 0.85, Math.sin(a * 2 + 1.1) * 0.5];
      tuboLivre(o, [soma(c, esc(d, r1)), soma(c, esc(d, r2))], [0.7, 0], 3, MAT.brilho, { cima: [0, 0, 1] });
    }
    // orbe de trevas (as magias do necromante): a bola roxa e fiapos escuros girando em volta
    const tv = novaPeca(m, 'maoD', 33, { prop: 'trevas', chao: false });
    esfera(tv, [0, -9.4, 1.2], 4.2, MAT.trevas, 8, 5);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU, c = [0, -9.4, 1.2], d = [Math.cos(a), Math.sin(a) * 0.9, Math.sin(a * 3) * 0.4];
      tuboLivre(tv, [soma(c, esc(d, 4.4)), soma(c, esc([d[0] + d[1] * 0.6, d[1] - d[0] * 0.6, d[2]], 7.6)), soma(c, esc([d[0] + d[1] * 1.4, d[1] - d[0] * 1.4, d[2]], 9.4))],
        [0.9, 0.5, 0], 3, MAT.escuro, { cima: [0, 0, 1] });
    }
  }

  /* ---------- Armas e partes dos monstros (js/jogo/monstros.js) ----------
     extra: { armas: { D, E } (adaga, espada, maca, machado, tacape, lanca; escudo vai no antebraço), presas, garras,
     ajuste: { bracoL: 1.3… } (multiplica as proporções do corpo) }. As armas ficam sempre à mostra (não são adereços de
     pose), não encostam no chão e não crescem com a mão. Na mão, a empunhadura atravessa o punho de trás para a frente
     (eixo z: o polegar fica na frente) e a lâmina fica de pé (a largura em y), virada para a câmera. */
  const ARMA_INCLINA = { adaga: 40, espada: 40, maca: 35, machado: 25, tacape: 35, lanca: 75 };   // a ponta inclinada para os dedos (graus)
  /* chapa achatada: o contorno [[a, b], …] (no plano da arma) com espessura e (estrelado a partir do primeiro ponto) */
  function chapa(p, P, cont, e, mat) {
    const fr = cont.map(([a, b]) => vertA(p, P(a, b, e))), tr = cont.map(([a, b]) => vertA(p, P(a, b, -e)));
    const ref = P(cont[0][0], cont[0][1], 0), n = cont.length;
    for (let i = 1; i < n - 1; i++) { tri(p, fr[0], fr[i], fr[i + 1], mat, 0, ref); tri(p, tr[0], tr[i + 1], tr[i], mat, 0, ref); }
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; quad(p, fr[i], fr[j], tr[j], tr[i], mat, 0, ref); }
  }
  const ARMAS = {
    adaga(p, P, ax, bx) {
      tuboLivre(p, [P(-2.3), P(-1.9), P(1.9), P(2.3)], [0.72, 0.56, 0.56, 0.62], 6, MAT.cabo, { tampa: true, cima: bx });
      esfera(p, P(-2.7), 0.8, MAT.ferro, 5, 3);
      tuboLivre(p, [P(2.6, -2.0), P(2.6, 2.0)], [0.42, 0.42], 4, MAT.ferro, { tampa: true, cima: ax });
      tuboLivre(p, [P(2.8), P(5.2), P(8.4), P(10.8)], [[0.24, 1.0], [0.22, 0.96], [0.18, 0.66], 0], 4, MAT.lamina, { tampa: true, cima: bx });
    },
    espada(p, P, ax, bx) {
      tuboLivre(p, [P(-3.1), P(-2.7), P(2.9), P(3.2)], [0.76, 0.6, 0.6, 0.7], 6, MAT.cabo, { tampa: true, cima: bx });
      esfera(p, P(-3.6), 0.95, MAT.ferro, 6, 3);
      tuboLivre(p, [P(3.5, -3.6), P(3.5, 0), P(3.5, 3.6)], [0.5, 0.62, 0.5], 4, MAT.ferro, { tampa: true, cima: ax });
      [-3.8, 3.8].forEach((b) => esfera(p, P(3.5, b), 0.7, MAT.ferro, 5, 3));
      tuboLivre(p, [P(3.8), P(10), P(18), P(25.4), P(28.6)], [[0.3, 1.5], [0.3, 1.42], [0.28, 1.28], [0.26, 1.08], 0], 4, MAT.lamina, { tampa: true, cima: bx });
    },
    maca(p, P, ax, bx) {
      tuboLivre(p, [P(-3.4), P(-3.0), P(15.6), P(16.2)], [0.85, 0.66, 0.74, 0.95], 6, MAT.madeira, { tampa: true, cima: bx });
      tuboLivre(p, [P(-2.6), P(2.6)], [0.74, 0.74], 6, MAT.cabo, { tampa: true, cima: bx });
      const c = P(18.2), cx = norm(cruz(ax, bx));
      esfera(p, c, [2.8, 2.8, 2.8], MAT.ferro, 8, 5);
      for (let i = 0; i < 6; i++) {   // flanges em volta e a ponta
        const a = (i / 6) * TAU, d = soma(esc(bx, Math.cos(a)), esc(cx, Math.sin(a)));
        tuboLivre(p, [soma(c, esc(d, 2.1)), soma(c, esc(d, 4.5))], [[1.0, 1.7], 0], 4, MAT.ferro, { tampa: true, cima: ax });
      }
      tuboLivre(p, [P(20.4), P(22.6)], [0.9, 0], 4, MAT.ferro, { tampa: true, cima: bx });
    },
    machado(p, P, ax, bx) {   // machado de guerra (duas mãos): cabo longo, lâmina larga em meia-lua e o esporão atrás
      tuboLivre(p, [P(-10.5), P(-10), P(26), P(27.2)], [0.85, 0.72, 0.78, 0.6], 6, MAT.madeira, { tampa: true, cima: bx });
      [[-2.4, 2.4], [8, 11]].forEach(([a0, a1]) => tuboLivre(p, [P(a0), P(a1)], [0.86, 0.86], 6, MAT.cabo, { tampa: true, cima: bx }));
      tuboLivre(p, [P(18.6), P(25.2)], [1.25, 1.25], 6, MAT.ferro, { tampa: true, cima: bx });
      chapa(p, P, [[21.9, 1.0], [18.2, 1.4], [14.8, 4.6], [13.6, 9.2], [16.4, 11.4], [21.9, 10.6], [27.4, 11.4], [30.4, 9.2], [29.2, 4.6], [25.6, 1.4]], 0.34, MAT.lamina);
      chapa(p, P, [[21.9, -1.0], [20.4, -1.1], [21.6, -5.6], [22.3, -5.6], [23.4, -1.1]], 0.42, MAT.ferro);
    },
    tacape(p, P, ax, bx) {   // tacape: tora que engrossa até a ponta, com nós
      tubo(p, [{ y: -3, rx: 1.0 }, { y: 3, rx: 1.05 }, { y: 8, rx: 1.6 }, { y: 14, rx: 2.5 }, { y: 20, rx: 3.3 }, { y: 24.5, rx: 3.5 }, { y: 26.5, rx: 2.6 }], 7,
        MAT.madeira, { tampaIni: true, tampaFim: true, tf: (x, y, z) => P(y, x, z) });
      tuboLivre(p, [P(-2.4), P(2.4)], [1.25, 1.25], 6, MAT.cabo, { tampa: true, cima: bx });
      const cx = norm(cruz(ax, bx));
      [[12, 0.3], [17, 2.6], [21, 4.4], [23.5, 1.2], [19, 5.8], [15, 3.9]].forEach(([a, ang]) => {
        const r = 1.6 + a * 0.06, d = soma(esc(bx, Math.cos(ang)), esc(cx, Math.sin(ang)));
        esfera(p, soma(P(a), esc(d, r)), 0.9 + a * 0.02, MAT.cabo, 5, 3);
      });
    },
    lanca(p, P, ax, bx) {
      tuboLivre(p, [P(-16.5), P(-16), P(29), P(29.6)], [0.6, 0.52, 0.52, 0.56], 6, MAT.madeira, { tampa: true, cima: bx });
      tuboLivre(p, [P(28.4), P(30.4)], [0.7, 0.7], 6, MAT.cabo, { tampa: true, cima: bx });
      tuboLivre(p, [P(30.2), P(32.4), P(35.2), P(37.6)], [[0.26, 0.9], [0.26, 1.45], [0.22, 0.9], 0], 4, MAT.lamina, { tampa: true, cima: bx });
    },
  };
  /* escudo pesado: redondo, de madeira com o aro e o umbo de ferro, empunhado pelo centro — o antebraço aponta para o
     meio dele (com o braço para a frente, ele fica de frente) */
  function escudo(m, l, s, k) {
    const p = novaPeca(m, 'mao' + l, 36, { chao: false, fixo: true });
    const c0 = [s * -0.4 * k, -2.6 * k, 0.2 * k], Y = (d) => [c0[0], c0[1] - d, c0[2]];
    tuboLivre(p, [Y(0.6), Y(1.3), Y(2.0), Y(3.2), Y(3.7)], [9.6, 10.2, 9.8, 5.4, 0], 12, MAT.madeira, { tampa: true, cima: [0, 0, 1] });
    tuboLivre(p, [Y(0.9), Y(2.0)], [10.8, 10.8], 12, MAT.ferro, { tampa: true, cima: [0, 0, 1] });
    esfera(p, Y(3.6), [2.2, 2.2, 2.2], MAT.ferro, 7, 4);
    tuboLivre(p, [Y(2.1), Y(2.5)], [[0.6, 9.8], [0.6, 9.8]], 4, MAT.ferro, { tampa: true, cima: [0, 0, 1] });   // tira de ferro atravessada
  }
  function construirExtras(m, c, ap, extra) {
    const A = extra.armas || {}, k = c.mao || 1;
    [['E', 1], ['D', -1]].forEach(([l, s]) => {
      const t = A[l];
      if (!t) return;
      if (t === 'escudo') { escudo(m, l, s, k); return; }
      if (!ARMAS[t]) return;
      const G = [s * -0.45 * k, -2.9 * k, 0.15 * k], ang = (ARMA_INCLINA[t] || 0) * RAD;
      const ax = [0, -Math.sin(ang), Math.cos(ang)], bx = [0, Math.cos(ang), Math.sin(ang)], cx = [1, 0, 0];
      const P = (a, b, e) => soma(G, soma(esc(ax, a), soma(esc(bx, b || 0), esc(cx, e || 0))));
      ARMAS[t](novaPeca(m, 'mao' + l, 36, { chao: false, fixo: true }), P, ax, bx, s);
    });
    if (extra.presas) {   // presas de baixo, saindo do queixo para cima (orc, ogro)
      const p = novaPeca(m, 'cabeca', 37, { chao: false });
      [1, -1].forEach((sd) => tuboLivre(p, [[sd * 2.7, 3.4, 7.0], [sd * 2.9, 5.0, 8.3], [sd * 3.3, 6.9, 8.4]], [0.85, 0.6, 0], 5, MAT.presa, { tampa: true, cima: [1, 0, 0] }));
    }
    if (extra.garras) [['E', 1], ['D', -1]].forEach(([l, s]) => {   // garras compridas saindo dos dedos (troll)
      const p = novaPeca(m, 'mao' + l, 36, { chao: false, fixo: true });
      [-0.75, 0, 0.75].forEach((dz) => tuboLivre(p, [[s * -0.8 * k, -4.4 * k, dz * k], [s * -1.5 * k, -7.6 * k, (dz + 0.7) * k], [s * -2.6 * k, -10.2 * k, (dz + 1.9) * k]],
        [0.5 * k, 0.36 * k, 0], 4, MAT.garra, { tampa: true, cima: [0, 0, 1] }));
    });
  }

  /* ---------- Modelo completo ---------- */
  /* A malha depende só da forma (corpo, penteado, peças…); as cores ficam na paleta. Assim, mudar uma cor no
     seletor não remonta a malha. */
  const FORMA = ['corpo', 'estatura', 'busto', 'curvas', 'marcas', 'orelhas', 'orelhasPos', 'barba', 'cabeloFrente', 'franja', 'cabeloTras', 'adorno', 'mascara', 'peito', 'casaco', 'capa', 'capuz', 'capuzForma', 'ombros', 'luvas',
    'pernas', 'saia', 'meias', 'cinto', 'cintoPos', 'calcados', 'emblema', 'colar', 'joias', 'costas', 'asas', 'cauda'];
  const formas = new Map();
  function malha(ap, agua, extra) {
    const chave = FORMA.map((k) => (k === 'busto' || k === 'franja' ? Math.round((+ap[k] || 0) * 10) : k === 'estatura' ? estaturaDe(ap) : k === 'curvas' ? curvasDe(ap) : ap[k])).join('|') + (agua ? '|agua' : '') +
      (extra ? '|' + JSON.stringify(extra) : '');
    let g = formas.get(chave);
    if (g) { formas.delete(chave); formas.set(chave, g); return g; }
    const corpo = proporcoes(ap);
    if (extra && extra.ajuste) for (const k in extra.ajuste) corpo[k] = (corpo[k] || 1) * extra.ajuste[k];
    g = { pecas: [] };
    g.esqueleto = esqueleto(corpo, ap);
    g.idx = {};
    g.esqueleto.forEach((o, i) => { g.idx[o.nome] = i; });
    construirCorpo(g, corpo, ap);
    construirCapa(g, corpo, ap);
    construirCapuz(g, corpo, ap);
    construirOmbros(g, corpo, ap);
    construirColar(g, corpo, ap);
    construirJoias(g, corpo, ap);
    construirCostas(g, corpo, ap);
    construirCabeca(g, ap);
    construirCabelo(g, ap);
    construirAdorno(g, ap);
    construirAsas(g, ap);
    if (agua) caudaDeSereia(g, corpo, ap); else construirCauda(g, ap);
    construirProps(g);
    if (extra) construirExtras(g, corpo, ap, extra);
    // marcas na pele (manchas, escamas, listras): pintadas em toda a pele (efeito 5)
    if (ap.marcas !== 'nenhuma' && ap.marcas !== 'sardas') g.pecas.forEach((p) => { for (let k = 0; k < p.t.length; k += 5) if (p.t[k + 3] === MAT.pele && !p.t[k + 4]) p.t[k + 4] = 5; });
    if (ap.corpo === 'osteon') ossos(g);
    g.pecas = g.pecas.filter((p) => p.t.length);
    g.pecas.forEach((p) => {
      const e = p.prop || p.fixo ? null : escalaDoOsso(corpo, g.esqueleto[p.osso].nome);   // a besta, a poção e as armas não crescem com a mão
      if (e) for (let k = 0; k < p.v.length; k += 3) { p.v[k] *= e[0]; p.v[k + 1] *= e[1]; p.v[k + 2] *= e[2]; }
      if (e && e[0] === e[1] && e[1] === e[2]) p.ik = 1 / e[0];   // a pintura dos dedos usa as medidas de antes da escala
      const nome = g.esqueleto[p.osso].nome;   // anatomia pintada na pele (ver "anatomia" em renderizar)
      const ANAT = { peito: 1, tronco: 2, bracoE: 3, bracoD: -3, antebracoE: 4, antebracoD: -4, coxaE: 5, coxaD: -5, canelaE: 6, canelaD: -6 };
      p.anat = ANAT[nome] || 0;
      p.vf = Float32Array.from(p.v); p.tf = Int32Array.from(p.t); p.uvf = Float32Array.from(p.uv);
      p.nf = normaisSuaves(p);
    });
    g.cabeca = corpo.cabeca; g.pe = corpo.pe;
    g.colisao = medirColisao(g);
    g.nTri = g.pecas.reduce((s, p) => s + p.t.length / 5, 0);
    formas.set(chave, g);
    if (formas.size > 40) formas.delete(formas.keys().next().value);
    return g;
  }
  /* Volumes do corpo para o pano e o cabelo desviarem, medidos na malha (com a calça, a bota e o casaco):
     - pernas: cápsulas da coxa (do primeiro quarto ao joelho: o alto dela fica dentro do quadril), da canela e do pé;
     - quadril: uma cápsula em pé (o raio sai de cada saia: um pouco menos que a cintura dela), para o pano não entrar
       no corpo quando o quadril inclina;
     - tronco: elipses (largura, frente e costas) no espaço do peito e da barriga, para o cabelo e a capa;
     - cabelos: de cada osso de cabelo (e da capa), o comprimento, alguns pontos para testar a colisão e, em cada peça,
       quanto cada vértice está para a ponta (0 na raiz, 1 na ponta: é o quanto ele dobra). */
  const OSSOS_CABELO = ['cabeloT', 'cabeloE', 'cabeloD', 'capa'];
  function medirColisao(g) {
    const E = g.esqueleto, idx = g.idx;
    const doOsso = (nome) => g.pecas.filter((p) => p.osso === idx[nome] && !p.prop && !p.pano);
    const percentil = (lista, q) => { if (!lista.length) return 0; lista.sort((a, b) => a - b); return lista[Math.min(lista.length - 1, Math.floor(lista.length * q))]; };
    const raio = (nome, a, b, q) => {
      const d = [];
      doOsso(nome).forEach((p) => { for (let k = 0; k < p.vf.length; k += 3) d.push(distPontoSeg(p.vf[k], p.vf[k + 1], p.vf[k + 2], a, b)); });
      return percentil(d, q || 0.85);
    };
    const pernas = [];
    ['E', 'D'].forEach((l) => {
      const joelho = E[idx['canela' + l]].off, tornozelo = E[idx['pe' + l]].off;
      pernas.push({ osso: idx['coxa' + l], a: esc(joelho, 0.25), b: joelho.slice(), r: raio('coxa' + l, [0, 0, 0], joelho) });
      pernas.push({ osso: idx['canela' + l], a: [0, 0, 0], b: tornozelo.slice(), r: raio('canela' + l, [0, 0, 0], tornozelo) });
      // pé: do calcanhar à ponta da bota, na altura do meio dela
      let z0 = Infinity, z1 = -Infinity, ys = 0, n = 0;
      doOsso('pe' + l).forEach((p) => { for (let k = 0; k < p.vf.length; k += 3) { z0 = Math.min(z0, p.vf[k + 2]); z1 = Math.max(z1, p.vf[k + 2]); ys += p.vf[k + 1]; n++; } });
      if (n) {
        const y = ys / n, a = [0, y, z0 + (z1 - z0) * 0.2], b = [0, y, z1 - (z1 - z0) * 0.15];
        pernas.push({ osso: idx['pe' + l], a, b, r: Math.max(1.5, raio('pe' + l, a, b, 0.7)) });
      }
    });
    const quadril = { osso: idx.raiz, a: [0, 2, 0], b: [0, -7, 0] };
    // tronco: elipses de largura (x) e profundidade (z, da frente e de trás) nos ossos do peito e da barriga
    const elipse = (nome, y0, y1) => {
      const xs = [], zs = [];
      doOsso(nome).forEach((p) => { for (let k = 0; k < p.vf.length; k += 3) if (p.vf[k + 1] >= y0 && p.vf[k + 1] <= y1) { xs.push(Math.abs(p.vf[k])); zs.push(p.vf[k + 2]); } });
      if (!xs.length) return null;
      const zf = percentil(zs.slice(), 0.92), zt = percentil(zs.slice(), 0.06);
      return { osso: idx[nome], y0, y1, rx: percentil(xs, 0.9) + 0.6, cz: (zf + zt) / 2, rz: (zf - zt) / 2 + 0.8 };
    };
    const tronco = [elipse('peito', -1, 13.5), elipse('tronco', -1, 8)].filter(Boolean);
    const cabelos = [];
    OSSOS_CABELO.forEach((nome) => {
      const pecas = g.pecas.filter((p) => p.osso === idx[nome]);
      if (!pecas.length) return;
      let L = 1;
      pecas.forEach((p) => { for (let k = 1; k < p.vf.length; k += 3) L = Math.max(L, -p.vf[k]); });
      const todos = [];
      pecas.forEach((p) => {
        p.dobra = new Float32Array(p.vf.length / 3);
        for (let k = 0; k < p.dobra.length; k++) {
          const t = R.clamp(-p.vf[k * 3 + 1] / L, 0, 1);
          p.dobra[k] = t;
          if (t > 0.3) todos.push(p.vf[k * 3], p.vf[k * 3 + 1], p.vf[k * 3 + 2], t);
        }
      });
      const passo = Math.max(1, Math.floor(todos.length / 4 / 36));
      const amostras = [];
      for (let i = 0; i < todos.length; i += 4 * passo) amostras.push(todos[i], todos[i + 1], todos[i + 2], todos[i + 3]);
      cabelos.push({ osso: idx[nome], nome, L, amostras: Float32Array.from(amostras) });
    });
    return { pernas, quadril, tronco, cabelos };
  }
  /* distância do ponto (x, y, z) ao segmento a → b */
  function distPontoSeg(x, y, z, a, b) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], l2 = ux * ux + uy * uy + uz * uz;
    let t = l2 > 1e-9 ? ((x - a[0]) * ux + (y - a[1]) * uy + (z - a[2]) * uz) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = x - (a[0] + ux * t), dy = y - (a[1] + uy * t), dz = z - (a[2] + uz * t);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /* normal de cada vértice: a média das faces em volta (pesada pela área). É o que deixa a pintura da sombra macia.
     p.proxy: a normal puxa para a de um volume simples (como quem modela nesse estilo faz com o cabelo e o rosto): o
     cabelo inteiro e o rosto são sombreados como uma bola lisa, sem as faces de cada mecha brigando entre si.
     { c: centro, r: raios (elipsoide) ou eixo: true (cilindro em volta do eixo y, para o cabelo pendurado), k: quanto } */
  function normaisSuaves(p) {
    const v = p.vf, t = p.tf, N = new Float32Array(v.length);
    for (let k = 0; k < t.length; k += 5) {
      const a = t[k] * 3, b = t[k + 1] * 3, c = t[k + 2] * 3;
      const ux = v[b] - v[a], uy = v[b + 1] - v[a + 1], uz = v[b + 2] - v[a + 2], wx = v[c] - v[a], wy = v[c + 1] - v[a + 1], wz = v[c + 2] - v[a + 2];
      const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
      [a, b, c].forEach((i) => { N[i] += nx; N[i + 1] += ny; N[i + 2] += nz; });
    }
    for (let i = 0; i < N.length; i += 3) { const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1; N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; }
    const P = p.proxy;
    if (P) for (let i = 0; i < N.length; i += 3) {
      let qx = v[i] - P.c[0], qy = P.eixo ? 0.35 : v[i + 1] - P.c[1], qz = v[i + 2] - P.c[2];
      if (P.r) { qx /= P.r[0] * P.r[0]; qy /= P.r[1] * P.r[1]; qz /= P.r[2] * P.r[2]; }
      const lq = Math.hypot(qx, qy, qz) || 1;
      let nx = N[i] * (1 - P.k) + (qx / lq) * P.k, ny = N[i + 1] * (1 - P.k) + (qy / lq) * P.k, nz = N[i + 2] * (1 - P.k) + (qz / lq) * P.k;
      const l = Math.hypot(nx, ny, nz) || 1;
      N[i] = nx / l; N[i + 1] = ny / l; N[i + 2] = nz / l;
    }
    return N;
  }
  /* op.agua: forma aquática (só sereia/tritão): a cauda de peixe no lugar das pernas. O jogo pede quando o
     personagem entra na água. */
  M3.criarModelo = function (ap, op) {
    const agua = !!(op && op.agua) && ap.raca === 'sereia';
    const g = malha(ap, agua, op && op.extra);
    return { pecas: g.pecas, esqueleto: g.esqueleto, idx: g.idx, nTri: g.nTri, colisao: g.colisao, ap, pal: paleta(ap), rosto: coresRosto(ap), altura: R.clamp(+ap.altura || 1, 0.8, 1.2),
      asasA: R.clamp(+ap.asasAltura || 1, 0.4, 2.2), asasL: R.clamp(+ap.asasLargura || 1, 0.4, 2.2), cabeca: g.cabeca, pe: g.pe, agua };
  };
  M3.temFormaAgua = (ap) => !!ap && ap.raca === 'sereia';

  /* Pontos do esqueleto padrão numa pose, no espaço do modelo: as raízes dos cabelos e da capa, a cabeça e o quadril.
     É o que a dinâmica do cabelo e do pano (poses.js) usa para saber como cada ponto se move ao longo de uma animação. */
  let esqPadrao = null;
  function padrao() {
    if (!esqPadrao) {
      const ap = Object.assign({}, R.APARENCIA_PADRAO, { cabeloTras: 'longo' }), c = proporcoes(ap), O = esqueleto(c, ap), idx = {};
      O.forEach((o, i) => { idx[o.nome] = i; });
      esqPadrao = { esqueleto: O, idx, pecas: [], pe: c.pe, cabeca: c.cabeca, altura: 1 };
    }
    return esqPadrao;
  }
  M3.pontosDaPose = function (pose) {
    const E = padrao(), W = ossosDaPose(E, pose), I = E.idx, pt = (n) => [W[I[n]][3], W[I[n]][7], W[I[n]][11]];
    return { cabeloT: pt('cabeloT'), cabeloE: pt('cabeloE'), cabeloD: pt('cabeloD'), capa: pt('capa'), raiz: pt('raiz'), cabeca: pt('cabeca') };
  };
  /* Onde pontos de ossos ficam na tela, na câmera do jogo (o esqueleto padrão): [[x, y], …] em pixels do jogo a partir do
     pé do sprite, x para a frente (para onde o herói olha) e y para cima. pts: [[osso, [x, y, z]], …] no espaço do osso.
     Serve aos efeitos presos ao corpo (o rastro do olho e o dedo da Marca da Presa). */
  M3.pontosNaTela = function (pose, pts) {
    const E = padrao(), W = ossosDaPose(E, pose), V = mul(rotX(M3.CAMERA.pitch), rotY(M3.CAMERA.yaw));
    return pts.map(([osso, p]) => { const q = aplicar(mul(V, W[E.idx[osso]]), p[0], p[1], p[2]); return [q[0], q[1]]; });
  };

  /* Medidas do modelo parado (de frente), em unidades do jogo: altura (alto do crânio), topo (o ponto mais alto,
     com cabelo, chifres e auréola), cabeça (do queixo ao alto do crânio), queixo, ombros (largura de fora a fora),
     cabeçaL (largura da cabeça), quadril (altura da articulação), joelho. Serve para a setinha "P1" acima do herói e
     para conferir as proporções. */
  const MEDIDAS = new Map();
  M3.medidas = function (ap) {
    const chave = JSON.stringify(ap);
    if (MEDIDAS.has(chave)) return MEDIDAS.get(chave);
    const m = M3.criarModelo(ap);
    const W = ossosDaPose(m, R.POSES.neutra || R.POSES.poses[R.POSES.anims.idle[0]]);
    const pt = (n, p) => aplicar(W[m.idx[n]], p[0], p[1], p[2]);
    const queixo = pt('cabeca', [0, 0.5, 0])[1], alto = pt('cabeca', TOPO_CABECA)[1];
    let topo = alto, ombroX = 0;
    m.pecas.forEach((p) => {
      if (p.prop) return;
      const nome = m.esqueleto[p.osso].nome, M = W[p.osso], v = p.vf;
      const cab = nome === 'cabeca' || /^cabelo/.test(nome), braco = /^braco/.test(nome);
      if (!cab && !braco) return;
      for (let k = 0; k < v.length; k += 3) {
        const q = aplicar(M, v[k], v[k + 1], v[k + 2]);
        if (cab && q[1] > topo) topo = q[1];
        if (braco && Math.abs(q[0]) > ombroX) ombroX = Math.abs(q[0]);
      }
    });
    const r = { altura: alto, topo, cabeca: alto - queixo, queixo, ombros: ombroX * 2, cabecaL: 2 * 9.1 * (m.cabeca || 1),
      quadril: pt('coxaE', [0, 0, 0])[1], joelho: pt('canelaE', [0, 0, 0])[1], cintura: pt('tronco', [0, 0, 0])[1] };
    r.cabecas = r.altura / r.cabeca;
    MEDIDAS.set(chave, r);
    if (MEDIDAS.size > 60) MEDIDAS.delete(MEDIDAS.keys().next().value);
    return r;
  };

  /* forma aquática: tira as pernas (e o que vai nelas) e põe a cauda de peixe inteira, com a nadadeira em leque */
  function caudaDeSereia(g, c, ap) {
    const pernas = /^(coxa|canela|pe)[ED]$/;
    g.pecas = g.pecas.filter((p) => !pernas.test(g.esqueleto[p.osso].nome));
    const q = c.quadril, esc9 = (p) => { for (let k = 4; k < p.t.length; k += 5) if (p.t[k - 1] === MAT.cauda) p.t[k] = 9; };
    const a = novaPeca(g, 'peixe', 12);
    tubo(a, [{ y: 3.4, rx: q * 0.98, rz: 5.8 }, { y: -5, rx: q * 1.04, rz: 6.3, z: 0.2 }, { y: -13, rx: q * 0.88, rz: 5.6, z: 0.2 }, { y: -21.6 * c.perna, rx: q * 0.68, rz: 4.6 }], 10,
      MAT.cauda, { tampaIni: true });
    esc9(a);
    const b = novaPeca(g, 'peixe2', 13);
    tubo(b, [{ y: 1.6, rx: q * 0.7, rz: 4.7 }, { y: -8, rx: q * 0.52, rz: 3.8 }, { y: -16 * c.perna, rx: q * 0.33, rz: 2.6 }, { y: -22 * c.perna, rx: q * 0.2, rz: 1.6 }], 10,
      MAT.cauda, { tampaFim: true });
    esc9(b);
    // nadadeira em leque no fim, e duas pequenas dos lados do joelho
    const f = novaPeca(g, 'peixe2', 14, { aberta: true }), y0 = -21 * c.perna, c0 = vertA(f, [0, y0, 0]);
    [1, -1].forEach((sd) => {
      const p1 = vertA(f, [sd * 5, y0 - 4, 1.2]), p2 = vertA(f, [sd * 11.5, y0 - 11, 3.2]), p3 = vertA(f, [sd * 9, y0 - 13.5, 2.6]), p4 = vertA(f, [sd * 3.2, y0 - 9, 1.0]);
      tri(f, c0, p1, p2, MAT.cauda2); tri(f, c0, p2, p3, MAT.cauda2); tri(f, c0, p3, p4, MAT.cauda2);
      const l = novaPeca(g, 'peixe2', 14, { aberta: true });
      tri(l, vertA(l, [sd * q * 0.62, 0, 0]), vertA(l, [sd * (q * 0.62 + 5), -4, -1.4]), vertA(l, [sd * q * 0.5, -6.5, 0]), MAT.cauda2);
    });
  }

  /* osteon: os membros que estão à mostra (só pele) afinam até virar osso, com bolinhas nas juntas */
  function ossos(g) {
    const finos = new Set();
    g.pecas.forEach((p) => {
      const nome = g.esqueleto[p.osso].nome, n = nome.replace(/[ED]$/, '');
      if (!/^(braco|antebraco|coxa|canela|pescoco)$/.test(n) || p.mecha) return;
      for (let k = 3; k < p.t.length; k += 5) if (p.t[k] !== MAT.pele) return;
      const f = n === 'pescoco' ? 0.55 : 0.42;
      for (let k = 0; k < p.v.length; k += 3) { p.v[k] *= f; p.v[k + 2] *= f; }
      finos.add(nome);
    });
    ['antebracoE', 'antebracoD', 'canelaE', 'canelaD'].forEach((n) => { if (finos.has(n)) esfera(novaPeca(g, n, 1), [0, 0.3, 0], n[0] === 'a' ? 1.25 : 1.6, MAT.pele, 6, 3); });
  }

  /* =====================================================================
     POSE → MATRIZES DOS OSSOS
     ===================================================================== */
  const ZERO = [0, 0, 0];
  function rotacaoOsso(o, g) {
    if (o.tipo === 'cima') return rot(g[0], g[1], g[2]);
    if (o.tipo === 'membro') return rot(o.sx * g[0], o.lado * g[1], o.lado * g[2]);
    return rot(-g[0], o.lado * g[1], o.lado * g[2]);   // cabelo: pende para baixo, x+ = balança para a frente
  }
  const PONTOS_PE = [[0, -3.4, -2.8], [0, -3.4, 7.0], [1.8, -3.3, 2], [-1.8, -3.3, 2]];
  const escalar = (M, x, y, z) => { M[0] *= x; M[4] *= x; M[8] *= x; M[1] *= y; M[5] *= y; M[9] *= y; M[2] *= z; M[6] *= z; M[10] *= z; };
  function ossosDaPose(m, pose) {
    const O = m.esqueleto, W = new Array(O.length);
    const raizR = pose.raiz || ZERO;
    for (let i = 0; i < O.length; i++) {
      const o = O[i];
      let g = anguloCabelo(o, pose) || pose[o.nome] || ZERO;
      if (o.tipo === 'segue') { const r = pose[o.ref] || ZERO; g = [R.clamp(r[0] * 0.8, -28, 42), 0, R.clamp(r[2] * 0.6, -10, 14)]; }
      if (o.tipo === 'media') {   // cauda de peixe: média das coxas (o primeiro gomo) e das canelas (o segundo, como um joelho)
        const n = o.nome === 'peixe' ? 'coxa' : 'canela', a = pose[n + 'E'] || ZERO, b = pose[n + 'D'] || ZERO, x = (a[0] + b[0]) / 2;
        g = o.nome === 'peixe' ? [-R.clamp(x * 0.8, -40, 80), 0, 0] : [R.clamp(x * 0.7, 0, 70), 0, 0];
      }
      const Rl = o.tipo === 'segue' ? rot(o.sx * g[0], 0, o.lado * g[2]) : o.tipo === 'media' ? rot(g[0], 0, 0) : rotacaoOsso(o, g);
      if (o.paiI < 0) { const p = pose.raizP || ZERO; W[i] = mul(trans(o.off[0] + p[0], o.off[1] + p[1], o.off[2] + p[2]), Rl); }
      else if (o.tipo === 'cabelo') {
        const pos = aplicar(W[o.paiI], o.off[0], o.off[1], o.off[2]);
        W[i] = mul(trans(pos[0], pos[1], pos[2]), mul(rotY(raizR[1]), Rl));
      } else W[i] = mul(W[o.paiI], mul(trans(o.off[0], o.off[1], o.off[2]), Rl));
      // escalas no espaço do osso (colunas da matriz): largura e altura das asas, tamanho da cabeça (e do cabelo preso nela)
      if (o.nome === 'asas' && (m.asasL !== 1 || m.asasA !== 1)) escalar(W[i], m.asasL, m.asasA, Math.sqrt(m.asasL * m.asasA));
      if (m.cabeca && m.cabeca !== 1) {
        if (o.nome === 'cabeca') escalar(W[i], m.cabeca, m.cabeca, m.cabeca);
        // cabelo pendurado (rabo, marias, cortina de trás): a largura acompanha a cabeça, o comprimento cresce menos
        // (senão, com a cabeça grande do estilo, os cabelos compridos arrastariam no chão)
        else if (o.tipo === 'cabelo' && o.pai === 'cabeca') escalar(W[i], m.cabeca, 1 + (m.cabeca - 1) * 0.3, m.cabeca);
      }
    }
    // pés no chão: desce/sobe o corpo inteiro até o ponto mais baixo encostar em y = 0
    if (pose.chao !== false) {
      let min = Infinity;
      if (pose.chao === 'corpo' || m.agua) {   // na água não há pés: o ponto mais baixo (a cauda) encosta
        m.pecas.forEach((p) => {
          if (p.prop || !p.chao || p.grupo >= 20) return;
          const M = W[p.osso], v = p.vf;
          for (let k = 0; k < v.length; k += 3) { const y = M[4] * v[k] + M[5] * v[k + 1] + M[6] * v[k + 2] + M[7]; if (y < min) min = y; }
        });
      } else {
        const kp = m.pe || 1;
        ['peE', 'peD'].forEach((n) => { const M = W[m.idx[n]]; PONTOS_PE.forEach((q) => { const y = aplicar(M, q[0] * kp, q[1] * kp, q[2] * kp)[1]; if (y < min) min = y; }); });
      }
      if (isFinite(min)) W.forEach((M) => { M[7] -= min - (pose.alto || 0); });   // alto: sobe do chão (o voo da corrida)
    }
    // altura: o modelo inteiro cresce ou encolhe a partir dos pés
    const h = m.altura || 1;
    if (h !== 1) W.forEach((M) => { for (let k = 0; k < 12; k++) M[k] *= h; });
    W.h = h;
    return W;
  }
  /* ângulo de um osso de cabelo (ou da capa) na pose: sem "capa", a capa acompanha o cabelo de trás */
  function anguloCabelo(o, pose) {
    if (o.nome !== 'capa' || pose.capa) return null;
    const c = pose.cabeloT || ZERO;
    return [R.clamp(c[0] * 0.6, -40, 30), 0, 0];
  }
  /* matriz de um osso de cabelo (ou da capa) com outros ângulos, como ossosDaPose faria: o pai já desceu até o chão
     e cresceu com o modelo, então só a rotação ganha a altura */
  function matrizCabelo(m, W, i, g, yaw) {
    const o = m.esqueleto[i], h = W.h || 1;
    const pos = aplicar(W[o.paiI], o.off[0], o.off[1], o.off[2]);
    const M = mul(trans(pos[0], pos[1], pos[2]), mul(rotY(yaw), rotacaoOsso(o, g)));
    if (m.cabeca && m.cabeca !== 1 && o.pai === 'cabeca') escalar(M, m.cabeca, 1 + (m.cabeca - 1) * 0.3, m.cabeca);
    if (h !== 1) for (let k = 0; k < 12; k++) if (k % 4 !== 3) M[k] *= h;
    return M;
  }

  /* =====================================================================
     PANO E CABELO QUE DESVIAM DO CORPO (calculado em cada quadro, a partir da pose)
     As saias e a barra do casaco caem da cintura em colunas; cada segmento de cada coluna aponta para onde o pano
     penderia (meio preso ao quadril, meio pendurado, com o vento e o giro que a pose traz em pose.pano) e, se entrar
     numa perna (cápsulas da coxa, da canela e do pé) ou no quadril, gira para fora até passar por cima dela. O desvio
     de uma coluna levanta um pouco as vizinhas, como um pano de verdade. O cabelo de trás, as mechas dos lados e a capa
     dobram da raiz à ponta (a ponta vem da dinâmica da pose: pose.cabeloTP…) e, se entrarem no tronco, vão para trás
     (ou para fora) até sair.
     ===================================================================== */
  const PANO = { solto: 0.5, rigidez: 0.28, folga: 0.9, passo: 0.17, max: 2.6, tenda: [0.45, 0.18] };
  const CABELO = { passo: 7, max: 84, tolera: 0.02 };
  /* menor distância entre os segmentos p0 → p1 e q0 → q1 */
  function distSegSeg(p0x, p0y, p0z, p1x, p1y, p1z, q0, q1) {
    const ux = p1x - p0x, uy = p1y - p0y, uz = p1z - p0z;
    const vx = q1[0] - q0[0], vy = q1[1] - q0[1], vz = q1[2] - q0[2];
    const wx = p0x - q0[0], wy = p0y - q0[1], wz = p0z - q0[2];
    const a = ux * ux + uy * uy + uz * uz, b = ux * vx + uy * vy + uz * vz, c = vx * vx + vy * vy + vz * vz;
    const d = ux * wx + uy * wy + uz * wz, e = vx * wx + vy * wy + vz * wz, D = a * c - b * b;
    let sN, sD = D, tN, tD = D;
    if (D < 1e-9) { sN = 0; sD = 1; tN = e; tD = c > 1e-9 ? c : 1; }
    else {
      sN = b * e - c * d; tN = a * e - b * d;
      if (sN < 0) { sN = 0; tN = e; tD = c; } else if (sN > sD) { sN = sD; tN = e + b; tD = c; }
    }
    if (tN < 0) { tN = 0; if (-d < 0) sN = 0; else if (-d > a) sN = sD; else { sN = -d; sD = a; } }
    else if (tN > tD) { tN = tD; if (-d + b < 0) sN = 0; else if (-d + b > a) sN = sD; else { sN = -d + b; sD = a; } }
    const sc = Math.abs(sN) < 1e-9 ? 0 : sN / sD, tc = Math.abs(tN) < 1e-9 ? 0 : tN / tD;
    const dx = wx + sc * ux - tc * vx, dy = wy + sc * uy - tc * vy, dz = wz + sc * uz - tc * vz;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  /* D girado em volta do eixo t (unitário) pelo ângulo th (radianos) */
  function rodar(D, t, th) {
    const c = Math.cos(th), s = Math.sin(th), k = (t[0] * D[0] + t[1] * D[1] + t[2] * D[2]) * (1 - c);
    return [D[0] * c + (t[1] * D[2] - t[2] * D[1]) * s + t[0] * k, D[1] * c + (t[2] * D[0] - t[0] * D[2]) * s + t[1] * k,
      D[2] * c + (t[0] * D[1] - t[1] * D[0]) * s + t[2] * k];
  }
  /* cápsulas das pernas na pose (espaço do modelo) */
  function capsulasDaPose(m, W) {
    const h = W.h || 1;
    return m.colisao.pernas.map((c) => ({ a: aplicar(W[c.osso], c.a[0], c.a[1], c.a[2]), b: aplicar(W[c.osso], c.b[0], c.b[1], c.b[2]), r: c.r * h }));
  }
  /* quanto girar o segmento S → S + D·len em volta de t (para fora) para ele sair das cápsulas */
  function desvio(S, D, t, len, livre) {
    const c0 = livre(S, D, len);
    if (c0 >= 0) return 0;
    let melhor = 0, melhorC = c0, ant = 0;
    for (let th = PANO.passo; th <= PANO.max; th += PANO.passo) {
      const c = livre(S, rodar(D, t, th), len);
      if (c >= 0) {   // achou: refina entre o último ângulo que ainda entrava e este
        let lo = ant, hi = th;
        for (let i = 0; i < 4; i++) { const meio = (lo + hi) / 2; if (livre(S, rodar(D, t, meio), len) >= 0) hi = meio; else lo = meio; }
        return hi;
      }
      if (c > melhorC) { melhorC = c; melhor = th; }
      ant = th;
    }
    return melhor;   // não dá para sair de todo: o que fica mais longe
  }
  /* vértices (e normais) de uma peça de pano na pose, no espaço do modelo */
  function panoDaPose(m, p, W, pose, caps) {
    const pn = p.pano, A = pn.aneis, nA = A.length, nC = A[0].length, v = p.vf, o = pn.o;
    const Wr = W[m.idx.raiz], h = W.h || 1;
    const din = pose.pano || {};
    const vento = din.v || ZERO, giro = din.giro || 0, solto = din.solto != null ? din.solto : PANO.solto;
    const yaw = (pose.raiz || ZERO)[1] * RAD, cy = Math.cos(yaw), sy = Math.sin(yaw);
    const P = new Float32Array(v.length);
    // o quadril: uma cápsula em pé, um pouco mais fina que a cintura desta saia
    if (pn.rQuadril == null) {
      let r = Infinity;
      for (const i of A[0]) r = Math.min(r, Math.hypot(v[i * 3] + o[0], v[i * 3 + 2] + o[2]));
      pn.rQuadril = r * 0.8;
      pn.coluna = new Map(A[nA - 1].map((vi, k) => [vi, k]));
    }
    const q = m.colisao.quadril;
    const todas = caps.concat([{ a: aplicar(Wr, q.a[0], q.a[1], q.a[2]), b: aplicar(Wr, q.b[0], q.b[1], q.b[2]), r: pn.rQuadril * h }]);
    const folga = PANO.folga * h, noChao = pose.chao !== false, piso = 0.4 * h;
    const livre = (S, D, len) => {   // a menor folga entre o segmento e as cápsulas (negativa: entrou)
      let min = Infinity;
      const ex = S[0] + D[0] * len, ey = S[1] + D[1] * len, ez = S[2] + D[2] * len;
      for (const c of todas) { const d = distSegSeg(S[0], S[1], S[2], ex, ey, ez, c.a, c.b) - c.r - folga; if (d < min) min = d; }
      return min;
    };
    const fora = [], S = [], dirAnt = [], Ds = [], eixos = [], lens = [], th = new Float32Array(nC), th2 = new Float32Array(nC);
    for (let k = 0; k < nC; k++) {   // cintura: presa ao quadril
      const i = A[0][k], lx = v[i * 3] + o[0], ly = v[i * 3 + 1] + o[1], lz = v[i * 3 + 2] + o[2];
      fora.push(norm([Wr[0] * lx + Wr[2] * lz, Wr[4] * lx + Wr[6] * lz, Wr[8] * lx + Wr[10] * lz]));
      S.push(aplicar(Wr, lx, ly, lz));
      P[i * 3] = S[k][0]; P[i * 3 + 1] = S[k][1]; P[i * 3 + 2] = S[k][2];
    }
    for (let j = 1; j < nA; j++) {
      const w = j / (nA - 1), kGiro = giro * (0.3 + 0.9 * w);
      for (let k = 0; k < nC; k++) {
        const a = A[j - 1][k] * 3, b = A[j][k] * 3;
        const dx = v[b] - v[a], dy = v[b + 1] - v[a + 1], dz = v[b + 2] - v[a + 2], l0 = Math.hypot(dx, dy, dz) || 1e-6;
        // o segmento preso ao quadril e o mesmo segmento pendurado (só com o giro do corpo)
        let ax = Wr[0] * dx + Wr[1] * dy + Wr[2] * dz, ay = Wr[4] * dx + Wr[5] * dy + Wr[6] * dz, az = Wr[8] * dx + Wr[9] * dy + Wr[10] * dz;
        const len = Math.hypot(ax, ay, az) || 1e-6;
        ax /= len; ay /= len; az /= len;
        const gx = (cy * dx + sy * dz) / l0, gy = dy / l0, gz = (cy * dz - sy * dx) / l0;
        let D = norm([ax + (gx - ax) * solto + vento[0] * w + fora[k][0] * kGiro, ay + (gy - ay) * solto + vento[1] * w + fora[k][1] * kGiro,
          az + (gz - az) * solto + vento[2] * w + fora[k][2] * kGiro]);
        if (dirAnt[k]) D = norm([D[0] + dirAnt[k][0] * PANO.rigidez, D[1] + dirAnt[k][1] * PANO.rigidez, D[2] + dirAnt[k][2] * PANO.rigidez]);
        let t = cruz(D, fora[k]);
        const lt = Math.hypot(t[0], t[1], t[2]);
        t = lt > 1e-3 ? [t[0] / lt, t[1] / lt, t[2] / lt] : norm(cruz(D, [0, 1, 0]));   // já aponta para fora: gira para cima
        Ds[k] = D; eixos[k] = t; lens[k] = len;
        th[k] = desvio(S[k], D, t, len, livre);
      }
      // o desvio de uma coluna levanta um pouco as vizinhas (tenda em volta da perna)
      for (let k = 0; k < nC; k++) {
        const v1 = Math.max(th[(k + 1) % nC], th[(k + nC - 1) % nC]), v2 = Math.max(th[(k + 2) % nC], th[(k + nC - 2) % nC]);
        th2[k] = Math.max(th[k], v1 * PANO.tenda[0], v2 * PANO.tenda[1]);
      }
      for (let k = 0; k < nC; k++) {
        const D = th2[k] ? rodar(Ds[k], eixos[k], th2[k]) : Ds[k];
        const E = [S[k][0] + D[0] * lens[k], S[k][1] + D[1] * lens[k], S[k][2] + D[2] * lens[k]];
        if (noChao && E[1] < piso) E[1] = piso;   // não entra no chão
        dirAnt[k] = D; S[k] = E;
        const b = A[j][k] * 3;
        P[b] = E[0]; P[b + 1] = E[1]; P[b + 2] = E[2];
      }
    }
    // pontas da barra (rasgos, folhas): no meio dos dois vértices de onde pendem, na direção do último segmento
    for (const [i, a, b] of pn.pontas) {
      const da = dirAnt[pn.coluna.get(a)] || [0, -1, 0], db = dirAnt[pn.coluna.get(b)] || [0, -1, 0], d = norm(soma(da, db));
      const l = Math.hypot(v[i * 3] - (v[a * 3] + v[b * 3]) / 2, v[i * 3 + 1] - (v[a * 3 + 1] + v[b * 3 + 1]) / 2, v[i * 3 + 2] - (v[a * 3 + 2] + v[b * 3 + 2]) / 2) * h;
      P[i * 3] = (P[a * 3] + P[b * 3]) / 2 + d[0] * l;
      P[i * 3 + 1] = Math.max(noChao ? piso : -Infinity, (P[a * 3 + 1] + P[b * 3 + 1]) / 2 + d[1] * l);
      P[i * 3 + 2] = (P[a * 3 + 2] + P[b * 3 + 2]) / 2 + d[2] * l;
    }
    // normais do pano dobrado
    const N = new Float32Array(v.length), t = p.tf;
    for (let k = 0; k < t.length; k += 5) {
      const a = t[k] * 3, b = t[k + 1] * 3, c = t[k + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], wx = P[c] - P[a], wy = P[c + 1] - P[a + 1], wz = P[c + 2] - P[a + 2];
      const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
      N[a] += nx; N[a + 1] += ny; N[a + 2] += nz; N[b] += nx; N[b + 1] += ny; N[b + 2] += nz; N[c] += nx; N[c + 1] += ny; N[c + 2] += nz;
    }
    for (let i = 0; i < N.length; i += 3) { const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1; N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; }
    return { P, N };
  }
  /* cabelos (e capa) na pose: para cada osso de cabelo que dobra ou desvia, as matrizes da raiz, do meio e da ponta */
  function cabelosDaPose(m, W, pose) {
    const C = m.colisao, out = new Map();
    if (!C || !C.cabelos.length) return out;
    const yaw = (pose.raiz || ZERO)[1], h = W.h || 1, kk = 1 / (h * h);
    const corpos = C.tronco.map((e) => ({ e, M: W[e.osso] }));
    const dentro = (x, y, z) => {   // quanto o ponto entrou no tronco (0 = fora; 1 = no meio)
      let pior = 0;
      for (const { e, M } of corpos) {
        const px = x - M[3], py = y - M[7], pz = z - M[11];
        const ly = (M[1] * px + M[5] * py + M[9] * pz) * kk;
        if (ly < e.y0 || ly > e.y1) continue;
        const lx = (M[0] * px + M[4] * py + M[8] * pz) * kk, lz = (M[2] * px + M[6] * py + M[10] * pz) * kk;
        const q2 = (lx / e.rx) * (lx / e.rx) + ((lz - e.cz) / e.rz) * ((lz - e.cz) / e.rz);
        if (q2 < 1) pior = Math.max(pior, 1 - Math.sqrt(q2));
      }
      return pior;
    };
    for (const c of C.cabelos) {
      const o = m.esqueleto[c.osso];
      const g0 = anguloCabelo(o, pose) || pose[o.nome] || ZERO;
      const gt = pose[o.nome + 'P'] || g0;   // a ponta (dinâmica da pose); sem ela, o cabelo é duro
      const testar = (ga, gb) => {
        const M0 = matrizCabelo(m, W, c.osso, ga, yaw), M1 = matrizCabelo(m, W, c.osso, gb, yaw), A = c.amostras;
        let pior = 0;
        for (let i = 0; i < A.length; i += 4) {
          const s = A[i + 3], p0 = aplicar(M0, A[i], A[i + 1], A[i + 2]), p1 = aplicar(M1, A[i], A[i + 1], A[i + 2]);
          const d = dentro(p0[0] + (p1[0] - p0[0]) * s, p0[1] + (p1[1] - p0[1]) * s, p0[2] + (p1[2] - p0[2]) * s);
          if (d > pior) pior = d;
        }
        return pior;
      };
      let r0 = g0, r1 = gt, pior = testar(g0, gt);
      if (pior > CABELO.tolera) {   // entrou no tronco: o de trás e a capa vão para trás; as mechas dos lados, para fora (ou trás, ou frente)
        const dirs = o.nome === 'cabeloE' || o.nome === 'cabeloD' ? [[0, 1], [-1, 0], [1, 0]] : [[-1, 0]];
        busca: for (let d = CABELO.passo; d <= CABELO.max; d += CABELO.passo) {
          for (const [ux, uz] of dirs) {
            const a = [g0[0] + ux * d * 0.35, g0[1], g0[2] + uz * d * 0.35], b = [gt[0] + ux * d, gt[1], gt[2] + uz * d];
            const pi = testar(a, b);
            if (pi < pior) { pior = pi; r0 = a; r1 = b; }
            if (pi <= CABELO.tolera) break busca;
          }
        }
      }
      if (r0 === g0 && r1 === g0) continue;   // duro e sem desvio: o osso de sempre
      const meio = [(r0[0] + r1[0]) / 2, (r0[1] + r1[1]) / 2, (r0[2] + r1[2]) / 2];
      out.set(c.osso, [matrizCabelo(m, W, c.osso, r0, yaw), matrizCabelo(m, W, c.osso, meio, yaw), matrizCabelo(m, W, c.osso, r1, yaw)]);
    }
    return out;
  }

  /* =====================================================================
     ROSTO PINTADO (olhos de anime). Coordenadas da cabeça → u (largura) e v (altura) do rosto.
     ===================================================================== */
  const sq = (x) => x * x;
  /* Estilos de olho, medidos nos modelos de referência do estilo Legends (u vai de -1 a 1 na largura do rosto e v
     sobe 1 a cada 10 unidades da cabeça). ew, eh: meia largura e meia altura do olho; forma: 'redondo' (o contorno é
     uma superelipse de expoente p: 2 = oval, mais = quase quadrado; os olhos do Megaman Legends) ou 'amendoa' (cantos
     finos, olho de adulto); topo: altura do alto do olho (1 = a superelipse inteira; menos = a pálpebra desce) e a
     inclinação para fora; ci, co: grossura do cílio no canto de dentro e no de fora; desce: até onde o traço do canto
     de fora desce (b); ponta: quanto o cílio sai para fora no canto; ix, iy, ia, ib: centro e raios da íris; pupila:
     'barra' (vertical), 'redonda', 'fenda' ou 'nenhuma'; brilho: quantos brilhos (ou 'estrela'). */
  const ESTILOS_OLHO = {
    finos: { ew: 0.275, eh: 0.15, forma: 'amendoa', topo: [0.92, 0.12], ci: 0.4, co: 0.9, ponta: 0.36,
      ix: 0.04, iy: 0.1, ia: 0.47, pupila: 'redonda', pr: 1.32, dobra: true },
    gato: { ew: 0.2, eh: 0.2, forma: 'redondo', p: 2.4, topo: [0.86, 0.22], ci: 0.12, co: 0.32, desce: 0.3, ponta: 0.4,
      ix: 0.04, iy: -0.04, ia: 0.78, ib: 0.92, pupila: 'fenda', pr: 1 },
  };
  /* um olho: a vai do canto de dentro (-1) ao de fora (1), b de baixo (-1) a cima (1); r = largura / altura do olho
     (para a íris redonda do olho amendoado); lado: de que lado do rosto (o brilho fica sempre do mesmo lado da tela).
     Devolve a cor, ou 0 (a pele). */
  function olho(F, E, tipo, a, b, r, lado) {
    if (tipo === 'fechado') return Math.abs(a) < 1.0 && Math.abs(b - (0.02 - 0.32 * a * a)) < 0.14 ? F.cilio : 0;
    if (tipo === 'feliz') return Math.abs(a) < 0.96 && Math.abs(b - (0.4 - 0.5 * a * a)) < 0.15 ? F.cilio : 0;
    if (tipo === 'dor') return a > -0.95 && a < 1.0 && Math.abs(Math.abs(b) - 0.5 * (a + 0.95)) < 0.17 ? F.cilio : 0;
    const t = R.clamp((a + 1) / 2, 0, 1), esp = E.ci + (E.co - E.ci) * t;
    if (E.forma === 'amendoa') return olhoAmendoa(F, E, tipo, a, b, r, lado, t, esp);
    const P = E.p, aa = Math.min(1, Math.abs(a));
    // o alto do olho: o arco da superelipse, achatado pelo estilo, inclinado para fora; "bravo" corta de dentro para fora
    let topo = E.topo[0] * Math.pow(1 - Math.pow(aa, P), 1 / P) + E.topo[1] * a;
    if (tipo === 'bravo') topo = Math.min(topo, 0.32 + 0.42 * a);
    const raio = Math.pow(Math.pow(Math.abs(a), P) + Math.pow(Math.abs(Math.min(b, 0)), P), 1 / P);   // 1 = o contorno de baixo
    // cílio de cima: uma faixa escura que acompanha o arco, fina no canto de dentro e grossa no de fora
    if (Math.abs(a) < 1.03 && b <= topo + 0.06 && b >= topo - esp) return F.cilio;
    // a ponta do cílio, saindo para fora e um pouco para cima no canto de fora
    if (E.ponta && a >= 0.9 && a < 1 + E.ponta) {
      const f = (a - 0.9) / (0.1 + E.ponta), c0 = E.topo[1] * 0.9 + 0.06 + f * 0.18;
      if (b <= c0 + 0.04 && b >= c0 - esp * (1 - f * 0.8)) return F.cilio;
    }
    // o traço que desce pelo contorno do canto de fora (até "desce") e um curtinho no de dentro
    if (b < topo && b > -E.desce && a > 0 && raio > 0.86 && raio < 1.05) return F.cilio;
    if (b < topo && b > 0.25 && a < 0 && raio > 0.9 && raio < 1.04) return F.cilio;
    if (b > topo - esp) return 0;
    // traço de baixo: curtinho, perto do canto de fora, num tom mais claro
    if (raio > 0.96 && raio < 1.1 && b < -0.45 && a > 0.12 && a < 0.8) return F.cilioClaro;
    if (raio >= 1) return 0;
    const c = iris(F, E, a - E.ix, b - E.iy, E.ia, E.ib, lado);
    if (c) return b > topo - esp - 0.2 && c !== F.branco && c !== F.pupila ? F.irisEscura : c;   // a sombra do cílio em cima da íris
    return b > topo - esp - 0.22 ? F.escleraSombra : F.esclera;
  }
  /* olho amendoado (adulto): cantos finos, o delineado grosso por cima, a ponta do cílio saindo do canto, o branco dos
     dois lados e a íris redonda cortada pelas pálpebras */
  function olhoAmendoa(F, E, tipo, a, b, r, lado, t, esp) {
    if (a < -1.1 || a > 1 + E.ponta + 0.1) return 0;
    const q = Math.max(0, 1 - a * a);
    let topo = E.topo[0] * Math.pow(q, 0.55) + E.topo[1] * a;
    if (tipo === 'bravo') topo = Math.min(topo, -0.1 + 0.6 * (a + 1));
    const fundo = -0.92 * Math.pow(q, 0.7) + 0.05 * a;
    // delineado: por cima da pálpebra, engrossando para fora e passando do canto numa ponta
    if (a > -1.04 && a < 1.0 && b >= topo - 0.1 && b <= topo + esp) return F.cilio;
    if (a >= 1.0) {
      const f = (a - 1) / E.ponta;
      if (f < 1 && b <= topo + esp * (1 - f) + f * 0.3 && b >= topo - 0.1 + f * 0.25) return F.cilio;
      // dois pontinhos de cílio por cima da ponta
      if ((Math.abs(a - 1.08) < 0.05 && Math.abs(b - (topo + esp + 0.32)) < 0.14) || (Math.abs(a - 1.24) < 0.05 && Math.abs(b - (topo + esp + 0.1)) < 0.14)) return F.cilio;
      return 0;
    }
    if (a < -1.0) return Math.abs(b - topo) < 0.12 && a > -1.1 ? F.cilio : 0;   // pontinha no canto de dentro
    if (E.dobra && a > -0.5 && a < 0.85 && Math.abs(b - (topo + esp + 0.42 - 0.12 * a * a)) < 0.08) return F.dobra;
    if (b > topo - 0.1) return 0;
    // pálpebra de baixo: um traço claro do meio para fora
    if (b < fundo + 0.12 && b > fundo - 0.12 && a > -0.3 && a < 0.96) return F.cilioClaro;
    if (b < fundo) return 0;
    const c = iris(F, E, a - E.ix, (b - E.iy) / r, E.ia, E.ia, lado);
    return c || (b > topo - 0.36 ? F.escleraSombra : F.esclera);
  }
  /* íris (centro 0, 0; raios ia, ib): o anel escuro na borda, a pupila, o brilho (no alto, sempre do lado esquerdo da
     tela, como uma luz só) e o degradê para claro embaixo */
  function iris(F, E, a, b, ia, ib, lado) {
    const d = (a / ia) * (a / ia) + (b / ib) * (b / ib);
    if (d >= 1) return 0;
    const s = a * lado;   // para a direita da tela
    // o brilho: um ponto redondo no alto, à esquerda
    if (sq((s + 0.3 * ia) / (0.24 * ia)) + sq((b - 0.36 * ib) / (0.2 * ib)) < 1) return F.branco;
    if (d > 0.8) return F.irisAnel;
    const pr = E.pr || 1;
    if (E.pupila === 'redonda' && sq(a / (0.38 * ia * pr)) + sq(b / (0.38 * ib * pr)) < 1) return F.pupila;
    if (E.pupila === 'fenda' && sq(a / (0.14 * ia)) + sq(b / (0.86 * ib)) < 1) return F.pupila;
    if (b < -0.52 * ib) return F.irisClara;   // a meia-lua clara embaixo
    if (b < -0.14 * ib) return F.irisMeio;
    return F.iris;
  }
  /* O rosto é pintado em "texels" (TX_ROSTO unidades da cabeça), como a textura de um modelo de PS1: os olhos ficam com
     os pixels grandes das referências. Só quando o desenho é grande o bastante para eles aparecerem (ROSTO_TEXEL,
     ligado em renderizar); pequeno, o rosto é pintado liso (o texel seria menor que um pixel). */
  const TX_ROSTO = 0.3;
  let ROSTO_TEXEL = false;
  function pixelRosto(F, ex, x, y, z, luz) {
    if (ROSTO_TEXEL) { x = (Math.floor(x / TX_ROSTO) + 0.5) * TX_ROSTO; y = (Math.floor(y / TX_ROSTO) + 0.5) * TX_ROSTO; }
    const u = x / ROSTO_X, v = (y - 9.6) / 10;
    const lado = u >= 0 ? 1 : -1;
    const RR = F.raca, olhos = ex.olhos || 'aberto', E = RR.pupilaFenda ? ESTILOS_OLHO.gato : F.olhos;
    if (RR.caveira) return pixelCaveira(F, olhos, u, v, lado);
    if (RR.golem) return pixelGolem(F, olhos, u, v);
    // olhos (com quatro olhos: os de cima sobem um pouco e há um par menor embaixo). O tamanho acompanha a estatura
    // (no adulto, olhos menores)
    const oy = RR.oy + (F.quatro ? 0.05 : 0), k = RR.ok * F.olhoK;
    const ew = E.ew * k, eh = E.eh * k, r = (ew * ROSTO_X) / (eh * 10);
    const a = ((u - lado * RR.ox) / ew) * lado;   // a > 0: canto de fora
    const b = (v - oy) / eh;
    if (ARTE && !RR.pupilaFenda) {   // pixel art: os olhos dos sprites de Ragnarok Online (o par de baixo, com quatro olhos, menor)
      const c = olhoRO(F, olhos, u, v, lado, RR.ox, oy, k) || (F.quatro ? olhoRO(F, olhos, u, v, lado, RR.ox + 0.05, oy - 0.3, k * 0.62) : 0);
      if (c) return c;
    } else if (a > -1.3 && a < 1.7 && b > -1.4 && b < 2.2) { const c = olho(F, E, olhos, a, b, r, lado); if (c) return c; }
    if (F.quatro && !(ARTE && !RR.pupilaFenda)) {
      const a2 = ((u - lado * (RR.ox + 0.05)) / (ew * 0.62)) * lado, b2 = (v - oy + 0.3) / (eh * 0.62);
      if (a2 > -1.3 && a2 < 1.7 && b2 > -1.4 && b2 < 2.2) { const c = olho(F, E, olhos, a2, b2, r, lado); if (c) return c; }
    }
    // sobrancelhas: um traço fino um pouco acima do olho (grossas: mais largo e mais comprido); a pose pode mudar a
    // inclinação (brava, com dor)
    const SB = F.sobrancelhas;
    if (SB !== 'nenhuma' && a > (SB === 'grossas' ? -1.05 : -0.85) && a < (SB === 'grossas' ? 1.2 : 1.05)) {
      const base = oy + eh * (E.forma === 'amendoa' ? E.topo[0] + E.co + 0.3 : E.topo[0]) + 0.09 * F.olhoK;
      const d = olhos === 'bravo' ? -0.045 + 0.07 * a : olhos === 'dor' ? 0.03 - 0.05 * a : 0.012 * (1 - a * a);
      const g = SB === 'grossas' ? 0.032 + 0.012 * R.clamp(-a, 0, 1) : 0.016;
      if (Math.abs(v - (base + d)) < g) return F.sobrancelha;
    }
    // nariz: no jovem, só um pontinho de sombra; no adulto, a sombra de um lado da ponte e a narina
    if (RR.nariz) {
      if (F.adulto && u > -0.05 && u < -0.014 && v < -0.3 && v > -0.45 + (u + 0.05) * 0.6) return F.peleSombra;
      if (u > -0.04 && u < 0.02 && v < -0.43 && v > -0.47) return F.adulto ? F.narina : F.peleSombra;
    }
    if (F.marcas !== 'nenhuma') { const cm = marcaRosto(F, u, v, x, y, z); if (cm) return cm; }
    // rubor: uma oval rosada na bochecha, embaixo do canto de fora do olho
    if (RR.rubor && !F.quatro) {
      const ru = (u - lado * 0.58) / 0.11, rv = (v + 0.42) / 0.05;
      if (ru * ru + rv * rv < 1) return F.ruborClaro;
    }
    return 0;
  }
  /* Pixel art: o olho dos sprites de Ragnarok Online — um bloquinho de uns 3 × 4 pixels, sem branco nem contorno: a
     pálpebra escura em cima (passando um pixel para fora no canto), a íris bem escura no meio, a cor da íris embaixo
     e um pontinho de brilho do lado de dentro. Piscando, um risco; bravo, o alto corta em diagonal; com dor, apertado. */
  function olhoRO(F, olhos, u, v, lado, ox, oy, k) {
    const a = ((u - lado * ox) / (0.16 * k)) * lado, b = (v - oy) / (0.21 * k);   // a > 0: canto de fora; b > 0: em cima
    if (a < -1.1 || a > 1.5 || b < -1.2 || b > 1.2) return 0;
    if (olhos === 'fechado' || olhos === 'feliz') return a > -1 && a < 1.35 && Math.abs(b + (olhos === 'feliz' ? 0.35 * (1 - a * a) : 0.1)) < 0.26 ? F.cilio : 0;
    if (olhos === 'dor') return a > -1 && a < 1.2 && Math.abs(b - 0.45 * a + 0.1) < 0.28 ? F.cilio : 0;
    const topo = olhos === 'bravo' ? 1 - 0.7 * R.clamp(-a + 0.2, 0, 1.2) : 1;
    if (b > topo) return 0;
    if (a > 1) return b > topo - 0.5 && a < 1.45 && olhos !== 'bravo' ? F.cilio : 0;   // a ponta da pálpebra, para fora
    if (a < -1 || b < -1) return 0;
    if (b > topo - 0.5) return F.cilio;
    if (b > -0.3) return a > -0.8 && a < -0.2 && b > 0.05 && b < topo - 0.55 ? F.branco : F.pupila;
    return F.iris;
  }
  /* osteon: caveira (órbitas fundas com um brilho no meio, buraco do nariz e a fileira de dentes) */
  function pixelCaveira(F, olhos, u, v, lado) {
    const au = Math.abs(u);
    const oa = (au - 0.36) / 0.23, ob = (v + 0.06) / 0.25;
    if (oa * oa + ob * ob < 1) {
      if (olhos !== 'fechado' && olhos !== 'feliz' && oa * oa / 0.12 + ob * ob / 0.1 < 1) return F.visor;
      return F.fenda;
    }
    if (v < -0.24 && v > -0.42 && au < 0.1 * (v + 0.42) / 0.18) return F.fenda;   // nariz
    if (Math.abs(v + 0.6) < 0.075 && au < 0.3) {   // dentes
      if (Math.abs(v + 0.6) < 0.012 || ((u + 1) / 0.075) % 1 < 0.2) return F.fenda;
      return F.osso;
    }
    if (sq((au - 0.5) / 0.16) + sq((v + 0.36) / 0.08) < 1) return F.peleSombra;   // maçãs do rosto
    return 0;
  }
  /* golem: placa lisa com uma fenda de luz nos olhos, a crista no meio e uma grade no lugar da boca */
  function pixelGolem(F, olhos, u, v) {
    const au = Math.abs(u), vy = v + 0.06 + au * au * 0.1;
    if (Math.abs(vy) < 0.05 && au < 0.6) return olhos === 'fechado' ? F.fenda : F.visor;
    if (Math.abs(vy) < 0.085 && au < 0.64) return F.fenda;
    if (au < 0.045 && v > 0.12) return F.corpo2;
    if (v > 0.42 && v < 0.62 && au < 0.12 * (0.62 - v) / 0.2) return F.corpo2;
    if (au < 0.16 && v < -0.42 && v > -0.62 && (((v + 0.62) / 0.066) % 1) < 0.4) return F.fenda;
    return 0;
  }
  /* marcas no rosto: só nos lados (e na testa), para não sujar os olhos */
  function marcaRosto(F, u, v, x, y, z) {
    const au = Math.abs(u), t = F.marcas;
    if (t === 'sardas') {   // pintinhas nas bochechas e no nariz
      if (au > 0.8 || v > -0.18 || v < -0.48) return 0;
      const gu = Math.floor(u / 0.075), gv = Math.floor(v / 0.075);
      if (hash3(gu, gv, 7) > 0.42) return 0;
      const cu = (gu + 0.3 + hash3(gu, gv, 1) * 0.4) * 0.075, cv = (gv + 0.3 + hash3(gu, gv, 2) * 0.4) * 0.075;
      return sq((u - cu) / 0.022) + sq((v - cv) / 0.02) < 1 ? F.marcaPele : 0;
    }
    if (t === 'tatuagens' || (au < 0.66 && v < 0.62)) return 0;
    if (t === 'listras') return au > 0.66 && Math.abs(((v * 6 + au * 3) % 1 + 1) % 1 - 0.5) < 0.16 && v < 0.2 && v > -0.62 ? F.marcaPele : 0;
    return pixelMarcas(t, x, y, z || 0) ? F.marcaPele : 0;
  }
  /* desenhos das máscaras de rosto inteiro (coordenadas da cabeça, como o rosto) */
  function pixelMascara(F, x, y, base) {
    const u = x / ROSTO_X, v = (y - 9.6) / 10, au = Math.abs(u), t = F.tipoMascara;
    if (t === 'caveira') {
      if (sq((au - 0.36) / 0.23) + sq((v + 0.05) / 0.2) < 1) return F.fenda;   // órbitas
      if (v < -0.22 && v > -0.42 && au < 0.09 - (v + 0.22) * -0.25) return F.fenda;   // nariz
      if (v < -0.52 && v > -0.72 && au < 0.34) {   // dentes
        if (Math.abs(v + 0.62) < 0.02) return F.mascaraLinha;
        if (((u + 0.34) / 0.085) % 1 < 0.18) return F.mascaraLinha;
      }
      return base;
    }
    if (t === 'lisa') {   // olhos brilhando em fenda, puxados para cima, numa sombra preta
      const oa = (au - 0.36) / 0.2, ob = (v + 0.04 - (au - 0.36) * 0.5) / 0.06;
      if (oa * oa + ob * ob < 1) return oa * oa + ob * ob < 0.45 ? F.branco : F.brilhoOlho;
      if (oa * oa + ob * ob < 1.9) return F.marca;
      const sa = (au - 0.37) / 0.33, sb = (v + 0.05 - (au - 0.36) * 0.4) / (v < -0.04 ? 0.24 : 0.17);   // a sombra escorre um pouco para baixo
      if (sa * sa + sb * sb < 1) return F.fenda;
      return base;
    }
    return base;
  }

  /* ---------- Marcas na pele (coordenadas da peça) ---------- */
  function hash3(x, y, z) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1274126177)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1103515245);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function pixelMarcas(t, x, y, z) {
    const h = Math.atan2(x, z) * 2.4;   // em volta da peça
    if (t === 'escamas') {   // fileiras de meias-luas
      const H = 1.15, row = Math.floor(y / H), fx = (((h / H + (row & 1) * 0.5) % 1) + 1) % 1 - 0.5, fy = (((y / H) % 1) + 1) % 1;
      const d = Math.hypot(fx, fy - 1);
      return d > 0.4 && d < 0.56;
    }
    if (t === 'tatuagens') {   // tatuagens de qareen: faixas tribais em ondas, com espirais, a cada ~7 unidades de altura
      const faixa = ((y / 7.5) % 1 + 1) % 1, yy = (faixa - 0.5) * 7.5;   // -3.75..3.75 dentro da faixa
      if (Math.abs(yy) > 2.6) return false;
      const onda = Math.sin(h * 2.0) * 1.1;
      if (Math.abs(yy - onda) < 0.28 || Math.abs(yy - onda + 1.6) < 0.2) return true;   // duas linhas em onda
      const cx = ((h / Math.PI) % 1 + 1) % 1 - 0.5, r = Math.hypot(cx * 3.2, yy - onda + 0.8);   // espiral entre as ondas
      return r < 1.0 && Math.abs(((Math.atan2(yy - onda + 0.8, cx) / TAU + r / 0.55) % 1 + 1) % 1 - 0.5) < 0.16;
    }
    if (t === 'listras') {   // listras de tigre: onduladas e interrompidas
      const f = Math.sin(y * 1.15 + Math.sin(h * 1.3 + y * 0.2) * 1.3);
      return f > 0.78 && Math.cos(h * 2.1 + y * 0.37) > -0.35;
    }
    return false;
  }

  /* ---------- Dano visível (o herói machucado) ----------
     As marcas ficam presas ao corpo (nas coordenadas da peça: não pulam de um quadro para o outro). O espaço é cortado
     em cubos de DANO_CUBO unidades e alguns ganham uma marca: uma bola em volta de um ponto do cubo (o que a superfície
     corta dela é o que aparece; só vale quando o triângulo passa perto do centro, n: a normal dele, para não sair um
     pontinho) e um plano quase deitado passando por ele (o risco: corta na diagonal as peças em pé, braços, pernas e
     tronco). Ferido (nivel 1): menos marcas e menores; muito ferido (2): as mesmas, maiores, e outras novas. sal muda
     o desenho de uma peça para a outra. Devolve se tem marca e deixa em DM a distância ao centro (r: espichada ao longo
     do risco; rr: redonda; as duas com a borda serrilhada no grid dos texels), o raio (R), a distância ao risco mais
     perto (risco: muito ferido, alguns viram as três garras de um golpe) e o sorteio do tipo (h). */
  const DANO_CUBO = 8, DM = { r: 0, rr: 0, R: 0, risco: 0, h: 0 };
  // o último cubo de cada grade e o que foi sorteado nele (os pixels vizinhos quase sempre caem no mesmo cubo): o
  // sorteio da marca, o tipo (h), o tamanho (h2), a diagonal (h3), o centro e a normal do plano do risco
  const DC = new Float64Array(8).fill(NaN), DH = new Float64Array(20);
  function marcaDano(nivel, x, y, z, sal, nx, ny, nz) {
    const C = DANO_CUBO, lim = nivel >= 2 ? 0.6 : 0.38;
    for (let g = 0; g < 2; g++) {   // duas grades, uma no meio da outra: toda superfície passa perto do centro de algum cubo
      const o = g * C * 0.5, sl = sal + g * 31, px = x + o, py = y + o, pz = z + o;
      const cx = Math.floor(px / C), cy = Math.floor(py / C), cz = Math.floor(pz / C), k = g * 4, q = g * 10;
      if (DC[k] !== cx || DC[k + 1] !== cy || DC[k + 2] !== cz || DC[k + 3] !== sl) {
        DC[k] = cx; DC[k + 1] = cy; DC[k + 2] = cz; DC[k + 3] = sl;
        const h = hash3(cx + 5, cy + sl, cz * 3 + 1), h2 = hash3(cx - sl, cy + 7, cz + 2), h3 = hash3(cz + 9, cx * 3, cy - sl);
        const ang = 0.4 + h3 * 0.5, fi = h2 * 6.283, sa = Math.sin(ang);
        DH[q] = hash3(cx * 7 + sl, cy * 3 + 11, cz * 5 - sl); DH[q + 1] = h; DH[q + 2] = h2; DH[q + 3] = h3;
        DH[q + 4] = (cx + 0.5 + (h2 - 0.5) * 0.16) * C; DH[q + 5] = (cy + 0.5 + (h3 - 0.5) * 0.16) * C; DH[q + 6] = (cz + 0.5 + (h - 0.5) * 0.16) * C;
        DH[q + 7] = sa * Math.cos(fi); DH[q + 8] = Math.cos(ang); DH[q + 9] = sa * Math.sin(fi);
      }
      if (DH[q] > lim) continue;
      const h = DH[q + 1], h2 = DH[q + 2], h3 = DH[q + 3];
      const ux = px - DH[q + 4], uy = py - DH[q + 5], uz = pz - DH[q + 6];
      const R = C * (nivel >= 2 ? 0.35 + h2 * 0.08 : 0.27 + h2 * 0.08), dn = ux * nx + uy * ny + uz * nz;
      if (dn > R * 0.65 || dn < -R * 0.65) continue;
      const d2 = ux * ux + uy * uy + uz * uz;
      if (d2 > (R + 0.35) * (R + 0.35)) continue;   // (longe até com a serra)
      const serra = ruido(x, y, z) * 0.7, rr = Math.sqrt(d2) + serra;
      if (rr > R) continue;
      const fio = ux * DH[q + 7] + uy * DH[q + 8] + uz * DH[q + 9], passo = 1.4;
      const garras = nivel >= 2 && h3 > 0.55 && Math.abs(fio) < passo * 1.5;
      DM.risco = (garras ? Math.abs(fio - Math.round(fio / passo) * passo) : Math.abs(fio)) + Math.max(0, rr / R - 0.65) * 1.2;   // (afina nas pontas)
      DM.r = Math.sqrt(d2 + fio * fio * 1.2) + serra; DM.rr = rr; DM.R = R; DM.h = h;
      return 1;
    }
    return 0;
  }
  /* o rosto machucado (só na pele, nas coordenadas do rosto pintado): ferido, um corte na bochecha; muito ferido, outro
     na testa, do outro lado, com um fio de sangue descendo */
  function rostoFerido(nivel, x, y, cor) {
    if (ROSTO_TEXEL) { x = (Math.floor(x / TX_ROSTO) + 0.5) * TX_ROSTO; y = (Math.floor(y / TX_ROSTO) + 0.5) * TX_ROSTO; }
    const u = x / ROSTO_X, v = (y - 9.6) / 10, a = u + 0.52, b = v + 0.3;   // (a bochecha do lado que aparece no jogo e no retrato)
    if (a > -0.1 && a < 0.1 && Math.abs(b - a * 0.7) < 0.022) return DANO_CORTE;
    if (nivel < 2) return cor;
    const c = u - 0.3, d = v - 0.5;
    if (c > -0.1 && c < 0.1 && Math.abs(d + c * 0.55) < 0.022) return DANO_CORTE;
    return u > 0.335 && u < 0.375 && v > 0.28 && v < 0.47 ? DANO_SANGUE[1] : cor;
  }
  const xadrez = (x, y, z) => (Math.floor(x * INV_TX) + Math.floor(y * INV_TX) + Math.floor(z * INV_TX)) & 1;   // o pontilhado (mancha rala)
  const DANO_HEMATOMA = [empacotar([150, 92, 132]), empacotar([104, 58, 102])], DANO_CORTE = empacotar([178, 28, 34]), DANO_RASPAO = empacotar([206, 92, 86]);
  const DANO_SANGUE = [empacotar([132, 22, 32]), empacotar([90, 14, 26])];
  /* as peças que ficam no corpo (o rasgo mostra a pele por baixo); nas outras (capa, saia, luvas, chapéus), o fundo escuro */
  const OSSOS_DO_CORPO = new Set(['raiz', 'tronco', 'peito', 'pescoco', 'bracoE', 'bracoD', 'antebracoE', 'antebracoD', 'coxaE', 'coxaD', 'canelaE', 'canelaD']);

  /* ---------- Emblema no peito (coordenadas do osso do peito) ----------
     Cada desenho diz se o ponto (u, v) está dentro; a borda (contorno) é o que está dentro mas sai ao ampliar. */
  function dentroPoligono(u, v, P) {
    let d = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      if ((P[i][1] > v) !== (P[j][1] > v) && u < ((P[j][0] - P[i][0]) * (v - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0]) d = !d;
    }
    return d;
  }
  const estrelaR = (th, n, ri, re) => { const f = (((th / TAU) * n) % 1 + 1) % 1; return ri + (re - ri) * Math.abs(f - 0.5) * 2; };
  const RAIO = [[0.18, 1], [0.62, 1], [0.18, 0.18], [0.5, 0.18], [-0.3, -1], [-0.02, -0.12], [-0.42, -0.12]];
  const EMBLEMAS = {
    estrela: (u, v) => { const r = Math.hypot(u, v), R0 = estrelaR(Math.atan2(u, v), 8, 0.46, 1.0); return r < R0 && (r > R0 - 0.3 || r < 0.2); },
    cruz: (u, v) => (Math.abs(u) < 0.2 && v > -1 && v < 0.95) || (Math.abs(v - 0.36) < 0.2 && Math.abs(u) < 0.66),
    sol: (u, v) => { const r = Math.hypot(u, v); return r < 0.44 || (r < 1.0 && 0.5 + 0.5 * Math.cos(12 * Math.atan2(u, v)) > (r - 0.5) / 0.5); },
    lua: (u, v) => Math.hypot(u, v) < 0.86 && Math.hypot(u - 0.42, v - 0.2) > 0.7,
    coracao: (u, v) => { const x = u * 1.18, y = (v + 0.12) * 1.25; return Math.pow(x * x + y * y - 1, 3) - x * x * y * y * y <= 0; },
    caveira: (u, v) => Math.hypot(u, (v - 0.15) * 1.05) < 0.72 || (Math.abs(u) < 0.44 && v > -0.82 && v < -0.2),
    raio: (u, v) => dentroPoligono(u, v, RAIO),
    olho: (u, v) => Math.abs(v) < 0.58 * (1 - sq(u / 0.98)) && Math.abs(u) < 0.98,
  };
  /* 0 = fora, 1 = desenho, 2 = traço escuro (contorno e detalhes) */
  function pixelEmblema(t, x, y) {
    const f = EMBLEMAS[t];
    if (!f) return 0;
    const u = x / 2.9, v = (y - 5.6) / 2.9;
    if (!f(u, v)) return 0;
    if (!f(u * 1.13, v * 1.13)) return 2;
    if (t === 'caveira' && (Math.hypot(Math.abs(u) - 0.28, v - 0.06) < 0.19 || (Math.abs(u) < 0.06 && v < -0.18 && v > -0.34) || (v < -0.5 && Math.abs(((u + 1) / 0.15) % 1 - 0.5) < 0.12))) return 2;
    if (t === 'olho' && Math.hypot(u, v) < 0.32) return Math.hypot(u, v) < 0.14 ? 1 : 2;
    return 1;
  }

  /* =====================================================================
     RASTERIZADOR
     ===================================================================== */
  /* buffers de desenho, um por tamanho (o jogo, as prévias e os retratos usam tamanhos diferentes) */
  const BUFS = new Map();
  function buffer(w, h) {
    const chave = w + 'x' + h;
    let B = BUFS.get(chave);
    if (!B) {
      if (BUFS.size >= 4) BUFS.delete(BUFS.keys().next().value);
      B = { w, h, z: new Float32Array(w * h), c: new Uint32Array(w * h), g: new Int32Array(w * h), l: new Uint32Array(w * h), o: new Uint32Array(w * h),
        t: new Int32Array(w * h), w0: new Float32Array(w * h), w1: new Float32Array(w * h), p: new Int32Array(w * h), sujo: null };   // t, w0, w1: pintura adiada; p: a peça
      B.z.fill(-1e9);
      BUFS.set(chave, B);
    }
    // limpa só a área usada no desenho anterior
    const S = B.sujo;
    if (S) for (let y = S[1]; y <= S[3]; y++) { B.z.fill(-1e9, y * w + S[0], y * w + S[2] + 1); B.g.fill(0, y * w + S[0], y * w + S[2] + 1); }
    else B.g.fill(0);
    B.mx0 = w; B.my0 = h; B.mx1 = -1; B.my1 = -1;
    return B;
  }

  /* rasteriza um triângulo: cor fixa (tid = 0) ou, para pintar depois, o número do triângulo (tid) e os pesos de
     dois vértices em cada pixel (assim cada pixel visível é pintado uma vez só, no fim). Os pesos são funções lineares
     do pixel: em cada linha calcula-se só o trecho dentro do triângulo e os pesos andam somando. */
  /* nas poses com bracosSobreAsas (a corrida, com os braços esticados para trás), os braços (grupos 10 e 11) ganham das
     asas (26 e 27) por esta folga de profundidade; o resto do corpo continua decidindo pela profundidade de verdade */
  let FOLGA_BRACOS = 0;
  function triangulo(B, ax, ay, az, bx, by, bz, cx, cy, cz, cor, lin, grp, tid, pid) {
    const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
    if (area > -1e-6 && area < 1e-6) return;
    let fa = -1, fb = -1, fv = 0;
    if (FOLGA_BRACOS) {
      if (grp === 10 || grp === 11) { fa = 26; fb = 27; fv = -FOLGA_BRACOS; } else if (grp === 26 || grp === 27) { fa = 10; fb = 11; fv = FOLGA_BRACOS; }
    }
    const inv = 1 / area;
    const W = B.w;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(B.h - 1, Math.ceil(Math.max(ay, by, cy)));
    if (x1 < x0 || y1 < y0) return;
    // w0 = A0·px + B0·py + C0; w1 = A1·px + B1·py + C1; w2 = 1 − w0 − w1
    const A0 = (by - cy) * inv, B0 = (cx - bx) * inv, C0 = (bx * cy - cx * by) * inv;
    const A1 = (cy - ay) * inv, B1 = (ax - cx) * inv, C1 = (cx * ay - ax * cy) * inv;
    const A2 = -A0 - A1, B2 = -B0 - B1, C2 = 1 - C0 - C1;
    const Az = A0 * az + A1 * bz + A2 * cz;
    const zb = B.z, cb = B.c, gb = B.g, lb2 = B.l, tb = B.t, wa = B.w0, wb = B.w1, pb = B.p;
    const E = -1e-5;
    let tocou = false;
    for (let y = y0; y <= y1; y++) {
      const py = y + 0.5;
      const b0 = B0 * py + C0, b1 = B1 * py + C1, b2 = B2 * py + C2;
      // o trecho da linha onde os três pesos são ≥ 0 (A·px + b ≥ E)
      let lo = x0 + 0.5, hi = x1 + 0.5;
      if (A0 > 0) lo = Math.max(lo, (E - b0) / A0); else if (A0 < 0) hi = Math.min(hi, (E - b0) / A0); else if (b0 < E) continue;
      if (A1 > 0) lo = Math.max(lo, (E - b1) / A1); else if (A1 < 0) hi = Math.min(hi, (E - b1) / A1); else if (b1 < E) continue;
      if (A2 > 0) lo = Math.max(lo, (E - b2) / A2); else if (A2 < 0) hi = Math.min(hi, (E - b2) / A2); else if (b2 < E) continue;
      const xs = Math.max(x0, Math.ceil(lo - 0.5)), xe = Math.min(x1, Math.floor(hi - 0.5));
      if (xe < xs) continue;
      let px = xs + 0.5;
      let w0 = A0 * px + b0, w1 = A1 * px + b1, w2 = A2 * px + b2;
      let z = w0 * az + w1 * bz + w2 * cz;
      let i = y * W + xs;
      for (let x = xs; x <= xe; x++, i++, w0 += A0, w1 += A1, w2 += A2, z += Az) {
        if (w0 < E || w1 < E || w2 < E || z <= zb[i] + (fv && (gb[i] === fa || gb[i] === fb) ? fv : 0)) continue;
        zb[i] = z; gb[i] = grp; lb2[i] = lin; tb[i] = tid; pb[i] = pid;
        if (tid) { wa[i] = w0; wb[i] = w1; } else cb[i] = cor;
        tocou = true;
      }
    }
    if (tocou) { if (x0 < B.mx0) B.mx0 = x0; if (x1 > B.mx1) B.mx1 = x1; if (y0 < B.my0) B.my0 = y0; if (y1 > B.my1) B.my1 = y1; }
  }

  /* ---------- Pintura ----------
     Os modelos no estilo Legends têm a textura pintada à mão em pixels grandes: a sombra é pintada em tons, com
     manchas de pincel, e o cabelo tem listras claras e escuras ao longo das mechas. Aqui isso vira um pintor por
     pixel: a luz de cada vértice (normais suaves) misturada com a da face dá o nível de luz; o ponto da peça é
     arredondado para um "texel" (TEXEL unidades), cada texel ganha um ruído fixo de pincel, e o nível escolhe o tom
     na rampa do material (funda, sombra, luz, realce e, nos materiais que brilham, claro). */
  const LUZ = norm([0.42, 0.78, 0.62]);
  const TEXEL = 0.42, INV_TX = 1 / TEXEL;
  const LIM_FUNDA = -0.42, LIMIAR = 0.14, LIM_REALCE = 0.66, LIM_BRILHO = 0.88;
  const SUAVE = 0.84;   // quanto da luz vem das normais suaves (o resto vem da face: um resto das facetas low poly)
  /* -0.5..0.5, um valor fixo por texel: com força pequena, só serrilha a borda entre dois tons em degraus de texel
     (como a sombra pintada em pixels das texturas do estilo Legends); as áreas de um tom só ficam lisas */
  function ruido(x, y, z) {
    return hash3(Math.floor(x * INV_TX), Math.floor(y * INV_TX), Math.floor(z * INV_TX)) - 0.5;
  }
  const NT = 28;
  let TABELA = new Float32Array(NT * 8000);
  const tom = (mt, n) => (n < LIM_FUNDA ? mt.funda : n < LIMIAR ? mt.sombra : n < LIM_REALCE ? mt.luz : n < LIM_BRILHO || !mt.brilha ? mt.realce : mt.claro);
  M3.CAMERA = { yaw: 42, pitch: 9 };

  /* Desenha o modelo numa pose. op: { escala (px por unidade), yaw, pitch, w, h, ox, oy (onde cai o pé no
     buffer), filtro(peça), cv (canvas para reaproveitar), contornoGrosso, aa }. Devolve { cv, ax, ay, w, h }.
     aa: supersampling (2 = desenha no dobro da resolução e tira a média de cada 2 × 2: bordas lisas, como num render
     de verdade); o padrão é M3.AA. */
  /* qualidade (Configurações → Áudio e vídeo → Personagens): 'suave' (supersampling 2×) ou 'rapida' (sem
     antialiasing: menos da metade do trabalho, para aparelhos fracos). Fica guardada no navegador; sem escolha, é
     'suave' no computador e 'rapida' em celular e tablet (só toque). */
  M3.AA = (() => {
    let q = null;
    try { q = localStorage.getItem('res.personagens'); } catch (e) { /* sem acesso: usa o padrão */ }
    if (!q) q = R.Input && R.Input.soToque ? 'rapida' : 'suave';
    return q === 'rapida' ? 1 : 2;
  })();
  M3.qualidade = () => (M3.AA > 1 ? 'suave' : 'rapida');
  M3.definirQualidade = (q) => {
    M3.AA = q === 'rapida' ? 1 : 2;
    try { localStorage.setItem('res.personagens', q); } catch (e) { /* modo privado: vale só agora */ }
  };
  /* Pixel art (teste; Configurações → Áudio e vídeo → Visual): o personagem é desenhado em baixa resolução (um pixel da
     arte por TAM_PIXEL unidades: o pixel do jogo), sem antialiasing nem manchas de pincel, e ampliado sem suavizar,
     como num "3D Model + Real Time Pixel Art Shader". 'contorno': cada peça ganha uma linha de 1 pixel na própria cor,
     mais escura, por fora dela onde passa na frente de outra (e em volta da silhueta). 'nenhum' desliga. */
  const TAM_PIXEL = 1;
  M3.PIXEL = (() => {
    let q = null;
    try { q = localStorage.getItem('res.pixel'); } catch (e) { /* sem acesso: desligado */ }
    return q === 'liso' || q === 'contorno' || q === 'psx' ? q : 'nenhum';
  })();
  M3.definirPixel = (q) => {
    M3.PIXEL = q === 'liso' || q === 'contorno' || q === 'psx' ? q : 'nenhum';
    try { localStorage.setItem('res.pixel', M3.PIXEL); } catch (e) { /* modo privado: vale só agora */ }
  };
  let ARTE = false;   // desenhando em pixel art (a pintura fica mais simples: sem pincel, dobras nem anatomia)
  /* A caixa da pose na câmera ([x0, x1, y0, y1], em unidades do modelo a partir do pé): a esfera de cada peça (no espaço
     do osso, guardada na peça) levada pela matriz do osso. O pano e o cabelo que dobra podem sair da posição de
     descanso: a esfera deles cresce. É folgada de propósito (só serve para o quadro não cortar nada). */
  function esferaDaPeca(p) {
    if (p.esf) return p.esf;
    const v = p.vf;
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let k = 0; k < v.length; k += 3) {
      if (v[k] < x0) x0 = v[k]; if (v[k] > x1) x1 = v[k];
      if (v[k + 1] < y0) y0 = v[k + 1]; if (v[k + 1] > y1) y1 = v[k + 1];
      if (v[k + 2] < z0) z0 = v[k + 2]; if (v[k + 2] > z1) z1 = v[k + 2];
    }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
    let r = 0;
    for (let k = 0; k < v.length; k += 3) r = Math.max(r, Math.hypot(v[k] - cx, v[k + 1] - cy, v[k + 2] - cz));
    return (p.esf = [cx, cy, cz, r]);
  }
  function caixaDaPose(m, ossos, V, props) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of m.pecas) {
      if (!p.vf || !p.vf.length || (p.prop && props.indexOf(p.prop) < 0)) continue;
      const [cx, cy, cz, r0] = esferaDaPeca(p), M = mul(V, ossos[p.osso]);
      const s = Math.sqrt(Math.max(M[0] * M[0] + M[4] * M[4] + M[8] * M[8], M[1] * M[1] + M[5] * M[5] + M[9] * M[9], M[2] * M[2] + M[6] * M[6] + M[10] * M[10]));
      const r = r0 * s * (p.pano ? 1.5 : p.dobra ? 1.25 : 1) + 1;
      const qx = M[0] * cx + M[1] * cy + M[2] * cz + M[3], qy = M[4] * cx + M[5] * cy + M[6] * cz + M[7];
      if (qx - r < x0) x0 = qx - r; if (qx + r > x1) x1 = qx + r;
      if (qy - r < y0) y0 = qy - r; if (qy + r > y1) y1 = qy + r;
    }
    return isFinite(x0) ? [x0, x1, y0, y1] : [0, 0, 0, 0];
  }

  /* ---------- Smear (os quadros rápidos dos golpes, como nos desenhos animados) ----------
     Num quadro rápido, o lado de trás de cada peça (o que fica para trás no movimento) é puxado de volta até onde
     estava no quadro anterior da animação: o braço e a arma viram um borrão esticado ao longo do caminho, como os
     quadros de smear da animação 2D. As poses de antes vêm com a raiz alinhada à de agora (o corpo inteiro subindo ou
     descendo não estica; só os giros e os membros). O tronco e a cabeça esticam pouco; braços, armas e pernas, muito. */
  function inversa(M) {   // de uma matriz 3×4 (rotação com escala + translação)
    const a = M[0], b = M[1], c = M[2], d = M[4], e = M[5], f = M[6], g = M[8], h = M[9], i = M[10];
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C || 1e-9;
    const r = [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, 0, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, 0, C / det, -(a * h - b * g) / det, (a * e - b * d) / det, 0];
    r[3] = -(r[0] * M[3] + r[1] * M[7] + r[2] * M[11]); r[7] = -(r[4] * M[3] + r[5] * M[7] + r[6] * M[11]); r[11] = -(r[8] * M[3] + r[9] * M[7] + r[10] * M[11]);
    return r;
  }
  /* as matrizes da pose de antes, levadas para a raiz de agora (o giro e o deslocamento do corpo inteiro não esticam:
     só o que os membros andaram em relação ao quadril) */
  function ossosAnteriores(m, ossos, pose) {
    const A = ossosDaPose(m, pose), r = m.idx.raiz, Q = mul(ossos[r], inversa(A[r]));
    return A.map((M) => mul(Q, M));
  }
  const PESO_SMEAR = { braco: 0.8, antebraco: 1, mao: 1, coxa: 0.3, canela: 0.45, pe: 0.5, raiz: 0.2, tronco: 0.2, peito: 0.25,
    pescoco: 0.25, cabeca: 0.25, saia: 0.4, capa: 0.4, cabelo: 0.45, asas: 0.5, cauda: 0.6 };
  const pesoSmear = (nome) => { const n = nome.replace(/[ED]$/, ''); return PESO_SMEAR[n] != null ? PESO_SMEAR[n] : /^cabelo/.test(n) ? 0.45 : 0.5; };
  function esticar(m, p, T, v, n, M, MA, forca) {
    const o = m.esqueleto[p.osso], peso = (p.prop ? 1 : (o.peso != null ? o.peso : (o.peso = pesoSmear(o.nome)))) * forca;
    const [cx, cy, cz, r0] = esferaDaPeca(p);
    // o centro da peça agora e antes: a direção do movimento da peça
    const Cx = M[0] * cx + M[1] * cy + M[2] * cz + M[3], Cy = M[4] * cx + M[5] * cy + M[6] * cz + M[7], Cz = M[8] * cx + M[9] * cy + M[10] * cz + M[11];
    let ux = Cx - (MA[0] * cx + MA[1] * cy + MA[2] * cz + MA[3]), uy = Cy - (MA[4] * cx + MA[5] * cy + MA[6] * cz + MA[7]), uz = Cz - (MA[8] * cx + MA[9] * cy + MA[10] * cz + MA[11]);
    // peça que quase não andou (ou girou no lugar): usa o movimento médio dos vértices
    let l = Math.sqrt(ux * ux + uy * uy + uz * uz);
    if (l < 1.5) {
      ux = 0; uy = 0; uz = 0;
      for (let k = 0; k < n; k++) {
        const x = v[k * 3], y = v[k * 3 + 1], z = v[k * 3 + 2];
        ux += T[k * 3] - (MA[0] * x + MA[1] * y + MA[2] * z + MA[3]); uy += T[k * 3 + 1] - (MA[4] * x + MA[5] * y + MA[6] * z + MA[7]); uz += T[k * 3 + 2] - (MA[8] * x + MA[9] * y + MA[10] * z + MA[11]);
      }
      l = Math.sqrt(ux * ux + uy * uy + uz * uz) / n;
      if (l < 1.5) return;
      const s = Math.sqrt(ux * ux + uy * uy + uz * uz); ux /= s; uy /= s; uz /= s;
    } else { ux /= l; uy /= l; uz /= l; }
    const sc = Math.sqrt(M[0] * M[0] + M[4] * M[4] + M[8] * M[8]) || 1, r = Math.max(1, r0 * sc);
    for (let k = 0; k < n; k++) {
      const i = k * 3, x = v[i], y = v[i + 1], z = v[i + 2];
      // atrás do centro (no sentido do movimento): fica para trás; na frente, não mexe
      const rel = ((T[i] - Cx) * ux + (T[i + 1] - Cy) * uy + (T[i + 2] - Cz) * uz) / r;
      const w = R.clamp(0.1 - rel * 1.5, 0, 1) * peso;
      if (w <= 0) continue;
      let dx = T[i] - (MA[0] * x + MA[1] * y + MA[2] * z + MA[3]), dy = T[i + 1] - (MA[4] * x + MA[5] * y + MA[6] * z + MA[7]), dz = T[i + 2] - (MA[8] * x + MA[9] * y + MA[10] * z + MA[11]);
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < 4) continue;   // o que andou pouco não estica (só as partes rápidas viram borrão)
      const k2 = (d > 48 ? 48 / d : 1) * w * R.clamp((d - 4) / 10, 0, 1);
      T[i] -= dx * k2; T[i + 1] -= dy * k2; T[i + 2] -= dz * k2;
    }
  }

  M3.renderizar = function (m, pose, op) {
    op = op || {};
    // op.pixel: false (miniaturas: nunca), 'liso' ou 'contorno' (força); sem ele, o da configuração
    const PIX = op.pixel === false ? null : op.pixel || (M3.PIXEL !== 'nenhum' ? M3.PIXEL : null);
    ARTE = !!PIX;
    const K = PIX ? 1 : Math.max(1, Math.round(op.aa != null ? op.aa : M3.AA));
    const P = PIX ? Math.max(1, Math.round((op.escala || 2) * TAM_PIXEL)) : 1;   // pixels do quadro por pixel da arte
    // op.tamanho: o modelo maior no mundo (monstros grandes) com os mesmos pixels da arte (o quadro só fica maior)
    const E = (PIX ? (op.escala || 2) / P : (op.escala || 2) * K) * (op.tamanho || 1);
    const RZ = K / P;   // pixels do buffer por pixel do quadro
    let W = (op.w ? Math.ceil(op.w * RZ) : Math.round(220 * E)), H = (op.h ? Math.ceil(op.h * RZ) : Math.round(150 * E));
    let ox = op.ox != null ? op.ox * RZ : W / 2, oy = op.oy != null ? op.oy * RZ : Math.round(125 * E);
    const ossos = ossosDaPose(m, pose);
    FOLGA_BRACOS = pose.bracosSobreAsas ? 40 : 0;
    const V = mul(rotX(op.pitch != null ? op.pitch : M3.CAMERA.pitch), rotY(op.yaw != null ? op.yaw : M3.CAMERA.yaw));
    const props = pose.props || [];
    const ant = op.anterior && op.smear ? ossosAnteriores(m, ossos, op.anterior) : null;
    if (!op.w && !op.h && op.ox == null && op.oy == null && !op.foco) {
      // quadros do jogo: a janela padrão (110 unidades para cada lado, 125 acima do pé e 25 abaixo) cresce quando a pose
      // sai dela (o cabelo subindo no mortal, um chute alto) — assim nada fica recortado (nem o smear, que vai até a
      // pose de antes)
      const c = caixaDaPose(m, ossos, V, props);
      if (ant) { const c2 = caixaDaPose(m, ant, V, props); c[0] = Math.min(c[0], c2[0]); c[1] = Math.max(c[1], c2[1]); c[2] = Math.min(c[2], c2[2]); c[3] = Math.max(c[3], c2[3]); }
      const x0 = Math.min(-110, Math.floor(c[0] / 16) * 16), x1 = Math.max(110, Math.ceil(c[1] / 16) * 16);
      const y0 = Math.min(-25, Math.floor(c[2] / 16) * 16), y1 = Math.max(125, Math.ceil(c[3] / 16) * 16);
      if (x0 < -110 || x1 > 110 || y0 < -25 || y1 > 125) { W = Math.round((x1 - x0) * E); H = Math.round((y1 - y0) * E); ox = -x0 * E; oy = y1 * E; }
    }
    const B = buffer(W, H);
    // pano que desvia das pernas e cabelo que dobra (e sai de dentro do tronco)
    const caps = m.colisao ? capsulasDaPose(m, ossos) : null;
    const curvas = m.colisao ? cabelosDaPose(m, ossos, pose) : null;
    if (op.foco) {   // enquadra um ponto de um osso (retratos)
      const f = op.foco, q = aplicar(mul(V, ossos[m.idx[f.osso]]), f.p[0], f.p[1], f.p[2]);
      ox = f.x * RZ - q[0] * E; oy = f.y * RZ + q[1] * E;
    }
    if (PIX) { ox = Math.round(ox); oy = Math.round(oy); }   // o pé no grid dos pixels da arte (senão a figura treme)
    const pal = m.pal, F = m.rosto, ex = pose.rosto || {};
    ROSTO_TEXEL = E * (m.cabeca || 1) * TX_ROSTO >= 1.6;   // texels do rosto com 1,6 pixel ou mais: aparecem
    const emb = pal[MAT.emblema], mar = pal[MAT.marcas], c2 = pal[MAT.corpo2], ca2 = pal[MAT.cauda2];
    const cab = pal[MAT.cabelo];
    /* o triângulo que está sendo pintado: material, efeito, luz nos vértices, pontos da peça e uv (mechas) */
    const S = { mt: null, ef: 0, amp: 0, vies: 0, cabelo: 0, semente: 0, anel: false, topo: 1e9, ik: 1, anat: 0, gx: 0, gy: 0, gz: 0,
      d0: 0, d1: 0, d2: 0, x0: 0, y0: 0, z0: 0, x1: 0, y1: 0, z1: 0, x2: 0, y2: 0, z2: 0, u0: 0, v0: 0, u1: 0, v1: 0, u2: 0, v2: 0,
      mi: 0, sal: 0, onde: 0, nx: 0, ny: 0, nz: 1, peleRosto: false, semDano: false };   // (as últimas: dano visível)
    /* listras do cabelo: na mecha, ao longo dela (u: de um lado ao outro, v: da raiz à ponta); na touca e no resto,
       saindo do alto da cabeça. Devolve quanto a listra clareia ou escurece. */
    const listras = (x, y, z, w0, w1, w2) => {
      let l;
      // como nos cabelos pintados das referências: três tons (escuro, a cor do cabelo e claro) em listras finas ao
      // longo da mecha, cada listra quebrada em trechos, com as bordas serrilhadas no grid dos texels
      const j = hash3(Math.floor(x * INV_TX), Math.floor(y * INV_TX), Math.floor(z * INV_TX)) - 0.5;
      if (S.cabelo === 1) {
        const u = w0 * S.u0 + w1 * S.u1 + w2 * S.u2 + j * 0.07, v = w0 * S.v0 + w1 * S.v1 + w2 * S.v2 + j * 0.05;
        // ~6 listras por mecha, cada uma em 3 ou 4 trechos (no pixel art, 2 listras mais largas: as finas viram chuvisco)
        const f = Math.floor(u * (ARTE ? 2.2 : 6) + S.semente * 0.37);
        const g = Math.floor(v * (ARTE ? 1.6 : 3.4) + hash3(f, S.semente, 11) * 2);
        const h = hash3(f, g, S.semente * 13 + 7);
        l = h < 0.32 ? -0.62 : h > 0.8 ? 0.48 : (h - 0.56) * 0.3;
        if (v < 0.1) l -= 0.42;   // raiz escura (a sombra da touca)
        else if (v < 0.32 && h > 0.6) l += 0.28;   // brilho no alto da mecha
      } else {   // touca: as listras saem do alto da cabeça
        const f = Math.floor(Math.atan2(x, z - 0.3) * (ARTE ? 4 : 9) + 0.5 + j * 0.3), g = Math.floor(y * 0.42 + hash3(f, 2, 3) * 2);
        const h = hash3(f, g, 9);
        l = h < 0.3 ? -0.5 : h > 0.82 ? 0.38 : (h - 0.56) * 0.2;
      }
      // a faixa de brilho em volta da cabeça (o "anel de anjo" dos cabelos de anime)
      if (ARTE) l *= 0.3;   // tons mais próximos (o pixel art é mais liso: as listras viravam manchas)
      if (S.anel && z > -4) { const yb = 16.4 + Math.sin(Math.atan2(x, z) * 7) * 0.5; if (y > yb - 0.8 && y < yb + 0.8) l += 0.62; }
      return l;
    };
    /* anatomia pintada na pele (coordenadas da peça): quanto escurece o ponto. 1 peito, 2 barriga, ±3 braço
       (o sinal é o lado: para fora é x × lado > 0) */
    const kt = F.troncoK, mu = F.musculo, PELE = pal[MAT.pele];
    /* dobras do pano pintadas (como nas texturas pintadas à mão): no joelho, no cotovelo e na cintura */
    const dobras = (a, x, y, z) => {
      const A = a < 0 ? -a : a, ax = Math.abs(x);
      if (A === 6) return z > 0.8 && ax < 2.2 && Math.abs(y + 1.5 + ax * 0.14) < 0.17 ? 0.5 : 0;   // logo abaixo do joelho
      if (A === 5) {   // coxa: duas dobras curvas acima do joelho, na frente
        const yk = -21 * F.perna;
        return z > 0.5 && ax < 2.8 && (Math.abs(y - (yk + 2.3) - ax * 0.28) < 0.17 || Math.abs(y - (yk + 3.8) - ax * 0.2) < 0.14) ? 0.5 : 0;
      }
      if (A === 4) return z > 0.6 && (Math.abs(y + 0.9 + ax * 0.22) < 0.15 || Math.abs(y + 2.1 - ax * 0.16) < 0.12) ? 0.5 : 0;   // cotovelo
      if (A === 2) {   // cintura: dobras curvas dos lados
        const yy = y / kt;
        return z > 2.2 && ax > 1.4 && ax < 4.6 && (Math.abs(yy - 1.7 - ax * 0.22) < 0.17 || Math.abs(yy - 3.7 - ax * 0.15) < 0.14) ? 0.45 : 0;
      }
      return 0;
    };
    const anatomia = (a, x, y, z) => {
      const ax = Math.abs(x);
      if (a === 1) {
        const yy = y / kt;
        if (z > 1.6 && ax > 1.0 && ax < F.ombro * 0.72 && Math.abs(yy - (11.0 + 0.1 * ax)) < 0.26) return 0.6;   // clavículas
        if (mu > 0 && z > 3 && ax > 0.5 && ax < F.ombro * 0.78 && Math.abs(yy - (5.9 + 0.07 * ax * ax)) < 0.34) return 0.55;   // peitoral
        if (mu > 0 && ax < 0.2 && yy > 6 && yy < 10.4 && z > 3) return 0.35;   // esterno
        return 0;
      }
      if (a === 2 && mu > 0) {
        const yy = y / kt;
        if (z < 2) return 0;
        if (ax < 0.18 && yy > 0.4 && yy < 6.6) return 0.45;   // linha do meio
        if (ax > 0.4 && ax < 2.6 && (Math.abs(yy - 2.2) < 0.2 || Math.abs(yy - 4.5) < 0.2)) return 0.4;   // gomos
        if (ax < 0.3 && Math.abs(yy - 0.2) < 0.32) return 0.7;   // umbigo
        return 0;
      }
      if ((a === 3 || a === -3) && mu > 0) {
        const fora = x * a > 0, B = F.braco;
        if (fora && Math.abs(y - (-5.4 + 1.5 * Math.abs(z) / B)) < 0.32) return 0.5;   // deltoide
        if (z > B * 0.3 && Math.abs(y + 11.6) < 0.36) return 0.45;   // fim do bíceps
      }
      return 0;
    };
    const pintar0 = (w0, w1, w2) => {
      const x = w0 * S.x0 + w1 * S.x1 + w2 * S.x2, y = w0 * S.y0 + w1 * S.y1 + w2 * S.y2, z = w0 * S.z0 + w1 * S.z1 + w2 * S.z2;
      // a luz no centro do texel (a borda entre dois tons anda em degraus de texel, como uma textura pintada em pixels)
      const qx = (Math.floor(x * INV_TX) + 0.5) * TEXEL, qy = (Math.floor(y * INV_TX) + 0.5) * TEXEL, qz = (Math.floor(z * INV_TX) + 0.5) * TEXEL;
      let n = w0 * S.d0 + w1 * S.d1 + w2 * S.d2 + S.gx * (qx - x) + S.gy * (qy - y) + S.gz * (qz - z) + S.vies;
      if (S.amp) n += ruido(x, y, z) * S.amp;
      if (S.cabelo) n += listras(x, y, z, w0, w1, w2);
      if (y > S.topo) n -= 0.4;   // sombra pintada (o alto do pescoço, debaixo do queixo)
      if (S.anat) {
        if (S.mt === PELE) { if (F.musculo >= 0) n -= anatomia(S.anat, x, y, z); }
        else if (!S.mt.metal && !S.cabelo && S.ef !== 6) n -= dobras(S.anat, x, y, z);   // dobras pintadas no pano
      }
      const mt = S.mt, ef = S.ef;
      if (ef === 1) {   // rosto pintado: a pele leva a sombra da franja na testa
        if (F.franja && y > 14.3 + Math.sin(x * 1.4) * 0.45) n -= 0.55;
        const c = pixelRosto(F, ex, x, y, z, n);
        S.peleRosto = !c;   // (o dano visível só risca a pele)
        return c || tom(mt, n);
      }
      const base = tom(mt, n);
      if (ef < 3) return base;
      if (ef === 3) return pixelMascara(F, x, y, base);
      const claro = n > LIMIAR;
      if (ef === 4) { const e = pixelEmblema(F.emblema, x, y); return e === 0 ? base : e === 2 ? emb.linha : claro ? emb.luz : emb.sombra; }
      if (ef === 5) return pixelMarcas(F.marcas, x, y, z) ? (claro ? mar.luz : mar.sombra) : base;
      if (ef === 6) {   // anéis da cota de malha
        const H = 0.95, row = Math.floor(y / H), fx = (((x / H + (row & 1) * 0.5) % 1) + 1) % 1 - 0.5, fy = (((y / H) % 1) + 1) % 1 - 0.5;
        return fx * fx + fy * fy < 0.07 ? (claro ? mt.sombra : mt.linha) : base;
      }
      if (ef === 7) { const ax = Math.abs(x); return ax < 0.8 || y > 10.2 ? base : ((((y + ax * 0.32) / 2.0) % 1 + 1) % 1 < 0.42 ? c2.sombra : base); }   // costelas
      if (ef === 8) return Math.abs(x) < 1.1 && z < 2 ? base : c2.sombra;   // barriga oca do osteon
      if (ef === 10) {   // dedos: três vãos escuros entre os quatro dedos
        const fz = (((z * S.ik + 1.66) / 0.83) % 1 + 1) % 1;
        return y * S.ik < -2.5 && (fz < 0.17 || fz > 0.93) ? (n > LIMIAR ? mt.sombra : mt.funda) : base;
      }
      return pixelMarcas('escamas', x, y, z) ? (claro ? ca2.luz : ca2.sombra) : base;   // escamas da cauda de sereia
    };
    /* dano visível (op.dano: 1 ferido, 2 muito ferido), marca a marca (marcaDano):
       - no pano (camisa, casaco, capa, capuz, luvas, calça, saia, meias): metade são rasgos (o buraco mostra a pele por
         baixo, nas peças do corpo, ou o fundo escuro, com a borda escura dos fiapos; muito ferido, metade com sangue em
         volta), um quarto são cortes (a fenda escura; muito ferido, aberta) e o resto, sujeira (ferido) ou manchas de
         sangue (muito ferido);
       - na pele: cortes vermelhos (muito ferido, as três garras) e esfolados; muito ferido, hematomas roxos;
       - no metal: arranhões claros e, muito ferido, amassados; no couro, nos calçados e no resto: arranhões, sujeira e,
         muito ferido, sangue.
       Armas, cabelo, rosto, olhos, garras e brilhos ficam como estão. */
    const DANO = op.dano > 0 ? Math.min(2, Math.round(op.dano)) : 0;
    const SEM_DANO = new Set([MAT.cabelo, MAT.rosto, MAT.vidro, MAT.brilho, MAT.aureola, MAT.orelhaDentro, MAT.trevas, MAT.tela, MAT.garra, MAT.presa]);
    const RASGA = new Set([MAT.tecido]);
    ['peito', 'casaco', 'capa', 'capuz', 'luvas', 'pernas', 'saia', 'meias'].forEach((g) => { RASGA.add(MAT[g]); RASGA.add(MAT[g + '2']); });
    const sangue = (claro) => DANO_SANGUE[claro ? 0 : 1];
    const pintar = !DANO ? pintar0 : (w0, w1, w2) => {
      const cor = pintar0(w0, w1, w2);
      if (S.ef === 1) return S.peleRosto && S.sal >= 0 ? rostoFerido(DANO, w0 * S.x0 + w1 * S.x1 + w2 * S.x2, w0 * S.y0 + w1 * S.y1 + w2 * S.y2, cor) : cor;
      if (S.semDano) return cor;
      const x = w0 * S.x0 + w1 * S.x1 + w2 * S.x2, y = w0 * S.y0 + w1 * S.y1 + w2 * S.y2, z = w0 * S.z0 + w1 * S.z1 + w2 * S.z2;
      if (!marcaDano(DANO, x, y, z, S.sal, S.nx, S.ny, S.nz)) return cor;
      const r = DM.r, rr = DM.rr, R = DM.R, h = DM.h, rs = DM.risco, mt = S.mt, n = w0 * S.d0 + w1 * S.d1 + w2 * S.d2 + S.vies, claro = n > LIMIAR;
      if (mt === PELE || S.mi === MAT.marcas || S.mi === MAT.focinho) {   // pele
        if (h < 0.6) return rs < 0.3 ? sangue(false) : rs < 0.62 ? DANO_CORTE : cor;   // cortes (o meio mais escuro)
        if (DANO >= 2) {   // hematoma com um corte no meio
          if (rs < 0.5 && rr < R * 0.75) return DANO_CORTE;
          return rr < R * 0.55 || (rr < R * 0.85 && xadrez(x, y, z)) ? DANO_HEMATOMA[claro ? 0 : 1] : cor;
        }
        return rr < R * 0.75 && (rr < R * 0.4 || xadrez(x, y, z)) ? DANO_RASPAO : cor;   // esfolado
      }
      if (mt.metal) {   // arranhões e amassados
        if (h < 0.7) return rs < 0.34 ? mt.claro : cor;
        if (DANO < 2) return cor;
        return rr < R * 0.4 ? mt.funda : rr < R * 0.56 ? mt.claro : cor;
      }
      if (!RASGA.has(S.mi)) {   // couro, calçados e o resto: arranhões, sujeira e sangue
        if (h < 0.5) return rs < 0.36 ? (claro ? mt.realce : mt.luz) : cor;
        if (DANO >= 2 && h > 0.75) return rr < R * 0.5 || (rr < R * 0.8 && xadrez(x, y, z)) ? sangue(claro) : cor;
        return rr < R * 0.8 && xadrez(x, y, z) ? (claro ? mt.sombra : mt.funda) : cor;
      }
      const fundo = S.onde === 1 ? tom(PELE, n - 0.3) : mt.funda;   // o que aparece pelo buraco
      if (h < 0.5) {   // rasgo
        const Rb = DANO >= 2 && h < 0.25 ? R * 0.74 : R;   // (o sangue em volta)
        if (r < Rb - 0.8) return fundo;
        if (r < Rb) return mt.linha;
        return r < R * 0.88 || xadrez(x, y, z) ? sangue(claro) : cor;
      }
      if (h < 0.75) {   // corte no pano: a fenda escura (muito ferido, aberta: a pele no meio)
        if (DANO >= 2) return rs < 0.34 ? fundo : rs < 0.8 ? mt.linha : cor;
        return rs < 0.5 ? mt.linha : cor;
      }
      if (DANO >= 2) return rr < R * 0.6 || (rr < R * 0.9 && xadrez(x, y, z)) ? sangue(claro) : cor;   // mancha de sangue
      return rr < R * 0.85 && xadrez(x, y, z) ? (claro ? mt.sombra : mt.funda) : cor;   // sujeira
    };
    const L0 = LUZ[0], L1 = LUZ[1], L2 = LUZ[2];
    let T = new Float32Array(3 * 600), D = new Float32Array(600);
    // tabela dos triângulos a pintar (NT números cada): material, efeito, luz, pontos, uv e os dados da peça
    let TB = TABELA, nt = 0;
    const guardar = (mi, ef, p) => {
      if ((nt + 2) * NT > TB.length) { const t2 = new Float32Array(TB.length * 2); t2.set(TB); TB = TABELA = t2; }
      nt++;
      const o = nt * NT;
      TB[o] = mi; TB[o + 1] = ef; TB[o + 2] = S.d0; TB[o + 3] = S.d1; TB[o + 4] = S.d2;
      TB[o + 5] = S.x0; TB[o + 6] = S.y0; TB[o + 7] = S.z0; TB[o + 8] = S.x1; TB[o + 9] = S.y1; TB[o + 10] = S.z1; TB[o + 11] = S.x2; TB[o + 12] = S.y2; TB[o + 13] = S.z2;
      TB[o + 14] = S.u0; TB[o + 15] = S.v0; TB[o + 16] = S.u1; TB[o + 17] = S.v1; TB[o + 18] = S.u2; TB[o + 19] = S.v2;
      TB[o + 20] = S.cabelo; TB[o + 21] = S.semente; TB[o + 22] = S.anel ? 1 : 0; TB[o + 23] = S.topo; TB[o + 24] = S.ik; TB[o + 25] = S.anat;
      TB[o + 26] = p.prop ? -1 : ((p.grupo || 0) * 13 + (p.osso || 0) * 7) % 97; TB[o + 27] = OSSOS_DO_CORPO.has(m.esqueleto[p.osso].nome) ? 1 : 0;   // (dano visível)
      return nt;
    };
    const carregar = (tid) => {
      const o = tid * NT;
      S.mt = pal[TB[o]]; S.ef = TB[o + 1]; S.amp = ARTE ? 0 : S.mt.pincel; S.vies = S.mt.vies;
      S.d0 = TB[o + 2]; S.d1 = TB[o + 3]; S.d2 = TB[o + 4];
      S.x0 = TB[o + 5]; S.y0 = TB[o + 6]; S.z0 = TB[o + 7]; S.x1 = TB[o + 8]; S.y1 = TB[o + 9]; S.z1 = TB[o + 10]; S.x2 = TB[o + 11]; S.y2 = TB[o + 12]; S.z2 = TB[o + 13];
      S.u0 = TB[o + 14]; S.v0 = TB[o + 15]; S.u1 = TB[o + 16]; S.v1 = TB[o + 17]; S.u2 = TB[o + 18]; S.v2 = TB[o + 19];
      S.cabelo = TB[o + 20]; S.semente = TB[o + 21]; S.anel = TB[o + 22] > 0; S.topo = TB[o + 23]; S.ik = TB[o + 24]; S.anat = ARTE ? 0 : TB[o + 25];
      S.mi = TB[o]; S.sal = TB[o + 26]; S.onde = TB[o + 27];
      // gradiente da luz no plano do triângulo (para levar a luz até o centro do texel)
      const e1x = S.x1 - S.x0, e1y = S.y1 - S.y0, e1z = S.z1 - S.z0, e2x = S.x2 - S.x0, e2y = S.y2 - S.y0, e2z = S.z2 - S.z0;
      if (DANO) {   // a normal do triângulo nas coordenadas da peça e se a marca pega nele (dano visível)
        S.semDano = S.sal < 0 || S.cabelo > 0 || SEM_DANO.has(S.mi);
        const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x, l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        S.nx = nx / l; S.ny = ny / l; S.nz = nz / l;
      }
      const a = e1x * e1x + e1y * e1y + e1z * e1z, b = e1x * e2x + e1y * e2y + e1z * e2z, c = e2x * e2x + e2y * e2y + e2z * e2z, det = a * c - b * b;
      if (det > 1e-9) {
        const dn1 = S.d1 - S.d0, dn2 = S.d2 - S.d0, al = (dn1 * c - dn2 * b) / det, be = (dn2 * a - dn1 * b) / det;
        S.gx = al * e1x + be * e2x; S.gy = al * e1y + be * e2y; S.gz = al * e1z + be * e2z;
      } else { S.gx = 0; S.gy = 0; S.gz = 0; }
    };
    let pid = 0;
    for (const p of m.pecas) {
      pid++;
      if (p.prop && props.indexOf(p.prop) < 0) continue;
      if (op.filtro && !op.filtro(p, m)) continue;
      const M = mul(V, ossos[p.osso]);
      const v = p.vf, nv = p.nf, n = v.length / 3;
      if (n * 3 > T.length) { T = new Float32Array(n * 3); D = new Float32Array(n); }
      const pano = p.pano && caps ? panoDaPose(m, p, ossos, pose, caps) : null;
      const dob = !pano && p.dobra && curvas && curvas.size ? curvas.get(p.osso) : null;
      if (pano) {   // pano: os vértices já vêm no espaço do modelo (só falta a câmera)
        const P = pano.P, NP = pano.N;
        for (let k = 0; k < n; k++) {
          const x = P[k * 3], y = P[k * 3 + 1], z = P[k * 3 + 2];
          T[k * 3] = V[0] * x + V[1] * y + V[2] * z + V[3];
          T[k * 3 + 1] = V[4] * x + V[5] * y + V[6] * z + V[7];
          T[k * 3 + 2] = V[8] * x + V[9] * y + V[10] * z + V[11];
          const a = NP[k * 3], b = NP[k * 3 + 1], c = NP[k * 3 + 2];
          const qx = V[0] * a + V[1] * b + V[2] * c, qy = V[4] * a + V[5] * b + V[6] * c, qz = V[8] * a + V[9] * b + V[10] * c;
          D[k] = (qx * L0 + qy * L1 + qz * L2) / (Math.sqrt(qx * qx + qy * qy + qz * qz) || 1);
        }
      } else if (dob) {   // cabelo que dobra: da matriz da raiz à da ponta, passando pela do meio
        const A0 = mul(V, dob[0]), A1 = mul(V, dob[1]), A2 = mul(V, dob[2]), dobra = p.dobra;
        for (let k = 0; k < n; k++) {
          const s = dobra[k], Ma = s < 0.5 ? A0 : A1, Mb = s < 0.5 ? A1 : A2, u = s < 0.5 ? s * 2 : s * 2 - 1;
          const x = v[k * 3], y = v[k * 3 + 1], z = v[k * 3 + 2];
          const ax = Ma[0] * x + Ma[1] * y + Ma[2] * z + Ma[3], ay = Ma[4] * x + Ma[5] * y + Ma[6] * z + Ma[7], az = Ma[8] * x + Ma[9] * y + Ma[10] * z + Ma[11];
          const bx = Mb[0] * x + Mb[1] * y + Mb[2] * z + Mb[3], by = Mb[4] * x + Mb[5] * y + Mb[6] * z + Mb[7], bz = Mb[8] * x + Mb[9] * y + Mb[10] * z + Mb[11];
          T[k * 3] = ax + (bx - ax) * u; T[k * 3 + 1] = ay + (by - ay) * u; T[k * 3 + 2] = az + (bz - az) * u;
          const a = nv[k * 3], b = nv[k * 3 + 1], c = nv[k * 3 + 2];
          const nax = Ma[0] * a + Ma[1] * b + Ma[2] * c, nay = Ma[4] * a + Ma[5] * b + Ma[6] * c, naz = Ma[8] * a + Ma[9] * b + Ma[10] * c;
          const qx = nax + (Mb[0] * a + Mb[1] * b + Mb[2] * c - nax) * u, qy = nay + (Mb[4] * a + Mb[5] * b + Mb[6] * c - nay) * u, qz = naz + (Mb[8] * a + Mb[9] * b + Mb[10] * c - naz) * u;
          D[k] = (qx * L0 + qy * L1 + qz * L2) / (Math.sqrt(qx * qx + qy * qy + qz * qz) || 1);
        }
      } else {
        for (let k = 0; k < n; k++) {
          const x = v[k * 3], y = v[k * 3 + 1], z = v[k * 3 + 2];
          T[k * 3] = M[0] * x + M[1] * y + M[2] * z + M[3];
          T[k * 3 + 1] = M[4] * x + M[5] * y + M[6] * z + M[7];
          T[k * 3 + 2] = M[8] * x + M[9] * y + M[10] * z + M[11];
          // luz no vértice (normal suave girada com o osso)
          const a = nv[k * 3], b = nv[k * 3 + 1], c = nv[k * 3 + 2];
          const qx = M[0] * a + M[1] * b + M[2] * c, qy = M[4] * a + M[5] * b + M[6] * c, qz = M[8] * a + M[9] * b + M[10] * c;
          D[k] = (qx * L0 + qy * L1 + qz * L2) / (Math.sqrt(qx * qx + qy * qy + qz * qz) || 1);   // (Math.hypot é bem mais lento)
        }
        if (ant) esticar(m, p, T, v, n, M, mul(V, ant[p.osso]), op.smear);
      }
      // a peça inteira: listras de cabelo, brilho em volta da cabeça, sombra no alto
      const ehCabelo = p.mecha ? 1 : 2, naCabeca = m.esqueleto[p.osso].nome === 'cabeca';
      S.semente = (p.grupo * 7) % 11; S.topo = p.sombraTopo != null ? p.sombraTopo : 1e9; S.ik = p.ik || 1; S.anat = p.anat || 0;
      const t = p.tf, uv = p.uvf;
      for (let k = 0; k < t.length; k += 5) {
        const ia = t[k], ib = t[k + 1], ic = t[k + 2], a = ia * 3, b = ib * 3, c = ic * 3, mt = pal[t[k + 3]], ef = t[k + 4];
        const ax = T[a], ay = T[a + 1], az = T[a + 2], bx = T[b], by = T[b + 1], bz = T[b + 2], cx = T[c], cy = T[c + 1], cz = T[c + 2];
        // normal da face (espaço da câmera, z para a câmera)
        let nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
        let ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
        let nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
        if (nz < 0) {   // o lado de dentro (só peças abertas): cor lisa, do forro ou da sombra
          if (!p.aberta) continue;
          nx = -nx; ny = -ny; nz = -nz;
          const dd = (nx * L0 + ny * L1 + nz * L2) / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
          const cor = mt.verso ? (dd > LIMIAR ? mt.verso.luz : mt.verso.sombra) : mt.sombra;
          triangulo(B, ox + ax * E, oy - ay * E, az, ox + bx * E, oy - by * E, bz, ox + cx * E, oy - cy * E, cz, cor, mt.linha, p.grupo, 0, pid);
          continue;
        }
        if (mt.plano) {   // brilho, auréola: cor lisa
          triangulo(B, ox + ax * E, oy - ay * E, az, ox + bx * E, oy - by * E, bz, ox + cx * E, oy - cy * E, cz, mt.luz, mt.linha, p.grupo, 0, pid);
          continue;
        }
        const dF = (nx * L0 + ny * L1 + nz * L2) / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
        S.d0 = SUAVE * D[ia] + (1 - SUAVE) * dF; S.d1 = SUAVE * D[ib] + (1 - SUAVE) * dF; S.d2 = SUAVE * D[ic] + (1 - SUAVE) * dF;
        S.x0 = v[a]; S.y0 = v[a + 1]; S.z0 = v[a + 2]; S.x1 = v[b]; S.y1 = v[b + 1]; S.z1 = v[b + 2]; S.x2 = v[c]; S.y2 = v[c + 1]; S.z2 = v[c + 2];
        if (mt === cab) {
          S.cabelo = ehCabelo; S.anel = naCabeca && (ef === 2 || p.mecha);
          if (ehCabelo === 1) { S.u0 = uv[ia * 2]; S.v0 = uv[ia * 2 + 1]; S.u1 = uv[ib * 2]; S.v1 = uv[ib * 2 + 1]; S.u2 = uv[ic * 2]; S.v2 = uv[ic * 2 + 1]; }
        } else { S.cabelo = 0; S.anel = false; }
        triangulo(B, ox + ax * E, oy - ay * E, az, ox + bx * E, oy - by * E, bz, ox + cx * E, oy - cy * E, cz, 0, mt.linha, p.grupo, guardar(t[k + 3], ef, p), pid);
      }
    }
    // pinta cada pixel visível uma vez (o triângulo só é carregado quando muda de um pixel para o outro)
    const tb = B.t, gb = B.g, cb = B.c, wa = B.w0, wb = B.w1;
    let atual = 0;
    const amostra = (i) => {
      const tid = tb[i];
      if (!gb[i] || !tid) return;
      if (tid !== atual) { carregar(tid); atual = tid; }
      const w0 = wa[i], w1 = wb[i];
      cb[i] = pintar(w0, w1, 1 - w0 - w1);
    };
    if (K === 2) {
      // supersampling: dentro de um triângulo só (sem rosto, desenhos ou marcas), pinta uma vez por bloco 2 × 2;
      // nas bordas e nos desenhos pintados, cada amostra (é onde o antialiasing aparece)
      for (let y = B.my0 & ~1; y <= B.my1; y += 2) {
        for (let x = B.mx0 & ~1; x <= B.mx1; x += 2) {
          const i = y * W + x, j = i + 1, k = i + W, l = k + 1, t = tb[i];
          if (t && gb[i] && gb[j] && gb[k] && gb[l] && tb[j] === t && tb[k] === t && tb[l] === t && TB[t * NT + 1] < 3 && TB[t * NT + 1] !== 1) {
            if (t !== atual) { carregar(t); atual = t; }
            const w0 = (wa[i] + wa[j] + wa[k] + wa[l]) * 0.25, w1 = (wb[i] + wb[j] + wb[k] + wb[l]) * 0.25;
            cb[i] = cb[j] = cb[k] = cb[l] = pintar(w0, w1, 1 - w0 - w1);
          } else { amostra(i); amostra(j); amostra(k); amostra(l); }
        }
      }
    } else {
      for (let y = B.my0; y <= B.my1; y++) for (let x = B.mx0, i = y * W + B.mx0; x <= B.mx1; x++, i++) amostra(i);
    }
    return PIX ? recortePixel(B, op, ox, oy, PIX, P) : contornoERecorte(B, op, ox, oy, K);
  };

  /* Pixel art: o contorno (de 1 pixel, na cor da peça da frente, mais escura, por fora dela) e o quadro ampliado P × P,
     sem suavizar. Uma peça "passa na frente" de outra quando está Z_PIXEL unidades mais perto da câmera (as emendas de
     uma superfície contínua, como o tronco e o quadril, não ganham linha); uma mecha de cabelo na frente de outra,
     Z_CABELO (senão o cabelo vira um emaranhado de linhas). */
  const ESCURO_PIXEL = 0.62, Z_PIXEL = 0.8, Z_CABELO = 3;
  function recortePixel(B, op, ox, oy, modo, P) {
    const W = B.w, H = B.h, g = B.g, z = B.z, c = B.c, pd = B.p, o = B.o, comLinha = modo === 'contorno';
    const rx0 = Math.max(0, B.mx0 - 1), ry0 = Math.max(0, B.my0 - 1), rx1 = Math.min(W - 1, B.mx1 + 1), ry1 = Math.min(H - 1, B.my1 + 1);
    B.sujo = rx1 >= rx0 ? [rx0, ry0, rx1, ry1] : null;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = ry0; y <= ry1; y++) {
      for (let x = rx0, i = y * W + rx0; x <= rx1; x++, i++) {
        const gi = g[i];
        let cor = gi ? c[i] : 0;
        if (comLinha) {   // o vizinho mais à frente, de outra peça, que passa na frente deste pixel (ou o vazio em volta)
          const pi = gi ? pd[i] : -1, zi = gi ? z[i] : -1e9, cab = gi >= 100 || gi === 6;
          let melhor = -1e9, j = -1;
          const ver = (k) => {
            const gk = g[k];
            if (!gk || pd[k] === pi) return;
            const lim = gi ? zi + (cab && (gk >= 100 || gk === 6) ? Z_CABELO : Z_PIXEL) : -1e9;
            if (z[k] > lim && z[k] > melhor) { melhor = z[k]; j = k; }
          };
          if (x + 1 < W) ver(i + 1);
          if (x > 0) ver(i - 1);
          if (y + 1 < H) ver(i + W);
          if (y > 0) ver(i - W);
          if (j >= 0) cor = escurecer(c[j], ESCURO_PIXEL);
        }
        o[i] = cor;
        if (cor) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
    }
    if (op.inteiro) {
      x0 = 0; y0 = 0; x1 = W - 1; y1 = H - 1;
      if (B.sujo) { o.fill(0, 0, ry0 * W); o.fill(0, (ry1 + 1) * W); for (let y = ry0; y <= ry1; y++) { o.fill(0, y * W, y * W + rx0); o.fill(0, y * W + rx1 + 1, (y + 1) * W); } } else o.fill(0);
    }
    if (x1 < x0) { x0 = 0; y0 = 0; x1 = 0; y1 = 0; }
    let w = (x1 - x0 + 1) * P, h = (y1 - y0 + 1) * P;
    if (op.inteiro && op.w) { w = Math.min(w, op.w); h = Math.min(h, op.h); }
    let cv = op.cv;
    if (!cv) cv = R.novoCanvas(w, h);
    else if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const cx = cv.getContext('2d');
    const img = cx.createImageData(w, h);
    const d32 = new Uint32Array(img.data.buffer), linha = new Uint32Array(w);
    for (let y = 0; y < h; y += P) {   // uma linha da arte, repetida P vezes
      const base = (y0 + y / P) * W + x0;
      for (let x = 0; x < w; x++) linha[x] = o[base + Math.floor(x / P)];
      for (let k = 0; k < P && y + k < h; k++) d32.set(linha, (y + k) * w);
    }
    cx.putImageData(img, 0, 0);
    return { cv, ax: (ox - x0) * P, ay: (oy - y0) * P, w, h, E: op.escala || 2 };
  }

  /* Contorno de tinta: em volta da silhueta (por fora) e onde uma peça passa na frente de outra. */
  const LIM_OUTRO = 0.9, LIM_MESMO = 5, LIM_CABELO = 1.7;
  // grupos 6 (touca) e 100+ (mechas) são cabelo: entre mechas, só um risco quando uma passa bem na frente
  const limiar = (gi, gj) => (gi === gj ? LIM_MESMO : (gi >= 100 || gi === 6) && (gj >= 100 || gj === 6) ? LIM_CABELO : LIM_OUTRO);
  /* Contorno: 'tinta' (linha escura em volta e entre as peças, como desenho de anime) ou 'pincel' (sem linha: a borda
     de cada peça só escurece na própria cor, como nos modelos pintados do estilo Legends) */
  M3.CONTORNO = 'pincel';
  let PINCEL = true;
  const BORDA_FORA = 0.72, BORDA_DENTRO = 0.8;   // contorno 'pincel': quanto escurece a borda da silhueta e a de uma peça na frente de outra
  const escurecer = (c, k) => ((c & 0xff000000) | (Math.round(((c >>> 16) & 255) * k) << 16) | (Math.round(((c >>> 8) & 255) * k) << 8) | Math.round((c & 255) * k)) >>> 0;
  function contornoERecorte(B, op, ox, oy, K) {
    K = K || 1;
    PINCEL = (op.contorno || M3.CONTORNO) === 'pincel';
    const W = B.w, H = B.h, g = B.g, z = B.z, c = B.c, l = B.l, o = B.o;
    // só a área tocada pelos triângulos (+1 px para o contorno de fora)
    const rx0 = Math.max(0, B.mx0 - 1), ry0 = Math.max(0, B.my0 - 1), rx1 = Math.min(W - 1, B.mx1 + 1), ry1 = Math.min(H - 1, B.my1 + 1);
    B.sujo = rx1 >= rx0 ? [rx0, ry0, rx1, ry1] : null;
    if (op.contornoGrosso) o.fill(0);
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = ry0; y <= ry1; y++) {
      for (let x = rx0; x <= rx1; x++) {
        const i = y * W + x;
        const gi = g[i];
        let cor = 0;
        if (gi && PINCEL) {   // contorno pintado: a borda escurece na própria cor (sem linha de tinta por fora)
          cor = c[i];
          const gR = x + 1 < W ? g[i + 1] : 0, gL = x > 0 ? g[i - 1] : 0, gD = y + 1 < H ? g[i + W] : 0, gU = y > 0 ? g[i - W] : 0;
          let borda = 0;
          if (!gR || !gL || !gD || !gU) borda = 2;
          else {
            // uma peça na frente de outra (o limiar × 2,2: mesma peça, entre mechas de cabelo, peças diferentes)
            const zi = z[i], ca = gi >= 100 || gi === 6;
            const dR = z[i + 1] - zi, dL = z[i - 1] - zi, dD = z[i + W] - zi, dU = z[i - W] - zi;
            if (dR > 1.98 || dL > 1.98 || dD > 1.98 || dU > 1.98) {
              if ((dR > 1.98 && gR !== gi && !(ca && (gR >= 100 || gR === 6) && dR <= 3.74)) || dR > 11 ||
                (dL > 1.98 && gL !== gi && !(ca && (gL >= 100 || gL === 6) && dL <= 3.74)) || dL > 11 ||
                (dD > 1.98 && gD !== gi && !(ca && (gD >= 100 || gD === 6) && dD <= 3.74)) || dD > 11 ||
                (dU > 1.98 && gU !== gi && !(ca && (gU >= 100 || gU === 6) && dU <= 3.74)) || dU > 11) borda = 1;
            }
          }
          if (borda) cor = escurecer(cor, borda === 2 ? BORDA_FORA : BORDA_DENTRO);
        } else if (gi) {
          cor = c[i];
          const zi = z[i];
          if (x + 1 < W) { const j = i + 1; if (g[j] && z[j] - zi > limiar(gi, g[j])) cor = l[j]; }
          if (x > 0) { const j = i - 1; if (g[j] && z[j] - zi > limiar(gi, g[j])) cor = l[j]; }
          if (y + 1 < H) { const j = i + W; if (g[j] && z[j] - zi > limiar(gi, g[j])) cor = l[j]; }
          if (y > 0) { const j = i - W; if (g[j] && z[j] - zi > limiar(gi, g[j])) cor = l[j]; }
        } else if (!PINCEL) {
          let melhor = -1e9;
          if (x + 1 < W && g[i + 1] && z[i + 1] > melhor) { melhor = z[i + 1]; cor = l[i + 1]; }
          if (x > 0 && g[i - 1] && z[i - 1] > melhor) { melhor = z[i - 1]; cor = l[i - 1]; }
          if (y + 1 < H && g[i + W] && z[i + W] > melhor) { melhor = z[i + W]; cor = l[i + W]; }
          if (y > 0 && g[i - W] && z[i - W] > melhor) { melhor = z[i - W]; cor = l[i - W]; }
        }
        o[i] = cor;
        if (cor) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
    }
    if (op.contornoGrosso) {   // retratos: mais uma volta de contorno por fora
      const o2 = o.slice();
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (o[i]) continue;
        if (x + 1 < W && g[i + 1] === 0 && o[i + 1]) o2[i] = o[i + 1];
        else if (x > 0 && g[i - 1] === 0 && o[i - 1]) o2[i] = o[i - 1];
        else if (y + 1 < H && g[i + W] === 0 && o[i + W]) o2[i] = o[i + W];
        else if (y > 0 && g[i - W] === 0 && o[i - W]) o2[i] = o[i - W];
      }
      o.set(o2);
      x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1); x1 = Math.min(W - 1, x1 + 1); y1 = Math.min(H - 1, y1 + 1);
    }
    if (op.inteiro) { x0 = 0; y0 = 0; x1 = W - 1; y1 = H - 1; if (B.sujo) { o.fill(0, 0, ry0 * W); o.fill(0, (ry1 + 1) * W); for (let y = ry0; y <= ry1; y++) { o.fill(0, y * W, y * W + rx0); o.fill(0, y * W + rx1 + 1, (y + 1) * W); } } else o.fill(0); }
    if (x1 < x0) { x0 = 0; y0 = 0; x1 = 0; y1 = 0; }
    // recorte alinhado aos blocos K × K do supersampling
    x0 = Math.floor(x0 / K) * K; y0 = Math.floor(y0 / K) * K;
    x1 = Math.min(W - 1, Math.floor(x1 / K) * K + K - 1); y1 = Math.min(H - 1, Math.floor(y1 / K) * K + K - 1);
    const w = Math.floor((x1 - x0 + 1) / K), h = Math.floor((y1 - y0 + 1) / K);
    let cv = op.cv;
    if (!cv) cv = R.novoCanvas(w, h);
    else if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const cx = cv.getContext('2d');
    const img = cx.createImageData(w, h);
    const d32 = new Uint32Array(img.data.buffer);
    if (K === 1) for (let y = 0; y < h; y++) d32.set(o.subarray((y + y0) * W + x0, (y + y0) * W + x0 + w), y * w);
    else {   // média de cada bloco K × K: a cor dos pontos cobertos e a cobertura vira a transparência (borda lisa)
      const KK = K * K;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let r = 0, gg = 0, b = 0, n = 0;
          for (let sy = 0; sy < K; sy++) {
            let i = (y0 + y * K + sy) * W + x0 + x * K;
            for (let sx = 0; sx < K; sx++, i++) {
              const c2 = o[i];
              if (c2) { r += c2 & 255; gg += (c2 >>> 8) & 255; b += (c2 >>> 16) & 255; n++; }
            }
          }
          if (n) d32[y * w + x] = ((Math.round(255 * n / KK) << 24) | (Math.round(b / n) << 16) | (Math.round(gg / n) << 8) | Math.round(r / n)) >>> 0;
        }
      }
    }
    cx.putImageData(img, 0, 0);
    return { cv, ax: (ox - x0) / K, ay: (oy - y0) / K, w, h, E: op.escala || 2 };
  }

  /* =====================================================================
     CENÁRIO (o lobby): malhas soltas desenhadas com a mesma luz, sombra em dois tons e contorno dos heróis.
     Peças { v: [x, y, z…], t: [a, b, c, material, 0…], grupo, aberta } em coordenadas do mundo (y para cima, z para a
     câmera), montadas com M3.malha; pal: os materiais da cena (M3.material). op: { escala, pitch, yaw, cv }.
     Devolve { cv, ax, ay, w, h, E } como renderizar: (ax, ay) é onde cai a origem do mundo no canvas.
     ===================================================================== */
  M3.material = material;
  M3.malha = {
    novaPeca: (grupo, op) => Object.assign({ v: [], t: [], grupo: grupo || 1, aberta: false }, op || {}),
    vert, vertA, tri, quad, tubo, tuboLivre, esfera, caixa,
  };
  /* ---------- Texturas do cenário (estética PSX fantasy) ----------
     As coisas do cenário com material de textura (op.tex) ganham a textura pintada em texels grandes, como as texturas
     pequenas do PlayStation esticadas nos polígonos: pedra com rejunte, rocha com rachaduras, tábuas com veio e nós,
     casca, folhagem em tufos, musgo, telhas, palha, metal com rebites, areia, pano, gelo, lava... A textura é projetada
     pelo lado da face (de cima, de frente ou de lado: a emenda aparece onde a face vira, como naquela época) e a luz
     vira quatro tons (funda, sombra, luz e realce) com pontilhado (dithering) entre eles. Cada função devolve quanto a
     luz do texel sobe ou desce (u, v em texels; s: a semente do material). */
  const TX_CEN = 2;   // unidades do mundo por texel
  const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const F = Math.floor;
  const TEX = {
    ruido: (u, v, s) => (hash3(F(u), F(v), s) - 0.5) * 0.26,
    rocha(u, v, s) {   // manchas grandes, pintas e uma rachadura de vez em quando
      let t = (hash3(F(u / 4), F(v / 4), s) - 0.5) * 0.3 + (hash3(F(u), F(v), s + 1) - 0.5) * 0.24;
      const r = F(v / 7), fu = u + hash3(r, 0, s + 2) * 14 + (F(v) & 1) * 0.8, c = F(fu / 19);
      if (Math.abs(fu - c * 19 - 9.5) < 0.55 && hash3(c, r, s + 3) < 0.3) t -= 0.6;
      return t;
    },
    blocos(u, v, s) {   // pedra aparelhada: fileiras de 5 texels, blocos desencontrados, rejunte e a luz na borda de cima
      const fila = F(v / 5), uu = u + (fila & 1) * 4.5 + hash3(fila, 1, s) * 3, bloco = F(uu / 9), fu = uu - bloco * 9, fv = v - fila * 5;
      if (fv < 0.9 || fu < 0.9) return -0.62;
      return (hash3(bloco, fila, s) - 0.5) * 0.34 + (hash3(F(u), F(v), s + 7) - 0.5) * 0.16 + (fv > 4 ? 0.16 : fv < 1.8 ? -0.12 : 0);
    },
    tijolos(u, v, s) {
      const fila = F(v / 2.5), uu = u + (fila & 1) * 2.5, c = F(uu / 5), fu = uu - c * 5, fv = v - fila * 2.5;
      if (fv < 0.6 || fu < 0.6) return -0.55;
      return (hash3(c, fila, s) - 0.5) * 0.36 + (hash3(F(u), F(v), s + 3) - 0.5) * 0.12;
    },
    tabuas(u, v, s) {   // tábuas deitadas (ao longo de u): 3 texels de largura, juntas, veio e nós
      const t0 = F(v / 3), fv = v - t0 * 3;
      if (fv < 0.6) return -0.62;
      const uu = u + hash3(t0, 2, s) * 40, j = F(uu / 17);
      if (uu - j * 17 < 0.6) return -0.5;
      let t = (hash3(t0, j, s) - 0.5) * 0.26 + Math.sin(uu * 0.8 + Math.sin(v * 1.7 + t0 * 3) * 2.2) * 0.1;
      const nx = j * 17 + 4 + hash3(t0, j, s + 9) * 9;
      if (hash3(t0, j, s + 4) < 0.35 && Math.abs(uu - nx) < 0.9 && Math.abs(fv - 1.6) < 0.7) t -= 0.45;   // nó
      return t;
    },
    aduelas: (u, v, s) => TEX.tabuas(v, u, s),   // tábuas em pé (barril, porta, casco)
    casca(u, v, s) {   // casca de árvore: listras em pé, quebradas
      const c = F(u / 1.5), seg = F((v + hash3(c, 5, s) * 9) / (3 + hash3(c, 0, s) * 4)), h = hash3(c, seg, s);
      return h < 0.3 ? -0.48 : h > 0.86 ? 0.22 : (h - 0.55) * 0.3;
    },
    folhas(u, v, s) {   // folhagem: tufos claros, buracos escuros
      const a = hash3(F(u / 2), F(v / 2), s), b = hash3(F(u), F(v), s + 5);
      return a < 0.2 ? -0.62 : a > 0.78 ? 0.32 : (b - 0.5) * 0.34;
    },
    musgo(u, v, s) { const b = hash3(F(u), F(v), s), a = hash3(F(u / 3), F(v / 3), s + 1); return (b < 0.25 ? -0.4 : b > 0.85 ? 0.3 : (b - 0.5) * 0.2) + (a - 0.5) * 0.2; },
    areia(u, v, s) { const b = hash3(F(u), F(v), s); return (b - 0.5) * 0.18 + Math.sin(u * 0.6 + v * 0.3 + hash3(F(v / 6), 0, s) * 3) * 0.07 + (b > 0.94 ? 0.3 : 0); },
    metal(u, v, s) {   // chapas com rebites nos cantos e manchas de ferrugem
      const P = 10, cu = F(u / P), cv = F(v / P), fu = u - cu * P, fv = v - cv * P;
      if (fu < 0.7 || fv < 0.7) return -0.58;
      if ((fu < 2.2 || fu > P - 1.5) && (fv < 2.2 || fv > P - 1.5)) return 0.45;
      return (hash3(cu, cv, s) - 0.5) * 0.18 + (hash3(F(u / 2), F(v / 2), s + 2) < 0.1 ? -0.38 : 0) + (fv > P - 2.5 ? -0.08 : 0);
    },
    telhas(u, v, s) {   // telhas em escamas
      const f = F(v / 3), uu = u + (f & 1) * 2, c = F(uu / 4), fu = uu - c * 4 - 2, fv = v - f * 3;
      if (fv < 0.5 + fu * fu * 0.12) return -0.55;
      return (hash3(c, f, s) - 0.5) * 0.28 + (fv > 2.2 ? 0.16 : 0);
    },
    palha(u, v, s) { return (hash3(F(u * 1.5), F(v / 5), s) - 0.5) * 0.52 + (hash3(F(u), F(v), s + 1) > 0.92 ? 0.3 : 0); },
    pano(u, v, s) { return ((F(u) + F(v)) & 1 ? 0.05 : -0.05) + (hash3(F(u / 5), F(v / 5), s) - 0.5) * 0.2; },
    gelo(u, v, s) { const k = hash3(F((u + v * 0.6) * 0.5), 0, s); return k > 0.82 ? 0.4 : (hash3(F(u), F(v), s) - 0.5) * 0.12; },
    canelura(u, v, s) { const c = F(u / 2); return (c & 1 ? -0.22 : 0.06) + (hash3(F(u), F(v), s) - 0.5) * 0.16 + (hash3(F(u / 4), F(v / 4), s + 3) < 0.12 ? -0.3 : 0); },
    lava(u, v, s) {   // crosta escura com veios acesos
      const a = hash3(F(u / 3), F(v / 3), s), b = Math.sin(u * 0.55 + Math.sin(v * 0.4) * 3) + Math.sin(v * 0.7 - u * 0.2);
      return Math.abs(b) < 0.28 ? 0.9 : a < 0.3 ? -0.5 : (a - 0.5) * 0.3;
    },
    cristal(u, v, s) { const k = hash3(F(u + v * 0.5), 1, s); return k > 0.75 ? 0.4 : k < 0.2 ? -0.3 : 0; },
    aneis(u, v, s) { const r = Math.hypot(u, v); return (F(r) & 1 ? -0.16 : 0.08) + (hash3(F(u), F(v), s) - 0.5) * 0.1; },
    gomos(u, v, s) { const f = F(v / 2.5); return (f & 1 ? -0.2 : 0.06) + (hash3(F(u), f, s) - 0.5) * 0.2; },   // em faixas deitadas (palmeira, bambu)
  };
  M3.TEXTURAS = TEX;
  const NC = 12;
  let TABC = new Float32Array(NC * 4000);

  M3.renderizarCena = function (pecas, pal, op) {
    op = op || {};
    FOLGA_BRACOS = 0;
    // pixel art como os heróis (op.pixel: false nunca; sem ele, o da configuração)
    const PIX = op.pixel === false ? null : op.pixel || (M3.PIXEL !== 'nenhum' ? M3.PIXEL : null);
    const K = PIX ? 1 : Math.max(1, Math.round(op.aa != null ? op.aa : M3.AA));   // o mesmo antialiasing dos heróis
    const P = PIX ? Math.max(1, Math.round((op.escala || 1) * TAM_PIXEL)) : 1;
    const E = PIX ? (op.escala || 1) / P : (op.escala || 1) * K;
    const V = mul(rotX(op.pitch != null ? op.pitch : M3.CAMERA.pitch), rotY(op.yaw || 0));
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    pecas.forEach((p) => {
      if (!p.vf) { p.vf = Float32Array.from(p.v); p.tf = Int32Array.from(p.t); }
      for (let k = 0; k < p.vf.length; k += 3) {
        const q = aplicar(V, p.vf[k], p.vf[k + 1], p.vf[k + 2]);
        if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1];
      }
    });
    if (!isFinite(x0)) { x0 = x1 = y0 = y1 = 0; }
    const ox = Math.round(-x0 * E) + 3 * K, oy = Math.round(y1 * E) + 3 * K;
    const B = buffer(Math.ceil((x1 - x0) * E) + 7 * K, Math.ceil((y1 - y0) * E) + 7 * K);
    let pid = 0, nc = 0, TC = TABC;
    for (const p of pecas) {
      pid++;
      const v = p.vf, t = p.tf, n = v.length / 3, T = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) { const q = aplicar(V, v[k * 3], v[k * 3 + 1], v[k * 3 + 2]); T[k * 3] = q[0]; T[k * 3 + 1] = q[1]; T[k * 3 + 2] = q[2]; }
      for (let k = 0; k < t.length; k += 5) {
        const a = t[k] * 3, b = t[k + 1] * 3, c = t[k + 2] * 3, mt = pal[t[k + 3]];
        const ax = T[a], ay = T[a + 1], az = T[a + 2], bx = T[b], by = T[b + 1], bz = T[b + 2], cx = T[c], cy = T[c + 1], cz = T[c + 2];
        let nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
        let ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
        let nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
        let dentro = false;
        if (nz < 0) { if (!p.aberta) continue; nx = -nx; ny = -ny; nz = -nz; dentro = true; }
        const d = (nx * LUZ[0] + ny * LUZ[1] + nz * LUZ[2]) / (Math.hypot(nx, ny, nz) || 1);
        if (mt.tex && !mt.plano && !dentro && TEX[mt.tex]) {   // textura: pintada no fim, pixel a pixel
          if ((nc + 2) * NC > TC.length) { const t2 = new Float32Array(TC.length * 2); t2.set(TC); TC = TABC = t2; }
          nc++;
          // o lado da face no objeto escolhe a projeção da textura (de cima, de frente ou de lado)
          const ux = v[b] - v[a], uy = v[b + 1] - v[a + 1], uz = v[b + 2] - v[a + 2], wx = v[c] - v[a], wy = v[c + 1] - v[a + 1], wz = v[c + 2] - v[a + 2];
          const qx = Math.abs(uy * wz - uz * wy), qy = Math.abs(uz * wx - ux * wz), qz = Math.abs(ux * wy - uy * wx);
          const o = nc * NC;
          TC[o] = t[k + 3]; TC[o + 1] = d; TC[o + 2] = qy >= qx && qy >= qz ? 1 : qx >= qz ? 0 : 2;
          TC[o + 3] = v[a]; TC[o + 4] = v[a + 1]; TC[o + 5] = v[a + 2]; TC[o + 6] = v[b]; TC[o + 7] = v[b + 1]; TC[o + 8] = v[b + 2];
          TC[o + 9] = v[c]; TC[o + 10] = v[c + 1]; TC[o + 11] = v[c + 2];
          triangulo(B, ox + ax * E, oy - ay * E, az, ox + bx * E, oy - by * E, bz, ox + cx * E, oy - cy * E, cz, 0, mt.linha, p.grupo, nc, pid);
          continue;
        }
        const cor = mt.plano ? mt.luz : dentro ? mt.sombra : d > LIMIAR ? (mt.metal && d > 0.8 ? mt.claro : mt.luz) : mt.sombra;
        triangulo(B, ox + ax * E, oy - ay * E, az, ox + bx * E, oy - by * E, bz, ox + cx * E, oy - cy * E, cz, cor, mt.linha, p.grupo, null, pid);
      }
    }
    if (nc) {   // os pixels das faces com textura: o ponto no objeto, o texel, a luz em quatro tons e o pontilhado
      const tb = B.t, gb = B.g, cb = B.c, wa = B.w0, wb = B.w1, W2 = B.w, inv = 1 / TX_CEN;
      for (let y = B.my0; y <= B.my1; y++) {
        for (let x = B.mx0, i = y * W2 + B.mx0; x <= B.mx1; x++, i++) {
          const id = tb[i];
          if (!gb[i] || !id) continue;
          const o = id * NC, w0 = wa[i], w1 = wb[i], w2 = 1 - w0 - w1, eixo = TC[o + 2];
          const px = w0 * TC[o + 3] + w1 * TC[o + 6] + w2 * TC[o + 9], py = w0 * TC[o + 4] + w1 * TC[o + 7] + w2 * TC[o + 10], pz = w0 * TC[o + 5] + w1 * TC[o + 8] + w2 * TC[o + 11];
          const u = (eixo === 1 ? px : eixo === 0 ? pz : px) * inv, vv = (eixo === 1 ? pz : py) * inv;
          const mi = TC[o], mt = pal[mi];
          const nl = TC[o + 1] + TEX[mt.tex](u, vv, mi * 7 + 3) + ((BAYER4[((y / K | 0) & 3) * 4 + ((x / K | 0) & 3)] + 0.5) / 16 - 0.5) * 0.2;
          cb[i] = nl < -0.32 ? mt.funda : nl < LIMIAR ? mt.sombra : nl < 0.8 ? mt.luz : mt.brilha && nl > 0.95 ? mt.claro : mt.realce;
          tb[i] = 0;
        }
      }
    }
    return PIX ? recortePixel(B, op, ox, oy, PIX, P) : contornoERecorte(B, op, ox, oy, K);
  };

  M3.MAT = MAT;
  R.Modelo3D = M3;
})(window.RES);
