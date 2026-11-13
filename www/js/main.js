/* Rogue em' Slash — Começo e fluxo das telas: login (HTML) → sala (top-down, com a mesa de RPG) → partida (o mapa).
   Na partida, Esc / B / Start volta para a sala (e sai da sala online). */
(function (R) {
  'use strict';

  const F = { estado: 'login' };

  F.irLogin = function (tela) {
    F.estado = 'login';
    R.Saguao.mostrar(false); R.Jogo.mostrar(false);
    R.Input.ativo = false;
    if (tela) R.Telas.mostrar(tela); else R.Telas.inicial();
  };
  F.irSaguao = function () {
    F.estado = 'saguao';
    R.SaguaoOnline.contaMudou();
    R.Jogo.mostrar(false); R.Saguao.mostrar(true);
    R.Input.ativo = true;
  };
  F.irPartida = function () {
    F.estado = 'partida';
    R.Saguao.mostrar(false); R.Jogo.mostrar(true);
    R.Saguao.partidaComecou();
  };
  F.voltarSaguao = function () {
    F.estado = 'saguao';
    R.Jogo.mostrar(false); R.Saguao.mostrar(true);
    R.Input.ativo = true;
  };
  /* saiu da partida (Esc): volta para a sala, levanta da mesa e sai da sala online */
  F.sairDaPartida = function () { F.voltarSaguao(); R.Saguao.levantar(); };

  function aoAcao(nome) {
    if (F.estado === 'saguao') {
      if (nome === 'interagir') R.Saguao.interagir();
      else if (nome === 'voltar' && R.Saguao.sentado()) R.Saguao.levantar();
    } else if (F.estado === 'partida' && nome === 'voltar') F.sairDaPartida();
  }

  async function comecar() {
    R.Input.iniciar();
    R.Input.aoAcao = aoAcao;
    R.Telas.iniciar();
    R.Telas.mostrar('carregando');
    R.Rede.on('mudou', () => { R.Jogo.sincronizar(); R.Saguao.aoMudarRede(); });
    R.Rede.on('iniciar', () => { if (F.estado === 'saguao' && R.Saguao.sentado()) F.irPartida(); });
    R.Contas.on('mudou', () => { R.Jogo.sincronizar(); R.Rede.nomeMudou(); R.SaguaoOnline.contaMudou(); });
    await R.Contas.iniciar();
    R.Jogo.iniciar();
    R.Saguao.iniciar();
    F.irLogin();
  }
  R.Fluxo = F;
  window.addEventListener('contextmenu', (ev) => { if (F.estado !== 'login') ev.preventDefault(); });   // (toque longo no celular)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', comecar);
  else comecar();
})(window.RES);
