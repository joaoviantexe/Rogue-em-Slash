/* Rogue em' Slash — Personagem no mapa, como num beat 'em up (Streets of Rage, Castle Crashers): o modelo 3D do herói
   (js/modelo) sempre olhando para a direita ou para a esquerda. Frente e trás = direita e esquerda (ele vira); cima e
   baixo = para o fundo e para a frente do chão, andando de lado, sem virar. Cada quadro é a pose da animação vista de
   lado (R.Camera.YAW_LADO), desenhada uma vez e guardada (R.Sprites); olhando para a esquerda, o quadro é espelhado
   (como no RL20).
   Um personagem é LOCAL (movido pelo controle deste aparelho) ou REMOTO (de outro aparelho: segue os estados que chegam
   pela rede, um pouco atrasado para o movimento sair liso). */
(function (R) {
  'use strict';

  /* a velocidade do andar é a mesma com que a animação anda no mundo (poses.js: RITMO.walk), assim o pé não escorrega */
  const VEL = () => R.POSES.ritmo.walk.vel()[0];
  const FPS_ANDAR = () => R.POSES.ritmo.walk.fps, FPS_PARADO = () => R.POSES.ritmo.idle.fps;
  const ACEL = 900;      // unidades por segundo²: arranca e para rápido, sem patinar
  const K_PROF = 1.3;    // para o fundo e para a frente anda um pouco mais (no mundo): na tela, o chão "deitado" encurta
  const ATRASO = 0.1;    // segundos: o remoto é desenhado neste atraso, entre dois estados que já chegaram

  /* Cor de cada jogador (1 a 4): a da roupa (até o criador de personagem existir) e a do nome. */
  R.CORES_JOGADOR = {
    1: { nome: '#ff6a5a', corPeito: '#c0302a', corPeito2: '#731d19' },
    2: { nome: '#6aa8ff', corPeito: '#2f5fc0', corPeito2: '#1c3a78' },
    3: { nome: '#6ee07a', corPeito: '#2f9a48', corPeito2: '#1c5e2c' },
    4: { nome: '#ffd25a', corPeito: '#d8a020', corPeito2: '#7a5a12' },
  };
  R.aparenciaDoJogador = (slot) => {
    const c = R.CORES_JOGADOR[slot] || R.CORES_JOGADOR[1];
    return R.completarAparencia({ corPeito: c.corPeito, corPeito2: c.corPeito2 });
  };

  /* Para onde olha: 2 = direita, 6 = esquerda (os números das 8 direções do RL20: 0 = para a câmera, 4 = fundo). */
  const DIREITA = 2, ESQUERDA = 6;
  const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;

  class Personagem {
    constructor(op) {
      this.x = op.x; this.z = op.z; this.vx = 0; this.vz = 0;
      this.dir = op.dir === ESQUERDA ? ESQUERDA : DIREITA;   // começa olhando para a direita
      this.nome = op.nome || ''; this.slot = op.slot || 1;
      this.remoto = op.remoto ? { buf: [] } : null;
      this.ritmo = 1;
      this.vestir(op.aparencia || R.aparenciaDoJogador(this.slot));
    }
    vestir(ap) {
      this.folha = R.Sprites.folha(ap, { classe: 'heroi' });
      this.anim = new R.Sprites.Animador(this.folha);
      this.anim.tocar('idle', FPS_PARADO(), true);
      this.preparado = null; this.ultimo = null;
    }
    /* mudou de vaga (sala online): outra cor */
    definirSlot(slot) {
      if (slot === this.slot) return;
      this.slot = slot;
      this.vestir(R.aparenciaDoJogador(slot));
    }
    /* LOCAL. mov: { x, y } do controle (-1 a 1; y para baixo na tela = para a câmera). dt em segundos. */
    atualizar(dt, mov) {
      const v = VEL(), mag = Math.min(1, Math.hypot(mov.x, mov.y));
      const ax = mov.x * v, az = mov.y * v * K_PROF;   // a velocidade que o controle pede
      const dvx = ax - this.vx, dvz = az - this.vz, d = Math.hypot(dvx, dvz), passo = ACEL * dt;
      if (d <= passo) { this.vx = ax; this.vz = az; } else { this.vx += (dvx / d) * passo; this.vz += (dvz / d) * passo; }
      this.x += this.vx * dt; this.z += this.vz * dt;
      const antes = { x: this.x, z: this.z };
      R.Mapa.limitar(this);
      if (this.x !== antes.x) this.vx = 0;   // encostou na borda
      if (this.z !== antes.z) this.vz = 0;
      if (Math.abs(mov.x) > 0.05) this.dir = mov.x > 0 ? DIREITA : ESQUERDA;   // só vira para os lados (e na hora)
      const vel = Math.hypot(this.vx, this.vz / K_PROF);
      if (vel > 8 && mag > 0.05) { this.ritmo = R.clamp(vel / v, 0.45, 1); this.anim.tocar('walk', FPS_ANDAR() * this.ritmo, true); }   // devagar, o passo também
      else { this.ritmo = 1; this.anim.tocar('idle', FPS_PARADO(), true); }
      this.anim.atualizar(dt);
    }
    /* o que vai pela rede: [x, z, direção, andando (0/1), ritmo do passo] */
    estado() { return [r1(this.x), r1(this.z), this.dir, this.anim.nome === 'walk' ? 1 : 0, r2(this.ritmo)]; }
    /* REMOTO: chegou um estado (agora: segundos) */
    receber(e, agora) {
      const b = this.remoto.buf;
      b.push({ t: agora, x: +e[0] || 0, z: +e[1] || 0, dir: (e[2] | 0) === ESQUERDA ? ESQUERDA : DIREITA, a: e[3] ? 1 : 0, r: R.clamp(+e[4] || 1, 0.3, 1.5) });
      if (b.length > 20) b.shift();
      if (b.length === 1) { this.x = b[0].x; this.z = b[0].z; this.dir = b[0].dir; }
    }
    atualizarRemoto(dt, agora) {
      const b = this.remoto.buf;
      if (b.length) {
        const t = agora - ATRASO;
        let a = b[0], c = b[b.length - 1];
        for (let k = b.length - 1; k >= 0; k--) if (b[k].t <= t) { a = b[k]; c = b[Math.min(b.length - 1, k + 1)]; break; }
        const u = c.t > a.t ? R.clamp((t - a.t) / (c.t - a.t), 0, 1) : 1;
        this.x = R.lerp(a.x, c.x, u); this.z = R.lerp(a.z, c.z, u);
        const e = u < 0.5 ? a : c;
        this.dir = e.dir; this.ritmo = e.r;
        if (e.a) this.anim.tocar('walk', FPS_ANDAR() * e.r, true); else this.anim.tocar('idle', FPS_PARADO(), true);
      }
      this.anim.atualizar(dt);
    }
    /* o pedido de um quadro: a pose vista de lado (olhando para a direita), na resolução da tela */
    pedido(k, res, cam) {
      const op = { escala: res, yaw: cam.YAW_LADO, pitch: cam.PITCH, w: Math.round(220 * res), h: Math.round(175 * res), oy: Math.round(140 * res) };
      return ['L' + res + ':' + k, { pose: R.POSES.poses[k], op }];
    }
    /* trocou de animação ou de resolução: os quadros dela vão sendo desenhados aos poucos */
    preparar(res, cam) {
      const chave = res + ':' + this.anim.nome;
      if (chave === this.preparado) return;
      this.preparado = chave;
      const outra = this.anim.nome === 'walk' ? 'idle' : 'walk';   // e depois a outra
      const ks = this.anim.lista().concat(this.folha.meta.anims[outra] || []);
      R.Sprites.prepararLivre(this.folha, ks.map((k) => this.pedido(k, res, cam)));
    }
    /* desenha nos pés (sx, sy em pixels do jogo). podeDesenharAgora: se o quadro não estiver pronto, ele é desenhado na
       hora (só um por quadro do jogo, para não engasgar); senão fica o último que apareceu. */
    desenhar(ctx, cam, podeDesenharAgora) {
      const E = cam.E, sx = cam.sx(this.x), sy = cam.sy(this.z, 0);
      ctx.fillStyle = 'rgba(10,12,30,.28)';   // a sombra no chão
      ctx.beginPath(); ctx.ellipse(sx, sy, 20 * E, 20 * E * cam.PROF * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      const res = cam.resolucao();
      this.preparar(res, cam);
      const [chave, ped] = this.pedido(this.anim.quadro, res, cam);
      let q = R.Sprites.quadroLivre(this.folha, chave, null);
      let desenhouAgora = false;
      if (!q && (podeDesenharAgora || !this.ultimo || this.ultimo.res !== res)) { q = R.Sprites.quadroLivre(this.folha, chave, ped); desenhouAgora = true; }
      if (q) this.ultimo = { q, res };
      else q = this.ultimo.q;
      const k = res / E, T = cam.escalaTela;   // pixels do quadro por pixel do jogo; pixels da tela por pixel do jogo
      const x0 = Math.round(sx * T) / T, y0 = Math.round((sy - q.ay / k) * T) / T;
      if (this.dir === ESQUERDA) {   // espelhado em volta do pé
        ctx.save(); ctx.translate(x0, 0); ctx.scale(-1, 1);
        ctx.drawImage(q.cv, -Math.round((q.ax / k) * T) / T, y0, q.w / k, q.h / k);
        ctx.restore();
      } else ctx.drawImage(q.cv, x0 - Math.round((q.ax / k) * T) / T, y0, q.w / k, q.h / k);
      return desenhouAgora;
    }
    /* o nome em cima da cabeça, na cor do jogador */
    desenharNome(ctx, cam) {
      if (!this.nome) return;
      const sx = cam.sx(this.x), sy = cam.sy(this.z, 128);
      ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,12,30,.85)'; ctx.lineJoin = 'round';
      const txt = 'P' + this.slot + ' ' + this.nome;
      ctx.strokeText(txt, sx, sy);
      ctx.fillStyle = (R.CORES_JOGADOR[this.slot] || R.CORES_JOGADOR[1]).nome;
      ctx.fillText(txt, sx, sy);
    }
  }
  Personagem.DIREITA = DIREITA; Personagem.ESQUERDA = ESQUERDA;

  R.Personagem = Personagem;
})(window.RES);
