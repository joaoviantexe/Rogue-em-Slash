/* Rogue em' Slash — servidor local para jogar no navegador (npm start) e testar no celular pela mesma rede Wi-Fi.
   Sem dependências: só serve os arquivos de www/. (O index.html também abre direto, com dois cliques.) */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const RAIZ = path.join(__dirname, '..', 'www');
const PORTA = +process.env.PORT || 8080;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };

http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  const arq = path.join(RAIZ, path.normalize(url === '/' ? '/index.html' : url));
  if (!arq.startsWith(RAIZ)) { res.writeHead(403); res.end(); return; }
  fs.readFile(arq, (erro, dados) => {
    if (erro) { res.writeHead(404); res.end('Não encontrado'); return; }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(dados);
  });
}).listen(PORTA, '0.0.0.0', () => {
  console.log("Rogue em' Slash: http://localhost:" + PORTA);
  for (const lista of Object.values(os.networkInterfaces())) {
    for (const r of lista || []) if (r.family === 'IPv4' && !r.internal) console.log('  no celular (mesma rede): http://' + r.address + ':' + PORTA);
  }
});
