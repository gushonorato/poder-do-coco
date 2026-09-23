// Cocôs do Miguel, montinhos no chão e projéteis dos chefões.
import { ART } from '../art.js';
import { overlap, TILE } from '../world/level.js';
import { audio } from '../audio.js';

const POOP_G = 0.11;

export class Poop {
  constructor(x, y, dir, big, extraVx = 0) {
    this.big = big;
    const s = big ? 12 : 9;
    this.w = s;
    this.h = s;
    this.x = x - s / 2;
    this.y = y - s / 2;
    this.vx = dir * (big ? 3.3 : 3.0) + extraVx;
    this.vy = big ? -2.4 : -2.6;
    this.dir = dir;
    this.dmg = big ? 2 : 1;
    this.t = 0;
    this.dead = false;
  }
  // Ajusta a velocidade inicial para o arco passar pelo centro do alvo.
  // Se o arco bater em parede/bloco no caminho, tenta arcos mais altos.
  aimAt(target, jitter = 0, level = null) {
    const tx = target.x + target.w / 2 + (target.vx || 0) * 10;
    const ty = target.y + target.h * 0.5 + jitter * 10;
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    const dx = Math.abs(tx - cx);
    const first = Math.max(1.8, Math.min(3.2, dx / 22));
    for (const speed of [first, first * 0.8, first * 0.65, first * 0.5]) {
      const t = Math.max(6, dx / speed);
      const vy = Math.max(-4.2, Math.min(0.6, (ty - cy - 0.5 * POOP_G * t * t) / t));
      this.vx = this.dir * speed;
      this.vy = vy;
      if (!level || this.pathClear(level, t)) break;
    }
    this.aimed = true;
  }
  pathClear(level, steps) {
    let x = this.x + this.w / 2;
    let y = this.y + this.h / 2;
    let vy = this.vy;
    for (let i = 0; i < steps; i += 2) {
      vy += POOP_G * 2;
      x += this.vx * 2;
      y += vy * 2;
      if (level.isSolid(Math.floor(x / TILE), Math.floor(y / TILE))) return false;
    }
    return true;
  }
  update(world) {
    this.t++;
    if (!this.aimed) {
      // Ajuda de mira sutil para alvos que aparecem depois do disparo.
      const target = world.nearestEnemyAhead(this.x, this.dir, 150);
      if (target) {
        const ty = target.y + target.h * 0.55;
        const dy = ty - (this.y + this.h / 2);
        this.vy += Math.max(-0.08, Math.min(0.08, dy * 0.005));
      }
    }
    this.vy += POOP_G;
    this.x += this.vx;
    this.y += this.vy;
    if (this.t % 3 === 0) world.fx.spark(this.x + this.w / 2 - this.dir * 3, this.y + this.h / 2, this.big ? '#ffd23f' : '#8a5a2b', { vx: 0, vy: 0, g: 0, life: 10, size: 1 });
    // cheirinho (pontinhos verdes subindo)
    if (this.t % 5 === 0) world.fx.spark(this.x + this.w / 2 + (Math.random() - 0.5) * 4, this.y - 1, '#9be07f', { vx: Math.sin(this.t) * 0.3, vy: -0.5, g: 0, life: 14, size: 1 });

    // Acertou inimigo?
    for (const e of world.enemies) {
      if (e.dead || !e.hittable) continue;
      if (overlap(this, e.hitbox ? e.hitbox() : e)) {
        e.hit(this.dmg, this.dir, world);
        world.fx.splat(this.x + this.w / 2, this.y + this.h / 2);
        world.fx.popup(this.x + this.w / 2, this.y - 4, Math.random() < 0.5 ? 'PLOFT!' : 'SPLAT!', '#ffe08a');
        audio.sfx('splat');
        this.dead = true;
        return;
      }
    }
    // Acertou projétil inimigo? Os dois somem.
    for (const h of world.hazards) {
      if (h.dead || !h.shootable) continue;
      if (overlap(this, h)) {
        h.dead = true;
        this.dead = true;
        world.fx.poof(h.x + h.w / 2, h.y + h.h / 2);
        world.fx.popup(h.x + h.w / 2, h.y - 4, 'PLOFT!', '#ffe08a', { life: 30 });
        audio.sfx('splat');
        return;
      }
    }
    // Chão/parede
    const cx = Math.floor((this.x + this.w / 2) / TILE);
    const cyBottom = Math.floor((this.y + this.h) / TILE);
    const t = world.level.get(cx, cyBottom);
    if (this.vy > 0 && t !== 0) {
      const groundY = cyBottom * TILE;
      world.addPile(this.x + this.w / 2, groundY, this.big);
      world.fx.splat(this.x + this.w / 2, groundY - 2);
      audio.sfx('plop');
      this.dead = true;
      return;
    }
    if (world.level.isSolid(Math.floor((this.x + (this.dir > 0 ? this.w : 0)) / TILE), Math.floor((this.y + this.h / 2) / TILE))) {
      world.fx.splat(this.x + this.w / 2, this.y + this.h / 2);
      audio.sfx('plop');
      this.dead = true;
      return;
    }
    if (this.x < world.camX - 40 || this.x > world.camX + world.viewW + 40 || this.y > world.level.height + 20) this.dead = true;
  }
  draw(ctx, camX, camY) {
    const frames = this.big ? ART.item.poopBig : ART.item.poop;
    const img = frames[(this.t >> 2) % frames.length];
    ctx.drawImage(img, Math.round(this.x + this.w / 2 - img.width / 2 - camX), Math.round(this.y + this.h / 2 - img.height / 2 - camY));
  }
}

// Montinho de cocô no chão: fica um tempinho e derruba inimigos que andam por cima.
export class PoopPile {
  constructor(x, groundY, big) {
    this.w = big ? 16 : 12;
    this.h = 6;
    this.x = x - this.w / 2;
    this.y = groundY - this.h;
    this.life = 170;
    this.t = 0;
    this.dead = false;
  }
  update(world) {
    this.t++;
    if (--this.life <= 0) this.dead = true;
    for (const e of world.enemies) {
      if (e.dead || !e.hittable || e.flying || e.isBoss) continue;
      if (overlap(this, e)) {
        e.hit(1, Math.sign(e.vx) || 1, world);
        world.fx.popup(this.x + this.w / 2, this.y - 8, 'ESCORREGOU!', '#ffe08a');
        world.fx.splat(this.x + this.w / 2, this.y);
        audio.sfx('splat');
        this.dead = true;
        return;
      }
    }
  }
  draw(ctx, camX, camY) {
    if (this.life < 30 && this.life % 4 < 2) return;
    const img = ART.item.poopPile[0];
    const x = Math.round(this.x + this.w / 2 - img.width / 2 - camX);
    const y = Math.round(this.y + this.h - img.height - camY);
    ctx.drawImage(img, x, y);
    // mosquinhas
    ctx.fillStyle = '#2a1a14';
    for (let i = 0; i < 2; i++) {
      const a = this.t * 0.2 + i * 3;
      ctx.fillRect(Math.round(x + img.width / 2 + Math.cos(a) * 5), Math.round(y - 3 + Math.sin(a * 1.7) * 2), 1, 1);
    }
  }
}

// Comida que prende o intestino, arremessada pelos chefões (arco). Dá para destruir com cocô.
export const JUNK_NAMES = { soda: 'REFRIGERANTE', pizza: 'PIZZA', burger: 'HAMBÚRGUER', fries: 'BATATA FRITA', chocolate: 'CHOCOLATE', candy: 'BALA' };

export class JunkFood {
  constructor(type, x, y, vx, vy) {
    this.type = type;
    this.w = 13;
    this.h = 13;
    this.x = x - 6;
    this.y = y - 6;
    this.vx = vx;
    this.vy = vy;
    this.dead = false;
    this.shootable = true;
    this.junk = true;
    this.t = 0;
  }
  update(world) {
    this.t++;
    this.vy += 0.12;
    this.x += this.vx;
    this.y += this.vy;
    const gy = world.level.groundBelow(this.x + this.w / 2, this.y);
    if (gy != null && this.y + this.h >= gy) {
      world.fx.burst(this.x + 5, gy - 1, ['#ff4d6d', '#ffd23f', '#8a5a2b'], 6, 1.2, { life: 18 });
      this.dead = true;
    }
    if (this.t > 400) this.dead = true;
  }
  draw(ctx, camX, camY) {
    const frames = ART.junk[this.type];
    const img = frames[(this.t >> 3) % frames.length];
    ctx.drawImage(img, Math.round(this.x + this.w / 2 - img.width / 2 - camX), Math.round(this.y + this.h / 2 - img.height / 2 - camY));
  }
}

// Besteira que cai do céu (Constipador), com aviso de sombra antes.
export class FallingJunk {
  constructor(type, x, groundY, delay = 50) {
    this.type = type;
    this.junk = true;
    this.w = 10;
    this.h = 10;
    this.x = x - 5;
    this.groundY = groundY;
    this.y = -20;
    this.vy = 0;
    this.delay = delay;
    this.dead = false;
    this.shootable = true;
    this.t = 0;
  }
  get active() {
    return this.delay <= 0;
  }
  update(world) {
    this.t++;
    if (this.delay > 0) {
      this.delay--;
      this.y = world.camY - 16;
      return;
    }
    this.vy = Math.min(this.vy + 0.18, 4.5);
    this.y += this.vy;
    if (this.y + this.h >= this.groundY) {
      world.fx.burst(this.x + 5, this.groundY - 2, ['#ff4d6d', '#ffd23f', '#8a5a2b'], 8, 1.6, { life: 20 });
      world.fx.shake(1.5, 6);
      audio.sfx('stomp', { vol: 0.5 });
      this.dead = true;
    }
  }
  draw(ctx, camX, camY) {
    // Sombra de aviso crescendo no chão
    const warn = this.delay > 0 ? 1 - this.delay / 50 : 1;
    const sw = Math.round(4 + warn * 8);
    ctx.fillStyle = 'rgba(40,20,60,0.45)';
    ctx.fillRect(Math.round(this.x + 5 - sw / 2 - camX), Math.round(this.groundY - 2 - camY), sw, 2);
    if (this.delay > 0 && (this.delay >> 2) % 2 === 0) {
      ctx.fillStyle = '#ff4d6d';
      ctx.fillRect(Math.round(this.x + 4 - camX), Math.round(this.groundY - 12 - camY), 2, 6);
      ctx.fillRect(Math.round(this.x + 4 - camX), Math.round(this.groundY - 5 - camY), 2, 2);
    }
    if (this.delay <= 0) {
      const frames = ART.junk[this.type];
      const img = frames[(this.t >> 3) % frames.length];
      ctx.drawImage(img, Math.round(this.x + 5 - img.width / 2 - camX), Math.round(this.y + 5 - img.height / 2 - camY));
    }
  }
}
