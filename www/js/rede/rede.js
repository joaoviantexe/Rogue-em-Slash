/* Rogue em' Slash — Salas online (P2P via WebRTC, com PeerJS), como no RL20 (js/rede/rede.js): quem cria a sala é o
   ANFITRIÃO e os outros entram com o código de 4 letras. Funciona em hospedagem estática (Vercel, Cloudflare...): não
   há servidor de jogo; o servidor público do PeerJS só apresenta os aparelhos um ao outro.
   - Até 4 jogadores no total, misturando aparelhos (híbrido): cada aparelho pode ter vários jogadores locais.
   - O anfitrião decide quem está na sala e em que vaga (1 a 4) e repassa o estado de todos ~20 vezes por segundo.
   - Cada aparelho move os próprios jogadores (sem atraso para quem joga) e manda a posição deles; o anfitrião confere
     (dentro do mapa e na velocidade de andar) antes de repassar. */
(function (R) {
  'use strict';

  const PREFIXO = 'res-sala-';
  const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const MAX = 4;
  const INTERVALO = 0.05;   // 20 envios por segundo

  const N = {
    modo: 'offline',          // 'offline' | 'anfitriao' | 'cliente'
    peer: null, codigo: null, status: '', erro: null,
    clientes: new Map(),      // (anfitrião) peerId → { conn, ok, conta, locais: [i…], ordem }
    conn: null,               // (cliente) a conexão com o anfitrião
    meuId: null,
    sala: [],                 // quem está na sala: [{ slot, dono, i, nome }] (dono: 'anfitriao' ou o peerId do aparelho)
    fora: 0,                  // (cliente) quantos jogadores deste aparelho ficaram de fora (sala cheia)
    partida: false,           // a partida da sala já começou (quem entra depois vai direto para ela)
    tEnvio: 0, ordem: 0,
    ouvintes: {},
  };
  N.MAX = MAX;
  N.on = (ev, fn) => { (N.ouvintes[ev] = N.ouvintes[ev] || []).push(fn); };
  N.emit = (ev, d) => (N.ouvintes[ev] || []).forEach((f) => { try { f(d); } catch (e) { console.error(e); } });
  N.disponivel = () => typeof window.Peer === 'function';
  /* de quem são os jogadores deste aparelho */
  N.meuDono = () => (N.modo === 'cliente' ? N.meuId : 'anfitriao');

  function opcoesPeer() {
    const c = (R.CONFIG && R.CONFIG.rede) || {};
    const o = { debug: 1, config: { iceServers: c.iceServers || [] } };
    let srv = c.servidor;
    try {   // ?servidor=localhost:9000/res (para testes ou servidor próprio)
      const p = new URLSearchParams(location.search).get('servidor');
      const m = p && p.match(/^([^:/]+)(?::(\d+))?(\/.*)?$/);
      if (m) srv = { host: m[1], port: +(m[2] || 443), path: m[3] || '/', secure: m[1] !== 'localhost' && m[1] !== '127.0.0.1' };
    } catch (e) { /* sem URL */ }
    if (srv) Object.assign(o, srv);
    return o;
  }
  function novoCodigo() { let c = ''; for (let i = 0; i < 4; i++) c += LETRAS[Math.floor(Math.random() * LETRAS.length)]; return c; }
  function enviar(conn, msg) { try { if (conn && conn.open) conn.send(msg); } catch (e) { console.warn('rede', e); } }
  const enviarTodos = (msg) => N.clientes.forEach((c) => { if (c.ok) enviar(c.conn, msg); });
  const nomeValido = (n) => String(n || '').replace(/[^\p{L}\p{N} _.#()-]/gu, '').slice(0, 24) || 'Jogador';
  const nomeDe = (base, i) => (i > 0 ? base + ' (' + (i + 1) + ')' : base);
  const locaisValidos = (l) => [...new Set((Array.isArray(l) ? l : []).map((i) => i | 0).filter((i) => i >= 0 && i < MAX))].slice(0, MAX);
  function falhou(msg) { N.erro = msg; N.status = ''; N.emit('mudou'); }

  /* =====================================================================
     ANFITRIÃO
     ===================================================================== */
  N.criarSala = function () {
    N.sair();
    if (!N.disponivel()) { falhou('A biblioteca de rede não carregou.'); return; }
    N.modo = 'anfitriao'; N.status = 'Criando sala…'; N.erro = null; N.emit('mudou');
    const tentar = (n) => {
      const codigo = novoCodigo();
      const peer = new window.Peer(PREFIXO + codigo.toLowerCase(), opcoesPeer());
      N.peer = peer;
      peer.on('open', () => {
        if (N.peer !== peer) return;
        N.codigo = codigo; N.status = 'Sala aberta';
        montarSala();
      });
      peer.on('error', (e) => {
        if (N.peer !== peer) return;
        if (e.type === 'unavailable-id' && n < 5) { peer.destroy(); tentar(n + 1); return; }
        if (e.type === 'peer-unavailable') return;   // (um cliente que sumiu)
        const msg = traduzirErro(e);
        N.sair(); falhou(msg);
      });
      peer.on('connection', (conn) => {
        conn.on('open', () => { N.clientes.set(conn.peer, { conn, ok: false, conta: null, locais: [], ordem: ++N.ordem }); });
        conn.on('data', (msg) => aoMensagemAnfitriao(conn, msg));
        const fechou = () => { if (N.clientes.delete(conn.peer)) montarSala(); };
        conn.on('close', fechou);
        conn.on('error', fechou);
      });
    };
    tentar(0);
  };

  function aoMensagemAnfitriao(conn, msg) {
    const c = N.clientes.get(conn.peer);
    if (!c || !msg || typeof msg !== 'object') return;
    switch (msg.t) {
      case 'ola':
        if (msg.v !== R.VERSAO) {
          enviar(conn, { t: 'recusado', motivo: 'Versões diferentes do jogo (' + msg.v + ' × ' + R.VERSAO + '). Atualize a página.' });
          setTimeout(() => conn.close(), 300);
          return;
        }
        c.ok = true;
        c.conta = msg.conta && typeof msg.conta === 'object' ? { id: String(msg.conta.id || '').slice(0, 40), nome: nomeValido(msg.conta.nome) } : { id: '', nome: 'Jogador' };
        c.locais = locaisValidos(msg.locais);
        enviar(conn, { t: 'bemvindo', v: R.VERSAO, codigo: N.codigo, partida: N.partida });
        montarSala();
        break;
      case 'locais':   // o aparelho pôs ou tirou um jogador
        if (!c.ok) return;
        c.locais = locaisValidos(msg.locais);
        montarSala();
        break;
      case 'pos':
        if (!c.ok || !Array.isArray(msg.p)) return;
        msg.p.slice(0, MAX).forEach((e) => { if (Array.isArray(e)) R.Jogo.receberEstado(conn.peer + ':' + (e[0] | 0), e.slice(1), true); });
        break;
    }
  }

  /* Quem está na sala e em que vaga: quem já tinha vaga continua nela; os novos pegam as livres, na ordem (primeiro os
     jogadores do anfitrião, depois os aparelhos na ordem em que entraram). Quem não cabe fica de fora. */
  function montarSala() {
    if (N.modo !== 'anfitriao') return;
    const meuNome = (R.Contas && R.Contas.nome()) || 'Anfitrião';
    const pedidos = R.Jogo.indicesLocais().map((i) => ({ dono: 'anfitriao', i, nome: nomeDe(meuNome, i) }));
    [...N.clientes.entries()].filter(([, c]) => c.ok).sort((a, b) => a[1].ordem - b[1].ordem)
      .forEach(([peer, c]) => c.locais.forEach((i) => pedidos.push({ dono: peer, i, nome: nomeDe(c.conta.nome, i) })));
    const antes = new Map(N.sala.map((j) => [j.dono + ':' + j.i, j.slot]));
    const usadas = new Set(), sala = [];
    pedidos.forEach((p) => {
      const s = antes.get(p.dono + ':' + p.i);
      if (s && !usadas.has(s)) { usadas.add(s); sala.push(Object.assign({ slot: s }, p)); p.feito = true; }
    });
    pedidos.forEach((p) => {
      if (p.feito) return;
      for (let s = 1; s <= MAX; s++) if (!usadas.has(s)) { usadas.add(s); sala.push(Object.assign({ slot: s }, p)); return; }
    });
    N.sala = sala.sort((a, b) => a.slot - b.slot);
    N.clientes.forEach((c, peer) => {
      if (!c.ok) return;
      const dentro = N.sala.filter((j) => j.dono === peer).length;
      enviar(c.conn, { t: 'sala', sala: N.sala, fora: c.locais.length - dentro });
    });
    N.fora = R.Jogo.indicesLocais().length - N.sala.filter((j) => j.dono === 'anfitriao').length;
    N.emit('mudou');
  }

  /* =====================================================================
     CLIENTE
     ===================================================================== */
  N.entrarSala = function (codigo) {
    codigo = String(codigo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (codigo.length !== 4) { falhou('Código inválido (são 4 letras ou números).'); return; }
    N.sair();
    if (!N.disponivel()) { falhou('A biblioteca de rede não carregou.'); return; }
    N.modo = 'cliente'; N.codigo = codigo; N.status = 'Conectando…'; N.erro = null; N.emit('mudou');
    const peer = new window.Peer(opcoesPeer());
    N.peer = peer;
    peer.on('open', (id) => {
      if (N.peer !== peer) return;
      N.meuId = id;
      const conn = peer.connect(PREFIXO + codigo.toLowerCase(), { reliable: true, serialization: 'json' });
      N.conn = conn;
      const tempo = setTimeout(() => { if (N.conn === conn && !conn.open) { N.sair(); falhou('Não foi possível conectar à sala ' + codigo + '.'); } }, 12000);
      conn.on('open', () => {
        clearTimeout(tempo);
        N.status = 'Conectado, esperando o anfitrião…'; N.emit('mudou');
        enviar(conn, { t: 'ola', v: R.VERSAO, conta: R.Contas.resumo() || { id: '', nome: 'Jogador' }, locais: R.Jogo.indicesLocais() });
      });
      conn.on('data', (msg) => aoMensagemCliente(msg));
      // (quando eu mesmo saio, N.conn já é outra: não é a conexão que caiu)
      const caiu = () => { if (N.conn === conn) { N.sair(); falhou('A sala foi fechada (o anfitrião saiu ou a conexão caiu).'); } };
      conn.on('close', caiu);
      conn.on('error', caiu);
    });
    peer.on('error', (e) => { if (N.peer === peer) { const msg = traduzirErro(e); N.sair(); falhou(msg); } });
  };

  function aoMensagemCliente(msg) {
    if (!msg || typeof msg !== 'object') return;
    switch (msg.t) {
      case 'bemvindo':
        N.status = 'Na sala'; N.emit('mudou');
        if (msg.partida) { N.partida = true; N.emit('iniciar'); }   // chegou com a partida em andamento: entra nela
        break;
      case 'iniciar': N.partida = true; N.emit('iniciar'); break;
      case 'recusado': N.sair(); falhou(msg.motivo || 'O anfitrião recusou a entrada.'); break;
      case 'sala':
        if (!Array.isArray(msg.sala)) return;
        N.sala = msg.sala.slice(0, MAX).map((j) => ({ slot: R.clamp(j.slot | 0, 1, MAX), dono: String(j.dono), i: j.i | 0, nome: nomeValido(j.nome) }));
        N.fora = Math.max(0, msg.fora | 0);
        N.emit('mudou');
        break;
      case 's':
        if (Array.isArray(msg.p)) msg.p.forEach((e) => { if (Array.isArray(e)) R.Jogo.receberEstado(String(e[0]), e.slice(1), false); });
        break;
      case 'fim': N.sair(); falhou(msg.motivo || 'O anfitrião encerrou a sala.'); break;
    }
  }

  /* =====================================================================
     GERAL
     ===================================================================== */
  /* os jogadores deste aparelho mudaram (menu: pôr ou tirar jogador) */
  /* (anfitrião) começa a partida para todos da sala */
  N.iniciarPartida = function () {
    if (N.modo !== 'anfitriao') return;
    N.partida = true;
    enviarTodos({ t: 'iniciar' });
    N.emit('iniciar');
  };
  N.locaisMudaram = function () {
    if (N.modo === 'anfitriao') montarSala();
    else if (N.modo === 'cliente') enviar(N.conn, { t: 'locais', locais: R.Jogo.indicesLocais() });
  };
  /* o nome da conta mudou (anfitrião: os nomes da sala) */
  N.nomeMudou = () => { if (N.modo === 'anfitriao') montarSala(); };

  /* a cada quadro: o anfitrião manda o estado de todos; o cliente, o dos jogadores dele */
  N.tick = function (dt) {
    if (N.modo === 'offline') return;
    N.tEnvio += dt;
    if (N.tEnvio < INTERVALO) return;
    N.tEnvio = 0;
    if (N.modo === 'anfitriao' && N.clientes.size) enviarTodos({ t: 's', p: R.Jogo.estados(null) });
    else if (N.modo === 'cliente' && N.conn && N.status === 'Na sala') enviar(N.conn, { t: 'pos', p: R.Jogo.estados(N.meuId).map((e) => [+e[0].split(':').pop()].concat(e.slice(1))) });
  };

  N.sair = function (motivo) {
    if (N.modo === 'anfitriao') enviarTodos({ t: 'fim', motivo: motivo || 'O anfitrião encerrou a sala.' });
    const p = N.peer, estava = N.modo !== 'offline';
    setTimeout(() => { try { if (p) p.destroy(); } catch (e) { /* ok */ } }, 200);
    N.peer = null; N.conn = null; N.clientes = new Map(); N.modo = 'offline'; N.codigo = null; N.status = ''; N.meuId = null;
    N.sala = []; N.fora = 0; N.erro = null; N.partida = false;
    if (estava) N.emit('mudou');
  };

  function traduzirErro(e) {
    const t = e && e.type;
    if (t === 'peer-unavailable') return 'Sala não encontrada. Confira o código.';
    if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return 'Sem conexão com o servidor de salas (internet ou servidor do PeerJS fora do ar).';
    if (t === 'browser-incompatible') return 'Este navegador não suporta WebRTC.';
    if (t === 'unavailable-id') return 'Não consegui reservar um código de sala. Tente de novo.';
    return 'Erro de rede: ' + (t || e);
  }

  window.addEventListener('beforeunload', () => N.sair());
  R.Rede = N;
})(window.RES);
