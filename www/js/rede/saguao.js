/* Rogue em' Slash — Sala online pelo Supabase Realtime (como o lobby do RL20: js/rede/saguao.js): quem está na sala
   (presença), por onde anda (broadcast) e quem está na mesa de RPG. Não há servidor de jogo: cada aparelho conta o seu
   estado e o Supabase repassa para os outros. Funciona com ou sem conta (a chave publicável basta).
   - Presença: { id, conta, nome, cor, x, z, f, v (versão), mesa (sou o anfitrião: { codigo, desde, jogando }),
     sentado ({ cadeira, desde }), t }. Muda pouco: entrou, parou de andar, sentou, levantou, abriu a sala.
   - Movimento ('mov'): posição e velocidade quando começa a andar, muda de direção ou para (e a cada 0,8 s andando);
     os outros seguem essa velocidade até a próxima.
   Sem o Supabase configurado, a sala funciona só neste aparelho. */
(function (R) {
  'use strict';

  const CANAL = 'res-saguao-1';
  const O = { canal: null, conectado: false, eu: null, outros: new Map(), ouvintes: {} };
  let ultimoTrack = 0, timerTrack = null, mov = { t: 0, vx: 0, vz: 0, andando: false };

  O.on = (ev, fn) => { (O.ouvintes[ev] = O.ouvintes[ev] || []).push(fn); };
  O.emit = (ev, d) => (O.ouvintes[ev] || []).forEach((f) => { try { f(d); } catch (e) { console.error(e); } });
  O.disponivel = () => !!(R.Contas.ativo() && R.Contas.cliente);

  /* cada aba é um jogador na sala (dá para testar com duas abas da mesma conta) */
  const ID_ABA = 'a' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  /* a cor do boneco: fixa por conta (sem conta, por aba) */
  const CORES = ['#1f8ff0', '#2fbf4a', '#ff8a1e', '#9a5cf0', '#14b8c8', '#f0509a'];
  function corDe(chave) { let h = 0; for (const ch of String(chave)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return CORES[h % CORES.length]; }

  O.meu = function () {
    if (!O.eu) {
      const conta = R.Contas.usuario ? R.Contas.usuario.id : '';
      O.eu = { id: ID_ABA, conta, nome: R.Contas.nome() || 'Convidado', cor: corDe(conta || ID_ABA), x: 0, z: 2, f: Math.PI, v: R.VERSAO, mesa: null, sentado: null, t: 0 };
    }
    return O.eu;
  };
  /* trocou de conta (entrou, saiu): o nome e a cor mudam */
  O.contaMudou = function () {
    if (!O.eu) return;
    const conta = R.Contas.usuario ? R.Contas.usuario.id : '';
    Object.assign(O.eu, { conta, nome: R.Contas.nome() || 'Convidado', cor: corDe(conta || ID_ABA) });
    track(true);
  };

  /* ---------- Conexão ---------- */
  O.ligar = function () {
    if (!O.disponivel() || O.canal) return;
    const eu = O.meu();
    const canal = R.Contas.cliente.channel(CANAL, { config: { presence: { key: eu.id }, broadcast: { self: false } } });
    O.canal = canal;
    canal.on('presence', { event: 'sync' }, () => { if (O.canal === canal) lerPresenca(); });
    canal.on('broadcast', { event: 'mov' }, (m) => { if (O.canal === canal) receberMov(m && m.payload); });
    canal.subscribe((status) => {
      if (O.canal !== canal) return;
      const ok = status === 'SUBSCRIBED';
      if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {   // caiu: liga de novo daqui a pouco
        O.desligar();
        setTimeout(() => { if (R.Fluxo && R.Fluxo.estado !== 'login') O.ligar(); }, 3000);
        return;
      }
      if (ok === O.conectado && !ok) return;
      O.conectado = ok;
      if (ok) track(true);   // (re)conectou: conta de novo onde está
    });
  };
  O.desligar = function () {
    clearTimeout(timerTrack);
    if (O.canal) try { R.Contas.cliente.removeChannel(O.canal); } catch (e) { /* ok */ }
    O.canal = null; O.conectado = false;
    O.outros.clear();
    O.emit('sync');
  };

  /* ---------- Presença ----------
     O Supabase fecha o canal de quem muda a presença rápido demais ("Client presence rate limit exceeded"): no máximo uma
     mudança a cada INTERVALO_TRACK. Várias mudanças seguidas viram uma só (vai o estado mais novo). */
  const INTERVALO_TRACK = 2500;
  function track(imediato) {
    if (!O.canal || !O.conectado || !O.eu) return;
    clearTimeout(timerTrack);
    const espera = Math.max(0, INTERVALO_TRACK - (performance.now() - ultimoTrack), imediato ? 0 : 1500 - (performance.now() - ultimoTrack));
    timerTrack = setTimeout(() => {
      if (!O.canal || !O.conectado) return;
      ultimoTrack = performance.now();
      O.eu.t = Date.now();
      O.canal.track(Object.assign({}, O.eu)).catch(() => { /* tenta de novo na próxima mudança */ });
    }, espera);
  }
  /* muda o meu estado e avisa os outros (imediato: sem esperar o intervalo mínimo) */
  O.atualizar = function (campos, imediato) {
    Object.assign(O.meu(), campos);
    track(imediato !== false);
  };

  const num = (v, a, b, padrao) => (v !== null && v !== '' && isFinite(+v) ? R.clamp(+v, a, b) : padrao);
  const txt = (v, n) => String(v == null ? '' : v).slice(0, n);
  function saneado(p) {
    const m = p.mesa && typeof p.mesa === 'object' ? p.mesa : null, s = p.sentado && typeof p.sentado === 'object' ? p.sentado : null;
    return {
      id: txt(p.id, 40), conta: txt(p.conta, 40), nome: txt(p.nome, 18) || 'Jogador', cor: /^#[0-9a-f]{6}$/i.test(p.cor) ? p.cor : CORES[0],
      x: num(p.x, -50, 50, 0), z: num(p.z, -50, 50, 0), f: num(p.f, -10, 10, 0), v: txt(p.v, 10), t: num(p.t, 0, 1e15, 0),
      mesa: m ? { codigo: /^[A-Z0-9]{4}$/.test(m.codigo) ? m.codigo : null, desde: num(m.desde, 0, 1e15, 0), jogando: !!m.jogando } : null,
      sentado: s && isFinite(+s.cadeira) ? { cadeira: R.clamp(s.cadeira | 0, 0, 3), desde: num(s.desde, 0, 1e15, 0) } : null,
    };
  }
  function lerPresenca() {
    const st = O.canal.presenceState(), vistos = new Set();
    for (const k in st) {
      const metas = st[k], p = metas && metas[metas.length - 1];
      if (!p || !p.id || p.id === ID_ABA) continue;
      const s = saneado(p);
      vistos.add(s.id);
      const o = O.outros.get(s.id);
      if (!o) { O.outros.set(s.id, Object.assign(s, { vx: 0, vz: 0, recebido: performance.now() })); continue; }
      if (s.t >= o.t) Object.assign(o, s, { vx: 0, vz: 0, recebido: performance.now() });   // (a presença pode chegar depois de um movimento mais novo)
      else Object.assign(o, { nome: s.nome, cor: s.cor, v: s.v, mesa: s.mesa, sentado: s.sentado });
    }
    for (const id of [...O.outros.keys()]) if (!vistos.has(id)) O.outros.delete(id);
    O.emit('sync');
  }

  /* ---------- Movimento ---------- */
  function receberMov(p) {
    if (!p || typeof p !== 'object') return;
    const o = O.outros.get(txt(p.id, 40));
    if (!o) return;
    const t = num(p.t, 0, 1e15, 0);
    if (t < o.t) return;
    Object.assign(o, { x: num(p.x, -50, 50, o.x), z: num(p.z, -50, 50, o.z), vx: num(p.vx, -10, 10, 0), vz: num(p.vz, -10, 10, 0), f: num(p.f, -10, 10, o.f), t, recebido: performance.now() });
  }
  /* a cada quadro, com o meu boneco: manda só quando muda (ou de tempos em tempos andando) */
  O.mover = function (x, z, vx, vz, f) {
    const eu = O.meu();
    eu.x = Math.round(x * 100) / 100; eu.z = Math.round(z * 100) / 100; eu.f = Math.round(f * 100) / 100;
    if (!O.canal || !O.conectado) return;
    const agora = performance.now();
    const andando = Math.abs(vx) + Math.abs(vz) > 0.05;
    const mudou = andando !== mov.andando || Math.abs(vx - mov.vx) > 0.3 || Math.abs(vz - mov.vz) > 0.3;
    if (!mudou && !(andando && agora - mov.t > 800)) return;
    if (andando && mov.andando && agora - mov.t < 120) return;   // no máximo ~8 por segundo
    mov = { t: agora, vx, vz, andando };
    O.canal.send({ type: 'broadcast', event: 'mov', payload: { id: eu.id, x: eu.x, z: eu.z, vx: Math.round(vx * 100) / 100, vz: Math.round(vz * 100) / 100, f: eu.f, t: Date.now() } })
      .catch(() => { /* a próxima corrige */ });
    if (!andando) track(false);   // parou: a posição fica na presença, para quem chegar depois
  };

  /* ---------- A mesa de RPG ----------
     O anfitrião conta na presença dele (mesa: { codigo, desde, jogando }); quem senta conta "sentado". Se dois abrirem a
     sala ao mesmo tempo, fica quem abriu primeiro; se dois sentarem na mesma cadeira, fica quem sentou primeiro. */
  O.mesa = function () {
    const eu = O.meu(), todos = [...O.outros.values(), eu];
    const anfitrioes = todos.filter((o) => o.mesa).sort((a, b) => a.mesa.desde - b.mesa.desde || (a.id < b.id ? -1 : 1));
    const sentados = todos.filter((o) => o.sentado).sort((a, b) => a.sentado.desde - b.sentado.desde || (a.id < b.id ? -1 : 1));
    const cadeiras = [null, null, null, null];
    sentados.forEach((o) => { if (!cadeiras[o.sentado.cadeira]) cadeiras[o.sentado.cadeira] = o; });
    return { anfitriao: anfitrioes[0] || null, cadeiras };
  };

  R.SaguaoOnline = O;
})(window.RES);
