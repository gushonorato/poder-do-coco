// Fonte bitmap 5x7 (maiúsculas + acentos do português), desenhada pixel a pixel.
import { makeCanvas } from './pixel.js';
import { markHD, RENDER_SCALE } from './hd.js';

const G = {
  A: ['.111.', '1...1', '1...1', '11111', '1...1', '1...1', '1...1'],
  B: ['1111.', '1...1', '1...1', '1111.', '1...1', '1...1', '1111.'],
  C: ['.111.', '1...1', '1....', '1....', '1....', '1...1', '.111.'],
  D: ['1111.', '1...1', '1...1', '1...1', '1...1', '1...1', '1111.'],
  E: ['11111', '1....', '1....', '1111.', '1....', '1....', '11111'],
  F: ['11111', '1....', '1....', '1111.', '1....', '1....', '1....'],
  G: ['.111.', '1...1', '1....', '1.111', '1...1', '1...1', '.1111'],
  H: ['1...1', '1...1', '1...1', '11111', '1...1', '1...1', '1...1'],
  I: ['.111.', '..1..', '..1..', '..1..', '..1..', '..1..', '.111.'],
  J: ['..111', '...1.', '...1.', '...1.', '...1.', '1..1.', '.11..'],
  K: ['1...1', '1..1.', '1.1..', '11...', '1.1..', '1..1.', '1...1'],
  L: ['1....', '1....', '1....', '1....', '1....', '1....', '11111'],
  M: ['1...1', '11.11', '1.1.1', '1.1.1', '1...1', '1...1', '1...1'],
  N: ['1...1', '1...1', '11..1', '1.1.1', '1..11', '1...1', '1...1'],
  O: ['.111.', '1...1', '1...1', '1...1', '1...1', '1...1', '.111.'],
  P: ['1111.', '1...1', '1...1', '1111.', '1....', '1....', '1....'],
  Q: ['.111.', '1...1', '1...1', '1...1', '1.1.1', '1..1.', '.11.1'],
  R: ['1111.', '1...1', '1...1', '1111.', '1.1..', '1..1.', '1...1'],
  S: ['.1111', '1....', '1....', '.111.', '....1', '....1', '1111.'],
  T: ['11111', '..1..', '..1..', '..1..', '..1..', '..1..', '..1..'],
  U: ['1...1', '1...1', '1...1', '1...1', '1...1', '1...1', '.111.'],
  V: ['1...1', '1...1', '1...1', '1...1', '1...1', '.1.1.', '..1..'],
  W: ['1...1', '1...1', '1...1', '1.1.1', '1.1.1', '1.1.1', '.1.1.'],
  X: ['1...1', '1...1', '.1.1.', '..1..', '.1.1.', '1...1', '1...1'],
  Y: ['1...1', '1...1', '.1.1.', '..1..', '..1..', '..1..', '..1..'],
  Z: ['11111', '....1', '...1.', '..1..', '.1...', '1....', '11111'],
  0: ['.111.', '1...1', '1..11', '1.1.1', '11..1', '1...1', '.111.'],
  1: ['..1..', '.11..', '..1..', '..1..', '..1..', '..1..', '.111.'],
  2: ['.111.', '1...1', '....1', '...1.', '..1..', '.1...', '11111'],
  3: ['1111.', '....1', '....1', '.111.', '....1', '....1', '1111.'],
  4: ['...1.', '..11.', '.1.1.', '1..1.', '11111', '...1.', '...1.'],
  5: ['11111', '1....', '1111.', '....1', '....1', '1...1', '.111.'],
  6: ['.111.', '1....', '1....', '1111.', '1...1', '1...1', '.111.'],
  7: ['11111', '....1', '...1.', '..1..', '.1...', '.1...', '.1...'],
  8: ['.111.', '1...1', '1...1', '.111.', '1...1', '1...1', '.111.'],
  9: ['.111.', '1...1', '1...1', '.1111', '....1', '....1', '.111.'],
  '!': ['..1..', '..1..', '..1..', '..1..', '..1..', '.....', '..1..'],
  '?': ['.111.', '1...1', '....1', '...1.', '..1..', '.....', '..1..'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.....', '..1..'],
  ',': ['.....', '.....', '.....', '.....', '.....', '..1..', '.1...'],
  ':': ['.....', '..1..', '.....', '.....', '.....', '..1..', '.....'],
  '-': ['.....', '.....', '.....', '.111.', '.....', '.....', '.....'],
  '+': ['.....', '..1..', '..1..', '11111', '..1..', '..1..', '.....'],
  '/': ['....1', '...1.', '...1.', '..1..', '.1...', '.1...', '1....'],
  "'": ['..1..', '..1..', '.....', '.....', '.....', '.....', '.....'],
  '(': ['...1.', '..1..', '.1...', '.1...', '.1...', '..1..', '...1.'],
  ')': ['.1...', '..1..', '...1.', '...1.', '...1.', '..1..', '.1...'],
  '>': ['.1...', '..1..', '...1.', '....1', '...1.', '..1..', '.1...'],
  '<': ['...1.', '..1..', '.1...', '1....', '.1...', '..1..', '...1.'],
  '♥': ['.....', '.1.1.', '11111', '11111', '.111.', '..1..', '.....'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};

const ACCENTS = {
  acute: ['...1.', '..1..'],
  grave: ['.1...', '..1..'],
  circ: ['..1..', '.1.1.'],
  tilde: ['.11.1', '1..1.'],
};
const COMPOSED = {
  Á: ['A', 'acute'], À: ['A', 'grave'], Â: ['A', 'circ'], Ã: ['A', 'tilde'],
  É: ['E', 'acute'], Ê: ['E', 'circ'], Í: ['I', 'acute'],
  Ó: ['O', 'acute'], Ô: ['O', 'circ'], Õ: ['O', 'tilde'], Ú: ['U', 'acute'],
};

export const GLYPH_W = 5;
export const GLYPH_H = 7;
const ADVANCE = 6;
export const LINE_H = 11; // inclui espaço para acentos

function glyphPixels(ch) {
  // retorna lista de [x, y] relativos ao topo das maiúsculas
  const px = [];
  const add = (rows, oy) => rows.forEach((r, y) => [...r].forEach((c, x) => c === '1' && px.push([x, y + oy])));
  if (COMPOSED[ch]) {
    const [base, acc] = COMPOSED[ch];
    add(G[base], 0);
    add(ACCENTS[acc], -3);
  } else if (ch === 'Ç') {
    add(G.C, 0);
    add(['..1..', '.11..'], 7);
  } else {
    add(G[ch] || G['?'], 0);
  }
  return px;
}

export function textWidth(text, scale = 1) {
  return Math.max(0, text.length * ADVANCE - 1) * scale;
}

const cache = new Map();

// Renderiza (com cache) o texto num canvas. Topo das maiúsculas fica em y=3*scale.
function renderText(text, color, scale, outline) {
  const key = `${text}|${color}|${scale}|${outline || ''}`;
  let c = cache.get(key);
  if (c) return c;
  const o = outline ? 1 : 0;
  const w = textWidth(text, 1) + o * 2;
  const h = GLYPH_H + 3 + 2 + o * 2; // 3 acima (acentos) e 2 abaixo (cedilha)
  // Escala fracionária (ex.: 0.75) usa pixels reais da tela HD: letra menor e nítida.
  const hd = !Number.isInteger(scale);
  const unit = scale;
  scale = hd ? Math.max(1, Math.round(scale * RENDER_SCALE)) : scale;
  c = makeCanvas(w * scale, h * scale);
  const ctx = c.getContext('2d');
  const pixels = [];
  [...text].forEach((ch, i) => {
    for (const [x, y] of glyphPixels(ch)) pixels.push([i * ADVANCE + x + o, y + 3 + o]);
  });
  if (outline) {
    ctx.fillStyle = outline;
    for (const [x, y] of pixels)
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]])
        ctx.fillRect((x + dx) * scale, (y + dy) * scale, scale, scale);
  }
  ctx.fillStyle = color;
  for (const [x, y] of pixels) ctx.fillRect(x * scale, y * scale, scale, scale);
  if (hd) markHD(c, scale / unit);
  if (cache.size > 400) cache.clear();
  cache.set(key, c);
  return c;
}

// Desenha texto. (x, y) = canto superior esquerdo das maiúsculas (ou centro se align='center').
export function drawText(ctx, text, x, y, opts = {}) {
  const { color = '#ffffff', scale = 1, align = 'left', outline = null } = opts;
  text = String(text).toUpperCase();
  const c = renderText(text, color, scale, outline);
  const o = outline ? 1 : 0;
  let dx = Math.round(x) - o * scale;
  if (align === 'center') dx = Math.round(x - c.width / 2);
  else if (align === 'right') dx = Math.round(x - c.width) + o * scale;
  ctx.drawImage(c, dx, Math.round(y) - (3 + o) * scale);
}

// Quebra o texto em linhas que caibam em maxWidth (px virtuais, escala 1).
export function wrapText(text, maxWidth, scale = 1) {
  const words = String(text).toUpperCase().split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (textWidth(t, scale) > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
