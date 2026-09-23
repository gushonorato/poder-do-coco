// Efeitos: partículas, textos flutuantes ("PUM!", "PLOFT!"), tremida de tela.
import { drawText } from './gfx/font.js';

export class FX {
  constructor() {
    this.parts = [];
    this.popups = [];
    this.shakeT = 0;
    this.shakeMag = 0;
  }
  clear() {
    this.parts.length = 0;
    this.popups.length = 0;
    this.shakeT = 0;
  }
  // Partícula de pixel colorido
  spark(x, y, color, opts = {}) {
    this.parts.push({
      x, y,
      vx: opts.vx ?? (Math.random() - 0.5) * 2,
      vy: opts.vy ?? -Math.random() * 2,
      g: opts.g ?? 0.12,
      life: opts.life ?? 30 + Math.random() * 20,
      max: opts.life ?? 40,
      size: opts.size ?? (Math.random() < 0.5 ? 1 : 2),
      color,
      img: opts.img || null,
      drag: opts.drag ?? 0.98,
    });
  }
  burst(x, y, colors, n = 10, speed = 2, opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.spark(x, y, colors[i % colors.length], { vx: Math.cos(a) * s, vy: Math.sin(a) * s - (opts.up ?? 0.8), ...opts });
    }
  }
  splat(x, y) {
    this.burst(x, y, ['#7a4a1e', '#5c3412', '#9a6230'], 8, 1.8, { g: 0.15, life: 24 });
  }
  poof(x, y) {
    this.burst(x, y, ['#ffffff', '#ffe98a', '#ffd23f', '#f7f7f7'], 14, 2.2, { g: 0.03, life: 26, drag: 0.92 });
  }
  confetti(x, y, n = 40) {
    const cols = ['#ff4d6d', '#ffd23f', '#3ec1d3', '#7bd389', '#b77dff', '#ff9f1c'];
    for (let i = 0; i < n; i++) {
      this.spark(x + (Math.random() - 0.5) * 20, y, cols[i % cols.length], {
        vx: (Math.random() - 0.5) * 4,
        vy: -2 - Math.random() * 3,
        g: 0.06,
        life: 80 + Math.random() * 60,
        size: 2,
        drag: 0.985,
      });
    }
  }
  // Nuvem de pum: bolinhas verdes translúcidas que crescem e somem.
  puff(x, y, dir = 1, n = 5) {
    for (let i = 0; i < n; i++) {
      this.parts.push({
        x: x + (Math.random() - 0.5) * 4,
        y: y + (Math.random() - 0.5) * 4,
        vx: dir * (0.25 + Math.random() * 0.6),
        vy: -0.15 - Math.random() * 0.3,
        g: -0.005,
        life: 26 + Math.random() * 14,
        max: 40,
        size: 2,
        grow: 0.12 + Math.random() * 0.1,
        r: 2 + Math.random() * 2,
        color: Math.random() < 0.5 ? '#b8f5a0' : '#9be07f',
        drag: 0.93,
        puff: true,
      });
    }
  }
  sprite(x, y, img, opts = {}) {
    this.spark(x, y, null, { ...opts, img });
  }
  popup(x, y, text, color = '#ffffff', opts = {}) {
    this.popups.push({ x, y, text, color, life: opts.life ?? 50, max: opts.life ?? 50, scale: opts.scale ?? 1, vy: opts.vy ?? -0.5 });
  }
  shake(mag = 2, t = 12) {
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeT = Math.max(this.shakeT, t);
  }
  shakeOffset() {
    if (this.shakeT <= 0) return { x: 0, y: 0 };
    const m = this.shakeMag * (this.shakeT / 12);
    return { x: Math.round((Math.random() - 0.5) * 2 * m), y: Math.round((Math.random() - 0.5) * 2 * m) };
  }
  update() {
    for (const p of this.parts) {
      p.vy += p.g;
      p.vx *= p.drag;
      p.x += p.vx;
      p.y += p.vy;
      if (p.puff) p.r += p.grow;
      p.life--;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const t of this.popups) {
      t.y += t.vy;
      t.vy *= 0.95;
      t.life--;
    }
    this.popups = this.popups.filter((t) => t.life > 0);
    if (this.shakeT > 0) this.shakeT--;
    else this.shakeMag = 0;
  }
  draw(ctx, camX, camY) {
    for (const p of this.parts) {
      const x = Math.round(p.x - camX);
      const y = Math.round(p.y - camY);
      if (p.puff) {
        ctx.globalAlpha = Math.min(0.75, p.life / 30);
        ctx.fillStyle = p.color;
        const r = Math.round(p.r);
        ctx.fillRect(x - r, y - r + 1, r * 2, r * 2 - 2);
        ctx.fillRect(x - r + 1, y - r, r * 2 - 2, r * 2);
        ctx.globalAlpha = 1;
      } else if (p.img) {
        if (p.life < 10 && p.life % 2) continue;
        ctx.drawImage(p.img, x - (p.img.width >> 1), y - (p.img.height >> 1));
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(x, y, p.size, p.size);
      }
    }
    for (const t of this.popups) {
      if (t.life < 12 && t.life % 2) continue;
      drawText(ctx, t.text, t.x - camX, t.y - camY, { color: t.color, align: 'center', outline: '#2a1a14', scale: t.scale });
    }
  }
}
