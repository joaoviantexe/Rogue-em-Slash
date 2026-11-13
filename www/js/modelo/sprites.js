/* Rogue em' Slash — Folhas de quadros do personagem (do RL20: js/jogo/sprite.js, a parte das folhas e o animador).
   O modelo 3D (modelo3d.js + poses.js) é desenhado quadro a quadro, sob demanda, do ângulo da câmera do mapa e em
   8 direções (como os bonecos do lobby do RL20), e cada quadro fica guardado numa "folha" por aparência. */
(function (R) {
  'use strict';

  const S = { cache: {}, ordem: [], fila: [] };
  /* quadros guardados por folha: os mais antigos saem (cada quadro é um canvas; no celular a memória acaba rápido) */
  S.LIMITE_QUADROS = 128;

  /* op.classe: as animações da classe (sem classe, as do herói). */
  S.folha = function (aparencia, op) {
    const ap = R.completarAparencia(aparencia);
    const classe = (op && op.classe) || 'heroi';
    const chave = JSON.stringify(ap) + '|' + classe;
    let f = S.cache[chave];
    if (!f) f = S.cache[chave] = { aparencia: ap, chave, classe, meta: R.POSES.daClasse(classe), quadros: new Map(), modelo: null };
    S.ordem = S.ordem.filter((k) => k !== chave).concat(chave);
    while (S.ordem.length > 16) delete S.cache[S.ordem.shift()];
    return f;
  };
  const modelo = (f) => f.modelo || (f.modelo = R.Modelo3D.criarModelo(f.aparencia, {}));

  function guardar(f, chave, q) {
    f.quadros.set(chave, q);
    while (f.quadros.size > S.LIMITE_QUADROS) f.quadros.delete(f.quadros.keys().next().value);
    return q;
  }

  /* Quadro visto de qualquer ângulo: chave única, a pose (objeto) e as opções do renderizador ({ escala, yaw: para
     onde o boneco olha, pitch: inclinação da câmera, w, h, oy }). Sem pedido, só devolve o que já está pronto. */
  S.quadroLivre = function (f, chave, pedido) {
    let q = f.quadros.get(chave);
    if (q) { f.quadros.delete(chave); f.quadros.set(chave, q); return q; }   // (o mais usado fica por último)
    if (!pedido) return null;
    return guardar(f, chave, R.Modelo3D.renderizar(modelo(f), pedido.pose, pedido.op));
  };
  /* Pede vários quadros para irem sendo desenhados aos poucos: [[chave, { pose, op }], …] */
  S.prepararLivre = function (f, lista) {
    lista.forEach(([chave, pedido]) => { if (!f.quadros.has(chave)) S.fila.push([f, chave, pedido]); });
  };
  /* crédito: cada chamada ganha orcamentoMs e cada quadro desenhado gasta o tempo que levou. Um quadro que custa mais
     que o orçamento só sai a cada poucos quadros do jogo: na média, o desenho de fundo não passa do orçamento e o
     jogo não engasga. */
  S.credito = 0;
  S.tick = function (orcamentoMs) {
    if (!S.fila.length) { S.credito = 0; return; }
    const orc = orcamentoMs || 3;
    S.credito = Math.min(orc * 2, S.credito + orc);
    while (S.fila.length && S.credito > 0) {
      const [f, chave, pedido] = S.fila.shift();
      if (f.quadros.has(chave)) continue;
      const t = performance.now();
      guardar(f, chave, R.Modelo3D.renderizar(modelo(f), pedido.pose, pedido.op));
      S.credito -= performance.now() - t;
    }
  };

  /* Animador simples: troca de quadros por fps, com ou sem repetição. */
  class Animador {
    constructor(folha) { this.folha = folha; this.nome = null; this.t = 0; this.i = 0; this.fps = 10; this.loop = true; this.fim = false; }
    tocar(nome, fps, loop, reiniciar) {
      if (this.nome === nome && !reiniciar) { this.fps = fps || this.fps; return; }
      this.nome = nome; this.t = 0; this.i = 0; this.fps = fps || 10; this.loop = loop !== false; this.fim = false;
    }
    lista() { return this.folha.meta.anims[this.nome] || this.folha.meta.anims.idle; }
    atualizar(dt) {
      const l = this.lista();
      this.t += dt;
      const passo = 1 / this.fps;
      while (this.t >= passo) {
        this.t -= passo;
        if (this.i < l.length - 1) this.i++;
        else if (this.loop) this.i = 0;
        else this.fim = true;
      }
    }
    get quadro() { const l = this.lista(); return l[Math.min(this.i, l.length - 1)]; }
  }
  S.Animador = Animador;

  R.Sprites = S;
})(window.RES);
