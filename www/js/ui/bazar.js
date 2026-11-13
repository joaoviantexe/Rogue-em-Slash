/* Rogue em' Slash — Editor do boneco da sala (a mesa do bazar): a cor do corpo (grátis) e os itens — camisas, casacos,
   colares, chapéus, óculos, máscaras, capacetes e costas (asas, mochila, espada) —, cada um com a cor que o jogador quiser. Os itens custam moedas (preço na tabela
   itens_bazar do Supabase); comprado uma vez, é dele. O capacete cobre a cabeça inteira: com ele não vai chapéu, óculos
   nem máscara; a máscara e os óculos também não vão juntos (os dois ficam nos olhos).
   A câmera chega perto do boneco e ele muda na hora; ao fechar (Pronto, Esc ou B), o visual é salvo na conta (sem conta,
   só a cor do corpo, neste navegador) e os outros jogadores passam a ver. */
(function (R) {
  'use strict';

  const B = { aberto: false, aba: 'corpo', visual: null, inicial: '', escolhido: null, aviso: '' };
  let el = null;
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const S = () => R.Social;
  const ABAS = [['corpo', 'Corpo'], ['camisa', 'Camisas'], ['casaco', 'Casacos'], ['colar', 'Colares'], ['chapeu', 'Chapéus'], ['oculos', 'Óculos'],
    ['mascara', 'Máscaras'], ['capacete', 'Capacetes'], ['costas', 'Costas']];

  /* os itens de um encaixe: os do banco (com preço) ou, sem ele, os do jogo */
  function itensDe(tipo) {
    const doBanco = S().itens.filter((i) => i.tipo === tipo && (i.ativo || S().comprados.has(i.id)));
    if (doBanco.length || R.Contas.ativo()) return doBanco;
    return Object.keys(R.Itens3D.ITENS).filter((id) => R.Itens3D.ITENS[id].tipo === tipo).map((id) => ({ id, nome: R.Itens3D.ITENS[id].nome, tipo, preco: null }));
  }
  function preco(i) {
    if (S().comprados.has(i.id)) return 'Comprado';
    if (i.preco === 0) return 'Grátis';
    return i.preco == null ? '' : i.preco + ' moedas';
  }
  function aplicar() { R.SaguaoOnline.meu().visual = S().visualValido(B.visual, R.SaguaoOnline.meu().cor); }

  B.render = function () {
    if (!el) return;
    const v = B.visual, aba = B.aba;
    let corpo = '';
    if (aba === 'corpo') {
      corpo = `<label>Cor do corpo <input type="color" data-cor="corpo" value="${esc(v.corpo)}"></label>`;
    } else {
      const atual = v[aba], lista = itensDe(aba);
      corpo = `<ul class="bz-itens"><li><button type="button" data-item="" class="${atual ? '' : 'equipado'}">Nenhum</button></li>${lista.map((i) =>
        `<li><button type="button" data-item="${i.id}" class="${atual && atual.id === i.id ? 'equipado' : ''}${B.escolhido === i.id ? ' escolhido' : ''}">${esc(i.nome)}<small>${esc(preco(i))}</small></button></li>`).join('')}</ul>`;
      const e = B.escolhido && lista.find((i) => i.id === B.escolhido);
      if (e && !S().tem(e.id)) {
        corpo += S().comConta() ? `<p><button type="button" data-comprar="${e.id}">Comprar ${esc(e.nome)} por ${e.preco} moedas</button></p>`
          : `<p>${R.Contas.ativo() ? 'Entre numa conta para comprar itens.' : 'Os itens precisam das contas (Supabase) configuradas.'}</p>`;
      }
      if (atual) corpo += `<label>Cor do item <input type="color" data-cor="${aba}" value="${esc(atual.cor)}"></label>`;
      if (aba === 'capacete') corpo += '<p><small>O capacete cobre a cabeça: com ele não vai chapéu, óculos nem máscara.</small></p>';
    }
    el.innerHTML = `<h2>Bazar</h2>
      ${S().comConta() ? '<p>Moedas: <b>' + S().moedas + '</b></p>' : ''}
      <div class="bz-abas">${ABAS.map(([id, nome]) => `<button type="button" data-aba="${id}" class="${id === aba ? 'atual' : ''}">${nome}</button>`).join('')}</div>
      ${corpo}
      <p class="bz-aviso">${esc(B.aviso)}</p>
      <p><button type="button" data-pronto>Pronto</button></p>`;
  };
  const aviso = (m) => { B.aviso = m; B.render(); };

  function vestir(slot, id) {
    const v = B.visual;
    if (!id) { v[slot] = null; return; }
    const antes = v[slot] && v[slot].id === id ? v[slot].cor : null;
    v[slot] = { id, cor: antes || R.Itens3D.ITENS[id].cor };
    if (slot === 'capacete') { v.chapeu = null; v.oculos = null; v.mascara = null; }
    else if (slot === 'chapeu' || slot === 'oculos' || slot === 'mascara') v.capacete = null;
    if (slot === 'mascara') v.oculos = null;   // a máscara e os óculos ficam no mesmo lugar (os olhos)
    if (slot === 'oculos') v.mascara = null;
  }

  B.abrir = function () {
    if (!el) return;
    B.aberto = true; B.aba = 'corpo'; B.escolhido = null; B.aviso = '';
    B.visual = JSON.parse(JSON.stringify(R.SaguaoOnline.meu().visual));
    B.inicial = JSON.stringify(B.visual);
    el.classList.add('aberto');
    R.Saguao.focarBazar(true);
    R.UI.atualizar();
    B.render();
    S().carregarBazar().then(B.render).catch((e) => aviso(e.message));
  };
  /* fecha e salva (se mudou) */
  B.fechar = function () {
    if (!el || !B.aberto) return;
    B.aberto = false;
    el.classList.remove('aberto');
    R.Saguao.focarBazar(false);
    R.UI.atualizar();
    if (JSON.stringify(B.visual) === B.inicial) return;
    const v = S().visualValido(B.visual, R.SaguaoOnline.meu().cor);
    R.SaguaoOnline.atualizar({ visual: v });
    S().salvarVisual(v).catch((e) => R.Chat.aviso('Não salvou o visual: ' + e.message));
  };

  B.iniciar = function () {
    el = document.createElement('div');
    el.id = 'bazar';
    document.body.appendChild(el);
    el.addEventListener('click', async (ev) => {
      const t = ev.target.closest('button');
      if (!t) return;
      if (t.dataset.aba) { B.aba = t.dataset.aba; B.escolhido = null; B.aviso = ''; B.render(); return; }
      if (t.hasAttribute('data-pronto')) { B.fechar(); return; }
      if (t.dataset.item != null) {
        const id = t.dataset.item;
        if (!id || S().tem(id) || !R.Contas.ativo()) { vestir(B.aba, id || null); B.escolhido = null; }
        else B.escolhido = id;   // ainda não tem: mostra o botão de comprar
        aplicar(); B.aviso = ''; B.render();
        return;
      }
      if (t.dataset.comprar) {
        const id = t.dataset.comprar;
        try { await S().comprar(id); vestir(B.aba, id); B.escolhido = null; aplicar(); aviso('Comprado!'); } catch (e) { aviso(e.message); }
      }
    });
    // a cor muda o boneco na hora (sem redesenhar o painel, para o seletor de cor continuar aberto)
    el.addEventListener('input', (ev) => {
      const c = ev.target.dataset && ev.target.dataset.cor;
      if (!c) return;
      if (c === 'corpo') B.visual.corpo = ev.target.value; else if (B.visual[c]) B.visual[c].cor = ev.target.value;
      aplicar();
    });
    el.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { ev.preventDefault(); B.fechar(); } });
    S().on('bazar', () => { if (B.aberto) B.render(); });
  };

  R.Bazar = B;
})(window.RES);
