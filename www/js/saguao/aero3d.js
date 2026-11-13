/* Rogue em' Slash — Renderizador 3D da sala (WebGL, sem bibliotecas: continua abrindo com dois cliques).
   Feito para o estilo Frutiger Aero dos bonecos: vidro colorido e brilhante, com o reflexo branco do céu em cima, o
   brilho que atravessa o vidro embaixo e a borda mais escura. Os móveis e a sala são foscos. Poucas peças, então um
   shader só, que escolhe o material pelo tipo.
   Mundo: x para a direita, y para cima, z para a câmera; 1 unidade = 1 metro. */
(function (R) {
  'use strict';

  /* ---------- Matrizes 4×4 (por colunas, como o WebGL espera) ---------- */
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const pontoP = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  function mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  }
  function perspectiva(fov, asp, perto, longe) {
    const t = 1 / Math.tan(fov / 2), o = new Float32Array(16);
    o[0] = t / asp; o[5] = t; o[10] = (longe + perto) / (perto - longe); o[11] = -1; o[14] = (2 * longe * perto) / (perto - longe);
    return o;
  }
  function olhar(olho, alvo) {
    const z = norm(sub(olho, alvo)), x = norm(cruz([0, 1, 0], z)), y = cruz(z, x);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -pontoP(x, olho), -pontoP(y, olho), -pontoP(z, olho), 1]);
  }
  /* Matriz de uma peça: posição, giros (y, depois x e z: inclinar) e escala. Devolve [modelo, normais 3×3]. */
  function transformar(t) {
    const cy = Math.cos(t.ry || 0), sy = Math.sin(t.ry || 0), cx = Math.cos(t.rx || 0), sx = Math.sin(t.rx || 0), cz = Math.cos(t.rz || 0), sz = Math.sin(t.rz || 0);
    // R = Ry · Rx · Rz
    const Rz = [cz, sz, 0, -sz, cz, 0, 0, 0, 1], Rx = [1, 0, 0, 0, cx, sx, 0, -sx, cx], Ry = [cy, 0, -sy, 0, 1, 0, sy, 0, cy];
    const m3 = (a, b) => { const o = []; for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) o[c * 3 + r] = a[r] * b[c * 3] + a[3 + r] * b[c * 3 + 1] + a[6 + r] * b[c * 3 + 2]; return o; };
    const Rm = m3(Ry, m3(Rx, Rz)), e = [t.sx || 1, t.sy || 1, t.sz || 1];
    const M = new Float32Array(16), N = new Float32Array(9);
    for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) { M[c * 4 + r] = Rm[c * 3 + r] * e[c]; N[c * 3 + r] = Rm[c * 3 + r] / e[c]; }
    M[12] = t.x || 0; M[13] = t.y || 0; M[14] = t.z || 0; M[15] = 1;
    return [M, N];
  }

  /* ---------- Geometrias: { pos, nor, idx } ---------- */
  function esfera(seg, aneis) {
    seg = seg || 32; aneis = aneis || 20;
    const pos = [], nor = [], idx = [];
    for (let j = 0; j <= aneis; j++) {
      const v = (j / aneis) * Math.PI, y = Math.cos(v), r = Math.sin(v);
      for (let i = 0; i <= seg; i++) {
        const u = (i / seg) * Math.PI * 2, x = r * Math.sin(u), z = r * Math.cos(u);
        pos.push(x, y, z); nor.push(x, y, z);
      }
    }
    for (let j = 0; j < aneis; j++) for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i, b = a + seg + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    return { pos, nor, idx };
  }
  /* sólido de revolução: perfil [[raio, y], …] de baixo para cima (feche com raio 0 nas pontas), normais lisas */
  function torno(perfil, seg) {
    seg = seg || 32;
    const pos = [], nor = [], idx = [], n = perfil.length;
    perfil.forEach(([r, y], j) => {
      const a = perfil[Math.max(0, j - 1)], b = perfil[Math.min(n - 1, j + 1)];
      let nr = b[1] - a[1], ny = -(b[0] - a[0]);   // a tangente do perfil girada para fora
      const l = Math.hypot(nr, ny) || 1; nr /= l; ny /= l;
      for (let i = 0; i <= seg; i++) {
        const u = (i / seg) * Math.PI * 2, s = Math.sin(u), c = Math.cos(u);
        pos.push(r * s, y, r * c); nor.push(nr * s, ny, nr * c);
      }
    });
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i, b = a + seg + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    return { pos, nor, idx };
  }
  /* caixa de 1 × 1 × 1 com o centro na origem (faces com normais retas) */
  function caixa() {
    const pos = [], nor = [], idx = [];
    const faces = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
      [[0, -1, 0], [0, 0, -1], [1, 0, 0]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]]];
    faces.forEach(([n, u, v]) => {
      const b = pos.length / 3;
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, c]) => {
        pos.push((n[0] + u[0] * a + v[0] * c) / 2, (n[1] + u[1] * a + v[1] * c) / 2, (n[2] + u[2] * a + v[2] * c) / 2);
        nor.push(n[0], n[1], n[2]);
      });
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    });
    return { pos, nor, idx };
  }
  /* plano no chão, de -1 a 1 (as sombras redondas) */
  const plano = () => ({ pos: [-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1], nor: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], idx: [0, 2, 1, 0, 3, 2] });

  /* ---------- Shaders ---------- */
  const VS = `
    attribute vec3 aPos; attribute vec3 aNor;
    uniform mat4 uVP; uniform mat4 uM; uniform mat3 uN;
    varying vec3 vPos; varying vec3 vNor; varying vec3 vLoc;
    void main() {
      vec4 p = uM * vec4(aPos, 1.0);
      vPos = p.xyz; vNor = uN * aNor; vLoc = aPos;
      gl_Position = uVP * p;
    }`;
  const FS = `
    precision mediump float;
    varying vec3 vPos; varying vec3 vNor; varying vec3 vLoc;
    uniform int uTipo; uniform vec3 uCor; uniform vec3 uCam; uniform vec3 uLuz; uniform float uRealce; uniform float uAlfa;
    void main() {
      vec3 N = normalize(vNor), V = normalize(uCam - vPos), L = normalize(uLuz);
      float nl = dot(N, L);
      if (uTipo == 1) {
        // vidro Frutiger Aero: a cor funda nas bordas, clara por dentro, o reflexo do céu em cima e o brilho embaixo
        float fv = max(dot(N, V), 0.0);
        vec3 fundo = uCor * 0.3, claro = mix(uCor, vec3(0.78, 0.97, 1.0), 0.6);
        vec3 c = mix(fundo, uCor, smoothstep(-0.3, 1.0, nl * 0.5 + 0.5));
        float atravessa = pow(fv, 1.2) * smoothstep(0.55, -0.6, N.y);   // luz que passa pelo vidro e sai embaixo
        c = mix(c, claro, atravessa * 0.9);
        c = mix(c, uCor * 0.18, pow(1.0 - fv, 2.6) * 0.8);              // a borda escura (o contorno)
        vec3 Rf = reflect(-V, N);
        float ceu = smoothstep(0.35, 0.85, Rf.y) * smoothstep(0.2, 0.55, fv);   // o reflexo largo do céu no alto
        float ponto = pow(max(dot(N, normalize(L + V)), 0.0), 120.0);         // o ponto de brilho
        c += vec3(1.0) * (ceu * 0.55 + ponto * 0.9);
        gl_FragColor = vec4(c, uAlfa);
        return;
      }
      if (uTipo == 3) {   // sombra redonda no chão
        float d = length(vLoc.xz);
        gl_FragColor = vec4(0.12, 0.16, 0.3, uAlfa * (1.0 - smoothstep(0.25, 1.0, d)));
        return;
      }
      // fosco: luz do céu (azulada) em cima, do chão (quente) embaixo, e o sol
      vec3 ceu = vec3(0.92, 0.96, 1.0), chao = vec3(0.72, 0.68, 0.64);
      vec3 amb = mix(chao, ceu, N.y * 0.5 + 0.5) * 0.78;
      vec3 c = uCor * (amb + vec3(1.0, 0.98, 0.94) * (nl * 0.5 + 0.5) * 0.32);
      if (uTipo == 2) {   // piso: ladrilhos de 1 m em xadrez bem leve, com a junta
        vec2 q = vPos.xz, f = abs(fract(q) - 0.5);
        float junta = smoothstep(0.47, 0.5, max(f.x, f.y));
        float xadrez = mod(floor(q.x) + floor(q.y), 2.0);
        c *= (0.97 + 0.03 * xadrez) * (1.0 - junta * 0.07);
      }
      c += vec3(0.35, 0.85, 1.0) * uRealce;   // realce (a cadeira em que dá para sentar)
      gl_FragColor = vec4(c, uAlfa);
    }`;

  function compilar(gl, tipo, fonte) {
    const s = gl.createShader(tipo);
    gl.shaderSource(s, fonte); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s));
    return s;
  }

  const TIPOS = { fosco: 0, aero: 1, piso: 2, sombra: 3 };

  /* Cria o renderizador num canvas. Devolve { malha(geo), desenhar(pecas, camera), redimensionar() }.
     peça: { malha, t: { x, y, z, ry, rx, rz, sx, sy, sz }, cor: [r, g, b] (0 a 1), tipo, realce, alfa } */
  function criar(canvas) {
    const gl = canvas.getContext('webgl', { antialias: true, alpha: false }) || canvas.getContext('experimental-webgl');
    if (!gl) return null;
    const prog = gl.createProgram();
    gl.attachShader(prog, compilar(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compilar(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('programa: ' + gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const A = { pos: gl.getAttribLocation(prog, 'aPos'), nor: gl.getAttribLocation(prog, 'aNor') };
    const U = {};
    ['uVP', 'uM', 'uN', 'uTipo', 'uCor', 'uCam', 'uLuz', 'uRealce', 'uAlfa'].forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
    gl.enableVertexAttribArray(A.pos); gl.enableVertexAttribArray(A.nor);
    gl.enable(gl.DEPTH_TEST);

    const r = { gl, canvas, w: 1, h: 1, fundo: [0.86, 0.93, 0.98] };
    r.malha = function (geo) {
      const m = { n: geo.idx.length };
      m.pos = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, m.pos); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geo.pos), gl.STATIC_DRAW);
      m.nor = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, m.nor); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geo.nor), gl.STATIC_DRAW);
      m.idx = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.idx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geo.idx), gl.STATIC_DRAW);
      return m;
    };
    r.redimensionar = function () {
      const dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (w && h && (w !== canvas.width || h !== canvas.height)) { canvas.width = w; canvas.height = h; }
      r.w = canvas.width; r.h = canvas.height;
    };
    /* camera: { olho: [x, y, z], alvo: [x, y, z], fov (graus) } */
    r.desenhar = function (pecas, cam) {
      r.redimensionar();
      gl.viewport(0, 0, r.w, r.h);
      gl.clearColor(r.fundo[0], r.fundo[1], r.fundo[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const VP = mul(perspectiva((cam.fov || 40) * Math.PI / 180, r.w / r.h, 0.1, 100), olhar(cam.olho, cam.alvo));
      gl.uniformMatrix4fv(U.uVP, false, VP);
      gl.uniform3fv(U.uCam, cam.olho);
      gl.uniform3fv(U.uLuz, cam.luz || [0.45, 1.0, 0.55]);
      const desenharPeca = (p) => {
        const [M, N] = transformar(p.t || {});
        gl.uniformMatrix4fv(U.uM, false, M); gl.uniformMatrix3fv(U.uN, false, N);
        gl.uniform1i(U.uTipo, TIPOS[p.tipo] || 0);
        gl.uniform3fv(U.uCor, p.cor || [1, 1, 1]);
        gl.uniform1f(U.uRealce, p.realce || 0);
        gl.uniform1f(U.uAlfa, p.alfa != null ? p.alfa : 1);
        const m = p.malha;
        gl.bindBuffer(gl.ARRAY_BUFFER, m.pos); gl.vertexAttribPointer(A.pos, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, m.nor); gl.vertexAttribPointer(A.nor, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.idx);
        gl.drawElements(gl.TRIANGLES, m.n, gl.UNSIGNED_SHORT, 0);
      };
      gl.disable(gl.BLEND); gl.depthMask(true);
      pecas.filter((p) => p.tipo !== 'sombra').forEach(desenharPeca);
      // as sombras por último: transparentes, por cima do chão e por baixo do que está em cima delas
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -1);
      pecas.filter((p) => p.tipo === 'sombra').forEach(desenharPeca);
      gl.disable(gl.POLYGON_OFFSET_FILL); gl.depthMask(true); gl.disable(gl.BLEND);
    };
    return r;
  }

  const hex = (h) => { const n = parseInt(h.replace('#', ''), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

  R.Aero3D = { criar, esfera, torno, caixa, plano, hex };
})(window.RES);
