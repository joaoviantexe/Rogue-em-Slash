/* Rogue em' Slash — O celular (como o dos jogos de mundo aberto): sobe do canto da tela com Esc (ou Start do controle)
   e tem os apps Amigos (a lista de amigos, pedidos e adicionar pelo nome) e Configurações (nome de jogador, senha e sair
   da conta). Visual próprio, no estilo Frutiger Aero da sala (ícones de vidro). Também guarda R.UI, que sabe se alguma
   janela está aberta (aí o boneco não anda). */
(function (R) {
  'use strict';

  R.UI = {
    /* alguma janela aberta: as ações continuam, mas ninguém anda */
    atualizar() {
      R.Input.parado = !!((R.Chat && R.Chat.aberto) || (R.Celular && R.Celular.aberto) || (R.Bazar && R.Bazar.aberto) || (R.MenuJogador && R.MenuJogador.aberto));
    },
    fecharTudo() { [R.Chat, R.Celular, R.Bazar, R.MenuJogador].forEach((j) => { if (j && j.aberto) j.fechar(); }); },
  };

  const CEL = { aberto: false, app: null, aviso: '' };
  let el = null, relogio = null;
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const S = () => R.Social;

  /* ícones de vidro (desenhos simples, feitos aqui) */
  const ICONES = {
    amigos: '<svg viewBox="0 0 40 40"><circle cx="15" cy="13" r="6" fill="#fff"/><path d="M4 32c0-7 5-11 11-11s11 4 11 11z" fill="#fff"/><circle cx="27" cy="15" r="5" fill="#e8ffe8"/><path d="M24 22c6-1 12 3 12 10h-8c0-4-1-7-4-10z" fill="#e8ffe8"/></svg>',
    config: '<svg viewBox="0 0 40 40"><path fill="#fff" d="M17 4h6l1 5 4 2 4-3 4 4-3 4 2 4 5 1v6l-5 1-2 4 3 4-4 4-4-3-4 2-1 5h-6l-1-5-4-2-4 3-4-4 3-4-2-4-5-1v-6l5-1 2-4-3-4 4-4 4 3 4-2z"/><circle cx="20" cy="20" r="6" fill="#6b7a8c"/></svg>',
  };
  const APPS = [['amigos', 'Amigos'], ['config', 'Configurações']];

  function online(conta) {
    for (const o of R.SaguaoOnline.outros.values()) if (o.conta === conta) return true;
    return false;
  }
  const semConta = (o_que) => `<p>${o_que}</p><p><button type="button" data-acao="entrar">Entrar ou criar conta</button></p>`;

  const TELAS = {
    inicio: () => `<div class="cel-apps">${APPS.map(([id, nome]) => `<button type="button" class="cel-app" data-app="${id}"><span class="cel-icone cel-${id}">${ICONES[id]}</span>${nome}</button>`).join('')}</div>`,
    amigos: () => {
      if (!S().comConta()) return semConta(R.Contas.ativo() ? 'Entre numa conta para ter amigos.' : 'Os amigos precisam das contas (Supabase) configuradas.');
      const a = S().amigos, recebidos = a.filter((x) => x.situacao === 'recebido'), amigos = a.filter((x) => x.situacao === 'amigo'), enviados = a.filter((x) => x.situacao === 'enviado');
      const lista = (titulo, l, botoes) => (l.length ? `<h3>${titulo}</h3><ul>${l.map((x) => `<li><span>${esc(x.nome)}${x.situacao === 'amigo' ? (online(x.id) ? ' <i class="cel-on">● na sala</i>' : ' <i class="cel-off">offline</i>') : ''}</span>${botoes(x)}</li>`).join('')}</ul>` : '');
      return `<form data-form="adicionar"><input name="nome" placeholder="Nome de jogador" maxlength="18" autocomplete="off"><button type="submit">Adicionar</button></form>
        ${lista('Pedidos recebidos', recebidos, (x) => `<button type="button" data-acao="aceitar" data-id="${x.id}">Aceitar</button><button type="button" data-acao="recusar" data-id="${x.id}">Recusar</button>`)}
        ${lista('Amigos', amigos, (x) => `<button type="button" data-acao="sussurrar" data-id="${x.id}" data-nome="${esc(x.nome)}">Sussurrar</button><button type="button" data-acao="remover" data-id="${x.id}">Remover</button>`)}
        ${lista('Pedidos enviados', enviados, (x) => `<button type="button" data-acao="remover" data-id="${x.id}">Cancelar</button>`)}
        ${a.length ? '' : '<p>Nenhum amigo ainda. Adicione pelo nome ou clicando num jogador na sala.</p>'}`;
    },
    config: () => {
      if (!S().comConta()) return semConta('Você está jogando sem conta.');
      return `<p>Conta: <b>${esc(R.Contas.nome())}</b></p>
        <form data-form="nome"><label>Nome de jogador<input name="nome" maxlength="18" value="${esc(R.Contas.nome())}" autocomplete="off"></label><button type="submit">Salvar</button></form>
        <form data-form="senha"><label>Senha nova<input name="senha" type="password" minlength="6" autocomplete="new-password"></label><button type="submit">Salvar</button></form>
        <p><button type="button" data-acao="sair">Sair da conta</button></p>`;
    },
  };
  const TITULOS = { amigos: 'Amigos', config: 'Configurações' };

  CEL.render = function () {
    if (!el) return;
    const agora = new Date();
    el.querySelector('.cel-hora').textContent = String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0');
    el.querySelector('.cel-moedas').textContent = S().comConta() ? '● ' + S().moedas : '';
    const app = CEL.app, conteudo = el.querySelector('.cel-conteudo');
    // o que estava sendo digitado continua lá (a lista muda quando alguém entra ou sai da sala)
    const valores = {}, foco = document.activeElement && conteudo.contains(document.activeElement) ? document.activeElement.name : null;
    conteudo.querySelectorAll('input[name]').forEach((i) => { valores[i.closest('form').dataset.form + ':' + i.name] = i.value; });
    conteudo.innerHTML = app
      ? `<div class="cel-app-tela"><h2>${TITULOS[app]}</h2>${TELAS[app]()}<p class="cel-aviso">${esc(CEL.aviso)}</p></div>`
      : TELAS.inicio();
    conteudo.querySelectorAll('input[name]').forEach((i) => { const k = i.closest('form').dataset.form + ':' + i.name; if (k in valores) i.value = valores[k]; if (i.name === foco) i.focus(); });
  };
  const aviso = (msg) => { CEL.aviso = msg; CEL.render(); };

  CEL.abrir = function () {
    if (!el) return;
    CEL.aberto = true; CEL.app = null; CEL.aviso = '';
    el.classList.add('aberto');
    CEL.render();
    R.UI.atualizar();
    clearInterval(relogio); relogio = setInterval(CEL.render, 20000);
    S().carregarAmigos().catch(() => {});
  };
  CEL.fechar = function () {
    if (!el || !CEL.aberto) return;
    CEL.aberto = false;
    el.classList.remove('aberto');
    if (document.activeElement && el.contains(document.activeElement)) document.activeElement.blur();
    clearInterval(relogio);
    R.UI.atualizar();
  };
  CEL.alternar = () => (CEL.aberto ? CEL.fechar() : CEL.abrir());
  /* B do controle / Backspace: volta para a tela inicial (ou fecha) */
  CEL.voltar = () => { if (CEL.app) { CEL.app = null; CEL.aviso = ''; CEL.render(); } else CEL.fechar(); };

  async function aoAcao(b) {
    const a = b.dataset.acao, id = b.dataset.id;
    try {
      if (a === 'entrar') { CEL.fechar(); R.Fluxo.irLogin('entrar'); return; }
      if (a === 'aceitar') { await S().responderAmizade(id, true); aviso('Agora vocês são amigos.'); }
      if (a === 'recusar') { await S().responderAmizade(id, false); aviso(''); }
      if (a === 'remover') { await S().removerAmizade(id); aviso(''); }
      if (a === 'sussurrar') { CEL.fechar(); R.Chat.abrir(id, b.dataset.nome); }
      if (a === 'sair') { CEL.fechar(); await R.Contas.sair(); R.Fluxo.irLogin('entrar'); }
    } catch (e) { aviso(e.message); }
  }
  async function aoEnviar(f) {
    const d = Object.fromEntries(new FormData(f).entries());
    try {
      if (f.dataset.form === 'adicionar') { if (d.nome.trim()) { const r = await S().pedirAmizade({ nome: d.nome }); f.reset(); aviso(r); } }
      if (f.dataset.form === 'nome') { await S().trocarNome(d.nome); aviso('Nome salvo.'); }
      if (f.dataset.form === 'senha') { if (d.senha.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.'); await S().trocarSenha(d.senha); f.reset(); aviso('Senha salva.'); }
    } catch (e) { aviso(e.message); }
  }

  CEL.iniciar = function () {
    el = document.createElement('div');
    el.id = 'celular';
    el.innerHTML = `<div class="cel-corpo"><div class="cel-tela"><div class="cel-barra"><span class="cel-hora"></span><span class="cel-moedas"></span></div>
      <div class="cel-conteudo"></div></div>
      <div class="cel-botoes"><button type="button" data-cel="voltar" aria-label="Voltar">‹</button><button type="button" data-cel="inicio" aria-label="Início">●</button><button type="button" data-cel="fechar" aria-label="Fechar">✕</button></div></div>`;
    document.body.appendChild(el);
    el.addEventListener('click', (ev) => {
      const app = ev.target.closest('[data-app]'), cel = ev.target.closest('[data-cel]'), b = ev.target.closest('button[data-acao]');
      if (app) { CEL.app = app.dataset.app; CEL.aviso = ''; CEL.render(); if (CEL.app === 'amigos') S().carregarAmigos().catch(() => {}); }
      else if (cel) { const c = cel.dataset.cel; if (c === 'voltar') CEL.voltar(); else if (c === 'inicio') { CEL.app = null; CEL.render(); } else CEL.fechar(); }
      else if (b) aoAcao(b);
    });
    el.addEventListener('submit', (ev) => { ev.preventDefault(); aoEnviar(ev.target); });
    el.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { ev.preventDefault(); CEL.fechar(); } });   // (digitando num campo)
    S().on('amigos', () => { if (CEL.aberto && CEL.app === 'amigos') CEL.render(); });
    S().on('bazar', () => { if (CEL.aberto) CEL.render(); });
    R.SaguaoOnline.on('sync', () => { if (CEL.aberto && CEL.app === 'amigos') CEL.render(); });
  };

  R.Celular = CEL;
})(window.RES);
