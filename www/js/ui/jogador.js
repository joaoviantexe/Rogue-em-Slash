/* Rogue em' Slash — Menu de outro jogador: clicando (ou tocando) num jogador na sala, aparece o nome dele com
   "Sussurrar" (abre o chat só para ele) e "Adicionar amigo". Sussurrar vale com ou sem conta; amizade, só entre contas. */
(function (R) {
  'use strict';

  const MJ = { aberto: false, alvo: null, aviso: '' };
  let el = null;
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function render(aviso) {
    if (aviso != null) MJ.aviso = aviso;
    aviso = MJ.aviso;
    const o = MJ.alvo, S = R.Social, ele = !!o.conta;
    const amigo = S.amigos.find((a) => a.id === o.conta);
    let botoes = '';
    if (S.podeConversar() && ele) botoes += '<button type="button" data-acao="sussurrar">Sussurrar</button>';
    if (S.comConta() && ele && !o.anon) {
      if (!amigo) botoes += '<button type="button" data-acao="amigo">Adicionar amigo</button>';
      else if (amigo.situacao === 'recebido') botoes += '<button type="button" data-acao="aceitar">Aceitar amizade</button>';
      else botoes += `<p>${amigo.situacao === 'amigo' ? 'Vocês são amigos.' : 'Pedido de amizade enviado.'}</p>`;
    }
    el.innerHTML = `<strong>${esc(o.nome)}</strong>${botoes}${aviso ? `<p>${esc(aviso)}</p>` : ''}`;
  }

  /* mostra o menu do jogador o (estado dele na sala) perto do ponto x, y da tela */
  MJ.mostrar = function (o, x, y) {
    MJ.alvo = o; MJ.aberto = true; MJ.aviso = '';
    render();
    el.style.display = 'flex';
    const w = el.offsetWidth, h = el.offsetHeight;
    el.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x + 12)) + 'px';
    el.style.top = Math.max(8, Math.min(window.innerHeight - h - 8, y - h / 2)) + 'px';
    R.UI.atualizar();
  };
  MJ.fechar = function () {
    if (!el || !MJ.aberto) return;
    MJ.aberto = false; MJ.alvo = null;
    el.style.display = 'none';
    R.UI.atualizar();
  };

  MJ.iniciar = function () {
    el = document.createElement('div');
    el.id = 'menu-jogador';
    document.body.appendChild(el);
    el.addEventListener('click', async (ev) => {
      const b = ev.target.closest('button[data-acao]');
      if (!b || !MJ.alvo) return;
      const o = MJ.alvo;
      try {
        if (b.dataset.acao === 'sussurrar') { MJ.fechar(); R.Chat.abrir(o.conta, o.nome); return; }
        if (b.dataset.acao === 'amigo') { const r = await R.Social.pedirAmizade({ id: o.conta }); if (MJ.alvo === o) render(r); }
        if (b.dataset.acao === 'aceitar') { await R.Social.responderAmizade(o.conta, true); if (MJ.alvo === o) render('Agora vocês são amigos.'); }
      } catch (e) { if (MJ.alvo === o) render(e.message); }
    });
    // clicar na sala: num jogador abre o menu dele; fora, fecha
    const quadro = document.getElementById('saguao');
    const tentar = (x, y) => {
      if (R.Chat.aberto || R.Celular.aberto || R.Bazar.aberto) return false;
      const r = quadro.getBoundingClientRect(), o = R.Saguao.jogadorEm(x - r.left, y - r.top);
      if (o) { MJ.mostrar(o, x, y); return true; }
      MJ.fechar();
      return false;
    };
    quadro.addEventListener('click', (ev) => tentar(ev.clientX, ev.clientY));
    R.Input.aoToque = tentar;   // no celular, o toque na metade direita da tela
    R.Social.on('amigos', () => { if (MJ.aberto) render(); });
  };

  R.MenuJogador = MJ;
})(window.RES);
