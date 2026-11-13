/* Rogue em' Slash — Chat da sala: as últimas mensagens no canto de baixo à esquerda (na sala) e o campo de digitar,
   que abre com Enter (ou T, ou tocando nas mensagens) e fecha com Esc. Os sussurros (para um jogador só) aparecem em
   outra cor. Dá para conversar com ou sem conta (sem conta, pelo login anônimo). As mensagens vêm de R.Social. */
(function (R) {
  'use strict';

  const C = { aberto: false, para: null, paraNome: '', avisos: [] };
  const MAX_LINHAS = 8;
  let el = null;
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function linhas() {
    const ms = R.Social.mensagens.map((m) => ({ t: new Date(m.criado_em).getTime() || 0, m })).concat(C.avisos.map((a) => ({ t: a.t, a })));
    ms.sort((x, y) => x.t - y.t);
    return ms.slice(-MAX_LINHAS).map(({ m, a }) => {
      if (a) return `<div class="chat-linha aviso">${esc(a.texto)}</div>`;
      if (m.para) return `<div class="chat-linha sussurro">${esc(m.nome)} → ${esc(m.para_nome || '?')}: ${esc(m.texto)}</div>`;
      return `<div class="chat-linha"><b>${esc(m.nome)}:</b> ${esc(m.texto)}</div>`;
    }).join('');
  }
  C.render = function () {
    if (!el) return;
    const l = el.querySelector('.chat-linhas');
    l.innerHTML = linhas();
    l.classList.toggle('vazio', !l.innerHTML);
    el.querySelector('.chat-para').textContent = C.para ? 'Sussurrar para ' + C.paraNome + ':' : '';
  };
  /* uma linha só deste aparelho (avisos e erros) */
  C.aviso = function (texto) {
    C.avisos.push({ t: Date.now(), texto });
    if (C.avisos.length > 5) C.avisos.shift();
    C.render();
  };

  /* abre o campo (para: o id da conta de quem recebe um sussurro) */
  C.abrir = function (para, paraNome) {
    if (!el) return;
    if (!R.Social.podeConversar()) { C.aviso(R.Contas.ativo() ? 'O chat sem conta ainda não está ligado (login anônimo no Supabase).' : 'O chat precisa das contas (Supabase) configuradas.'); return; }
    C.para = para || null; C.paraNome = paraNome || '';
    C.aberto = true;
    el.classList.add('digitando');
    C.render();
    R.UI.atualizar();
    const inp = el.querySelector('input');
    inp.value = ''; inp.focus();
  };
  C.fechar = function () {
    if (!el || !C.aberto) return;
    C.aberto = false; C.para = null;
    el.classList.remove('digitando');
    el.querySelector('input').blur();
    C.render();
    R.UI.atualizar();
  };

  C.iniciar = function () {
    el = document.createElement('div');
    el.id = 'chat';
    el.innerHTML = '<div class="chat-linhas vazio"></div><form class="chat-form"><span class="chat-para"></span><input maxlength="200" autocomplete="off" enterkeyhint="send"><button type="submit">Enviar</button></form>';
    document.body.appendChild(el);
    const inp = el.querySelector('input');
    el.querySelector('form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const texto = inp.value.trim(), para = C.para;
      C.fechar();
      if (!texto) return;
      try { await R.Social.enviar(texto, para); } catch (e) { C.aviso(e.message); }
    });
    inp.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { ev.preventDefault(); C.fechar(); } });
    el.querySelector('.chat-linhas').addEventListener('click', () => { if (!C.aberto) C.abrir(); });
    R.Social.on('mensagem', C.render);
  };

  R.Chat = C;
})(window.RES);
