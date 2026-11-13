/* Rogue em' Slash — A sala (lobby): uma sala vazia vista de cima, onde cada jogador anda com o seu boneco de vidro
   (Frutiger Aero), e uma mesa de RPG com 4 cadeiras.
   - Sentar numa cadeira (perto dela: E, Enter, Espaço, A do controle ou toque na metade direita da tela): com a mesa
     vazia, quem senta cria a sala online e é o anfitrião; quem chega depois e senta entra na sala dele (sem código).
   - O anfitrião, sentado, aperta de novo para começar a partida: todos da mesa vão para o mapa. Quem sentar com a
     partida em andamento entra direto nela.
   - Para levantar, é só andar (ou B do controle / Backspace). O anfitrião levantando fecha a sala.
   - A mesa do bazar: perto dela, o mesmo botão abre o editor do boneco (R.Bazar); a câmera chega perto dele.
   - Clicar (ou tocar) em outro jogador abre o menu dele (R.MenuJogador: sussurrar, adicionar amigo).
   Os outros jogadores vêm de R.SaguaoOnline (Supabase Realtime); as salas, de R.Rede (PeerJS).
   Mundo: x para a direita, y para cima, z para a câmera; 1 unidade = 1 metro. */
(function (R) {
  'use strict';

  const SALA = { x0: -6, x1: 6, z0: -4, z1: 4, parede: 2.6 };
  const MESA = { x: 0, z: -1.2, w: 1.9, d: 1.25, h: 0.62 };
  const ASSENTO = 0.32;     // altura do assento das cadeiras
  /* as 4 cadeiras, uma de cada lado da mesa, viradas para ela (ry: para onde a frente aponta; 0 = para a câmera) */
  const LONGE = 0.56;       // do centro da cadeira até a borda da mesa
  const CADEIRAS = [
    { x: MESA.x, z: MESA.z - MESA.d / 2 - LONGE, ry: 0 },
    { x: MESA.x + MESA.w / 2 + LONGE, z: MESA.z, ry: -Math.PI / 2 },
    { x: MESA.x, z: MESA.z + MESA.d / 2 + LONGE, ry: Math.PI },
    { x: MESA.x - MESA.w / 2 - LONGE, z: MESA.z, ry: Math.PI / 2 },
  ];
  const NA_FRENTE = 0.16;   // sentado, o boneco fica um pouco à frente do encosto
  const RAIO = 0.34;        // o boneco no chão (para não atravessar a mesa e as cadeiras)
  const VEL = 3, ACEL = 14; // metros por segundo; arranque
  const ALCANCE = 1.3;      // de quão perto dá para sentar numa cadeira
  /* a mesa do bazar (com alguns itens em cima, de mostruário) e de quão perto da borda dela dá para abrir o editor */
  const BAZAR = { x: 3.9, z: 0.5, w: 1.7, d: 0.8, h: 0.74 };
  const ALCANCE_BAZAR = 0.85;

  const S = { visivel: false, eu: null, r: null, m: null, cam: { x: 0, z: 2 }, t: 0, alvoCadeira: -1, alvoBazar: false, entrarPendente: false, modoAntes: 'offline',
    foco: null, zoom: 0 };   // foco 'bazar': a câmera chega perto do boneco (o editor está aberto)
  const O = () => R.SaguaoOnline;

  /* ---------- Malhas ---------- */
  /* o boneco (como os ícones de pessoa do Frutiger Aero): corpo em domo, de ombros largos e redondos, e a cabeça
     grande e redonda, solta logo acima */
  const CORPO = [[0, 0], [0.3, 0], [0.37, 0.02], [0.405, 0.08], [0.415, 0.17], [0.405, 0.28], [0.375, 0.38], [0.32, 0.46], [0.235, 0.515], [0.12, 0.545], [0, 0.552]];
  const CABECA = { y: 0.84, r: 0.265 };
  function malhas(r) {
    const A = R.Aero3D;
    return { esfera: r.malha(A.esfera(36, 24)), corpo: r.malha(A.torno(CORPO, 40)), caixa: r.malha(A.caixa()), plano: r.malha(A.plano()) };
  }
  const COR = {
    piso: R.Aero3D.hex('#f3f6f9'), parede: R.Aero3D.hex('#e8f0f7'), rodape: R.Aero3D.hex('#c3d3e2'),
    madeira: R.Aero3D.hex('#9a6a44'), feltro: R.Aero3D.hex('#2f7a5a'), cadeira: R.Aero3D.hex('#a8754c'), bazar: R.Aero3D.hex('#3fb8c8'),
  };

  /* ---------- O meu boneco ---------- */
  function novoEu() {
    const o = O().meu();
    return { x: o.x, z: o.z, vx: 0, vz: 0, f: o.f, fase: 0, sentado: null };
  }
  /* não atravessa as paredes, as mesas e as cadeiras */
  function foraDaCaixa(p, b) {
    const hx = b.w / 2 + RAIO, hz = b.d / 2 + RAIO, dx = p.x - b.x, dz = p.z - b.z;
    if (Math.abs(dx) < hx && Math.abs(dz) < hz) {   // dentro da mesa: sai pelo lado mais perto
      if (hx - Math.abs(dx) < hz - Math.abs(dz)) p.x = b.x + Math.sign(dx || 1) * hx;
      else p.z = b.z + Math.sign(dz || 1) * hz;
    }
  }
  function colidir(p) {
    p.x = R.clamp(p.x, SALA.x0 + RAIO, SALA.x1 - RAIO);
    p.z = R.clamp(p.z, SALA.z0 + RAIO, SALA.z1 - RAIO);
    foraDaCaixa(p, MESA); foraDaCaixa(p, BAZAR);
    CADEIRAS.forEach((c) => {
      const ex = p.x - c.x, ez = p.z - c.z, d = Math.hypot(ex, ez), min = 0.27 + RAIO;
      if (d < min && d > 0.0001) { p.x = c.x + (ex / d) * min; p.z = c.z + (ez / d) * min; }
    });
  }

  /* ---------- A mesa ---------- */
  const cadeiraLivre = (i, mesa) => !mesa.cadeiras[i] || mesa.cadeiras[i] === O().meu();
  /* a cadeira livre mais perto do boneco (ou -1) */
  function cadeiraPerto() {
    const eu = S.eu, mesa = O().mesa();
    let melhor = -1, dm = ALCANCE;
    CADEIRAS.forEach((c, i) => {
      const d = Math.hypot(eu.x - c.x, eu.z - c.z);
      if (d < dm && cadeiraLivre(i, mesa)) { dm = d; melhor = i; }
    });
    return melhor;
  }
  function sentar(i) {
    const eu = S.eu, c = CADEIRAS[i], mesa = O().mesa(), agora = Date.now();
    eu.sentado = i; eu.vx = eu.vz = 0; eu.x = c.x; eu.z = c.z; eu.f = c.ry;
    const anf = mesa.anfitriao && mesa.anfitriao !== O().meu() ? mesa.anfitriao : null;
    if (anf) {   // já tem sala: entra nela
      O().atualizar({ sentado: { cadeira: i, desde: agora }, mesa: null, x: eu.x, z: eu.z, f: eu.f });
      if (anf.mesa.codigo) R.Rede.entrarSala(anf.mesa.codigo); else S.entrarPendente = true;
    } else {     // mesa vazia: cria a sala e é o anfitrião
      O().atualizar({ sentado: { cadeira: i, desde: agora }, mesa: { codigo: null, desde: agora, jogando: false }, x: eu.x, z: eu.z, f: eu.f });
      R.Rede.criarSala();
    }
  }
  /* levanta da cadeira (e sai da sala) */
  S.levantar = function () {
    const eu = S.eu;
    if (!eu || eu.sentado == null) return;
    const c = CADEIRAS[eu.sentado];
    eu.x = c.x - Math.sin(c.ry) * 0.75; eu.z = c.z - Math.cos(c.ry) * 0.75; eu.f = c.ry + Math.PI;   // um passo para trás
    colidir(eu);
    eu.sentado = null; S.entrarPendente = false;
    O().atualizar({ sentado: null, mesa: null, x: eu.x, z: eu.z, f: eu.f });
    if (R.Rede.modo !== 'offline') R.Rede.sair();
  };
  S.sentado = () => !!(S.eu && S.eu.sentado != null);

  /* perto da mesa do bazar (da borda dela) */
  function pertoDoBazar() {
    const eu = S.eu, dx = Math.max(0, Math.abs(eu.x - BAZAR.x) - BAZAR.w / 2), dz = Math.max(0, Math.abs(eu.z - BAZAR.z) - BAZAR.d / 2);
    return Math.hypot(dx, dz) < ALCANCE_BAZAR;
  }
  /* E / Espaço / A / toque: senta na cadeira mais perto (ou abre o bazar); sentado, o anfitrião começa a partida */
  S.interagir = function () {
    if (!S.visivel || !S.eu || S.foco) return;
    if (S.eu.sentado == null) {
      const i = cadeiraPerto();
      if (i >= 0) sentar(i); else if (pertoDoBazar()) R.Bazar.abrir();
      return;
    }
    const anf = O().mesa().anfitriao;
    if (R.Rede.modo === 'anfitriao') R.Rede.iniciarPartida();
    else if (R.Rede.modo === 'offline' && (!anf || anf === O().meu())) R.Fluxo.irPartida();   // sem internet: joga sozinho
  };

  /* a presença mudou: confere se a mesa ainda é minha e se a cadeira ainda é minha */
  function conferirMesa() {
    const eu = S.eu, meu = O().meu();
    if (!eu || eu.sentado == null) return;
    const mesa = O().mesa();
    if (meu.mesa && mesa.anfitriao && mesa.anfitriao !== meu) {   // outro abriu a sala antes: entro na dele
      R.Rede.sair();
      O().atualizar({ mesa: null });
      S.entrarPendente = true;
    }
    if (mesa.cadeiras[eu.sentado] !== meu) {   // outro sentou na minha cadeira antes
      const livre = CADEIRAS.findIndex((c, i) => cadeiraLivre(i, mesa));
      if (livre < 0) { S.levantar(); return; }
      const c = CADEIRAS[livre];
      eu.sentado = livre; eu.x = c.x; eu.z = c.z; eu.f = c.ry;
      O().atualizar({ sentado: { cadeira: livre, desde: Date.now() }, x: eu.x, z: eu.z, f: eu.f });
    }
    const anf = mesa.anfitriao;
    if (S.entrarPendente && anf && anf !== meu && anf.mesa.codigo && R.Rede.modo === 'offline') { S.entrarPendente = false; R.Rede.entrarSala(anf.mesa.codigo); }
  }

  /* a sala online (PeerJS) mudou */
  S.aoMudarRede = function () {
    const N = R.Rede, antes = S.modoAntes, meu = O().meu();
    S.modoAntes = N.modo;
    if (N.modo === 'anfitriao' && N.codigo && meu.mesa && meu.mesa.codigo !== N.codigo) O().atualizar({ mesa: Object.assign({}, meu.mesa, { codigo: N.codigo }) });
    if (antes === 'cliente' && N.modo === 'offline') {   // a sala fechou (o anfitrião saiu) ou a conexão caiu
      if (R.Fluxo.estado === 'partida') R.Fluxo.voltarSaguao();
      S.levantar();
    }
  };
  /* a partida começou (no anfitrião e em quem está na sala) */
  S.partidaComecou = function () {
    const meu = O().meu();
    if (meu.mesa) O().atualizar({ mesa: Object.assign({}, meu.mesa, { jogando: true }) });
  };

  /* ---------- Atualizar ---------- */
  function atualizar(dt) {
    const eu = S.eu;
    S.t += dt;
    const mov = R.Input.movimento('qualquer');
    const mag = Math.min(1, Math.hypot(mov.x, mov.y));
    if (eu.sentado != null) {
      if (mag > 0.5) S.levantar();   // andar levanta da cadeira
    } else {
      const ax = mov.x * VEL, az = mov.y * VEL;
      const dvx = ax - eu.vx, dvz = az - eu.vz, d = Math.hypot(dvx, dvz), passo = ACEL * dt;
      if (d <= passo) { eu.vx = ax; eu.vz = az; } else { eu.vx += (dvx / d) * passo; eu.vz += (dvz / d) * passo; }
      const x0 = eu.x, z0 = eu.z;
      eu.x += eu.vx * dt; eu.z += eu.vz * dt;
      colidir(eu);
      if (dt > 0) { eu.vx = (eu.x - x0) / dt; eu.vz = (eu.z - z0) / dt; }   // (o que a parede segurou não conta)
      if (mag > 0.1) eu.f = girar(eu.f, Math.atan2(mov.x, mov.y), dt * 12);
    }
    if (S.foco === 'bazar') eu.f = girar(eu.f, 0, dt * 8);   // no editor, de frente para a câmera
    eu.fase += dt * Math.hypot(eu.vx, eu.vz) * 3.2;
    O().mover(eu.x, eu.z, eu.vx, eu.vz, eu.f);
    S.alvoCadeira = eu.sentado == null && !S.foco ? cadeiraPerto() : -1;
    S.alvoBazar = eu.sentado == null && !S.foco && S.alvoCadeira < 0 && pertoDoBazar();
    S.zoom += ((S.foco ? 1 : 0) - S.zoom) * Math.min(1, dt * 6);
    // os outros: seguem a última velocidade que mandaram, suavizando a posição mostrada
    const agora = performance.now();
    O().outros.forEach((o) => {
      const dtR = Math.min(1.5, (agora - o.recebido) / 1000);
      const px = o.x + o.vx * dtR, pz = o.z + o.vz * dtR;
      if (o.sx == null) { o.sx = px; o.sz = pz; o.sf = o.f; o.fase = 0; }
      const k = Math.min(1, dt * 10);
      o.sx += (px - o.sx) * k; o.sz += (pz - o.sz) * k; o.sf = girar(o.sf, o.f, dt * 10);
      o.fase += dt * Math.hypot(o.vx, o.vz) * 3.2;
    });
    // a câmera segue o boneco (sem mostrar muito de fora da sala)
    const alvo = { x: R.clamp(eu.x, SALA.x0 + 3, SALA.x1 - 3), z: R.clamp(eu.z, SALA.z0 + 1.5, SALA.z1 - 1) };
    const kc = Math.min(1, dt * 5);
    S.cam.x += (alvo.x - S.cam.x) * kc; S.cam.z += (alvo.z - S.cam.z) * kc;
  }
  function girar(a, b, k) {   // ângulo a indo para b pelo caminho mais curto
    let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    return a + d * Math.min(1, k);
  }

  /* ---------- Desenhar ---------- */
  function boneco(lista, b) {
    const v = b.visual || {}, m = S.m, cor = R.Aero3D.hex(v.corpo || b.cor), vel = Math.hypot(b.vx || 0, b.vz || 0), k = Math.min(1, vel / 2);
    let y = 0, rx = 0, sy = 1 + Math.sin(S.t * 2.2 + (b.x || 0)) * 0.012;   // parado: respira
    if (b.sentado != null) { y = ASSENTO; sy *= 0.94; b = Object.assign({}, b, { x: b.x + Math.sin(b.f) * NA_FRENTE, z: b.z + Math.cos(b.f) * NA_FRENTE }); }
    else if (k > 0.02) {   // andando: pulinhos, inclinado para a frente
      y = Math.abs(Math.sin(b.fase)) * 0.07 * k;
      rx = 0.13 * k;
      sy *= 1 + Math.cos(b.fase * 2) * 0.035 * k;
    }
    const sxz = 1 / Math.sqrt(sy);
    lista.push({ malha: m.corpo, tipo: 'aero', cor, t: { x: b.x, y, z: b.z, ry: b.f, rx, sx: sxz, sy, sz: sxz } });
    const fx = Math.sin(b.f), fz = Math.cos(b.f), hy = CABECA.y * sy;
    const cab = { x: b.x + fx * Math.sin(rx) * hy, y: y + Math.cos(rx) * hy, z: b.z + fz * Math.sin(rx) * hy, r: CABECA.r, ry: b.f, rx };
    // os itens do bazar: o capacete cobre a cabeça inteira; senão, o chapéu e os óculos
    let esconde = false;
    ['capacete', 'chapeu', 'oculos'].forEach((s) => {
      if (v[s] && !(s !== 'capacete' && v.capacete)) esconde = R.Itens3D.desenhar(lista, S.r, v[s].id, v[s].cor, cab) || esconde;
    });
    if (!esconde) lista.push({ malha: m.esfera, tipo: 'aero', cor, t: { x: cab.x, y: cab.y, z: cab.z, ry: b.f, sx: CABECA.r, sy: CABECA.r, sz: CABECA.r } });
    if (b.sentado == null) lista.push({ malha: m.plano, tipo: 'sombra', alfa: 0.32, t: { x: b.x, y: 0.003, z: b.z, sx: 0.46 - y, sy: 1, sz: 0.46 - y } });
  }
  function moveis(lista) {
    const m = S.m, cx = (SALA.x0 + SALA.x1) / 2, cz = (SALA.z0 + SALA.z1) / 2, L = SALA.x1 - SALA.x0, P = SALA.z1 - SALA.z0;
    lista.push({ malha: m.caixa, tipo: 'piso', cor: COR.piso, t: { x: cx, y: -0.05, z: cz, sx: L, sy: 0.1, sz: P } });
    lista.push({ malha: m.caixa, cor: COR.parede, t: { x: cx, y: SALA.parede / 2, z: SALA.z0 - 0.1, sx: L + 0.4, sy: SALA.parede, sz: 0.2 } });
    [SALA.x0 - 0.1, SALA.x1 + 0.1].forEach((x) => lista.push({ malha: m.caixa, cor: COR.parede, t: { x, y: SALA.parede / 2, z: cz, sx: 0.2, sy: SALA.parede, sz: P } }));
    lista.push({ malha: m.caixa, cor: COR.rodape, t: { x: cx, y: 0.06, z: SALA.z0 + 0.01, sx: L, sy: 0.12, sz: 0.04 } });
    // a mesa: tampo de madeira com o feltro verde e quatro pés
    lista.push({ malha: m.caixa, cor: COR.madeira, t: { x: MESA.x, y: MESA.h - 0.04, z: MESA.z, sx: MESA.w, sy: 0.08, sz: MESA.d } });
    lista.push({ malha: m.caixa, cor: COR.feltro, t: { x: MESA.x, y: MESA.h + 0.002, z: MESA.z, sx: MESA.w - 0.22, sy: 0.01, sz: MESA.d - 0.22 } });
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => lista.push({ malha: m.caixa, cor: COR.madeira,
      t: { x: MESA.x + a * (MESA.w / 2 - 0.12), y: (MESA.h - 0.08) / 2, z: MESA.z + b * (MESA.d / 2 - 0.12), sx: 0.08, sy: MESA.h - 0.08, sz: 0.08 } }));
    lista.push({ malha: m.plano, tipo: 'sombra', alfa: 0.22, t: { x: MESA.x, y: 0.003, z: MESA.z, sx: MESA.w * 0.62, sy: 1, sz: MESA.d * 0.66 } });
    // a mesa do bazar: tampo azul-piscina (brilha quando dá para abrir), pés e alguns itens de mostruário em cima
    const rb = S.alvoBazar ? 0.22 + Math.sin(S.t * 5) * 0.1 : 0;
    lista.push({ malha: m.caixa, cor: COR.bazar, realce: rb, t: { x: BAZAR.x, y: BAZAR.h - 0.04, z: BAZAR.z, sx: BAZAR.w, sy: 0.08, sz: BAZAR.d } });
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => lista.push({ malha: m.caixa, cor: COR.madeira,
      t: { x: BAZAR.x + a * (BAZAR.w / 2 - 0.08), y: (BAZAR.h - 0.08) / 2, z: BAZAR.z + b * (BAZAR.d / 2 - 0.08), sx: 0.07, sy: BAZAR.h - 0.08, sz: 0.07 } }));
    lista.push({ malha: m.plano, tipo: 'sombra', alfa: 0.2, t: { x: BAZAR.x, y: 0.003, z: BAZAR.z, sx: BAZAR.w * 0.6, sy: 1, sz: BAZAR.d * 0.7 } });
    [['cowboy', -0.55], ['bruxo', 0], ['tv', 0.55]].forEach(([id, dx]) => {
      const it = R.Itens3D.ITENS[id], r0 = id === 'tv' ? 0.12 : 0.16;
      R.Itens3D.desenhar(lista, S.r, id, it.cor, { x: BAZAR.x + dx, y: BAZAR.h + (id === 'tv' ? 0.12 : -0.5 * r0), z: BAZAR.z, r: r0, ry: 0.4, rx: 0 });
    });
    // as cadeiras: assento, encosto (atrás, do lado de fora da mesa) e pés; a que dá para sentar brilha
    CADEIRAS.forEach((c, i) => {
      const realce = i === S.alvoCadeira ? 0.22 + Math.sin(S.t * 5) * 0.1 : 0;
      const local = (lx, ly, lz) => ({ x: c.x + Math.sin(c.ry) * lz + Math.cos(c.ry) * lx, y: ly, z: c.z + Math.cos(c.ry) * lz - Math.sin(c.ry) * lx });
      lista.push({ malha: m.caixa, cor: COR.cadeira, realce, t: Object.assign(local(0, ASSENTO - 0.035, 0), { ry: c.ry, sx: 0.5, sy: 0.07, sz: 0.5 }) });
      lista.push({ malha: m.caixa, cor: COR.cadeira, realce, t: Object.assign(local(0, ASSENTO + 0.26, -0.29), { ry: c.ry, sx: 0.5, sy: 0.52, sz: 0.06 }) });
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => lista.push({ malha: m.caixa, cor: COR.cadeira, realce,
        t: Object.assign(local(a * 0.2, (ASSENTO - 0.07) / 2, b * 0.2), { ry: c.ry, sx: 0.05, sy: ASSENTO - 0.07, sz: 0.05 }) }));
      lista.push({ malha: m.plano, tipo: 'sombra', alfa: 0.18, t: { x: c.x, y: 0.003, z: c.z, sx: 0.36, sy: 1, sz: 0.36 } });
    });
  }
  function desenhar() {
    const lista = [];
    moveis(lista);
    const eu = S.eu, meu = O().meu();
    boneco(lista, { x: eu.x, z: eu.z, vx: eu.vx, vz: eu.vz, f: eu.f, fase: eu.fase, sentado: eu.sentado, cor: meu.cor, visual: meu.visual });
    O().outros.forEach((o) => {
      if (o.sentado) { const c = CADEIRAS[o.sentado.cadeira]; boneco(lista, { x: c.x, z: c.z, f: c.ry, fase: 0, sentado: o.sentado.cadeira, cor: o.cor, visual: o.visual }); }
      else boneco(lista, { x: o.sx, z: o.sz, vx: o.vx, vz: o.vz, f: o.sf, fase: o.fase, sentado: null, cor: o.cor, visual: o.visual });
    });
    // a câmera de cima; no editor do bazar, perto do boneco (ele fica à esquerda, o painel à direita)
    const z = S.zoom * S.zoom * (3 - 2 * S.zoom);
    const alvo = [R.lerp(S.cam.x, eu.x + 0.5, z), R.lerp(0.4, 0.75, z), R.lerp(S.cam.z, eu.z, z)];
    S.r.desenhar(lista, { olho: [alvo[0], alvo[1] + R.lerp(7.4, 1.1, z), alvo[2] + R.lerp(6.6, 3.2, z)], alvo, fov: 42 });
  }

  let antes = 0;
  function quadro(agora) {
    if (!S.visivel) { antes = 0; return; }
    const dt = Math.min(0.05, antes ? (agora - antes) / 1000 : 0);
    antes = agora;
    atualizar(dt);
    desenhar();
    requestAnimationFrame(quadro);
  }

  /* Mostra (true) ou esconde (false) a sala. */
  S.mostrar = function (v) {
    v = !!v;
    if (v === S.visivel) return;
    S.visivel = v;
    document.body.classList.toggle('saguao', v);
    if (v) {
      if (!S.r) {
        S.r = R.Aero3D.criar(document.getElementById('saguao'));
        if (!S.r) { console.error('Sala: este navegador não tem WebGL.'); return; }
        S.m = malhas(S.r);
      }
      if (!S.eu) { S.eu = novoEu(); S.cam.x = S.eu.x; S.cam.z = S.eu.z; }
      O().ligar();
      requestAnimationFrame(quadro);
    }
  };

  S.iniciar = function () {
    O().on('sync', conferirMesa);
  };

  /* o outro jogador debaixo de um ponto da tela (pixels CSS do canvas), ou null */
  S.jogadorEm = function (px, py) {
    if (!S.visivel || !S.r || S.foco) return null;
    let melhor = null, dm = Infinity;
    O().outros.forEach((o) => {
      const pos = o.sentado ? CADEIRAS[o.sentado.cadeira] : { x: o.sx, z: o.sz };
      if (pos.x == null) return;
      const base = S.r.projetar([pos.x, o.sentado ? ASSENTO : 0, pos.z]), topo = S.r.projetar([pos.x, (o.sentado ? ASSENTO : 0) + 1.1, pos.z]);
      if (!base || !topo) return;
      const raio = Math.max(18, Math.abs(base[1] - topo[1]) * 0.45), cx = (base[0] + topo[0]) / 2, cy = (base[1] + topo[1]) / 2;
      const d = Math.hypot(px - cx, (py - cy) * 0.75);
      if (d < raio * 1.2 && d < dm) { dm = d; melhor = o; }
    });
    return melhor;
  };
  /* editor do bazar aberto (true) ou fechado: a câmera chega perto e o boneco vira para ela */
  S.focarBazar = function (v) { S.foco = v ? 'bazar' : null; if (v && S.eu) { S.eu.vx = S.eu.vz = 0; } };

  S.CADEIRAS = CADEIRAS; S.MESA = MESA;
  R.Saguao = S;
})(window.RES);
