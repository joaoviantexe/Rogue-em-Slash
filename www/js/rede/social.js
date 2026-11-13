/* Rogue em' Slash — O social e a loja, pelo Supabase (o banco está em supabase/esquema.sql):
   - chat da sala e sussurros (tabela mensagens, chegando na hora pelo Realtime);
   - amigos (pedir, aceitar, recusar, desfazer);
   - moedas, itens do bazar e o visual do boneco da sala (cor do corpo e os itens, cada um com a sua cor);
   - nome de jogador e senha (Configurações no celular).
   Sem conta dá para ler o chat da sala e mudar a cor do corpo (guardada só neste navegador); o resto pede uma conta. */
(function (R) {
  'use strict';

  const S = { mensagens: [], amigos: [], itens: [], comprados: new Set(), moedas: 0, ouvintes: {} };
  let canalChat = null;
  S.on = (ev, fn) => { (S.ouvintes[ev] = S.ouvintes[ev] || []).push(fn); };
  S.emit = (ev, d) => (S.ouvintes[ev] || []).forEach((f) => { try { f(d); } catch (e) { console.error(e); } });

  const C = () => R.Contas;
  const cli = () => C().cliente;
  S.comConta = () => C().ativo() && C().logado();
  /* conversar pede um login: a conta ou o anônimo de quem joga sem conta */
  S.podeConversar = () => C().ativo() && !!C().usuario;
  async function rpc(nome, args) {
    const { data, error } = await cli().rpc(nome, args || {});
    if (error) throw new Error(traduzir(error));
    return data;
  }
  function traduzir(e) {
    const msg = String((e && e.message) || e);
    if (/devagar/.test(msg)) return 'Calma: no máximo uma mensagem por segundo.';
    if (/moedas insuficientes/.test(msg)) return 'Moedas insuficientes.';
    if (/já comprado/.test(msg)) return 'Você já tem este item.';
    if (/item indisponível/.test(msg)) return 'Este item não está à venda.';
    if (/item não comprado/.test(msg)) return 'Compre o item antes de usar.';
    return C().traduzir(e);
  }

  /* =====================================================================
     VISUAL DO BONECO: { corpo: '#rrggbb', chapeu: { id, cor } | null, oculos, capacete, mascara, camisa, casaco, colar, costas }
     ===================================================================== */
  const COR = /^#[0-9a-f]{6}$/i;
  const SLOTS = ['chapeu', 'oculos', 'capacete', 'mascara', 'camisa', 'casaco', 'colar', 'costas'];
  S.SLOTS = SLOTS;
  /* só o formato esperado (vem de outro aparelho ou do banco) */
  S.visualValido = function (v, corPadrao) {
    const o = { corpo: corPadrao || '#1f8ff0' };
    SLOTS.forEach((s) => { o[s] = null; });
    if (!v || typeof v !== 'object') return o;
    if (v.asas && !v.costas) v = Object.assign({}, v, { costas: v.asas });   // (as asas eram um encaixe só delas: viraram "costas")
    if (COR.test(v.corpo)) o.corpo = v.corpo.toLowerCase();
    SLOTS.forEach((s) => {
      const it = v[s], def = it && R.Itens3D && R.Itens3D.ITENS[it.id];
      if (def && def.tipo === s) o[s] = { id: it.id, cor: COR.test(it.cor) ? it.cor.toLowerCase() : def.cor };
    });
    if (o.capacete) { o.chapeu = null; o.oculos = null; o.mascara = null; }   // o capacete cobre a cabeça inteira
    if (o.mascara) o.oculos = null;   // a máscara e os óculos ficam no mesmo lugar (os olhos)
    return o;
  };
  const CHAVE_VISUAL = 'res.visual';
  /* o meu visual: o da conta (perfis.visual) ou, sem conta, o deste navegador (só a cor do corpo) */
  S.meuVisual = function (corPadrao) {
    const p = C().perfil;
    if (S.comConta() && p && p.visual) return S.visualValido(p.visual, corPadrao);
    let local = null;
    try { local = JSON.parse(localStorage.getItem(CHAVE_VISUAL)); } catch (e) { /* sem armazenamento */ }
    const v = S.visualValido(local, corPadrao);
    if (!S.comConta()) SLOTS.forEach((s) => { v[s] = null; });
    return v;
  };
  S.salvarVisual = async function (v) {
    v = S.visualValido(v);
    try { localStorage.setItem(CHAVE_VISUAL, JSON.stringify({ corpo: v.corpo })); } catch (e) { /* ok */ }
    if (S.comConta()) {
      await rpc('salvar_visual', { v });
      if (C().perfil) C().perfil.visual = v;
    }
    S.emit('visual', v);
    return v;
  };

  /* =====================================================================
     BAZAR E MOEDAS
     ===================================================================== */
  S.carregarBazar = async function () {
    if (!C().ativo()) { S.itens = []; S.emit('bazar'); return; }
    const r = await cli().from('itens_bazar').select('id, nome, tipo, preco, ativo, ordem').order('ordem');
    if (r.error) throw new Error(traduzir(r.error));
    S.itens = (r.data || []).filter((i) => R.Itens3D.ITENS[i.id]);
    S.comprados = new Set();
    S.moedas = 0;
    if (S.comConta()) {
      const [c, m] = await Promise.all([cli().from('itens_comprados').select('item'), cli().from('carteiras').select('moedas').maybeSingle()]);
      if (c.error) throw new Error(traduzir(c.error));
      (c.data || []).forEach((x) => S.comprados.add(x.item));
      S.moedas = (m.data && m.data.moedas) || 0;
    }
    S.emit('bazar');
  };
  S.tem = (id) => S.comprados.has(id) || S.itens.some((i) => i.id === id && i.preco === 0);
  S.comprar = async function (id) {
    S.moedas = await rpc('comprar_item', { item: id });
    S.comprados.add(id);
    S.emit('bazar');
  };

  /* =====================================================================
     AMIGOS
     ===================================================================== */
  S.carregarAmigos = async function () {
    if (!S.comConta()) { S.amigos = []; S.emit('amigos'); return; }
    S.amigos = (await rpc('meus_amigos')) || [];
    S.emit('amigos');
  };
  const RESPOSTAS = {
    enviado: 'Pedido de amizade enviado.', aceita: 'Agora vocês são amigos.', ja_existe: 'Vocês já são amigos (ou o pedido já foi enviado).',
    voce_mesmo: 'Esse é você.', nao_encontrado: 'Jogador não encontrado.', convidado: 'Esse jogador está sem conta.',
  };
  /* pelo id da conta (clicando no jogador) ou pelo nome (no app Amigos). Devolve a frase da resposta. */
  S.pedirAmizade = async function (op) {
    const r = await rpc('pedir_amizade', { alvo: op.id || null, n: op.nome || null });
    S.carregarAmigos().catch(() => {});
    return RESPOSTAS[r] || r;
  };
  S.responderAmizade = async function (id, aceitar) { await rpc('responder_amizade', { outro: id, aceitar }); await S.carregarAmigos(); };
  S.removerAmizade = async function (id) { await rpc('remover_amizade', { outro: id }); await S.carregarAmigos(); };

  /* =====================================================================
     CHAT: { id, de, para, nome, para_nome, texto, criado_em }
     ===================================================================== */
  function receber(m) {
    if (!m || S.mensagens.some((x) => x.id === m.id)) return;
    S.mensagens.push(m);
    if (S.mensagens.length > 50) S.mensagens.shift();
    S.emit('mensagem', m);
  }
  S.ligarChat = function () {
    if (!C().ativo() || canalChat) return;
    const canal = cli().channel('res-mensagens');
    canal.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens' }, (p) => receber(p.new)).subscribe();
    canalChat = canal;
    // as últimas mensagens, para quem acabou de chegar (as regras do banco só devolvem o que dá para ler)
    cli().from('mensagens').select('id, de, para, nome, para_nome, texto, criado_em').order('criado_em', { ascending: false }).limit(30)
      .then(({ data, error }) => {
        if (error) { console.warn('Chat:', traduzir(error)); return; }
        (data || []).reverse().forEach(receber);
      });
  };
  S.desligarChat = function () {
    if (canalChat) try { cli().removeChannel(canalChat); } catch (e) { /* ok */ }
    canalChat = null; S.mensagens = [];
    S.emit('mensagem', null);
  };
  /* para: o id da conta de quem recebe o sussurro (ou nada: a sala toda) */
  S.enviar = async function (texto, para) {
    if (!S.podeConversar()) throw new Error('O chat sem conta ainda não está ligado (login anônimo no Supabase).');
    texto = String(texto || '').trim();
    if (!texto) return;
    const { data, error } = await cli().from('mensagens').insert({ texto, para: para || null }).select('id, de, para, nome, para_nome, texto, criado_em').single();
    if (error) throw new Error(traduzir(error));
    receber(data);   // (a cópia que volta pelo Realtime é ignorada: mesmo id)
  };

  /* =====================================================================
     CONTA (Configurações)
     ===================================================================== */
  S.trocarNome = async function (nome) {
    const r = await rpc('trocar_nome', { n: nome });
    if (r === 'invalido') throw new Error('O nome precisa ter de 2 a 18 letras, números, espaço, ponto, hífen ou _.');
    if (r === 'em_uso') throw new Error('Esse nome de jogador já está em uso.');
    C().perfil.nome = nome.trim();
    C().emit('mudou');
  };
  S.trocarSenha = (senha) => C().novaSenha(senha);

  /* entrou ou saiu da conta: o chat volta a ligar com as regras da conta nova */
  S.contaMudou = function () {
    const ligado = !!canalChat;
    S.desligarChat();
    if (ligado) S.ligarChat();
    S.carregarAmigos().catch(() => {});
    S.carregarBazar().catch(() => {});
  };

  R.Social = S;
})(window.RES);
