# Rogue em' Slash

Jogo 2.5D (chão em 3D visto de lado, de uma câmera alta) para **navegador**, **Android** e **PC**, desenvolvido por partes.

## O que já tem
- **Mapa de teste**: um chão limpo (ladrilhos em xadrez, para ver o movimento), a parede do fundo e mais nada (`www/js/jogo/mapa.js`).
- **Personagem**: um humano em **3D low poly no estilo Megaman Legends**, com o modelo do RL20 (veja abaixo).
- **Movimento**: para a frente e para trás (direita e esquerda) e para cima e para baixo (para o fundo e para a câmera),
  também na diagonal. O personagem vira para onde anda (8 direções), anda com a animação de passo e fica parado
  respirando quando solta o controle. A câmera acompanha para os lados.

## Controles
| Onde | Como mover |
| --- | --- |
| Teclado | **WASD** ou **setas** |
| Controle (Xbox, PlayStation…) | **analógico esquerdo** ou **direcional** |
| Celular / tablet | encoste o dedo na **metade esquerda** da tela e arraste (o direcional nasce onde o dedo encosta) |

## Como rodar
### Navegador
- Dois cliques em `www/index.html` (não precisa de servidor), **ou**
- `npm start` e abra `http://localhost:8080`. O terminal mostra também o endereço para abrir **no celular** (na mesma rede Wi-Fi).

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

## Modelo 3D do personagem (copiado do RL20)
Os modelos são feitos **do mesmo jeito que no RL20**: não há arquivo de arte; o jogo monta a malha a partir da aparência
(peças rígidas presas a um esqueleto), pinta e desenha com um **rasterizador por software num canvas 2D** (sem WebGL e
sem bibliotecas). Cada quadro é desenhado do ângulo da câmera do mapa, na direção do personagem, uma vez só, e fica guardado.
- `www/js/modelo/modelo3d.js`: o `modelo3d.js` do RL20 **inteiro** (todas as raças, roupas, cabelos e acessórios: é o que o
  criador de personagem vai usar). Só mudou o espaço global (`window.RES`) e o nome das chaves salvas no navegador.
- `www/js/modelo/poses.js`: as poses do RL20, por enquanto só a neutra, o **parado** e o **andar** do herói (os do
  Caçador), com a dinâmica do cabelo e da capa. As outras animações do RL20 entram quando forem pedidas.
- `www/js/modelo/sprites.js`: as folhas de quadros e o animador (do `sprite.js` do RL20), com limite de quadros guardados.
- `www/js/modelo/aparencia.js`: a aparência padrão (humano), com os mesmos campos do RL20 — é o objeto que o criador de
  personagem vai editar.

## Estrutura
```
www/                 o jogo (é o que vai para o navegador, o Android e o PC)
  index.html
  css/jogo.css
  js/nucleo/         utilidades e entrada (teclado, controles, toque)
  js/modelo/         modelo 3D, poses, folhas de quadros e aparência (do RL20)
  js/jogo/           mapa, personagem, câmera e laço do jogo
  js/main.js
pc/main.js           janela do PC (Electron)
android/             projeto Android (Capacitor)
ferramentas/         servidor local (npm start)
```
Sem módulos nem etapa de build (como o RL20): os arquivos usam o espaço global `RES` e abrem direto do disco.

## Planejado (ainda não feito)
- **Criador de personagem** igual ao do RL20.
- **4 jogadores**: locais, online ou híbrido (alguns no mesmo aparelho e outros pela rede), com **conta obrigatória** para jogar.
  O que já está preparado: a entrada separa os dispositivos (teclado, até 4 controles, toque) e o movimento é pedido por
  jogador (`R.Input.movimento(slot)`); a simulação roda em passos fixos de 1/60 s, separada do desenho; e os quadros das
  animações têm número fixo (`R.POSES`), como no online do RL20.
