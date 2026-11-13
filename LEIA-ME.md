# Rogue em' Slash

Jogo 2.5D no estilo **beat 'em up** (como Streets of Rage e Castle Crashers) para **navegador**, **Android** e **PC**,
desenvolvido por partes.

## O que já tem
- **Login**: HTML puro, sem estilo, com o conteúdo centralizado. A **conta é opcional** ("Jogar sem conta", digitando só o nome); quem
  quiser cria uma (nome de jogador, e-mail e senha) e já entra, **sem confirmação de e-mail**. Também tem "Esqueci minha
  senha". Quem já tinha entrado antes vê "Conectado como …" com **Continuar** e **Sair da conta**.
- **Sala** (`www/js/saguao/`): uma sala vazia vista de cima, onde cada jogador anda com um **boneco 3D Frutiger Aero**
  (vidro colorido e brilhante; a cor é fixa por conta). Os outros jogadores online aparecem andando na mesma sala.
- **Mesa de RPG** com 4 cadeiras, que é como se joga junto (veja "Jogar junto" abaixo).
- **Mesa do bazar**: o editor do boneco. A **cor do corpo é grátis**; os itens custam moedas e cada um tem a cor que o
  jogador quiser: **chapéus** (Cowboy, Bruxo, Pirata, Cartola, Boné, Fazendeiro, Boina), **óculos** (Óculos, Óculos 3D,
  Óculos de Ski) e **capacetes** (Motoqueiro, TV de Tubo; o capacete cobre a cabeça, então não vai junto com chapéu nem
  óculos). A câmera chega perto do boneco e ele muda na hora; os outros jogadores veem o visual novo.
- **Moedas**: saldo na conta, gasto no bazar. Por enquanto só entram pelo painel do Supabase (veja "Moedas" abaixo).
- **Chat da sala** (Enter) e **sussurros**; **clicar em outro jogador** abre o menu dele: **Sussurrar** e **Adicionar amigo**.
- **Celular** (Esc): sobe do canto da tela, com os apps **Amigos** (amigos, pedidos e adicionar pelo nome) e
  **Configurações** (nome de jogador, senha nova e sair da conta).
- **Sem conta** dá para andar na sala, **conversar e sussurrar**, jogar e trocar a cor do corpo (pelo login anônimo do
  Supabase, com o nome que o jogador digitou). Amigos, moedas e itens pedem conta.
- **Mapa de teste**: um chão limpo (ladrilhos em xadrez, para ver o movimento), a parede do fundo e mais nada (`www/js/jogo/mapa.js`).
- **Personagem**: um humano em **3D low poly no estilo Megaman Legends**, com o modelo do RL20 (veja abaixo).
- **Movimento de beat 'em up**: o personagem é visto de lado e só olha para a esquerda ou para a direita. Frente e trás
  (direita e esquerda) viram o personagem; cima e baixo andam para o fundo e para a frente do chão, de lado, sem virar.
  Também na diagonal. Anda com a animação de passo e fica parado respirando quando solta o controle.
- **Até 4 jogadores** na partida, cada um com uma cor de roupa (vermelho, azul, verde e amarelo).

## Controles
| | Teclado | Controle (Xbox, PlayStation…) | Celular / tablet |
| --- | --- | --- | --- |
| Andar | **WASD** ou **setas** | analógico esquerdo ou direcional | arraste o dedo na **metade esquerda** da tela |
| Sentar / começar / abrir o bazar | **E** ou **Espaço** | **A** | toque na **metade direita** da tela |
| Celular (na sala) / sair da partida | **Esc** | **Start** | — |
| Chat | **Enter** ou **T** (Esc fecha) | — | toque nas mensagens |
| Menu de outro jogador | clique nele | — | toque nele |
| Voltar / levantar | **Backspace** (ou andar, para levantar) | **B** (ou andar) | andar, para levantar |

## Jogar junto (a mesa de RPG)
- Chegue perto de uma cadeira (ela brilha) e aperte **E** para sentar. Com a mesa vazia, quem senta **abre a sala** e é o
  anfitrião. Quem chegar depois e sentar **entra na sala dele**, sem código.
- O anfitrião, sentado, aperta **E** de novo para **começar**: todos da mesa vão para o mapa. Quem sentar com a partida
  em andamento entra direto nela.
- Andar levanta da cadeira. O anfitrião levantando (ou saindo da partida com Esc) fecha a sala, e todos voltam para a sala.
- Sem internet, dá para sentar e começar sozinho.
- Como funciona: quem está na sala e na mesa vem do **Realtime do Supabase** (presença e movimento; como o lobby do
  RL20). A partida usa a conexão **direta entre os aparelhos** (WebRTC, biblioteca PeerJS); o servidor público e gratuito
  do PeerJS só apresenta os aparelhos um ao outro. O anfitrião decide quem está na sala e repassa a posição de todos
  ~20 vezes por segundo; cada aparelho move o próprio personagem e o anfitrião confere se a posição é possível.
- Todos precisam da **mesma versão** do jogo (se for diferente, a sala avisa ao entrar).
- Em algumas redes (4G, redes de empresa) a conexão direta pode falhar; aí é preciso um servidor TURN (veja
  "Próximos passos" abaixo).
- Para testar sozinho: abra o jogo em **duas janelas** do navegador.
- **Jogadores locais** (vários no mesmo aparelho): o jogo já sabe lidar com eles (cada um com o seu controle, dividindo a
  tela), mas o jeito de conectar eles pela sala ainda vai ser decidido.

## Como rodar no seu computador
### Navegador
- Dois cliques em `www/index.html` (não precisa de servidor), **ou**
- `npm start` e abra `http://localhost:8080`. O terminal mostra também o endereço para abrir **no celular** (na mesma rede Wi-Fi).

Sem o Supabase configurado (`www/js/config.js` vazio), as contas e a sala online ficam desligadas (a sala funciona só
neste aparelho).

### PC (Electron)
```bash
npm install
```
```bash
npm run pc
```
F11 liga e desliga a tela cheia.

### Android (Capacitor)
Precisa do [Android Studio](https://developer.android.com/studio). O projeto Android já está em `android/` (tela sempre deitada).
```bash
npm install
```
```bash
npm run android
```
Isso copia o jogo (`www/`) para o projeto Android e abre o Android Studio; lá é só apertar **Run** com o celular ligado
no cabo (ou num emulador). Depois de mudar o jogo, rode `npm run android:sync` (ou `npm run android` de novo).

## Hospedar e configurar (versão de navegador)
O jogo é um **site estático**: é só publicar a pasta `www/`. As contas ficam num projeto do **Supabase** (gratuito).
A ordem: **1)** Supabase, **2)** hospedagem (Cloudflare ou Vercel), **3)** voltar no Supabase com o endereço do site.

### 1. Supabase (contas)
1. Crie uma conta em [supabase.com](https://supabase.com) e um **projeto novo** (plano gratuito). Na região, escolha
   **South America (São Paulo)**, a mais perto dos jogadores do Brasil. Guarde a senha do banco num lugar seguro (o jogo
   não usa).
2. No projeto, abra **SQL Editor**, cole o arquivo `supabase/esquema.sql` inteiro e clique em **Run**. Ele cria as
   tabelas (perfis, amigos, chat, moedas, itens do bazar) e as regras de segurança: cada jogador só vê o que é dele, e
   moedas só mudam pelas funções que conferem as regras. **Rode de novo a cada atualização do jogo** (a versão 0.4 precisa:
   chat, amigos, moedas e bazar).
3. Em **Project Settings → API Keys**, copie a **Project URL** e a chave **publicável** (`sb_publishable_…`; em projetos
   antigos, a **anon / public**) e cole em `www/js/config.js`:
   ```js
   supabase: {
     url: 'https://SEU-PROJETO.supabase.co',
     chave: 'sb_publishable_...',
   },
   ```
   Essa chave é **pública por natureza** (vai junto com o site); quem protege os dados são as regras do passo 2.
   **Nunca** coloque no jogo a chave secreta (`sb_secret_…` / `service_role`).
4. Em **Authentication → Sign In / Providers → Email**, **desligue "Confirm email"** e salve. O jogo não tem confirmação
   de e-mail: criou a conta, já entra. (Com ele ligado, o cadastro avisa que o servidor ainda pede confirmação.)
5. Em **Authentication → Sign In / Providers**, ligue **"Allow anonymous sign-ins"** e salve. É o que deixa quem joga
   **sem conta** conversar: ele ganha um login anônimo com o nome que digitou (nome único, as mesmas regras do chat).
   Sem isso, o convidado joga do mesmo jeito, só não manda mensagem. O nome do convidado fica reservado **só enquanto
   ele joga**: ao sair (fechar a página, voltar para o login ou entrar numa conta) o login anônimo é apagado e o nome
   fica livre na hora; se o jogo fechou sem avisar (sem bateria, sem internet), o nome fica livre quando ele está há
   mais de 3 minutos sem dar sinal (o jogo dá um sinal por minuto). As mensagens dele continuam no chat.
6. Envie (commit e push) o `config.js` com a URL e a chave.

O único e-mail que o jogo manda é o de **"Esqueci minha senha"**. O envio padrão do Supabase serve **só para testes**:
ele só entrega para os e-mails da **equipe do projeto** (Organization → Team no Supabase) e no máximo **2 e-mails por
hora**. Para todo mundo poder recuperar a senha, configure um SMTP próprio (ex.: Resend, Brevo, Amazon SES; pede um
domínio seu) em **Authentication → Emails → SMTP Settings**. O texto dos e-mails
(em inglês por padrão) muda em **Authentication → Emails → Templates**. No plano gratuito, o Supabase **pausa
projetos parados** por um tempo; se as contas pararem, reative o projeto no painel.

### Moedas (por enquanto, pelo painel)
- **Dar moedas** a um jogador: no **SQL Editor**, `select public.dar_moedas('NomeDoJogador', 100);` (com o motivo:
  `select public.dar_moedas('NomeDoJogador', 100, 'evento');`; número negativo tira). O jogo não consegue chamar essa função.
- **Preços**: na tabela **itens_bazar** (Table Editor), coluna `preco` (0 = grátis; começam todos em 10). `ativo = false`
  tira o item do bazar (quem comprou continua usando). Rodar o `esquema.sql` de novo não mexe nos preços.
- O extrato de cada jogador fica em **movimentos_moedas**.

A **sala online** usa o **Realtime** do Supabase (já vem ligado; não precisa configurar). O plano gratuito tem limite de
conexões ao mesmo tempo e de mensagens por mês (acompanhe em **Usage** no painel). O jogo manda pouco: a presença muda
no máximo a cada 2,5 s (o Supabase derruba quem muda rápido demais) e o movimento só quando a direção muda.

### 2a. Cloudflare (recomendado)
O plano gratuito permite uso comercial e não tem limite de banda para arquivos estáticos. Hoje o painel da Cloudflare
cria um **Worker com arquivos estáticos** (e não mais um projeto do Pages); o repositório já tem o `wrangler.jsonc`, que
diz para ele servir só a pasta `www/` e ligar o endereço `workers.dev`.
1. Em [dash.cloudflare.com](https://dash.cloudflare.com), abra **Workers & Pages → Create application → Import a
   repository**, autorize o GitHub e escolha o repositório `Rogue-em-Slash`.
2. **Project name**: `rogue-em-slash` (tem que ser igual ao `name` do `wrangler.jsonc`). **Build command**: vazio.
   **Deploy command**: `npx wrangler deploy` (o padrão). **Root directory**: `/`.
3. **Deploy**. O endereço fica `https://rogue-em-slash.SUA-CONTA.workers.dev` (aparece em **Settings → Domains &
   Routes**; se estiver "Disabled", é só ligar o `workers.dev` ali — o `wrangler.jsonc` também liga a cada publicação).
4. Cada push na branch de produção (**Settings → Build → Branch control**) publica de novo sozinho.
5. Para um domínio próprio (ex.: `rogueemslash.com.br`): **Settings → Domains & Routes → Add → Custom domain** (o
   domínio precisa estar na Cloudflare).

### 2b. Vercel (alternativa)
O plano gratuito (Hobby) é só para uso **pessoal e não comercial**; para vender o jogo, seria o plano pago.
1. Em [vercel.com](https://vercel.com), **Add New → Project** e importe o repositório `Rogue-em-Slash` do GitHub.
2. Configure:
   - **Framework Preset**: `Other`.
   - **Root Directory**: `www` (assim a Vercel não vê o `package.json` e não instala nada).
   - **Build Command**, **Output Directory** e **Install Command**: deixe vazios.
3. **Deploy**. O endereço fica `https://NOME-DO-PROJETO.vercel.app`.

### 3. Voltar no Supabase com o endereço do site
Em **Authentication → URL Configuration**:
- **Site URL**: o endereço do jogo (ex.: `https://rogue-em-slash.SUA-CONTA.workers.dev`).
- **Redirect URLs**: o mesmo endereço e, para testar no seu computador, `http://localhost:8080`.

É para onde volta o link de senha nova ("Esqueci minha senha"). Pronto: abra o site e jogue (com ou sem conta).

### Branch de produção
Hoje o repositório só tem a branch `claude/kind-feynman-gl7mpm`. O mais simples é criar a `main` a partir dela (no
GitHub: **Branches → New branch**, e depois **Settings → Default branch** → `main`) e usar a `main` como produção; o que
for sendo feito em outras branches entra na `main` por pull request.

### E o Cloudflare R2?
**Por enquanto não precisa.** O R2 é um depósito de arquivos grandes; o jogo hoje não tem nenhum (os modelos são
desenhados por código e o site inteiro tem menos de 1 MB). Ele passa a valer a pena quando houver, por exemplo,
**músicas e artes pesadas**, os **instaladores** do jogo (APK do Android, executável do PC) para baixar, ou **arquivos
enviados pelos jogadores**. Quando chegar a hora: criar um *bucket*, ligar o acesso público por um domínio próprio (ou o
`r2.dev`, só para testes) e liberar o CORS para o endereço do jogo. As chaves de acesso do R2 são secretas: ficam num
servidor (ex.: um Worker da Cloudflare), nunca no site.

### Próximos passos (quando precisar)
- **TURN** (para quem não conseguir conectar pelo 4G ou em rede de empresa): a Cloudflare tem um serviço de TURN, mas
  ele pede credenciais temporárias geradas com uma chave secreta, então precisa de uma função no servidor (um Worker)
  que entregue essas credenciais ao jogo. Depois é só colocar o TURN em `rede.iceServers` no `www/js/config.js`.
- **SMTP próprio** para os e-mails das contas (veja o passo 1).

## Modelo 3D do personagem (copiado do RL20)
Os modelos são feitos **do mesmo jeito que no RL20**: não há arquivo de arte; o jogo monta a malha a partir da aparência
(peças rígidas presas a um esqueleto), pinta e desenha com um **rasterizador por software num canvas 2D** (sem WebGL e
sem bibliotecas). Cada quadro é desenhado de lado (a câmera do jogo do RL20, quase reta), uma vez só, e fica guardado;
olhando para a esquerda, o quadro é espelhado.
- `www/js/modelo/modelo3d.js`: o `modelo3d.js` do RL20 **inteiro** (todas as raças, roupas, cabelos e acessórios: é o que o
  criador de personagem vai usar). Só mudou o espaço global (`window.RES`) e o nome das chaves salvas no navegador.
- `www/js/modelo/poses.js`: as poses do RL20, por enquanto só a neutra, o **parado** e o **andar** do herói (os do
  Caçador), com a dinâmica do cabelo e da capa. As outras animações do RL20 entram quando forem pedidas.
- `www/js/modelo/sprites.js`: as folhas de quadros e o animador (do `sprite.js` do RL20), com limite de quadros guardados.
- `www/js/modelo/aparencia.js`: a aparência padrão (humano), com os mesmos campos do RL20 — é o objeto que o criador de
  personagem vai editar. Até ele existir, cada jogador só muda a cor da roupa.

## Estrutura
```
www/                 o jogo (é o que vai para o navegador, o Android e o PC)
  index.html
  css/jogo.css       só o necessário para o jogo ocupar a tela (as telas são HTML sem estilo)
  js/config.js       Supabase e rede (o que muda de um site para outro)
  js/lib/            supabase-js 2.117.2 e PeerJS 1.5.4 (licença MIT; os mesmos do RL20)
  js/nucleo/         utilidades e entrada (teclado, controles, toque)
  js/modelo/         modelo 3D, poses, folhas de quadros e aparência (do RL20)
  js/jogo/           mapa, personagem, câmera, jogadores e laço do jogo
  js/rede/           contas (Supabase), a sala online (Supabase Realtime) e as partidas online (PeerJS)
  js/saguao/         a sala: o renderizador 3D Frutiger Aero (WebGL, sem bibliotecas), os itens do bazar em 3D e a cena
  js/rede/social.js  chat e sussurros, amigos, moedas, bazar e visual (Supabase)
  js/ui/             login (HTML puro), celular, chat, menu de outro jogador e o editor do bazar
  js/main.js
supabase/esquema.sql banco (contas, amigos, chat, moedas, bazar), para colar no SQL Editor do Supabase
pc/main.js           janela do PC (Electron)
android/             projeto Android (Capacitor)
ferramentas/         servidor local (npm start)
wrangler.jsonc       publicação na Cloudflare (serve a pasta www/)
```
Sem módulos nem etapa de build (como o RL20): os arquivos usam o espaço global `RES` e abrem direto do disco.

## Planejado (ainda não feito)
- **Criador de personagem** igual ao do RL20.
- **Comprar moedas** com dinheiro (1 real = 1 moeda), depois de escolher o serviço de pagamento.
