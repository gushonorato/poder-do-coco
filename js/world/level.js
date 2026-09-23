// Mapa de tiles, colisão e construtor de fases.
import { VIEW_H } from '../gfx/hd.js';
export const TILE = 16;
export const ROWS = 12; // mundo tem 192px de altura; a câmera mostra VIEW_H (135)
export const GROUND_ROW = 10; // chão padrão ocupa as linhas 10 e 11
export const CAM_Y = ROWS * TILE - VIEW_H; // câmera no chão (sobe quando o Miguel pula alto)

export const T_EMPTY = 0;
export const T_SOLID = 1; // chão
export const T_ONEWAY = 2; // plataforma que dá para atravessar por baixo
export const T_BLOCK = 3; // bloco sólido (visual diferente)

export class Level {
  constructor(cols) {
    this.cols = cols;
    this.rows = ROWS;
    this.tiles = new Uint8Array(cols * ROWS);
    this.width = cols * TILE;
    this.height = ROWS * TILE;
    this.spawns = []; // { type, x, y, ...extra } em pixels
    this.checkpoints = []; // x em pixels
    this.start = { x: 2 * TILE, y: GROUND_ROW * TILE };
    this.arena = null; // { x0, x1 } em pixels
    this.theme = 'esplanada';
    this.decor = []; // enfeites de primeiro plano (placas etc.)
  }
  get(cx, cy) {
    if (cx < 0 || cx >= this.cols) return T_SOLID; // paredes invisíveis nas bordas
    if (cy < 0) return T_EMPTY;
    if (cy >= this.rows) return T_SOLID;
    return this.tiles[cy * this.cols + cx];
  }
  set(cx, cy, t) {
    if (cx < 0 || cx >= this.cols || cy < 0 || cy >= this.rows) return;
    this.tiles[cy * this.cols + cx] = t;
  }
  isSolid(cx, cy) {
    const t = this.get(cx, cy);
    return t === T_SOLID || t === T_BLOCK;
  }
  // Y do chão (topo do tile sólido/plataforma) abaixo de (x, y), ou null.
  groundBelow(x, y) {
    const cx = Math.floor(x / TILE);
    for (let cy = Math.max(0, Math.floor(y / TILE)); cy < this.rows; cy++) {
      const t = this.get(cx, cy);
      if (t !== T_EMPTY) return cy * TILE;
    }
    return null;
  }
}

// Move uma caixa (e: {x, y, w, h, vx, vy}) pelo mapa resolvendo colisões.
// Retorna flags { onGround, hitWall, hitCeil }. Também respeita limites extras (e.minX/e.maxX).
export function moveAndCollide(level, e, opts = {}) {
  const res = { onGround: false, hitWall: false, hitCeil: false };
  // Eixo X
  e.x += e.vx;
  if (e.vx !== 0) {
    const top = Math.floor(e.y / TILE);
    const bottom = Math.floor((e.y + e.h - 1) / TILE);
    if (e.vx > 0) {
      const cx = Math.floor((e.x + e.w - 1) / TILE);
      for (let cy = top; cy <= bottom; cy++) {
        if (level.isSolid(cx, cy)) {
          e.x = cx * TILE - e.w;
          res.hitWall = true;
          break;
        }
      }
    } else {
      const cx = Math.floor(e.x / TILE);
      for (let cy = top; cy <= bottom; cy++) {
        if (level.isSolid(cx, cy)) {
          e.x = (cx + 1) * TILE;
          res.hitWall = true;
          break;
        }
      }
    }
  }
  if (opts.minX != null && e.x < opts.minX) { e.x = opts.minX; res.hitWall = true; }
  if (opts.maxX != null && e.x + e.w > opts.maxX) { e.x = opts.maxX - e.w; res.hitWall = true; }
  if (res.hitWall) e.vx = 0;

  // Eixo Y
  const prevBottom = e.y + e.h;
  e.y += e.vy;
  const left = Math.floor(e.x / TILE);
  const right = Math.floor((e.x + e.w - 1) / TILE);
  if (e.vy > 0) {
    // sonda o pixel logo abaixo do pé (senão, parado no chão, alterna no ar/no chão a cada quadro)
    const cy = Math.floor((e.y + e.h) / TILE);
    for (let cx = left; cx <= right; cx++) {
      const t = level.get(cx, cy);
      const solid = t === T_SOLID || t === T_BLOCK;
      const oneway = t === T_ONEWAY && prevBottom <= cy * TILE + 1 && !opts.dropThrough;
      if (solid || oneway) {
        e.y = cy * TILE - e.h;
        e.vy = 0;
        res.onGround = true;
        break;
      }
    }
  } else if (e.vy < 0) {
    const cy = Math.floor(e.y / TILE);
    for (let cx = left; cx <= right; cx++) {
      if (level.isSolid(cx, cy)) {
        e.y = (cy + 1) * TILE;
        e.vy = 0;
        res.hitCeil = true;
        break;
      }
    }
  }
  return res;
}

export function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Construtor de fases em "coordenadas de tile" para ficar fácil de desenhar.
export class LevelBuilder {
  constructor(cols, theme) {
    this.level = new Level(cols);
    this.level.theme = theme;
  }
  ground(from, to, row = GROUND_ROW) {
    for (let cx = from; cx < to; cx++) for (let cy = row; cy < ROWS; cy++) this.level.set(cx, cy, T_SOLID);
    return this;
  }
  // Degrau/elevação de chão
  hill(from, to, row) {
    return this.ground(from, to, row);
  }
  gap(from, to) {
    for (let cx = from; cx < to; cx++) for (let cy = 0; cy < ROWS; cy++) this.level.set(cx, cy, T_EMPTY);
    return this;
  }
  platform(cx, cy, len) {
    for (let i = 0; i < len; i++) this.level.set(cx + i, cy, T_ONEWAY);
    return this;
  }
  block(cx, cy, w = 1, h = 1) {
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) this.level.set(cx + x, cy + y, T_BLOCK);
    return this;
  }
  // Coloca algo "em pé" sobre o tile (cx, cy é o tile onde o pé encosta; padrão = chão).
  spawn(type, cx, cy = GROUND_ROW, extra = {}) {
    this.level.spawns.push({ type, x: cx * TILE + TILE / 2, y: cy * TILE, ...extra });
    return this;
  }
  item(type, cx, cy = GROUND_ROW - 1) {
    return this.spawn(type, cx, cy + 1, { item: true });
  }
  checkpoint(cx) {
    this.level.checkpoints.push(cx * TILE);
    return this.spawn('flag', cx);
  }
  start(cx) {
    this.level.start = { x: cx * TILE, y: GROUND_ROW * TILE };
    return this;
  }
  arena(from, to) {
    this.level.arena = { x0: from * TILE, x1: to * TILE };
    return this;
  }
  done() {
    return this.level;
  }
}
