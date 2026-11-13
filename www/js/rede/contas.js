/* Rogue em' Slash — Contas (login e senha) pelo Supabase, como no RL20 (js/rede/contas.js). A conta é OPCIONAL (dá
   para jogar sem) e não tem confirmação de e-mail: criou, já entra (no Supabase, "Confirm email" fica desligado).
   Quem joga sem conta entra com o login anônimo do Supabase (com o nome que digitou): assim pode conversar, com as
   mesmas regras de quem tem conta (nome único, 1 mensagem por segundo). Sem o login anônimo ligado no projeto, o
   convidado joga do mesmo jeito, só não manda mensagem. O nome dele fica reservado só enquanto joga: ao sair (fechar
   o jogo, voltar para o login ou entrar numa conta) o login anônimo é apagado; e o jogo manda um sinal a cada minuto,
   para o banco liberar o nome de quem fechou o jogo sem avisar (supabase/esquema.sql: liberar_nome).
   Só liga quando R.CONFIG.supabase tem a URL e a chave publicável do projeto (www/js/config.js).
   O banco (tabela de perfis e as regras de quem vê o quê) está em supabase/esquema.sql. */
(function (R) {
  'use strict';

  const CHAVE_EMAIL = 'res.email', CHAVE_CONVIDADO = 'res.convidado';
  const C = { cliente: null, usuario: null, perfil: null, pronto: false, ouvintes: {} };

  C.on = (ev, fn) => { (C.ouvintes[ev] = C.ouvintes[ev] || []).push(fn); };
  C.emit = (ev, d) => (C.ouvintes[ev] || []).forEach((f) => { try { f(d); } catch (e) { console.error(e); } });

  const cfg = () => (R.CONFIG && R.CONFIG.supabase) || {};
  C.ativo = () => !!(cfg().url && cfg().chave && window.supabase && window.supabase.createClient);
  C.anonimo = () => !!(C.usuario && C.usuario.is_anonymous);   // jogando sem conta (login anônimo)
  C.logado = () => !!C.usuario && !C.anonimo();                 // com uma conta de verdade
  /* o nome do jogador: o da conta ou, sem conta, o que ele digitou ao entrar ("Jogar sem conta") */
  C.convidado = (() => { try { return localStorage.getItem(CHAVE_CONVIDADO) || ''; } catch (e) { return ''; } })();
  C.nome = () => (C.perfil ? C.perfil.nome : C.convidado);
  C.NOME_VALIDO = /^[\p{L}\p{N} _.-]{2,18}$/u;
  C.definirConvidado = function (nome) {
    nome = String(nome || '').trim();
    if (!C.NOME_VALIDO.test(nome)) throw new Error('O nome precisa ter de 2 a 18 letras, números, espaço, ponto, hífen ou _.');
    C.convidado = nome;
    try { localStorage.setItem(CHAVE_CONVIDADO, nome); } catch (e) { /* modo privado: vale só agora */ }
    C.emit('mudou');
  };
  /* quem eu sou, para mandar ao anfitrião de uma sala online */
  C.resumo = () => (C.usuario ? { id: C.usuario.id, nome: C.nome() } : null);

  /* ---------- Erros em português ---------- */
  function traduzir(erro) {
    if (!erro) return 'Erro desconhecido.';
    const cod = erro.code || '', msg = String(erro.message || erro);
    if (cod === 'invalid_credentials' || /invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
    if (cod === 'email_not_confirmed' || /not confirmed/i.test(msg)) return 'Confirme seu e-mail antes de entrar (veja a caixa de entrada e o spam).';
    if (cod === 'user_already_exists' || /already registered/i.test(msg)) return 'Já existe uma conta com este e-mail.';
    if (cod === 'weak_password' || /at least \d+ char/i.test(msg)) return 'A senha precisa ter pelo menos 6 caracteres.';
    // o envio de e-mail padrão do Supabase (sem SMTP próprio) só manda para os e-mails da equipe do projeto
    if (cod === 'email_address_not_authorized' || /address not authorized/i.test(msg)) return 'Ainda não dá para criar conta com este e-mail: o envio de e-mails do jogo está em modo de teste.';
    if (/email rate limit/i.test(msg)) return 'O jogo enviou e-mails demais nesta hora. Tente de novo mais tarde.';
    if (/rate limit|too many/i.test(msg) || cod.startsWith('over_')) return 'Muitas tentativas seguidas. Espere um pouco e tente de novo.';
    if (cod === 'validation_failed' || /invalid.*email|email.*invalid/i.test(msg)) return 'E-mail inválido.';
    if (/failed to fetch|network|load failed/i.test(msg)) return 'Sem conexão com o servidor de contas.';
    if (cod === 'PGRST202' || cod === 'PGRST205' || cod === '42P01' || cod === '42883' || /schema cache|does not exist/i.test(msg)) {
      return 'O servidor de contas ainda não foi preparado (rode o supabase/esquema.sql no Supabase).';
    }
    return msg;
  }
  C.traduzir = traduzir;
  const urlDoSite = () => location.origin + location.pathname;

  /* ---------- Início, entrar, sair ---------- */
  C.iniciar = async function () {
    if (!C.ativo()) { C.pronto = true; return; }
    C.cliente = window.supabase.createClient(cfg().url, cfg().chave, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'res.sessao' },
    });
    C.cliente.auth.onAuthStateChange((evento, sessao) => {
      C.token = sessao ? sessao.access_token : null;
      // a biblioteca pede para não chamar o Supabase dentro deste aviso: adia um instante
      setTimeout(() => {
        if (evento === 'PASSWORD_RECOVERY') C.emit('recuperarSenha');
        if (sessao && sessao.user && (!C.usuario || C.usuario.id !== sessao.user.id)) aoEntrar(sessao.user);
        else if (!sessao && C.usuario) aoSair();
      }, 0);
    });
    try {
      const { data } = await C.cliente.auth.getSession();
      if (data && data.session) { C.token = data.session.access_token; await aoEntrar(data.session.user); }
    } catch (e) { console.warn('Contas:', e); }
    C.pronto = true;
  };

  C.entrar = async function (email, senha) {
    await C.sairConvidado();   // (o nome de convidado fica livre)
    const { data, error } = await C.cliente.auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error) throw new Error(traduzir(error));
    if (data && data.user) await aoEntrar(data.user);
  };
  /* Cria a conta e já entra (sem confirmação de e-mail). */
  C.criarConta = async function (nome, email, senha) {
    nome = nome.trim();
    if (!C.NOME_VALIDO.test(nome)) throw new Error('O nome precisa ter de 2 a 18 letras, números, espaço, ponto, hífen ou _.');
    const livre = await C.cliente.rpc('nome_disponivel', { n: nome });
    if (livre.error) throw new Error(traduzir(livre.error));
    if (!livre.data) throw new Error('Esse nome de jogador já está em uso.');
    await C.sairConvidado();
    const { data, error } = await C.cliente.auth.signUp({ email: email.trim(), password: senha, options: { data: { nome } } });
    if (error) throw new Error(traduzir(error));
    if (data && data.session && data.user) { await aoEntrar(data.user); return; }
    // sem sessão: o e-mail já tinha conta, ou o projeto ainda pede confirmação de e-mail
    try { await C.entrar(email, senha); } catch (e) {
      if (/confirme seu e-mail/i.test(e.message)) throw new Error('O servidor de contas ainda pede confirmação de e-mail (no Supabase: Authentication → Sign In / Providers → Email → desligue "Confirm email").');
      throw new Error('Não foi possível criar a conta: este e-mail já pode estar em uso. Tente entrar ou use "Esqueci minha senha".');
    }
  };
  C.esqueciSenha = async function (email) {
    const { error } = await C.cliente.auth.resetPasswordForEmail(email.trim(), { redirectTo: urlDoSite() });
    if (error) throw new Error(traduzir(error));
  };
  C.novaSenha = async function (senha) {
    const { error } = await C.cliente.auth.updateUser({ password: senha });
    if (error) throw new Error(traduzir(error));
  };
  C.sair = async function () {
    try { await C.cliente.auth.signOut(); } catch (e) { console.warn('Contas:', e); }
    aoSair();
  };
  /* Quem jogava sem conta saiu: apaga o login anônimo (o nome dele fica livre na hora) e esquece a sessão. */
  C.sairConvidado = function () {
    if (!C.ativo() || !C.anonimo()) return C.saindo || Promise.resolve();
    C.saindo = (async () => {
      try { await C.cliente.rpc('sair_convidado'); } catch (e) { /* (o banco libera o nome sozinho em 3 minutos) */ }
      try { await C.cliente.auth.signOut({ scope: 'local' }); } catch (e) { /* ok */ }
      aoSair();
    })();
    return C.saindo.finally(() => { C.saindo = null; });
  };
  /* "Jogar sem conta": guarda o nome e entra com o login anônimo (ou reaproveita o de antes, trocando o nome) */
  C.entrarComoConvidado = async function (nome) {
    C.definirConvidado(nome);
    nome = C.convidado;
    if (!C.ativo()) return;
    if (C.saindo) await C.saindo;
    if (C.logado()) await C.sair();
    if (C.anonimo()) {
      if (C.perfil && C.perfil.nome === nome) return;
      const r = await C.cliente.rpc('trocar_nome', { n: nome });
      if (r.error) throw new Error(traduzir(r.error));
      if (r.data === 'em_uso') throw new Error('Esse nome já está em uso. Escolha outro.');
      if (r.data === 'invalido') throw new Error('O nome precisa ter de 2 a 18 letras, números, espaço, ponto, hífen ou _.');
      if (C.perfil) C.perfil.nome = nome;
      C.emit('mudou');
      return;
    }
    const livre = await C.cliente.rpc('nome_disponivel', { n: nome });
    if (livre.error) throw new Error(traduzir(livre.error));
    if (!livre.data) throw new Error('Esse nome já está em uso. Escolha outro.');
    const { data, error } = await C.cliente.auth.signInAnonymously({ options: { data: { nome } } });
    if (error) {   // o login anônimo está desligado no projeto: joga sem conversar
      console.warn('Contas: login anônimo:', traduzir(error));
      C.semAnonimo = true;
      return;
    }
    if (data && data.user) await aoEntrar(data.user);
  };
  C.emailLembrado = () => { try { return localStorage.getItem(CHAVE_EMAIL) || ''; } catch (e) { return ''; } };
  C.lembrarEmail = (email) => { try { localStorage.setItem(CHAVE_EMAIL, email.trim()); } catch (e) { /* modo privado */ } };

  async function aoEntrar(usuario) {
    if (C.usuario && C.usuario.id === usuario.id && C.perfil) return;
    C.usuario = usuario;
    const reserva = { id: usuario.id, nome: (usuario.user_metadata && usuario.user_metadata.nome) || String(usuario.email || 'Jogador').split('@')[0] };
    try {
      let r = await C.cliente.from('perfis').select('id, nome, visual' + (usuario.is_anonymous ? ', chave_saida' : '')).eq('id', usuario.id).maybeSingle();
      if (r.error) {   // banco ainda sem as colunas novas (falta rodar o supabase/esquema.sql de novo)
        console.warn('Contas: perfil', traduzir(r.error));
        r = await C.cliente.from('perfis').select('id, nome').eq('id', usuario.id).maybeSingle();
      }
      if (!r.error && !r.data && usuario.is_anonymous) {   // login anônimo que o banco já apagou (o nome foi liberado)
        try { await C.cliente.auth.signOut({ scope: 'local' }); } catch (e) { /* ok */ }
        C.usuario = null; C.perfil = null;
        return;
      }
      C.perfil = r.data || reserva;
    } catch (e) { C.perfil = reserva; }
    sinal();
    C.emit('mudou');
  }
  function aoSair() {
    clearInterval(timerSinal); timerSinal = null;
    if (!C.usuario) return;
    C.usuario = null; C.perfil = null;
    C.emit('mudou');
  }
  /* o jogo está aberto: um sinal agora e a cada minuto (o nome de convidado de quem sumiu fica livre em 3 minutos) */
  let timerSinal = null;
  function sinal() {
    const mandar = () => { if (C.usuario) C.cliente.rpc('marcar_visto').then(() => {}, () => {}); };
    mandar();
    if (!timerSinal) timerSinal = setInterval(mandar, 60000);
  }
  /* fechou a página jogando sem conta: apaga o login anônimo e a sessão guardada. Com a página fechando, o navegador só
     manda um texto simples (sendBeacon, sem cabeçalhos): vai a chave de saída do convidado, e a chave pública do site
     no endereço. */
  window.addEventListener('pagehide', () => {
    if (!C.ativo() || !C.anonimo()) return;
    const chave = C.perfil && C.perfil.chave_saida;
    try {
      if (chave && navigator.sendBeacon) navigator.sendBeacon(cfg().url + '/rest/v1/rpc/sair_convidado_chave?apikey=' + encodeURIComponent(cfg().chave), chave);
    } catch (e) { /* ok: o banco libera o nome sozinho em 3 minutos */ }
    try { localStorage.removeItem('res.sessao'); } catch (e) { /* ok */ }
    C.saiuAoFechar = true;
  });
  // a página voltou do cache do navegador depois de sair: começa de novo
  window.addEventListener('pageshow', (ev) => { if (ev.persisted && C.saiuAoFechar) location.reload(); });

  R.Contas = C;
})(window.RES);
