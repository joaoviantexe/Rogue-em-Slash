/* Rogue em' Slash — Telas (HTML puro, sem estilo: a cara delas fica para depois). A conta é opcional: o jogo abre
   direto no menu (jogando sem conta), e dá para entrar ou criar uma conta por ele. Sem confirmação de e-mail.
   - entrar / criar / esqueci / novaSenha: a conta (R.Contas).
   - menu: os jogadores deste aparelho (até 4, cada um com o seu controle), a sala online (criar ou entrar com o
     código) e o botão de jogar. No jogo, Esc, Start ou o botão "Menu" voltam para cá. */
(function (R) {
  'use strict';

  const T = { tela: 'carregando', msg: '', erro: false, ocupado: false, email: '', codigo: '' };
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const el = () => document.getElementById('telas');

  const campo = (rotulo, nome, tipo, extra) => `<p><label>${rotulo}<br><input type="${tipo}" name="${nome}" ${extra || ''}></label></p>`;
  const ir = (tela, texto) => `<button type="button" data-acao="ir" data-tela="${tela}">${texto}</button>`;
  const emailPadrao = () => T.email || R.Contas.emailLembrado();
  const status = () => `<p id="status" role="status">${esc(T.msg)}</p>`;

  /* ---------- Conta ---------- */
  const TELAS = {
    carregando: () => '<p>Carregando…</p>',
    entrar: () => `<h1>Rogue em' Slash</h1>
      <form data-form="entrar">
        ${campo('E-mail', 'email', 'email', `autocomplete="email" required value="${esc(emailPadrao())}"`)}
        ${campo('Senha', 'senha', 'password', 'autocomplete="current-password" required')}
        <p><button type="submit">Entrar</button></p>
      </form>
      ${status()}
      <p>${ir('criar', 'Criar conta')} ${ir('esqueci', 'Esqueci minha senha')}</p>
      <p>${ir('menu', 'Voltar (jogar sem conta)')}</p>`,
    criar: () => `<h1>Criar conta</h1>
      <form data-form="criar">
        ${campo('Nome de jogador', 'nome', 'text', 'maxlength="18" autocomplete="nickname" required')}
        ${campo('E-mail', 'email', 'email', `autocomplete="email" required value="${esc(emailPadrao())}"`)}
        ${campo('Senha', 'senha', 'password', 'autocomplete="new-password" minlength="6" required')}
        ${campo('Repita a senha', 'senha2', 'password', 'autocomplete="new-password" minlength="6" required')}
        <p><button type="submit">Criar conta</button></p>
      </form>
      ${status()}
      <p>${ir('entrar', 'Já tenho conta')} ${ir('menu', 'Voltar (jogar sem conta)')}</p>`,
    esqueci: () => `<h1>Esqueci minha senha</h1>
      <form data-form="esqueci">
        ${campo('E-mail', 'email', 'email', `autocomplete="email" required value="${esc(emailPadrao())}"`)}
        <p>Enviamos um link para você criar uma senha nova.</p>
        <p><button type="submit">Enviar link</button></p>
      </form>
      ${status()}
      <p>${ir('entrar', 'Voltar')}</p>`,
    novaSenha: () => `<h1>Nova senha</h1>
      <form data-form="novaSenha">
        ${campo('Nova senha', 'senha', 'password', 'autocomplete="new-password" minlength="6" required')}
        ${campo('Repita a senha', 'senha2', 'password', 'autocomplete="new-password" minlength="6" required')}
        <p><button type="submit">Salvar senha</button></p>
      </form>
      ${status()}`,
    menu: menu,
  };

  /* ---------- Menu ---------- */
  function opcoesDispositivo(l) {
    const outros = R.Jogo.locais.filter((x) => x.i !== l.i).map((x) => x.dispositivo);
    return R.Input.DISPOSITIVOS.map(([id, nome]) => {
      const m = /^controle(\d)$/.exec(id);
      if (id === 'toque' && !R.Input.temToque && l.dispositivo !== 'toque') return '';
      const rot = nome + (m && !R.Input.controleConectado(+m[1]) ? ' (desconectado)' : '');
      return `<option value="${id}" ${id === l.dispositivo ? 'selected' : ''} ${outros.includes(id) ? 'disabled' : ''}>${esc(rot)}</option>`;
    }).join('');
  }
  function menu() {
    const C = R.Contas, N = R.Rede, J = R.Jogo;
    const conta = !C.ativo() ? '<p>Contas desligadas (falta configurar o Supabase em www/js/config.js).</p>'
      : C.logado() ? `<p>Conectado como <strong>${esc(C.nome())}</strong>. <button type="button" data-acao="sairConta">Sair da conta</button></p>`
        : `<p>Jogando sem conta. ${ir('entrar', 'Entrar')} ${ir('criar', 'Criar conta')}</p>`;
    const naSala = new Map(N.sala.filter((j) => j.dono === N.meuDono()).map((j) => [j.i, j.slot]));
    const nomes = new Map(J.lista().map((j) => [j.dono + ':' + j.i, j.nome]));
    const locais = J.locais.map((l) => {
      const nome = nomes.get(N.meuDono() + ':' + l.i) || ((C.nome() || 'Jogador') + (l.i ? ' (' + (l.i + 1) + ')' : ''));
      const vaga = N.modo === 'offline' ? '' : naSala.has(l.i) ? ` (jogador ${naSala.get(l.i)} da sala)` : N.status === 'Na sala' || N.modo === 'anfitriao' ? ' (ficou de fora: sala cheia)' : '';
      return `<li>${esc(nome)}${vaga}: <label>controle <select data-jogador="${l.i}">${opcoesDispositivo(l)}</select></label>
        ${J.locais.length > 1 ? `<button type="button" data-acao="remover" data-i="${l.i}">Tirar</button>` : ''}</li>`;
    }).join('');
    let online;
    if (N.modo === 'offline') {
      online = `<p><button type="button" data-acao="criarSala">Criar sala</button></p>
        <form data-form="entrarSala"><p><label>Código da sala <input name="codigo" maxlength="4" size="6" autocomplete="off" autocapitalize="characters" value="${esc(T.codigo)}"></label>
        <button type="submit">Entrar na sala</button></p></form>`;
    } else {
      const quem = N.modo === 'anfitriao' ? 'você é o anfitrião: passe o código para os outros' : 'você entrou na sala';
      const vagas = [1, 2, 3, 4].map((s) => {
        const j = N.sala.find((x) => x.slot === s);
        return `<li>${j ? esc(j.nome) + (j.dono === N.meuDono() ? ' (este aparelho)' : '') : '(vaga livre)'}</li>`;
      }).join('');
      online = `<p>Sala <strong>${esc(N.codigo || '…')}</strong> — ${quem}. ${esc(N.status)}</p>
        <ol>${vagas}</ol>
        <p><button type="button" data-acao="sairSala">Sair da sala</button></p>`;
    }
    const erro = N.erro ? `<p role="alert">${esc(N.erro)}</p>` : '';
    return `<h1>Rogue em' Slash</h1>
      ${conta}
      <p><button type="button" data-acao="jogar">Jogar</button></p>
      <h2>Jogadores neste aparelho</h2>
      <ol>${locais}</ol>
      <p><button type="button" data-acao="adicionar" ${J.podeAdicionar() ? '' : 'disabled'}>Adicionar jogador</button> (até 4 no total, contando os da sala online)</p>
      <h2>Online</h2>
      ${online}
      ${erro}`;
  }

  /* ---------- Desenhar e trocar ---------- */
  T.mostrar = function (tela, msg, erro) {
    if (tela !== T.tela) { T.msg = ''; T.erro = false; }
    T.tela = tela;
    if (msg != null) { T.msg = msg; T.erro = !!erro; }
    T.render();
  };
  T.render = function () {
    if (R.Jogo.visivel) return;   // (o jogo está na tela: desenha quando o menu abrir)
    const foco = document.activeElement && document.activeElement.name;
    el().innerHTML = TELAS[T.tela]();
    if (foco) { const f = el().querySelector('[name="' + foco + '"]'); if (f) f.focus(); }
    else { const p = el().querySelector('input:not([value]), input[value=""]'); if (p && !R.Input.soToque && T.tela !== 'menu') p.focus(); }
  };
  T.abrirMenu = function () { R.Jogo.mostrar(false); T.mostrar('menu'); };
  /* mensagem embaixo do formulário (sem redesenhar: o que foi digitado continua lá) */
  T.aviso = (msg, erro) => {
    T.msg = msg; T.erro = !!erro;
    const p = document.getElementById('status');
    if (p) p.textContent = msg; else T.render();
  };

  /* ---------- Ações ---------- */
  async function aoEnviar(form) {
    const d = Object.fromEntries(new FormData(form).entries()), tela = T.tela;
    if (form.dataset.form === 'entrarSala') { T.codigo = d.codigo || ''; R.Rede.entrarSala(d.codigo); return; }
    if (T.ocupado) return;
    if (d.email) T.email = d.email;
    if ((tela === 'criar' || tela === 'novaSenha') && d.senha !== d.senha2) { T.aviso('As duas senhas não são iguais.', true); return; }
    T.ocupado = true; T.aviso('Aguarde…');
    try {
      if (tela === 'entrar') {
        await R.Contas.entrar(d.email, d.senha);
        R.Contas.lembrarEmail(d.email);
        T.mostrar('menu');
      } else if (tela === 'criar') {
        await R.Contas.criarConta(d.nome, d.email, d.senha);   // (criou: já entra)
        R.Contas.lembrarEmail(d.email);
        T.mostrar('menu');
      } else if (tela === 'esqueci') {
        await R.Contas.esqueciSenha(d.email);
        T.aviso('Se existir uma conta com esse e-mail, chegou um link para criar uma senha nova.');
      } else if (tela === 'novaSenha') {
        await R.Contas.novaSenha(d.senha);
        T.mostrar('menu');
      }
    } catch (e) {
      T.aviso(e.message, true);
    } finally { T.ocupado = false; }
  }
  function aoClicar(b) {
    const a = b.dataset.acao;
    if (a === 'ir') T.mostrar(b.dataset.tela);
    else if (a === 'jogar') { R.Jogo.mostrar(true); }
    else if (a === 'sairConta') { R.Rede.sair(); R.Contas.sair(); }
    else if (a === 'adicionar') { R.Jogo.adicionarLocal(); T.render(); }
    else if (a === 'remover') { R.Jogo.removerLocal(+b.dataset.i); T.render(); }
    else if (a === 'criarSala') R.Rede.criarSala();
    else if (a === 'sairSala') R.Rede.sair();
  }

  T.iniciar = function () {
    const raiz = el();
    raiz.addEventListener('submit', (ev) => { ev.preventDefault(); aoEnviar(ev.target); });
    raiz.addEventListener('click', (ev) => { const b = ev.target.closest('button[data-acao]'); if (b) aoClicar(b); });
    raiz.addEventListener('change', (ev) => {
      const s = ev.target.closest('select[data-jogador]');
      if (s) { R.Jogo.definirDispositivo(+s.dataset.jogador, s.value); T.render(); }
    });
    raiz.addEventListener('input', (ev) => { if (ev.target.name === 'codigo') T.codigo = ev.target.value; });
    document.getElementById('botao-menu').addEventListener('click', T.abrirMenu);
    R.Input.aoMenu = T.abrirMenu;
    R.Input.aoMudarControles = () => { if (T.tela === 'menu') T.render(); };
    R.Rede.on('mudou', () => { R.Jogo.sincronizar(); if (T.tela === 'menu') T.render(); });
    R.Contas.on('mudou', () => {
      R.Jogo.sincronizar(); R.Rede.nomeMudou();
      if (T.tela === 'menu') T.render();
      else if (T.tela === 'entrar' || T.tela === 'criar') T.mostrar('menu');
    });
    R.Contas.on('recuperarSenha', () => { R.Jogo.mostrar(false); T.mostrar('novaSenha'); });
  };

  R.Telas = T;
})(window.RES);
