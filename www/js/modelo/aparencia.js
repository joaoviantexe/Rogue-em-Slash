/* Rogue em' Slash — Aparência do personagem: os campos que o modelo 3D (modelo3d.js) lê, com os mesmos nomes e valores
   do RL20 (js/jogo/personagem.js e js/jogo/sprite.js). O criador de personagem, quando vier, edita este objeto. */
(function (R) {
  'use strict';

  /* Humano padrão (a do RL20, trocando a raça e tirando a auréola). */
  R.APARENCIA_PADRAO = {
    raca: 'humano', corpo: 'esguio', estatura: 0.4, altura: 1, busto: 0, curvas: 0.25, pele: '#f6cdb0', corCorpo2: '#ece4d4', marcas: 'nenhuma', corMarcas: '#7a808c',
    olhosTipo: 'finos', olhosQtd: '2', sobrancelhas: 'finas', olhos: '#3a7ad0', corEsclera: '#f6f2f0', dentes: 'sem', orelhas: 'humanas', orelhasPos: 'cima', corOrelhas2: '#f1ad9f', barba: 'nenhuma',
    cabeloFrente: 'espetada', franja: 0, cabeloTras: 'espetado', cabelo: '#5a3a24',
    adorno: 'nenhum', corAdorno: '#fff2a0', detalhes: '#f0c038', mascara: 'nenhuma', corMascara: '#ece6dc', corMascara2: '#f0c038',
    peito: 'tunica', corPeito: '#c0302a', corPeito2: '#731d19', casaco: 'nenhum', corCasaco: '#2c4466', corCasaco2: '#d8a050',
    capa: 'nenhuma', corCapa: '#2c4466', corCapa2: '#c8b48a', capuz: 'nenhum', capuzForma: 'normal', corCapuz: '#2c4466', corCapuz2: '#c8b48a',
    ombros: 'nenhuma', corOmbros: '#b9c2d4', corOmbros2: '#f0c038', luvas: 'nenhuma', corLuvas: '#6a4428', corLuvas2: '#f0c038',
    pernas: 'calca', corPernas: '#3a3448', corPernas2: '#f0c038', saia: 'nenhuma', corSaia: '#3a3448', corSaia2: '#f0c038',
    meias: 'nenhuma', corMeias: '#2a2630', corMeias2: '#ece6dc', cinto: 'simples', cintoPos: 'baixo', corCinto: '#6a4428', corCinto2: '#b9c2d4',
    calcados: 'botas', corCalcados: '#6a4428', corCalcados2: '#f0c038', emblema: 'nenhum', corEmblema: '#e04a8a',
    colar: 'nenhum', corColar: '#f0c038', corColar2: '#9a5ae0', joias: 'nenhuma', corJoias: '#f0c038', corJoias2: '#f4f0ea',
    costas: 'nenhuma', corCostas: '#6a4428', corCostas2: '#b9c2d4',
    asas: 'nenhuma', asasAltura: 1, asasLargura: 1, corAsas: '#f4f0ea', corAsas2: '#868480', cauda: 'nenhuma', corCauda: '#303058', corCauda2: '#e0dee8',
  };

  /* Joias escolhidas (uma lista, na ordem de sempre): dá para usar várias ('brincos+pulseiras'). O modelo usa. */
  const JOIAS = ['brincos', 'pulseiras', 'tornozeleiras'];
  R.joiasDe = (v) => { const s = new Set(String(v || '').split('+')); return JOIAS.filter((j) => s.has(j)); };

  /* Aparência completa: o que faltar vem da padrão. */
  R.completarAparencia = (ap) => Object.assign({}, R.APARENCIA_PADRAO, ap && typeof ap === 'object' ? ap : {});
})(window.RES);
