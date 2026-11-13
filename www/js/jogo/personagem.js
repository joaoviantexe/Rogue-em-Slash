/* Rogue em' Slash — Personagem no mapa: o modelo 3D do herói (js/modelo) andando no chão em 8 direções, como os
   bonecos do lobby do RL20 (js/jogo/saguao.js): cada quadro é a pose da animação vista do ângulo da câmera, desenhada
   uma vez e guardada (R.Sprites). Frente e trás = direita e esquerda; cima e baixo = para o fundo e para a câmera. */
(function (R) {
  'use strict';

  const RAD = Math.PI / 180;
  /* a velocidade do andar é a mesma com que a animação anda no mundo (poses.js: RITMO.walk), assim o pé não escorrega */
  const VEL = () => R.POSES.ritmo.walk.vel()[0];
  const FPS_ANDAR = () => R.POSES.ritmo.walk.fps, FPS_PARADO = () => R.POSES.ritmo.idle.fps;
  const ACEL = 900;   // unidades por segundo²: arranca e para rápido, sem patinar

  /* Direção (0 a 7, de 45 em 45 graus) a partir de um movimento no chão: 0 = para a câmera, 2 = direita, 4 = fundo,
     6 = esquerda (como no RL20). */
  const direcaoDe = (vx, vz) => ((Math.round(Math.atan2(vx, vz) / RAD / 45) % 8) + 8) % 8;

  class Personagem {
    constructor(op) {
      this.x = op.x; this.z = op.z; this.vx = 0; this.vz = 0;
      this.dir = op.dir != null ? op.dir : 2;   // começa olhando para a direita
      this.vestir(op.aparencia);
    }
    vestir(ap) {
      this.folha = R.Sprites.folha(ap, { classe: 'heroi' });
      this.anim = new R.Sprites.Animador(this.folha);
      this.anim.tocar('idle', FPS_PARADO(), true);
      this.preparado = null; this.ultimo = null;
    }
    /* mov: { x, y } do controle (-1 a 1; y para baixo na tela = para a câmera). dt em segundos. */
    atualizar(dt, mov) {
      const v = VEL(), mag = Math.min(1, Math.hypot(mov.x, mov.y));
      const ax = mov.x * v, az = mov.y * v;   // a velocidade que o controle pede
      const dvx = ax - this.vx, dvz = az - this.vz, d = Math.hypot(dvx, dvz), passo = ACEL * dt;
      if (d <= passo) { this.vx = ax; this.vz = az; } else { this.vx += (dvx / d) * passo; this.vz += (dvz / d) * passo; }
      this.x += this.vx * dt; this.z += this.vz * dt;
      const antes = { x: this.x, z: this.z };
      R.Mapa.limitar(this);
      if (this.x !== antes.x) this.vx = 0;   // encostou na borda
      if (this.z !== antes.z) this.vz = 0;
      if (mag > 0.05) this.dir = direcaoDe(mov.x, mov.y);   // vira na hora para onde o controle aponta
      const vel = Math.hypot(this.vx, this.vz);
      if (vel > 8 && mag > 0.05) this.anim.tocar('walk', FPS_ANDAR() * R.clamp(vel / v, 0.45, 1), true);   // devagar, o passo também
      else this.anim.tocar('idle', FPS_PARADO(), true);
      this.anim.atualizar(dt);
    }
    /* o pedido de um quadro: a pose vista da direção do personagem, na resolução da tela */
    pedido(k, res, cam) {
      const yaw = this.dir * 45;
      const op = { escala: res, yaw, pitch: cam.PITCH, w: Math.round(220 * res), h: Math.round(175 * res), oy: Math.round(140 * res) };
      return ['L' + res + ':' + yaw + ':' + k, { pose: R.POSES.poses[k], op }];
    }
    /* trocou de animação, de direção ou de resolução: os quadros dela vão sendo desenhados aos poucos */
    preparar(res, cam) {
      const chave = res + ':' + this.dir + ':' + this.anim.nome;
      if (chave === this.preparado) return;
      this.preparado = chave;
      const outra = this.anim.nome === 'walk' ? 'idle' : 'walk';   // e depois a outra, na mesma direção
      const ks = this.anim.lista().concat(this.folha.meta.anims[outra] || []);
      R.Sprites.prepararLivre(this.folha, ks.map((k) => this.pedido(k, res, cam)));
    }
    /* desenha nos pés (sx, sy em pixels do jogo). podeDesenharAgora: se o quadro não estiver pronto, ele é desenhado na
       hora (só um por quadro do jogo, para não engasgar); senão fica o último que apareceu. */
    desenhar(ctx, cam, podeDesenharAgora) {
      const E = cam.E, sx = cam.sx(this.x), sy = cam.sy(this.z, 0);
      ctx.fillStyle = 'rgba(10,12,30,.28)';   // a sombra no chão
      ctx.beginPath(); ctx.ellipse(sx, sy, 19 * E, 19 * E * cam.SEN, 0, 0, Math.PI * 2); ctx.fill();
      const res = cam.resolucao();
      this.preparar(res, cam);
      const [chave, ped] = this.pedido(this.anim.quadro, res, cam);
      let q = R.Sprites.quadroLivre(this.folha, chave, null);
      let desenhouAgora = false;
      if (!q && (podeDesenharAgora || !this.ultimo || this.ultimo.res !== res)) { q = R.Sprites.quadroLivre(this.folha, chave, ped); desenhouAgora = true; }
      if (q) this.ultimo = { q, res };
      else q = this.ultimo.q;
      const k = res / E, T = cam.escalaTela;   // pixels do quadro por pixel do jogo; pixels da tela por pixel do jogo
      ctx.drawImage(q.cv, Math.round((sx - q.ax / k) * T) / T, Math.round((sy - q.ay / k) * T) / T, q.w / k, q.h / k);
      return desenhouAgora;
    }
  }
  Personagem.direcaoDe = direcaoDe;

  R.Personagem = Personagem;
})(window.RES);
