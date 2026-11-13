/* Rogue em' Slash — Começo: liga a entrada e entra no mapa de teste. */
(function (R) {
  'use strict';

  function comecar() {
    R.Input.iniciar();
    // deixa a tela "Carregando" aparecer antes de montar o modelo e desenhar o primeiro quadro
    requestAnimationFrame(() => setTimeout(() => {
      R.Jogo.iniciar();
      const c = document.getElementById('carregando');
      if (c) c.remove();
    }, 0));
  }
  window.addEventListener('contextmenu', (ev) => ev.preventDefault());   // (toque longo no celular)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', comecar);
  else comecar();
})(window.RES);
