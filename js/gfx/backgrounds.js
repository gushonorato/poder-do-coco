// Cenários de Brasília em pixel art, com parallax.
// createBackground(theme, viewW, viewH) -> { draw(ctx, camX, time, opts), tint(ctx, time, opts) }
// Temas: 'esplanada' (fase 1, dia), 'ponte' (fase 2, pôr do sol),
//        'intro' (Congresso centralizado; opts.dark 0..1, opts.flash), 'title' (= esplanada).
import { makeCanvas, pixelCircle, pixelEllipse, pixelLine } from './pixel.js';
import { ART } from '../art.js';
import { makeHDCanvas, markHD, cloneHD, BG_SCALE } from './hd.js';

const fl = Math.floor;
const clamp01 = (v) => Math.max(0, Math.min(1, v || 0));

// ---------------------------------------------------------------- utilidades

function rect(ctx, x, y, w, h, color) {
  w = fl(w); h = fl(h);
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = color;
  ctx.fillRect(fl(x), fl(y), w, h);
}

function dot(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(fl(x), fl(y), 1, 1);
}

function rng(seed) {
  let s = (Math.imul(seed | 0, 2654435761) >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function thickLine(ctx, x0, y0, x1, y1, color, t = 2) {
  for (let i = 0; i < t; i++) pixelLine(ctx, x0 + i, y0, x1 + i, y1, color);
}

// Faixas horizontais de cor com 2–3 linhas de dithering entre elas.
function paintBands(ctx, w, bands, startY = 0) {
  let y = startY;
  for (const [color, h] of bands) { rect(ctx, 0, y, w, h, color); y += h; }
  rect(ctx, 0, y, w, ctx.canvas.height - y, bands[bands.length - 1][0]);
  y = startY;
  for (let i = 0; i < bands.length - 1; i++) {
    y += bands[i][1];
    const above = bands[i][0];
    const below = bands[i + 1][0];
    ctx.fillStyle = below;
    for (let x = 0; x < w; x++) {
      if ((x & 3) === 0) ctx.fillRect(x, y - 2, 1, 1);
      if (((x + y) & 1) === 0) ctx.fillRect(x, y - 1, 1, 1);
    }
    ctx.fillStyle = above;
    for (let x = 0; x < w; x++) if (((x + 2) & 3) === 0) ctx.fillRect(x, y, 1, 1);
  }
}

// Canvas-faixa que emenda horizontalmente: at(x, fn) desenha também nas cópias ±width.
// Faixas em HD: o desenho em código continua em coordenadas lógicas (pixel grande)
// e os cartões-postais gerados por IA entram com todo o detalhe.
function buildStrip(width, height, paint) {
  const { canvas, ctx } = makeHDCanvas(width, height, BG_SCALE);
  const at = (x, fn) => { fn(x); fn(x - width); fn(x + width); };
  paint(ctx, at, width);
  return markHD(canvas, BG_SCALE);
}

function tileStrip(ctx, strip, offset, viewW, y = 0) {
  const w = strip.width;
  let x = -(((fl(offset) % w) + w) % w);
  for (; x < viewW; x += w) ctx.drawImage(strip, x, y);
}

// ---------------------------------------------------------------- cartões-postais gerados por IA

const bgImg = (name) => (ART.bg ? ART.bg[name] : null);
const tintCache = new Map();
// Cópia da imagem com uma camada de cor por cima (névoa ao longe, entardecer).
function tinted(img, color, alpha) {
  const key = img.width + 'x' + img.height + color + alpha + (img.__id || (img.__id = Math.random()));
  let c = tintCache.get(key);
  if (c) return c;
  const { canvas, ctx: g } = cloneHD(img);
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.fillRect(0, 0, canvas.width, canvas.height);
  c = img.__s ? markHD(canvas, img.__s) : canvas;
  tintCache.set(key, c);
  return c;
}
// Desenha centralizado em x, apoiado em baseY.
function place(ctx, img, cx, baseY) {
  ctx.drawImage(img, fl(cx - img.width / 2), fl(baseY - img.height));
}
// Reflexo na água: cópia invertida, apagada, cortada na faixa do lago.
function reflect(ctx, img, cx, waterY, depth, alpha = 0.3) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(fl(cx - img.width / 2), waterY, img.width, depth);
  ctx.clip();
  ctx.globalAlpha = alpha;
  ctx.translate(0, waterY * 2);
  ctx.scale(1, -1);
  ctx.drawImage(img, fl(cx - img.width / 2), fl(waterY - img.height));
  ctx.restore();
}

// ---------------------------------------------------------------- nuvens

function makeCloud(w, h, seed, pal) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const r = rng(seed);
  const baseY = h - 3;
  const n = 3 + fl(r() * 3);
  const maxR = fl((h - 6) / 1.75);
  const bumps = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const mid = i > 0 && i < n - 1;
    const br = Math.min(maxR - 1, fl(h * (0.24 + r() * 0.16)) + (mid ? fl(h * 0.12) : 0));
    const bx = fl(w * 0.2 + w * 0.6 * t + (r() - 0.5) * 6);
    bumps.push([bx, baseY - fl(br * 0.7), br]);
  }
  const shape = (dy, color) => {
    pixelEllipse(ctx, fl(w / 2), baseY - 3 + dy, fl(w / 2) - 2, 4, color);
    for (const [bx, by, br] of bumps) pixelCircle(ctx, bx, by + dy, br, color);
  };
  // sombra embaixo, borda clara em cima, corpo no meio
  shape(0, pal.shade);
  shape(-3, pal.light);
  shape(-2, pal.main);
  ctx.clearRect(0, baseY + 1, w, h);
  return c;
}

function makeCloudStrip(width, height, count, seed, pal, minH = 14, varH = 14) {
  return buildStrip(width, height, (ctx) => {
    const r = rng(seed);
    const slot = width / count;
    for (let i = 0; i < count; i++) {
      const ch = minH + fl(r() * varH);
      const cw = ch * 3;
      const cl = makeCloud(cw, ch, seed * 31 + i * 7 + 1, pal);
      const x = fl(i * slot + r() * Math.max(1, slot - cw));
      const y = fl(r() * Math.max(1, height - ch));
      ctx.drawImage(cl, x, y);
    }
  });
}

// ---------------------------------------------------------------- marcos de Brasília

// Congresso Nacional: torres gêmeas, laje, cúpula do Senado (esq.) e tigela da Câmara (dir.).
function drawCongresso(ctx, cx, baseY, P, s = 1) {
  const S = (v) => Math.max(1, Math.round(v * s));
  const slabW = S(150);
  const slabH = S(7);
  const slabTop = baseY - slabH;
  const sx = cx - fl(slabW / 2);

  // torres gêmeas (atrás da laje)
  const tw = S(10);
  const gap = S(2);
  const th = S(80);
  const towerTop = slabTop - th;
  for (const tx of [cx - fl(gap / 2) - tw, cx + Math.ceil(gap / 2)]) {
    rect(ctx, tx, towerTop, tw, th, P.tower);
    rect(ctx, tx, towerTop, 1, th, P.towerLight);
    rect(ctx, tx + tw - 2, towerTop, 2, th, P.towerShade);
    for (let y = towerTop + 4; y < slabTop - 1; y += 2) rect(ctx, tx + 1, y, tw - 3, 1, P.window);
    rect(ctx, tx, towerTop, tw, 2, P.towerShade);
    rect(ctx, tx, towerTop, tw, 1, P.line);
  }
  // passarela ligando as torres
  const bY = towerTop + fl(th * 0.4);
  rect(ctx, cx - fl(gap / 2) - 1, bY, gap + 2, S(9), P.towerShade);
  for (let y = bY + 2; y < bY + S(9) - 1; y += 2) rect(ctx, cx - fl(gap / 2), y, gap, 1, P.window);

  // rampa de acesso (esquerda)
  const rampW = S(26);
  for (let i = 0; i < rampW; i++) {
    const hh = Math.max(1, Math.round(slabH * (1 - i / rampW)));
    rect(ctx, sx - i - 1, baseY - hh, 1, hh, i % 6 === 0 ? P.whiteDark : P.whiteShade);
  }

  // laje principal
  rect(ctx, sx, slabTop, slabW, slabH, P.white);
  rect(ctx, sx, slabTop, slabW, 1, P.whiteLight);
  rect(ctx, sx + 3, slabTop + S(3), slabW - 6, 1, P.whiteDark);
  rect(ctx, sx, baseY - 1, slabW, 1, P.whiteShade);
  rect(ctx, sx + slabW - 1, slabTop, 1, slabH, P.whiteShade);

  // cúpula do Senado (convexa)
  const dx = cx - S(44);
  const drx = S(15);
  const dry = S(9);
  for (let y = 0; y <= dry; y++) {
    const hw = fl(drx * Math.sqrt(1 - (y / dry) ** 2) + 0.3);
    const yy = slabTop - 1 - y;
    rect(ctx, dx - hw, yy, hw * 2 + 1, 1, P.white);
    const sh = fl(hw * 0.45);
    rect(ctx, dx + hw - sh, yy, sh + 1, 1, P.whiteShade);
  }
  rect(ctx, dx - drx, slabTop - 1, drx * 2 + 1, 1, P.whiteShade);
  for (let i = 0; i < S(4); i++) rect(ctx, dx - S(8) + i, slabTop - S(5) - i, 2, 1, P.whiteLight);

  // tigela da Câmara (côncava) sobre pedestal
  const bx = cx + S(44);
  const bh = S(12);
  const topHW = S(22);
  const botHW = S(5);
  const ped = S(2);
  const bowlTop = slabTop - ped - bh;
  rect(ctx, bx - S(4), slabTop - ped, S(8) + 1, ped, P.whiteShade);
  for (let i = 0; i < bh; i++) {
    const t = i / (bh - 1);
    const hw = fl(botHW + (topHW - botHW) * Math.sqrt(1 - t * t));
    const yy = bowlTop + i;
    rect(ctx, bx - hw, yy, hw * 2 + 1, 1, P.white);
    const sh = fl(hw * 0.4);
    rect(ctx, bx + hw - sh, yy, sh + 1, 1, P.whiteShade);
  }
  rect(ctx, bx - topHW, bowlTop, topHW * 2 + 1, 1, P.whiteLight);
  rect(ctx, bx - topHW + 3, bowlTop + 1, topHW * 2 - 5, 1, P.whiteDark);
}

// Catedral Metropolitana: coroa de colunas curvas com vidro azul e cruz.
function drawCatedral(ctx, cx, baseY, P, s = 1) {
  const S = (v) => Math.max(1, Math.round(v * s));
  const H = S(40);
  const tip = S(6);
  const top = baseY - H;
  const hwAt = (t) => (t < 0.3
    ? S(8) + S(7) * Math.pow((0.3 - t) / 0.3, 1.2)
    : S(8) + S(15) * Math.pow((t - 0.3) / 0.7, 1.6));

  // campanário (ao lado)
  const bx = cx + S(32);
  const bTop = baseY - S(34);
  rect(ctx, bx, bTop, 1, baseY - bTop, P.whiteShade);
  rect(ctx, bx + S(6), bTop + 2, 1, baseY - bTop - 2, P.whiteShade);
  pixelLine(ctx, bx, bTop, bx + S(6), bTop + 2, P.whiteShade);
  for (let i = 0; i < 4; i++) rect(ctx, bx + 2 + (i % 2), bTop + 5 + i * 5, 2, 2, P.bell);

  // vidro
  for (let i = tip; i < H; i++) {
    const hw = fl(hwAt(i / (H - 1)));
    rect(ctx, cx - hw, top + i, hw * 2 + 1, 1, i < H * 0.55 ? P.catGlass : P.catGlassDark);
  }
  // reflexo no vidro
  for (let i = tip + 2; i < H - 4; i += 1) {
    const hw = hwAt(i / (H - 1));
    dot(ctx, cx - fl(hw * 0.45), top + i, P.catGlassLight);
  }
  // colunas curvas
  const N = 9;
  for (let k = 0; k < N; k++) {
    const u = Math.cos(((k + 0.5) * Math.PI) / N);
    const w = Math.abs(u) < 0.8 ? 2 : 1;
    const col = u < -0.3 ? P.whiteLight : u > 0.4 ? P.whiteShade : P.white;
    for (let i = 0; i < H; i++) {
      const hw = hwAt(i / (H - 1));
      const x = fl(cx + hw * u) - (w === 2 ? 1 : 0);
      rect(ctx, x, top + i, w, 1, col);
    }
  }
  // base
  const hb = fl(hwAt(1));
  rect(ctx, cx - hb - 3, baseY - 1, hb * 2 + 7, 1, P.whiteDark);
  // cruz
  rect(ctx, cx, top - S(9), 1, S(9) + 2, P.line);
  rect(ctx, cx - 2, top - S(7), 5, 1, P.line);
}

// Museu Nacional (cúpula branca com rampa curva).
function drawMuseu(ctx, cx, baseY, P) {
  const rx = 22;
  const ry = 16;
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    const x = cx + 10 + t * 30;
    const y = baseY - 12 + fl(t * t * 10);
    rect(ctx, x, y, 2, 2, P.white);
    rect(ctx, x, y + 2, 2, 1, P.whiteDark);
  }
  for (let y = 0; y <= ry; y++) {
    const hw = fl(rx * Math.sqrt(1 - (y / ry) ** 2) + 0.3);
    const yy = baseY - 1 - y;
    rect(ctx, cx - hw, yy, hw * 2 + 1, 1, P.white);
    const sh = fl(hw * 0.42);
    rect(ctx, cx + hw - sh, yy, sh + 1, 1, P.whiteShade);
  }
  for (let i = 0; i < 7; i++) dot(ctx, cx - 14 + i, baseY - 11 - fl(i * 0.6), P.whiteLight);
  rect(ctx, cx - 7, baseY - 6, 10, 5, P.line);
  rect(ctx, cx - 6, baseY - 5, 8, 4, P.shadow);
}

// Biblioteca Nacional (caixa branca com frisos).
function drawBiblioteca(ctx, x, baseY, P) {
  const w = 46;
  const h = 20;
  rect(ctx, x, baseY - h, w, h, P.white);
  rect(ctx, x, baseY - h, w, 1, P.whiteLight);
  for (let xx = x + 2; xx < x + w - 4; xx += 3) rect(ctx, xx, baseY - h + 3, 1, h - 7, P.whiteShade);
  rect(ctx, x + w - 3, baseY - h, 3, h - 3, P.whiteShade);
  rect(ctx, x, baseY - 3, w, 3, P.shadow);
  rect(ctx, x + 2, baseY - 3, 2, 3, P.white);
  rect(ctx, x + w - 4, baseY - 3, 2, 3, P.white);
}

// Bloco dos Ministérios (vidro esverdeado, lajes brancas, pilotis).
function drawMinisterio(ctx, x, baseY, w, h, P) {
  const top = baseY - h;
  rect(ctx, x, top, w, h - 3, P.glass);
  for (let y = top + 2; y < baseY - 4; y += 3) rect(ctx, x, y, w, 1, P.glassLine);
  for (let xx = x + 3; xx < x + w - 3; xx += 4) rect(ctx, xx, top + 1, 1, h - 5, P.glassDark);
  rect(ctx, x + 1, top + 3, 2, h - 9, P.glassLight);
  rect(ctx, x + w - 3, top, 3, h - 3, P.glassDark);
  rect(ctx, x - 1, top - 2, w + 2, 2, P.white);
  rect(ctx, x - 1, top - 2, w + 2, 1, P.whiteLight);
  rect(ctx, x, baseY - 3, w, 3, P.shadow);
  rect(ctx, x + 1, baseY - 3, 1, 3, P.white);
  rect(ctx, x + fl(w / 2), baseY - 3, 1, 3, P.white);
  rect(ctx, x + w - 2, baseY - 3, 1, 3, P.white);
}

// Torre de TV (treliça com mirante e antena).
function drawTorreTV(ctx, cx, baseY, h, C) {
  const legTop = baseY - fl(h * 0.28);
  const spread = fl(h * 0.13);
  // pernas
  thickLine(ctx, cx - spread, baseY, cx - 3, legTop, C.main, 2);
  thickLine(ctx, cx + spread - 1, baseY, cx + 2, legTop, C.shade, 2);
  pixelLine(ctx, cx, baseY, cx, legTop, C.shade);
  for (let y = baseY - 5; y > legTop + 2; y -= 6) {
    const t = (baseY - y) / (baseY - legTop);
    const hw = fl(spread * (1 - t)) + 2;
    rect(ctx, cx - hw, y, hw * 2 + 1, 1, C.main);
    pixelLine(ctx, cx - hw, y, cx + hw - 2, y - 5, C.shade);
  }
  // fuste em treliça
  const shaftTop = baseY - fl(h * 0.84);
  rect(ctx, cx - 2, shaftTop, 1, legTop - shaftTop, C.main);
  rect(ctx, cx + 2, shaftTop, 1, legTop - shaftTop, C.shade);
  for (let y = legTop; y > shaftTop + 3; y -= 4) {
    pixelLine(ctx, cx - 2, y, cx + 2, y - 4, C.main);
    pixelLine(ctx, cx + 2, y, cx - 2, y - 4, C.shade);
  }
  // mirante
  const deckY = baseY - fl(h * 0.58);
  rect(ctx, cx - 6, deckY, 13, 3, C.main);
  rect(ctx, cx - 6, deckY, 13, 1, C.light);
  rect(ctx, cx - 5, deckY + 3, 11, 1, C.shade);
  rect(ctx, cx - 4, shaftTop + 2, 9, 2, C.main);
  // antena
  const ant = fl(h * 0.16);
  rect(ctx, cx, shaftTop - ant, 1, ant, C.main);
  dot(ctx, cx, shaftTop - ant - 1, C.red);
}

// Ponte JK: três arcos brancos que cruzam o tabuleiro, com cabos e reflexo.
function drawPonteJK(ctx, x0, deckY, waterY, P) {
  const arches = 3;
  const archW = 120;
  const step = 100;
  const apex = 34;
  const L = 15 + (arches - 1) * step + archW + 15;
  const archX = (k) => x0 + 15 + k * step;
  const archY = (t) => deckY + 8 - (apex + 8) * Math.sin(Math.PI * t);

  // reflexos na água
  for (let k = 0; k < arches; k++) {
    const ax = archX(k);
    for (let i = 0; i <= archW; i += 2) {
      const y = 2 * waterY - archY(i / archW);
      rect(ctx, ax + i, y, 1, 2, P.reflect);
    }
  }
  for (let x = x0; x < x0 + L; x += 2) dot(ctx, x, 2 * waterY - deckY - 3, P.reflect);

  // pilares
  for (let k = 0; k < arches; k++) {
    for (const px of [archX(k), archX(k) + archW]) {
      rect(ctx, px - 2, deckY + 3, 4, waterY - deckY - 3, P.shade);
      rect(ctx, px - 2, deckY + 3, 1, waterY - deckY - 3, P.white);
      rect(ctx, px - 3, waterY - 1, 6, 2, P.dark);
    }
  }
  // cabos
  for (let k = 0; k < arches; k++) {
    const ax = archX(k);
    for (let i = 12; i < archW - 12; i += 3) {
      const y = fl(archY(i / archW));
      if (y < deckY - 2) rect(ctx, ax + i, y + 2, 1, deckY - y - 2, P.cable);
    }
  }
  // tabuleiro
  rect(ctx, x0, deckY, L, 2, P.white);
  rect(ctx, x0, deckY + 2, L, 2, P.shade);
  rect(ctx, x0, deckY + 4, L, 1, P.dark);
  for (let x = x0 + 2; x < x0 + L; x += 6) dot(ctx, x, deckY - 1, P.shade);
  // arcos (desenhados por cima: eles atravessam o tabuleiro na diagonal)
  for (let k = 0; k < arches; k++) {
    const ax = archX(k);
    for (let i = 0; i <= archW; i++) {
      const y = fl(archY(i / archW));
      rect(ctx, ax + i, y, 1, 3, P.white);
      dot(ctx, ax + i, y, P.light);
      dot(ctx, ax + i, y + 3, P.shade);
    }
  }
  return L;
}

// Palácio da Alvorada: colunas que afinam até tocar o chão, formando arcos.
function drawAlvorada(ctx, x, baseY, P) {
  const w = 128;
  const colH = 16;
  const roofH = 3;
  const top = baseY - colH - roofH;
  rect(ctx, x + 3, top + roofH, w - 6, colH, P.glass);
  for (let xx = x + 6; xx < x + w - 6; xx += 5) rect(ctx, xx, top + roofH + 2, 1, colH - 3, P.glassLine);
  const n = 8;
  const span = w / n;
  for (let k = 0; k <= n; k++) {
    const cxk = x + fl(k * span);
    for (let i = 0; i < colH; i++) {
      const t = i / (colH - 1);
      const hw = fl((span / 2) * Math.pow(1 - t, 1.7));
      const yy = top + roofH + i;
      rect(ctx, cxk - hw, yy, hw * 2 + 1, 1, P.white);
      if (hw > 1) rect(ctx, cxk + fl(hw * 0.4), yy, hw - fl(hw * 0.4) + 1, 1, P.whiteShade);
    }
  }
  rect(ctx, x - 3, top, w + 6, roofH, P.white);
  rect(ctx, x - 3, top, w + 6, 1, P.whiteLight);
  rect(ctx, x - 3, top + roofH - 1, w + 6, 1, P.whiteShade);
  rect(ctx, x - 8, baseY, w + 16, 2, P.pool);
  rect(ctx, x - 8, baseY, w + 16, 1, P.poolLight);
}

function drawVeleiro(ctx, x, waterY, P) {
  rect(ctx, x - 6, waterY - 2, 13, 2, P.hull);
  rect(ctx, x - 4, waterY, 9, 1, P.hullDark);
  rect(ctx, x, waterY - 17, 1, 15, P.mast);
  for (let i = 0; i < 13; i++) rect(ctx, x + 1, waterY - 16 + i, fl(i * 0.6) + 1, 1, P.sail);
  for (let i = 0; i < 9; i++) rect(ctx, x - fl(i * 0.5) - 1, waterY - 12 + i, fl(i * 0.5) + 1, 1, P.sail2);
  for (let i = 0; i < 6; i += 2) rect(ctx, x - 5 + i * 2, waterY + 2, 3, 1, P.reflect);
}

// ---------------------------------------------------------------- vegetação e mobiliário

function drawIpe(ctx, x, baseY, h, C, seed) {
  const r = rng(seed);
  const trunkTop = baseY - fl(h * 0.5);
  const cr = h / 50;
  thickLine(ctx, x, baseY, x + 1, trunkTop, C.trunk, 3);
  pixelLine(ctx, x + 3, baseY, x + 3, trunkTop + 3, C.trunkDark);
  thickLine(ctx, x + 1, trunkTop + 4, x - fl(8 * cr), trunkTop - fl(4 * cr), C.trunk, 2);
  thickLine(ctx, x + 2, trunkTop + 2, x + fl(9 * cr), trunkTop - fl(5 * cr), C.trunk, 2);
  const cy = trunkTop - fl(h * 0.1);
  const blobs = [[-10, -6, 7], [0, -12, 8], [10, -7, 7], [-4, -1, 6], [6, 0, 6], [-15, 0, 5], [15, 0, 5], [-6, -16, 5], [7, -16, 5]];
  for (const [bx, by, br] of blobs) pixelCircle(ctx, x + fl(bx * cr) + 1, cy + fl(by * cr) + 1, Math.max(1, fl(br * cr)), C.shade);
  for (const [bx, by, br] of blobs) pixelCircle(ctx, x + fl(bx * cr), cy + fl(by * cr) - 1, Math.max(1, fl(br * cr) - 1), C.bloom);
  for (let i = 0; i < 40; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * 15 * cr;
    const px = x + Math.cos(a) * d * 1.15;
    const py = cy - 6 * cr + Math.sin(a) * d * 0.75;
    dot(ctx, px, py, r() < 0.6 ? C.light : C.shade);
  }
  // pétalas caídas no pé
  for (let i = 0; i < 8; i++) dot(ctx, x - 10 + r() * 22, baseY - 2 - r() * 2, C.bloom);
}

function drawCerrado(ctx, x, baseY, h, C, seed) {
  const r = rng(seed);
  const pts = [[x, baseY], [x + 3, baseY - fl(h * 0.2)], [x - 2, baseY - fl(h * 0.4)], [x + 2, baseY - fl(h * 0.55)]];
  for (let i = 0; i < pts.length - 1; i++) {
    thickLine(ctx, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], C.trunk, 3);
    pixelLine(ctx, pts[i][0] + 2, pts[i][1], pts[i + 1][0] + 2, pts[i + 1][1], C.trunkDark);
  }
  const [tx, ty] = pts[pts.length - 1];
  thickLine(ctx, tx, ty, tx - fl(h * 0.3), ty - fl(h * 0.15), C.trunk, 2);
  thickLine(ctx, tx, ty, tx + fl(h * 0.28), ty - fl(h * 0.2), C.trunk, 2);
  thickLine(ctx, tx, ty, tx + 1, ty - fl(h * 0.3), C.trunk, 2);
  const tufts = [[-0.3, -0.18], [0.28, -0.23], [0, -0.34], [-0.13, -0.3], [0.15, -0.33], [-0.42, -0.12]];
  for (const [dx, dy] of tufts) pixelEllipse(ctx, tx + fl(dx * h) + 1, ty + fl(dy * h) + 1, 7, 4, C.shade);
  for (const [dx, dy] of tufts) pixelEllipse(ctx, tx + fl(dx * h), ty + fl(dy * h) - 1, 6, 3, C.leaf);
  for (let i = 0; i < 18; i++) {
    const [dx, dy] = tufts[fl(r() * tufts.length)];
    dot(ctx, tx + dx * h + (r() - 0.5) * 10, ty + dy * h - 2 + (r() - 0.5) * 4, C.light);
  }
}

function drawPoste(ctx, x, baseY, h, C, lit = false) {
  if (lit) {
    pixelCircle(ctx, x - 3, baseY - h + 2, 5, C.glow);
    pixelCircle(ctx, x + 4, baseY - h + 2, 5, C.glow);
  }
  rect(ctx, x, baseY - h, 1, h, C.pole);
  rect(ctx, x + 1, baseY - h, 1, h, C.poleDark);
  rect(ctx, x - 4, baseY - h, 10, 1, C.pole);
  rect(ctx, x - 5, baseY - h + 1, 4, 2, C.lamp);
  rect(ctx, x + 3, baseY - h + 1, 4, 2, C.lamp);
}

function drawArbusto(ctx, x, baseY, w, C) {
  pixelEllipse(ctx, x + 1, baseY - 3, fl(w / 2), 4, C.shade);
  pixelEllipse(ctx, x, baseY - 4, fl(w / 2) - 1, 3, C.leaf);
  dot(ctx, x - 2, baseY - 6, C.light);
  dot(ctx, x + 2, baseY - 5, C.light);
}

// Bandeira do Brasil (22x15), pré-renderizada.
function makeFlag() {
  const w = 22;
  const h = 15;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  rect(ctx, 0, 0, w, h, '#1f9e4a');
  for (let y = 0; y < h; y++) {
    const t = 1 - Math.abs(y - (h - 1) / 2) / ((h - 1) / 2);
    const hw = fl(t * (w / 2 - 2));
    rect(ctx, w / 2 - hw, y, hw * 2, 1, '#ffd83a');
  }
  pixelCircle(ctx, 11, 7, 4, '#2a4fa8');
  rect(ctx, 7, 7, 3, 1, '#ffffff');
  rect(ctx, 10, 6, 3, 1, '#ffffff');
  rect(ctx, 13, 7, 2, 1, '#ffffff');
  dot(ctx, 9, 8, '#ffffff');
  dot(ctx, 12, 9, '#ffffff');
  return c;
}

function drawFlagWave(ctx, flag, x, y, time) {
  for (let i = 0; i < flag.width; i++) {
    const off = Math.round(Math.sin(time * 5 - i * 0.45) * 1.4 * (i / flag.width));
    ctx.drawImage(flag, i, 0, 1, flag.height, x + i, y + off, 1, flag.height);
  }
}

// Pétalas caindo (animação barata).
function drawPetals(ctx, W, time, camX, colors, n, par = 0.65) {
  for (let i = 0; i < n; i++) {
    const sp = 9 + ((i * 37) % 11);
    const y = ((time * sp + i * 97) % 200) - 20;
    let x = i * 131 + 17 - camX * par + Math.sin(time * 1.5 + i) * 6 + time * 6;
    x = (((x % (W + 20)) + W + 20) % (W + 20)) - 10;
    rect(ctx, x, y, i % 3 === 0 ? 2 : 1, 1, colors[i % colors.length]);
  }
}

// Escurecimento (opts.dark 0..1) e relâmpago (opts.flash) sobre a tela inteira.
function screenTint(ctx, W, H, time = 0, opts = {}) {
  const d = clamp01(opts.dark);
  if (d > 0) {
    ctx.fillStyle = `rgba(28, 12, 48, ${(0.45 * d).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (opts.flash) {
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(0, 0, W, H);
    const r = rng(fl(time * 7) + 3);
    let x = fl(W * (0.2 + r() * 0.6));
    let y = 0;
    while (y < 95) {
      const nx = x + fl((r() - 0.5) * 18);
      const ny = y + 8 + fl(r() * 10);
      thickLine(ctx, x, y, nx, ny, '#fffbe0', 2);
      x = nx; y = ny;
    }
  }
}

// ---------------------------------------------------------------- paletas

const ESP = {
  white: '#f7f4ec', whiteLight: '#ffffff', whiteShade: '#dcd6c8', whiteDark: '#b3ac9c',
  line: '#6f6a62', shadow: '#55636a', bell: '#c9a24a',
  tower: '#efe5cf', towerLight: '#fbf6ea', towerShade: '#cdbf9f', window: '#a39577',
  glass: '#5e9f8d', glassLight: '#8ccab4', glassDark: '#3f7669', glassLine: '#cfeade',
  catGlass: '#4f8fd6', catGlassDark: '#3b72b8', catGlassLight: '#8fc0f0',
  lawn: '#5fb847', lawnLight: '#7fcf5a', lawnDark: '#4a9c3a',
};

const CLOUD_DAY = { main: '#f7fbff', shade: '#c9def2', light: '#ffffff' };
const CLOUD_SUNSET = { main: '#ffb3c6', shade: '#d77aa3', light: '#ffe0ea' };
const CLOUD_STORM = { main: '#5a4a72', shade: '#3a2d4f', light: '#76688f' };

const IPE_AMARELO = { trunk: '#6b4630', trunkDark: '#4a2f20', bloom: '#ffd21f', shade: '#eb9d00', light: '#fff38a' };
const IPE_ROSA = { trunk: '#4d3033', trunkDark: '#2f1f22', bloom: '#ff7eb6', shade: '#d4508e', light: '#ffc6df' };
const IPE_ROXO = { trunk: '#4d3033', trunkDark: '#2f1f22', bloom: '#b97ae2', shade: '#8a4fc0', light: '#e2bff7' };
const CERRADO = { trunk: '#6e4a33', trunkDark: '#4a3122', leaf: '#4f9f40', shade: '#347a2f', light: '#7fc75d' };
const CERRADO_DUSK = { trunk: '#4a3030', trunkDark: '#2f1f22', leaf: '#3d7a45', shade: '#2a5a38', light: '#5f9a55' };
const POSTE = { pole: '#7c8088', poleDark: '#5a5e66', lamp: '#fff3b0', glow: 'rgba(255,214,140,0.35)' };
const MATO = { leaf: '#58b043', shade: '#3c8a34', light: '#86d563' };
const MATO_DUSK = { leaf: '#3f7f47', shade: '#2c5f3a', light: '#62a05a' };

// ---------------------------------------------------------------- tema: Esplanada (dia)

function makeEsplanada(W, H) {
  const sky = makeCanvas(W, H);
  const sctx = sky.getContext('2d');
  paintBands(sctx, W, [
    ['#2c78d4', 20], ['#3887dd', 18], ['#4796e6', 18], ['#58a6ed', 18], ['#6cb5f2', 18],
    ['#84c4f5', 16], ['#9fd3f8', 14], ['#bbe1fa', 14], ['#d4edfb', 44],
  ]);
  // sol no canto
  const sunX = W - 38;
  pixelCircle(sctx, sunX, 24, 15, '#fff2b0');
  pixelCircle(sctx, sunX, 24, 12, '#ffe066');
  pixelCircle(sctx, sunX, 24, 9, '#fff6c8');

  const clouds = makeCloudStrip(1000, 84, 7, 5, CLOUD_DAY);

  // camada distante: colinas e skyline em névoa, Torre de TV
  const HAZE = { main: '#86b0d2', shade: '#7aa3c7', light: '#a3c6e2', red: '#e8604c' };
  const far = buildStrip(1024, H, (ctx, at, width) => {
    const r = rng(12);
    for (let x = 0; x < width; x++) {
      const y = fl(131 + 3 * Math.sin((2 * Math.PI * x * 3) / width) + 1.5 * Math.sin((2 * Math.PI * x * 11) / width));
      rect(ctx, x, y, 1, H - y, '#a7c9e3');
    }
    for (let i = 0; i < 26; i++) {
      const x = fl(r() * (width - 20));
      const w = 8 + fl(r() * 12);
      const h = 6 + fl(r() * 16);
      at(x, (xx) => {
        rect(ctx, xx, 136 - h, w, h + 10, HAZE.shade);
        rect(ctx, xx, 136 - h, w, 1, HAZE.light);
        for (let y = 136 - h + 3; y < 136; y += 3) rect(ctx, xx + 1, y, w - 2, 1, '#8fb6d6');
      });
    }
    const torre = bgImg('torretv');
    if (torre) {
      const hazy = tinted(torre, '#a7c9e3', 0.5);
      at(700, (xx) => place(ctx, hazy, xx, 139));
    } else at(700, (xx) => drawTorreTV(ctx, xx, 138, 100, HAZE));
    rect(ctx, 0, 136, width, H - 136, '#9bbfdc');
  });

  // camada média: gramado, Congresso, Ministérios, Catedral, Museu e Biblioteca
  const mid = buildStrip(1400, H, (ctx, at, width) => {
    const base = 143;
    rect(ctx, 0, 139, width, H - 139, ESP.lawn);
    rect(ctx, 0, 139, width, 1, ESP.lawnLight);
    rect(ctx, 0, 142, width, 1, ESP.lawnDark);
    // arvorezinhas distantes
    for (const tx of [40, 70, 105, 1215, 1370]) {
      at(tx, (xx) => {
        rect(ctx, xx, base - 8, 1, 6, '#6e4a33');
        pixelCircle(ctx, xx, base - 11, 4, '#4f9f40');
        pixelCircle(ctx, xx - 1, base - 12, 2, '#7fc75d');
      });
    }
    if (bgImg('congresso')) {
      const soft = (n) => tinted(bgImg(n), '#cfe6f7', 0.12);
      at(262, (xx) => place(ctx, soft('congresso'), xx, base + 1));
      at(560, (xx) => place(ctx, soft('ministerios'), xx, base + 1));
      at(850, (xx) => place(ctx, soft('catedral'), xx, base + 1));
      at(1040, (xx) => place(ctx, soft('museu'), xx, base + 1));
      at(1290, (xx) => place(ctx, soft('ministerios'), xx, base + 1));
    } else {
      at(262, (xx) => drawCongresso(ctx, xx, base, ESP, 1.15));
      const mins = [[430, 26, 38], [478, 26, 40], [526, 26, 38], [574, 26, 41], [622, 26, 38], [670, 26, 40]];
      for (const [mx, w, h] of mins) at(mx, (xx) => drawMinisterio(ctx, xx, base, w, h, ESP));
      at(850, (xx) => drawCatedral(ctx, xx, base, ESP, 1.3));
      at(1015, (xx) => drawMuseu(ctx, xx, base, ESP));
      at(1080, (xx) => drawBiblioteca(ctx, xx, base, ESP));
      for (const [mx, w, h] of [[1250, 24, 34], [1296, 24, 36]]) at(mx, (xx) => drawMinisterio(ctx, xx, base, w, h, ESP));
    }
  });

  // camada próxima: ipês amarelos, árvores do cerrado, postes, arbustos
  const near = buildStrip(1024, H, (ctx, at, width) => {
    const base = 150;
    const r = rng(77);
    for (let i = 0; i < 22; i++) {
      const x = fl(r() * width);
      at(x, (xx) => drawArbusto(ctx, xx, base - 1, 10 + fl(r() * 8), MATO));
    }
    const cerr = bgImg('cerrado');
    const ipe = bgImg('ipe_amarelo');
    for (const [x, h] of [[372, 42], [640, 40], [950, 46]]) at(x, (xx) => (cerr ? place(ctx, cerr, xx, base + 1) : drawCerrado(ctx, xx, base, h, CERRADO, x)));
    for (const x of [128, 530, 845]) at(x, (xx) => drawPoste(ctx, xx, base, 36, POSTE));
    for (const [x, h] of [[90, 56], [420, 50], [760, 60]]) at(x, (xx) => (ipe ? place(ctx, ipe, xx, base + 1) : drawIpe(ctx, xx, base, h, IPE_AMARELO, x)));
  });

  const petalColors = ['#ffd21f', '#fff38a', '#eb9d00'];
  return {
    topColor: '#2c78d4',
    draw(ctx, camX = 0, time = 0) {
      ctx.drawImage(sky, 0, 0);
      tileStrip(ctx, clouds, time * 4 + camX * 0.05, W, 4);
      tileStrip(ctx, far, camX * 0.12, W);
      tileStrip(ctx, mid, camX * 0.35, W);
      tileStrip(ctx, near, camX * 0.65, W);
      drawPetals(ctx, W, time, camX, petalColors, 10);
    },
    tint(ctx, time = 0, opts = {}) { screenTint(ctx, W, H, time, opts); },
  };
}

// ---------------------------------------------------------------- tema: Ponte JK / Lago Paranoá (pôr do sol)

function makePonte(W, H) {
  const HORIZON = 112;
  const sky = makeCanvas(W, H);
  const sctx = sky.getContext('2d');
  paintBands(sctx, W, [
    ['#35276a', 16], ['#4a2f80', 14], ['#62398f', 12], ['#7e409b', 12], ['#9c47a1', 10],
    ['#bb529f', 10], ['#d86496', 10], ['#ec7d88', 10], ['#f89a77', 8], ['#ffb86a', 7], ['#ffd27a', 3],
  ]);
  const sunX = fl(W * 0.64);
  pixelCircle(sctx, sunX, HORIZON - 5, 21, '#ffc15e');
  pixelCircle(sctx, sunX, HORIZON - 5, 18, '#ffd872');
  pixelCircle(sctx, sunX, HORIZON - 5, 14, '#fff0a8');
  // faixas escuras cruzando o sol (estilo retrô)
  rect(sctx, sunX - 22, HORIZON - 12, 44, 1, '#ffb86a');
  rect(sctx, sunX - 22, HORIZON - 8, 44, 1, '#ffb86a');
  // lago Paranoá
  paintBands(sctx, W, [
    ['#f0a07a', 2], ['#c07392', 3], ['#91599a', 4], ['#6f4b8f', 6], ['#57417f', 9], ['#463874', 12], ['#3a3169', 32],
  ], HORIZON);
  rect(sctx, 0, HORIZON, W, 1, '#ffe3a0');

  const r0 = rng(99);
  const stars = [];
  for (let i = 0; i < 26; i++) stars.push([fl(r0() * W), fl(r0() * 46), r0() * 6.28]);
  const ripples = [];
  for (let i = 0; i < 40; i++) ripples.push([fl(r0() * W), HORIZON + 4 + fl(r0() * 34), 2 + fl(r0() * 5), r0()]);

  const clouds = makeCloudStrip(900, 66, 6, 17, CLOUD_SUNSET, 12, 10);

  // margem distante: colinas e prédios em silhueta, Torre de TV
  const far = buildStrip(1024, H, (ctx, at, width) => {
    const r = rng(3);
    for (let x = 0; x < width; x++) {
      const y = fl(107 + 2 * Math.sin((2 * Math.PI * x * 4) / width) + 1.5 * Math.sin((2 * Math.PI * x * 13) / width));
      rect(ctx, x, y, 1, HORIZON + 1 - y, '#7a5596');
    }
    for (let i = 0; i < 30; i++) {
      const x = fl(r() * (width - 14));
      const w = 5 + fl(r() * 9);
      const h = 3 + fl(r() * 9);
      at(x, (xx) => {
        rect(ctx, xx, HORIZON - h, w, h + 1, '#63457f');
        if (r() < 0.8) dot(ctx, xx + 1 + fl(r() * (w - 2)), HORIZON - h + 1 + fl(r() * (h - 1)), '#ffcf7a');
      });
    }
    const torre = bgImg('torretv');
    if (torre) at(300, (xx) => place(ctx, tinted(torre, '#6d4f8c', 0.62), xx, HORIZON + 2));
    else at(300, (xx) => drawTorreTV(ctx, xx, HORIZON + 1, 72, { main: '#5b3f7a', shade: '#4d3469', light: '#6d4f8c', red: '#ff5a5a' }));
  });

  // meio: Ponte JK, veleiros, Palácio da Alvorada na margem
  const PJK = { white: '#fff1e2', light: '#ffffff', shade: '#e2b3ad', dark: '#8f6384', cable: '#f3c9c0', reflect: '#9b6fa6' };
  const ALV = {
    white: '#fff1e2', whiteLight: '#ffffff', whiteShade: '#e0b7ae', glass: '#3d3a63', glassLine: '#5a5585',
    pool: '#8f6fb0', poolLight: '#c9a0d0',
  };
  const BOAT = { hull: '#fff1e2', hullDark: '#b98aa5', mast: '#5b3f55', sail: '#fff6ee', sail2: '#ffd6c8', reflect: '#9b6fa6' };
  const mid = buildStrip(1400, H, (ctx, at) => {
    const jk = bgImg('pontejk');
    if (jk) {
      at(120 + jk.width / 2, (xx) => {
        reflect(ctx, jk, xx, 136, 14, 0.28);
        place(ctx, jk, xx, 137);
      });
    } else at(120, (xx) => drawPonteJK(ctx, xx, 121, 131, PJK));
    at(610, (xx) => drawVeleiro(ctx, xx, 134, BOAT));
    at(690, (xx) => drawVeleiro(ctx, xx, 128, BOAT));
    at(1230, (xx) => drawVeleiro(ctx, xx, 131, BOAT));
    // península com o Alvorada
    at(770, (xx) => {
      rect(ctx, xx, 134, 330, 20, '#3e6b4f');
      rect(ctx, xx + 4, 133, 322, 1, '#5b8f5e');
      for (let i = 0; i < 330; i += 3) dot(ctx, xx + i, 135 + (i % 2), '#4d7d57');
      for (const tx of [8, 30, 290, 312]) {
        rect(ctx, xx + tx, 124, 2, 10, '#3a2a30');
        pixelCircle(ctx, xx + tx + 1, 121, 6, '#2f5a3f');
        pixelCircle(ctx, xx + tx, 120, 4, '#3f7550');
      }
      const alv = bgImg('alvorada');
      if (alv) place(ctx, alv, xx + 165, 140);
      else drawAlvorada(ctx, xx + 90, 136, ALV);
    });
  });

  // orla próxima: ipês rosa/roxos, postes acesos, arbustos
  const near = buildStrip(1024, H, (ctx, at, width) => {
    const base = 150;
    rect(ctx, 0, 141, width, H - 141, '#3f7a47');
    rect(ctx, 0, 141, width, 1, '#5a9a55');
    const r = rng(41);
    for (let i = 0; i < 20; i++) {
      const x = fl(r() * width);
      at(x, (xx) => drawArbusto(ctx, xx, base - 1, 10 + fl(r() * 8), MATO_DUSK));
    }
    const dusk = (n) => (bgImg(n) ? tinted(bgImg(n), '#3a2456', 0.22) : null);
    const cerr = dusk('cerrado');
    const rosa = dusk('ipe_rosa');
    const roxo = dusk('ipe_roxo');
    for (const [x, h] of [[470, 42], [900, 40]]) at(x, (xx) => (cerr ? place(ctx, cerr, xx, base + 1) : drawCerrado(ctx, xx, base, h, CERRADO_DUSK, x)));
    for (const x of [240, 700, 980]) at(x, (xx) => drawPoste(ctx, xx, base, 36, POSTE, true));
    at(120, (xx) => (rosa ? place(ctx, rosa, xx, base + 1) : drawIpe(ctx, xx, base, 54, IPE_ROSA, 120)));
    at(360, (xx) => (roxo ? place(ctx, roxo, xx, base + 1) : drawIpe(ctx, xx, base, 48, IPE_ROXO, 360)));
    at(580, (xx) => (rosa ? place(ctx, rosa, xx, base + 1) : drawIpe(ctx, xx, base, 50, IPE_ROSA, 580)));
    at(820, (xx) => (roxo ? place(ctx, roxo, xx, base + 1) : drawIpe(ctx, xx, base, 56, IPE_ROXO, 820)));
  });

  const petalColors = ['#ff7eb6', '#ffc6df', '#b97ae2'];
  return {
    topColor: '#35276a',
    draw(ctx, camX = 0, time = 0) {
      ctx.drawImage(sky, 0, 0);
      for (const [x, y, p] of stars) {
        const b = Math.sin(time * 2 + p);
        if (b > -0.3) dot(ctx, x, y, b > 0.5 ? '#fff6d8' : '#c9a9e0');
        if (b > 0.92) { dot(ctx, x - 1, y, '#c9a9e0'); dot(ctx, x + 1, y, '#c9a9e0'); }
      }
      tileStrip(ctx, clouds, time * 2 + camX * 0.04, W, 8);
      // brilho do sol e ondinhas no lago
      for (let y = HORIZON + 2; y < 148; y += 2) {
        const t = (y - HORIZON) / 36;
        const w = fl(24 - t * 12 + Math.sin(time * 3 + y * 0.7) * 4);
        const off = fl(Math.sin(time * 2 + y * 1.3) * 3);
        rect(ctx, sunX - fl(w / 2) + off, y, w, 1, (y >> 1) % 2 ? '#ffd27a' : '#ffae5c');
      }
      for (const [x, y, w, p] of ripples) {
        if ((time * 0.8 + p) % 1 < 0.55) rect(ctx, x, y, w, 1, '#8a6db0');
      }
      tileStrip(ctx, far, camX * 0.06, W);
      tileStrip(ctx, mid, camX * 0.3, W);
      tileStrip(ctx, near, camX * 0.6, W);
      drawPetals(ctx, W, time, camX, petalColors, 10, 0.6);
    },
    tint(ctx, time = 0, opts = {}) { screenTint(ctx, W, H, time, opts); },
  };
}

// ---------------------------------------------------------------- tema: intro (Eixo Monumental)

function makeIntro(W, H) {
  const day = makeCanvas(W, H);
  paintBands(day.getContext('2d'), W, [
    ['#2c78d4', 20], ['#3887dd', 18], ['#4796e6', 18], ['#58a6ed', 18], ['#6cb5f2', 18],
    ['#84c4f5', 16], ['#9fd3f8', 14], ['#bbe1fa', 14], ['#d4edfb', 44],
  ]);
  const dark = makeCanvas(W, H);
  paintBands(dark.getContext('2d'), W, [
    ['#1f1733', 22], ['#2a1f42', 20], ['#35284f', 20], ['#41325c', 18], ['#4f3d68', 18],
    ['#5e4a74', 16], ['#6e5780', 14], ['#7d6489', 52],
  ]);
  const clouds = makeCloudStrip(900, 70, 6, 11, CLOUD_DAY);
  const storm = makeCloudStrip(700, 96, 8, 23, CLOUD_STORM, 18, 16);

  const margin = 40;
  const LW = W + margin * 2;
  const cx = fl(LW / 2);
  const poleX = margin + Math.max(18, fl(W * 0.12));
  const { canvas: landHD, ctx: lctx } = makeHDCanvas(LW, H, BG_SCALE);
  const land = landHD;
  const base = 138;
  // ministérios nas laterais (em "perspectiva": maiores longe do centro)
  const mins = bgImg('ministerios');
  if (mins) {
    place(lctx, mins, cx - 112 - mins.width / 2, base + 1);
    place(lctx, mins, cx + 112 + mins.width / 2, base + 1);
    place(lctx, bgImg('congresso'), cx, base + 1);
  } else {
    for (let i = 0; i < 4; i++) {
      const h = 26 + i * 6;
      const w = 20 + i * 3;
      drawMinisterio(lctx, cx - 112 - i * 40 - w, base, w, h, ESP);
      drawMinisterio(lctx, cx + 112 + i * 40, base, w, h, ESP);
    }
    drawCongresso(lctx, cx, base, ESP, 1.25);
  }
  rect(lctx, 0, base, LW, H - base, ESP.lawn);
  rect(lctx, 0, base, LW, 1, ESP.lawnLight);
  for (let y = base + 4; y < H; y += 5) rect(lctx, 0, y, LW, 2, ESP.lawnDark);
  rect(lctx, cx - 96, base + 2, 192, 5, '#6fb6e8');
  rect(lctx, cx - 96, base + 2, 192, 1, '#b5e0fa');
  for (let x = cx - 90; x < cx + 90; x += 11) rect(lctx, x, base + 4, 4, 1, '#9fd2f4');
  // mastro da bandeira
  rect(lctx, poleX, 24, 2, base - 22, '#c3c6cc');
  rect(lctx, poleX + 1, 24, 1, base - 22, '#8f939c');
  rect(lctx, poleX - 1, 21, 4, 3, '#e8c64a');
  const ipeI = bgImg('ipe_amarelo');
  if (ipeI) {
    place(lctx, ipeI, margin + 14, 153);
    place(lctx, ipeI, margin + W - 16, 153);
  } else {
    drawIpe(lctx, margin + 12, 152, 50, IPE_AMARELO, 5);
    drawIpe(lctx, margin + W - 14, 152, 54, IPE_AMARELO, 9);
  }
  const flag = makeFlag();
  markHD(land, BG_SCALE);

  return {
    topColor: '#2c78d4',
    draw(ctx, camX = 0, time = 0, opts = {}) {
      const d = clamp01(opts.dark);
      ctx.drawImage(day, 0, 0);
      if (d > 0) {
        ctx.globalAlpha = d;
        ctx.drawImage(dark, 0, 0);
        ctx.globalAlpha = 1;
      }
      if (d < 1) {
        ctx.globalAlpha = 1 - d;
        tileStrip(ctx, clouds, time * 4, W, 6);
        ctx.globalAlpha = 1;
      }
      if (d > 0) {
        ctx.globalAlpha = d;
        tileStrip(ctx, storm, time * 14, W, -8);
        ctx.globalAlpha = 1;
      }
      const shift = Math.max(-margin, Math.min(margin, fl(camX * 0.25)));
      const ox = -margin - shift;
      ctx.drawImage(land, ox, 0);
      drawFlagWave(ctx, flag, ox + poleX + 2, 25, time * (1 + d * 2));
      if (!opts.tintLater) screenTint(ctx, W, H, time, opts);
    },
    // Escurece/relampeja a tela inteira. draw() já chama sozinho; para escurecer também
    // o chão e os personagens, use draw(..., { dark, tintLater: true }) e depois tint(ctx, time, opts).
    tint(ctx, time = 0, opts = {}) { screenTint(ctx, W, H, time, opts); },
  };
}

// ---------------------------------------------------------------- API

export function createBackground(theme, viewW, viewH = 180) {
  const W = Math.max(1, fl(viewW));
  const H = Math.max(180, fl(viewH));
  switch (theme) {
    case 'ponte': return makePonte(W, H);
    case 'intro': return makeIntro(W, H);
    case 'title':
    case 'esplanada':
    default: return makeEsplanada(W, H);
  }
}
