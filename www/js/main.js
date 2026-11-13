/* Rogue em' Slash — Começo e fluxo das telas: login (HTML) → sala (top-down, com a mesa de RPG e a do bazar) → partida
   (o mapa). Na sala: Esc / Start abre o celular, Enter abre o chat, E / A interage, B / Backspace volta.
   Na partida, Esc / B / Start volta para a sala (e sai da sala online). */
(function (R) {
  'use strict';

  const F = { estado: 'login' };

  F.irLogin = function (tela) {
    F.estado = 'login';
    R.UI.fecharTudo();
    if (R.Saguao.sentado()) R.Saguao.levantar();
    R.Saguao.mostrar(false); R.Jogo.mostrar(false);
    R.SaguaoOnline.desligar();   // (quem está no login não aparece na sala)
    R.Input.ativo = false;
    if (tela) R.Telas.mostrar(tela); else R.Telas.inicial();
  };
  F.irSaguao = function () {
    F.estado = 'saguao';
    R.SaguaoOnline.contaMudou();
    R.Jogo.mostrar(false); R.Saguao.mostrar(true);
    R.Social.ligarChat();
    R.Social.carregarBazar().catch(() => {});
    R.Social.carregarAmigos().catch(() => {});
    R.Input.ativo = true;
    R.UI.atualizar();
  };
  F.irPartida = function () {
    F.estado = 'partida';
    R.UI.fecharTudo();
    R.Saguao.mostrar(false); R.Jogo.mostrar(true);
    R.Saguao.partidaComecou();
    R.Input.parado = false;
  };
  F.voltarSaguao = function () {
    F.estado = 'saguao';
    R.Jogo.mostrar(false); R.Saguao.mostrar(true);
    R.Input.ativo = true;
    R.UI.atualizar();
  };
  /* saiu da partida: volta para a sala, levanta da mesa e sai da sala online */
  F.sairDaPartida = function () { F.voltarSaguao(); R.Saguao.levantar(); };

  function aoAcao(nome) {
    if (F.estado === 'partida') { if (nome === 'voltar' || nome === 'celular') F.sairDaPartida(); return; }
    if (F.estado !== 'saguao') return;
    const algoAberto = R.Chat.aberto || R.Celular.aberto || R.Bazar.aberto || R.MenuJogador.aberto;
    if (nome === 'celular') {
      if (R.Bazar.aberto) R.Bazar.fechar();
      else if (R.MenuJogador.aberto) R.MenuJogador.fechar();
      else R.Celular.alternar();
    } else if (nome === 'chat') { if (!algoAberto) R.Chat.abrir(); }
    else if (nome === 'interagir') { if (!algoAberto) R.Saguao.interagir(); }
    else if (nome === 'voltar') {
      if (R.Celular.aberto) R.Celular.voltar();
      else if (R.Bazar.aberto) R.Bazar.fechar();
      else if (R.MenuJogador.aberto) R.MenuJogador.fechar();
      else if (R.Saguao.sentado()) R.Saguao.levantar();
    }
  }

  async function comecar() {
    R.Input.iniciar();
    R.Input.aoAcao = aoAcao;
    R.Telas.iniciar();
    R.Telas.mostrar('carregando');
    R.Rede.on('mudou', () => { R.Jogo.sincronizar(); R.Saguao.aoMudarRede(); });
    R.Rede.on('iniciar', () => { if (F.estado === 'saguao' && R.Saguao.sentado()) F.irPartida(); });
    R.Contas.on('mudou', () => { R.Jogo.sincronizar(); R.Rede.nomeMudou(); R.SaguaoOnline.contaMudou(); R.Social.contaMudou(); });
    await R.Contas.iniciar();
    R.Jogo.iniciar();
    R.Saguao.iniciar();
    R.Chat.iniciar(); R.Celular.iniciar(); R.MenuJogador.iniciar(); R.Bazar.iniciar();
    F.irLogin();
  }
  R.Fluxo = F;
  window.addEventListener('contextmenu', (ev) => { if (F.estado !== 'login') ev.preventDefault(); });   // (toque longo no celular)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', comecar);
  else comecar();
})(window.RES);
