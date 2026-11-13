/* Rogue em' Slash — Configuração do site (o passo a passo está no LEIA-ME, "Hospedar e configurar").
   Tudo aqui é público por natureza (vai junto com o site): nunca ponha aqui uma chave secreta. */
window.RES = window.RES || {};
window.RES.CONFIG = {
  /* Contas (Supabase → Project Settings → API Keys): a "Project URL" e a chave publicável (sb_publishable_…; em projetos
     antigos, a "anon / public"). Quem protege os dados são as regras do supabase/esquema.sql.
     Vazio: as contas ficam desligadas e o jogo abre sem login (só para testar). */
  supabase: {
    url: 'https://qqqlwwankdhamkghrhlq.supabase.co',
    chave: 'sb_publishable_PSCSL46erpWIr2WEWJyzYQ_M7n-YyyE',
  },
  /* Salas online (WebRTC, biblioteca PeerJS: a conexão é direta entre os aparelhos).
     servidor: null usa o servidor público e gratuito do PeerJS, que só apresenta os aparelhos um ao outro.
     iceServers: STUN (descobre o endereço de cada aparelho). Em redes muito fechadas (4G, empresas) a conexão direta
     pode falhar; aí entra um servidor TURN aqui (ex.: o TURN da Cloudflare; veja o LEIA-ME). */
  rede: {
    servidor: null,   // ex.: { host: 'meuservidor.com', port: 443, path: '/', secure: true }
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
    ],
  },
};
