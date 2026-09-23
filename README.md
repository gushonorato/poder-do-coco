# Poder do Cocô 💩

Jogo de plataforma "run and gun" feito para o Miguel (5 anos): o **Monstro Constipador**
raptou a mamãe Hérica e o cachorro Simba, e o único jeito de salvá-los é **fazendo cocô
nos monstros**. Tudo se passa em Brasília (Esplanada dos Ministérios, Congresso, Catedral,
Ponte JK, Torre de TV, Palácio da Alvorada).

- **Fase 1 — Esplanada dos Ministérios.** Chefão: **General Rolha**, que joga refrigerante,
  pizza, batata frita e hambúrguer. Ao vencer, o Simba é libertado e passa a acompanhar o Miguel.
- **Fase 2 — Ponte JK.** Chefão: **Constipador**, que faz chover chocolate, bala e
  hambúrguer. Ao vencer, a mamãe é libertada e vem o final.
- **Comidas saudáveis** (maçã, mamão, ameixa, laranja, pera, melancia, água) recuperam
  coração. O **brócolis** ativa o **SUPER COCÔ**. As falas da mamãe (voz clonada) incentivam
  o Miguel a comer fruta, beber água e ir ao banheiro quando der vontade.
- Dificuldade pensada para 5 anos: sem buracos, vidas infinitas com checkpoints, mira
  automática do cocô, chefões com ataques lentos e avisados.

## Como jogar

| | Celular | Teclado |
|---|---|---|
| Andar | ◀ ▶ (canto esquerdo) | ← → ou A D |
| Pular | ⬆ | Espaço, ↑ ou W |
| Fazer cocô | 💩 (segure para vários) | X (ou Z, J, C, Enter) |
| Pausa | ❚❚ | P ou Esc |

## Rodar no computador

```bash
python3 tools/serve.py 8000
```

Abra http://localhost:8000. Atalhos para testar: `?cena=fase1`, `?cena=fase2`,
`?cena=intro`, `?cena=fim`.

## Jogar no celular

1. Com o celular na **mesma rede Wi-Fi** do computador, rode `python3 tools/serve.py 8000`
   e abra `http://<IP-do-computador>:8000` no celular (no Mac: `ipconfig getifaddr en0`).
2. Para ter o jogo como app (tela cheia e offline), publique a pasta num site estático
   (GitHub Pages, Netlify, Cloudflare Pages…). Com HTTPS o service worker funciona:
   no celular, use "Adicionar à tela de início".

> A pasta toda é estática (HTML + JS + imagens + áudio), sem build e sem dependências.

## Estrutura

```
index.html, css/style.css      página e controles de toque
js/main.js                     tela, laço, cenas, menus
js/scenes/                     título, abertura, fases, final
js/entities/                   Miguel, monstros, chefões, cocôs, itens
js/world/                      mapa/colisão e desenho das duas fases
js/gfx/                        cenários de Brasília, fonte pixel, imagens HD
js/audio.js                    efeitos e músicas chiptune (WebAudio, sem arquivos)
js/voices.js                   falas e legendas
assets/sprites/                personagens, monstros e itens (atlas PNG + atlas.json)
assets/bg/                     cartões-postais de Brasília
assets/voice/                  falas (voz clonada da Hérica e dos vilões)
tools/                         servidor, processamento de sprites, robô de teste
```

## Como a arte foi feita

- **Personagens, monstros, itens, cartões-postais e logo:** gerados com IA (Higgsfield /
  GPT Image) a partir das fotos de referência, em folhas de animação. Depois
  `tools/sprites/process.py` e `process_bg.py` recortam os quadros, reduzem para a escala
  do jogo (4× de detalhe), unificam a paleta e montam os atlas.
- A tela interna tem 135 px lógicos de altura, renderizada em 4× (540p) e ampliada para a
  tela do aparelho.
- **Vozes:** voz da Hérica clonada (Higgsfield, Seed Audio); os vilões usam vozes prontas.
- **Músicas e efeitos:** sintetizados em tempo real (`js/audio.js`).

Depois de mudar arquivos, rode `python3 tools/build_sw.py` para atualizar a lista do modo
offline.
