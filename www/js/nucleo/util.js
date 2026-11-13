/* Rogue em' Slash — utilidades gerais (as do RL20: js/nucleo/util.js, só as que o jogo usa por enquanto).
   Todos os arquivos usam o espaço global RES (sem módulos), como no RL20: o jogo abre com dois cliques no
   index.html, sem servidor, e o mesmo código roda no navegador, no Android (Capacitor) e no PC (Electron). */
window.RES = window.RES || {};
(function (R) {
  'use strict';

  R.VERSAO = '0.1.0';

  R.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  R.lerp = (a, b, t) => a + (b - a) * t;

  /* Canvas desenhado uma vez e reaproveitado (os quadros do personagem). */
  R.novoCanvas = function (w, h) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w); c.height = Math.ceil(h);
    return c;
  };

  /* ---------- Cores ---------- */
  R.hexParaRgb = (h) => {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
})(window.RES);
