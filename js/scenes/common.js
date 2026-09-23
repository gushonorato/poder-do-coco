// Utilidades compartilhadas pelas cenas.
import { ART, frameOf } from '../art.js';
import { LIFT } from '../gfx/hd.js';

// As cenas desenham o "mundo" (cenário, chão, personagens) num espaço de 180 px
// de altura; a tela mostra 135. beginWorld sobe tudo para o chão ficar embaixo.
export const SCREEN_GROUND = 148; // y do chão no espaço de desenho (topo da grama)
export const GROUND_ON_SCREEN = SCREEN_GROUND - LIFT;
export function beginWorld(ctx) {
  ctx.save();
  ctx.translate(0, -LIFT);
}
export function endWorld(ctx) {
  ctx.restore();
}

export function drawGroundStrip(ctx, tiles, viewW, offset = 0) {
  const o = ((Math.round(offset) % 16) + 16) % 16;
  for (let x = -o; x < viewW; x += 16) {
    ctx.drawImage(tiles.top, x, SCREEN_GROUND);
    ctx.drawImage(tiles.fill, x, SCREEN_GROUND + 16);
  }
}

// Desenha um facingSet ancorado pelos pés em (x, chão).
export function drawFeet(ctx, set, facing, frame, x, groundY = SCREEN_GROUND, white = false) {
  const img = frameOf(set, facing, frame, white);
  ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(groundY - img.height));
  return img;
}

// Desenha um canvas ampliado (inteiro) centralizado em (cx, cy).
export function drawScaled(ctx, img, cx, cy, scale) {
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
}

// Balão de fala simples.
export function drawBubble(ctx, text, x, y, drawText) {
  const w = text.length * 6 + 8;
  const bx = Math.round(x - w / 2);
  const by = Math.round(y - 16);
  ctx.fillStyle = '#2a1a14';
  ctx.fillRect(bx - 1, by - 1, w + 2, 15);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(bx, by, w, 13);
  ctx.fillRect(Math.round(x) - 2, by + 13, 4, 2);
  ctx.fillRect(Math.round(x) - 1, by + 15, 2, 2);
  drawText(ctx, text, x, by + 3, { align: 'center', color: '#2a1a14' });
}

export function heart() {
  return ART.item.heart[0];
}
