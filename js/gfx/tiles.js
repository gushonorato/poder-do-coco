// Tiles 16x16 do chão e plataformas.
// createTiles(theme) -> { top, fill, platform, block, topLeft, topRight }
import { sprite, flipH, makeCanvas } from './pixel.js';

// ---------------------------------------------------------------- Esplanada (grama + terra vermelha do cerrado)

const ESP_PAL = {
  G: '#7ad657', // grama clara
  g: '#55b83f', // grama
  d: '#3d8f35', // grama escura
  r: '#c9563c', // terra vermelha
  R: '#a3412e', // terra escura
  o: '#e59f7a', // pedrinha clara
  O: '#7f3223', // sombra/contorno da terra
  K: '#6b6459', // contorno do concreto
  w: '#fbf8f0', // concreto branco
  W: '#ebe5d6', // concreto
  s: '#c9c0ad', // concreto sombra
  S: '#a39a86', // concreto sombra forte
};

const ESP_TOP = [
  '..G.....G...G...',
  '.GGG..G.GG.GGG.G',
  'GGGGGGGGGGGGGGGG',
  'GGgGGGGGgGGGGgGG',
  'gggggggggggggggg',
  'gdggggdgggggdggg',
  'ddgdddddddgddddd',
  'RddRRdRRRdRRdRRd',
  'RRrRRRRrRRRRrRRR',
  'rrrrrrrrrrrrrrrr',
  'rrorrrrRrrrrrrRr',
  'rrRrrrrrrrorrrrr',
  'rrrrrrrrRrrrrrrr',
  'rrrrorrrrrrrrRrr',
  'rRrrrrrrrrrorrrr',
  'rrrrrrRrrrrrrrrr',
];

const ESP_FILL = [
  'rrrrrrRrrrrrrrrr',
  'rrorrrrrrrrRrrrr',
  'rrRrrrrrrrrrrorr',
  'rrrrrrrrrrrrrRrr',
  'rrrrrrrrrrRrrrrr',
  'rrrrorrrrrrrrrrr',
  'rrrrRrrrRrrrrrrr',
  'rRrrrrrrrrrorrrr',
  'rrrrrrRrrrrRrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrorrrrrrRrrrrrr',
  'rrRrrrrrrrrrrrrr',
  'rrrrRrrrorrrrRrr',
  'rrrrrrrrRrrrrrrr',
  'rRrrrrrrrrrrorrr',
  'rrrrrrRrrrrrRrrr',
];

const ESP_PLATFORM = [
  'KKKKKKKKKKKKKKKK',
  'wwwwwwwwwwwwwwwK',
  'WwWWWWWWWWWWWWWs',
  'WWWWWWWWWWWWWWWs',
  'ssssssssssssssss',
  'KKKKKKKKKKKKKKKK',
  '.S............S.',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];

const ESP_BLOCK = [
  'KKKKKKKKKKKKKKKK',
  'KwwwwwwwwwwwwwWK',
  'KwWWWWWWWWWWWWsK',
  'KwWWWWsWWWWWWWsK',
  'KwWWWWWWWWWWWWsK',
  'KwWWWWWWWWWsWWsK',
  'KwWWWWWWWWWWWWsK',
  'KwWWsWWWWWWWWWsK',
  'KwWWWWWWWWWWWWsK',
  'KwWWWWWWWWsWWWsK',
  'KwWWWWWWWWWWWWsK',
  'KwWWWWWWWWWWWWsK',
  'KwWWWWWWsWWWWWsK',
  'KwWWWWWWWWWWWWsK',
  'KWsssssssssssssK',
  'KKKKKKKKKKKKKKKK',
];

// ---------------------------------------------------------------- Ponte (orla do Paranoá ao entardecer)

const PON_PAL = {
  G: '#6ab85a', // grama clara
  g: '#4a9a4c', // grama
  d: '#2f7040', // grama escura
  P: '#6f5a4b', // rejunte
  p: '#b09478', // pedra do calçadão
  q: '#cdb394', // pedra clara
  k: '#4a2e1c', // contorno da madeira
  l: '#d9a263', // madeira clara
  m: '#b37a45', // madeira
  n: '#8c5a31', // veio da madeira
  K: '#3f3a4f', // contorno do bloco de pedra
  h: '#b3adc8', // pedra clara
  s: '#8c86a3', // pedra
  S: '#6d6787', // pedra sombra
};

const PON_A = [
  'PPPPPPPPPPPPPPPP',
  'qqqqqqqPqqqqqqqP',
  'pppppppPpppppppP',
  'pppppppPpppppppP',
];
const PON_B = [
  'PPPPPPPPPPPPPPPP',
  'qqqPqqqqqqqPqqqq',
  'pppPpppppppPpppp',
  'pppPpppppppPpppp',
];

const PON_TOP = [
  '..G..G....G..G..',
  '.GGGGGG.GGGGGGG.',
  'GGGGGGGGGGGGGGGG',
  'GgGGGGgGGGGGgGGG',
  'gggggggggggggggg',
  'gdgggdgggdgggdgg',
  'dddddddddddddddd',
  'dPddPdddPddPdddP',
  ...PON_A,
  ...PON_B,
];

const PON_FILL = [...PON_A, ...PON_B, ...PON_A, ...PON_B];

const PON_PLATFORM = [
  'kkkkkkkkkkkkkkkk',
  'lllllllklllllllk',
  'mmmmmmmkmmmmmmmk',
  'mmnmmmmkmmmmnmmk',
  'nnnnnnnknnnnnnnk',
  'kkkkkkkkkkkkkkkk',
  '..k..........k..',
  '..k..........k..',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];

const PON_BLOCK = [
  'KKKKKKKKKKKKKKKK',
  'KhhhhhhhhhhhhhsK',
  'KhssssssssssssSK',
  'KhsssSssssssssSK',
  'KhssssssssssssSK',
  'KhsssssssssSssSK',
  'KhssssssssssssSK',
  'KKKKKKKKKKKKKKKK',
  'KhhhhhhKhhhhhhsK',
  'KhssssSKhssssSSK',
  'KhssssSKhssssSSK',
  'KhsSssSKhssSsSSK',
  'KhssssSKhssssSSK',
  'KhssssSKhssssSSK',
  'KSSSSSSKSSSSSSSK',
  'KKKKKKKKKKKKKKKK',
];

// Borda esquerda do chão: a grama "dobra" a quina e a terra ganha contorno.
function capLeft(top, grass, grassDark, edge) {
  const c = makeCanvas(16, 16);
  const ctx = c.getContext('2d');
  ctx.drawImage(top, 0, 0);
  ctx.clearRect(0, 0, 2, 2);
  ctx.clearRect(0, 2, 1, 1);
  ctx.fillStyle = grass;
  ctx.fillRect(1, 2, 2, 5);
  ctx.fillStyle = grassDark;
  ctx.fillRect(0, 3, 1, 6);
  ctx.fillRect(1, 7, 1, 3);
  ctx.fillStyle = edge;
  ctx.fillRect(0, 9, 1, 7);
  return c;
}

export function createTiles(theme) {
  if (theme === 'ponte') {
    const top = sprite(PON_TOP, PON_PAL);
    const topLeft = capLeft(top, PON_PAL.G, PON_PAL.d, PON_PAL.P);
    return {
      top,
      fill: sprite(PON_FILL, PON_PAL),
      platform: sprite(PON_PLATFORM, PON_PAL),
      block: sprite(PON_BLOCK, PON_PAL),
      topLeft,
      topRight: flipH(topLeft),
    };
  }
  // 'esplanada', 'intro', 'title' e padrão
  const top = sprite(ESP_TOP, ESP_PAL);
  const topLeft = capLeft(top, ESP_PAL.G, ESP_PAL.d, ESP_PAL.O);
  return {
    top,
    fill: sprite(ESP_FILL, ESP_PAL),
    platform: sprite(ESP_PLATFORM, ESP_PAL),
    block: sprite(ESP_BLOCK, ESP_PAL),
    topLeft,
    topRight: flipH(topLeft),
  };
}
