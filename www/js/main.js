/* Rogue em' Slash — Começo: liga a entrada e as contas, monta o mapa de teste (escondido) e mostra o menu (a conta é
   opcional: quem tinha entrado antes continua conectado). */
(function (R) {
  'use strict';

  async function comecar() {
    R.Input.iniciar();
    R.Telas.iniciar();
    R.Telas.mostrar('carregando');
    await R.Contas.iniciar();
    R.Jogo.iniciar();
    R.Telas.mostrar('menu');
  }
  window.addEventListener('contextmenu', (ev) => { if (R.Jogo.visivel) ev.preventDefault(); });   // (toque longo no celular)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', comecar);
  else comecar();
})(window.RES);
