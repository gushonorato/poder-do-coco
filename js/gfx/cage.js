// Gaiola desenhada em pixels, do tamanho que for preciso (Simba ou Hérica).
// Desenhe o personagem ANTES e a gaiola por cima.
export function drawCage(ctx, cx, bottomY, w, h, spacing = 7) {
  const x = Math.round(cx - w / 2);
  const y = Math.round(bottomY - h);
  const ink = '#2a1a14';
  const bar = '#8d8d99';
  const hi = '#d0d0dc';
  // teto arredondado e base
  ctx.fillStyle = ink;
  ctx.fillRect(x + 2, y, w - 4, 1);
  ctx.fillRect(x, y + 1, w, 4);
  ctx.fillRect(x - 1, bottomY - 5, w + 2, 5);
  ctx.fillStyle = bar;
  ctx.fillRect(x + 1, y + 2, w - 2, 2);
  ctx.fillRect(x, bottomY - 4, w, 3);
  ctx.fillStyle = hi;
  ctx.fillRect(x + 2, y + 2, w - 4, 1);
  ctx.fillRect(x + 1, bottomY - 4, w - 2, 1);
  // argola
  ctx.fillStyle = ink;
  ctx.fillRect(Math.round(cx) - 3, y - 4, 6, 4);
  ctx.fillStyle = bar;
  ctx.fillRect(Math.round(cx) - 2, y - 3, 4, 2);
  // barras
  const n = Math.max(3, Math.round(w / spacing));
  for (let i = 0; i <= n; i++) {
    const bx = Math.round(x + (i * (w - 3)) / n);
    ctx.fillStyle = ink;
    ctx.fillRect(bx, y + 5, 3, h - 10);
    ctx.fillStyle = bar;
    ctx.fillRect(bx + 1, y + 5, 1, h - 10);
    ctx.fillStyle = hi;
    ctx.fillRect(bx + 1, y + 6, 1, 3);
  }
  // cadeado
  const lx = Math.round(cx) - 4;
  const ly = Math.round(y + h * 0.55);
  ctx.fillStyle = ink;
  ctx.fillRect(lx + 1, ly - 4, 7, 5);
  ctx.fillRect(lx, ly, 9, 8);
  ctx.fillStyle = '#b8b8c4';
  ctx.fillRect(lx + 2, ly - 3, 5, 3);
  ctx.fillStyle = ink;
  ctx.fillRect(lx + 3, ly - 2, 3, 2);
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(lx + 1, ly + 1, 7, 6);
  ctx.fillStyle = '#fff29a';
  ctx.fillRect(lx + 1, ly + 1, 7, 1);
  ctx.fillStyle = ink;
  ctx.fillRect(lx + 4, ly + 3, 1, 3);
}
