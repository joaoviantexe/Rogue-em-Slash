/* Rogue em' Slash — Tela de login (HTML puro, sem estilo: só o conteúdo centralizado). Aparece antes da sala.
   A conta é opcional ("Jogar sem conta") e não tem confirmação de e-mail: criou, já entra.
   - entrar / criar / esqueci / novaSenha; conectado: quem já tinha entrado antes (Continuar ou Sair da conta);
     convidado: sem conta, o jogador digita o nome dele. */
(function (R) {
  'use strict';

  const T = { tela: 'carregando', msg: '', ocupado: false, email: '' };
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const el = () => document.getElementById('telas');

  const campo = (rotulo, nome, tipo, extra) => `<p><label>${rotulo}<br><input type="${tipo}" name="${nome}" ${extra || ''}></label></p>`;
  const ir = (tela, texto) => `<button type="button" data-acao="ir" data-tela="${tela}">${texto}</button>`;
  const botao = (acao, texto) => `<button type="button" data-acao="${acao}">${texto}</button>`;
  const emailPadrao = () => T.email || R.Contas.emailLembrado();
  const status = () => `<p id="status" role="status">${esc(T.msg)}</p>`;

  const TELAS = {
    carregando: () => '<p>Carregando…</p>',
    entrar: () => `<h1>Rogue em' Slash</h1>
      ${R.Contas.ativo() ? `<form data-form="entrar">
        ${campo('E-mail', 'email', 'email', `autocomplete="email" required value="${esc(emailPadrao())}"`)}
        ${campo('Senha', 'senha', 'password', 'autocomplete="current-password" required')}
        <p><button type="submit">Entrar</button></p>
      </form>
      ${status()}
      <p>${ir('criar', 'Criar conta')} ${ir('esqueci', 'Esqueci minha senha')}</p>` : ''}
      <p>${ir('convidado', 'Jogar sem conta')}</p>`,
    criar: () => `<h1>Criar conta</h1>
      <form data-form="criar">
        ${campo('Nome de jogador', 'nome', 'text', 'maxlength="18" autocomplete="nickname" required')}
        ${campo('E-mail', 'email', 'email', `autocomplete="email" required value="${esc(emailPadrao())}"`)}
        ${campo('Senha', 'senha', 'password', 'autocomplete="new-password" minlength="6" required')}
        ${campo('Repita a senha', 'senha2', 'password', 'autocomplete="new-password" minlength="6" required')}
        <p><button type="submit">Criar conta</button></p>
      </form>
      ${status()}
      <p>${ir('entrar', 'Voltar')}</p>`,
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
    convidado: () => `<h1>Jogar sem conta</h1>
      <form data-form="convidado">
        ${campo('Seu nome', 'nome', 'text', `maxlength="18" autocomplete="nickname" required value="${esc(R.Contas.convidado)}"`)}
        <p><button type="submit">Jogar</button></p>
      </form>
      ${status()}
      <p>${ir('entrar', 'Voltar')}</p>`,
    conectado: () => `<h1>Rogue em' Slash</h1>
      <p>Conectado como <strong>${esc(R.Contas.nome())}</strong>.</p>
      <p>${botao('continuar', 'Continuar')} ${botao('sairConta', 'Sair da conta')}</p>`,
  };

  /* ---------- Desenhar e trocar ---------- */
  T.mostrar = function (tela) {
    if (tela !== T.tela) T.msg = '';
    T.tela = tela;
    T.render();
  };
  T.render = function () {
    el().innerHTML = TELAS[T.tela]();
    const p = el().querySelector('input:not([value]), input[value=""]');   // o cursor no primeiro campo vazio
    if (p && !R.Input.soToque) p.focus();
  };
  /* a primeira tela: quem já tinha entrado antes vê a conta; os outros, o login */
  T.inicial = () => T.mostrar(R.Contas.logado() ? 'conectado' : 'entrar');
  /* mensagem embaixo do formulário (sem redesenhar: o que foi digitado continua lá) */
  T.aviso = (msg) => {
    T.msg = msg;
    const p = document.getElementById('status');
    if (p) p.textContent = msg; else T.render();
  };

  /* ---------- Ações ---------- */
  async function aoEnviar(form) {
    const d = Object.fromEntries(new FormData(form).entries()), tela = T.tela;
    if (tela === 'convidado') {
      if (T.ocupado) return;
      T.ocupado = true; T.aviso('Aguarde…');
      try { await R.Contas.entrarComoConvidado(d.nome); R.Fluxo.irSaguao(); } catch (e) { T.aviso(e.message); } finally { T.ocupado = false; }
      return;
    }
    if (T.ocupado) return;
    if (d.email) T.email = d.email;
    if ((tela === 'criar' || tela === 'novaSenha') && d.senha !== d.senha2) { T.aviso('As duas senhas não são iguais.'); return; }
    T.ocupado = true; T.aviso('Aguarde…');
    try {
      if (tela === 'entrar') {
        await R.Contas.entrar(d.email, d.senha);
        R.Contas.lembrarEmail(d.email);
        R.Fluxo.irSaguao();
      } else if (tela === 'criar') {
        await R.Contas.criarConta(d.nome, d.email, d.senha);   // (criou: já entra)
        R.Contas.lembrarEmail(d.email);
        R.Fluxo.irSaguao();
      } else if (tela === 'esqueci') {
        await R.Contas.esqueciSenha(d.email);
        T.aviso('Se existir uma conta com esse e-mail, chegou um link para criar uma senha nova.');
      } else if (tela === 'novaSenha') {
        await R.Contas.novaSenha(d.senha);
        R.Fluxo.irSaguao();
      }
    } catch (e) {
      T.aviso(e.message);
    } finally { T.ocupado = false; }
  }
  async function aoClicar(b) {
    const a = b.dataset.acao;
    if (a === 'ir') T.mostrar(b.dataset.tela);
    else if (a === 'continuar') R.Fluxo.irSaguao();
    else if (a === 'sairConta') { await R.Contas.sair(); T.mostrar('entrar'); }
  }

  T.iniciar = function () {
    const raiz = el();
    raiz.addEventListener('submit', (ev) => { ev.preventDefault(); aoEnviar(ev.target); });
    raiz.addEventListener('click', (ev) => { const b = ev.target.closest('button[data-acao]'); if (b) aoClicar(b); });
    R.Contas.on('recuperarSenha', () => R.Fluxo.irLogin('novaSenha'));
  };

  R.Telas = T;
})(window.RES);
