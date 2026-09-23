// Monstrinhos do exército do Constipador.
import { ART, frameOf } from '../art.js';
import { moveAndCollide, TILE, T_EMPTY } from '../world/level.js';
import { audio } from '../audio.js';

export class Enemy {
  constructor(x, groundY, w, h) {
    this.w = w;
    this.h = h;
    this.x = x - w / 2;
    this.y = groundY - h;
    this.vx = 0;
    this.vy = 0;
    this.hp = 1;
    this.facing = -1;
    this.flash = 0;
    this.t = Math.floor(Math.random() * 60);
    this.dead = false;
    this.active = false;
    this.hittable = true;
    this.flying = false;
    this.onGround = false;
    this.contactDamage = true;
  }
  // Ativa quando chega perto da tela, para não sair andando antes de ser visto.
  checkActive(world) {
    if (!this.active && this.x < world.camX + world.viewW + 24 && this.x + this.w > world.camX - 24) this.active = true;
  }
  hit(dmg, dir, world) {
    this.hp -= dmg;
    this.flash = 8;
    this.vx += dir * 0.8;
    if (this.hp <= 0) this.die(world);
    else audio.sfx('bossHit', { pitch: 1.6, vol: 0.5 });
  }
  die(world) {
    this.dead = true;
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    world.fx.poof(cx, cy);
    for (let i = 0; i < 4; i++)
      world.fx.sprite(cx, cy, ART.item.star[0], { vx: (Math.random() - 0.5) * 3, vy: -1.5 - Math.random() * 1.5, g: 0.1, life: 36 });
    audio.sfx('enemyDie');
    world.onEnemyKilled(this);
  }
  gravity() {
    this.vy = Math.min(this.vy + 0.25, 5);
  }
  drawSprite(ctx, camX, camY, set, frame, bob = 0) {
    const white = this.flash > 0 && this.flash % 3 === 0;
    const img = frameOf(set, this.facing, frame);
    const x = Math.round(this.x + this.w / 2 - img.width / 2 - camX);
    const y = Math.round(this.y + this.h - img.height - camY + bob);
    ctx.drawImage(img, x, y);
    if (white) {
      ctx.globalAlpha = 0.6;
      ctx.drawImage(frameOf(set, this.facing, frame, true), x, y);
      ctx.globalAlpha = 1;
    }
  }
  update(world) {
    this.checkActive(world);
    if (!this.active) return;
    this.t++;
    if (this.flash > 0) this.flash--;
    this.think(world);
    if (this.y > world.level.height + 40) this.dead = true;
  }
  think() {}
}

// Lata de refrigerante: anda devagar e vira nas paredes e beiradas.
export class Refri extends Enemy {
  constructor(x, gy) {
    super(x, gy, 14, 22);
    this.speed = 0.38;
  }
  think(world) {
    this.vx += (this.facing * this.speed - this.vx) * 0.2;
    this.gravity();
    const r = moveAndCollide(world.level, this);
    this.onGround = r.onGround;
    if (r.hitWall) this.facing *= -1;
    if (this.onGround) {
      const aheadX = this.facing > 0 ? this.x + this.w + 1 : this.x - 1;
      const below = world.level.get(Math.floor(aheadX / TILE), Math.floor((this.y + this.h + 1) / TILE));
      if (below === T_EMPTY) this.facing *= -1;
    }
  }
  draw(ctx, camX, camY) {
    // passinho: sobe 1px entre os quadros
    this.drawSprite(ctx, camX, camY, ART.enemy.refri.walk, this.t >> 3, (this.t >> 2) % 2 ? -1 : 0);
  }
}

// Cookie: pula na direção do Miguel de tempos em tempos.
export class Cookie extends Enemy {
  constructor(x, gy) {
    super(x, gy, 18, 16);
    this.hp = 2;
    this.wait = 60 + Math.random() * 40;
  }
  think(world) {
    const p = world.player;
    this.gravity();
    if (this.onGround) {
      this.vx *= 0.8;
      this.facing = p.x + p.w / 2 < this.x + this.w / 2 ? -1 : 1;
      if (--this.wait <= 0) {
        const dist = Math.abs(p.x - this.x);
        if (dist < 170) {
          this.vy = -3.3;
          this.vx = this.facing * 0.9;
        }
        this.wait = 75 + Math.random() * 45;
      }
    }
    const r = moveAndCollide(world.level, this);
    this.onGround = r.onGround;
  }
  draw(ctx, camX, camY) {
    const set = this.onGround ? ART.enemy.cookie.idle : ART.enemy.cookie.jump;
    // treme antes de pular
    const shake = this.onGround && this.wait < 18 ? (this.t % 4 < 2 ? -1 : 0) : 0;
    this.drawSprite(ctx, camX, camY, set, 0, shake);
  }
}

// Salgadinho voador: flutua em onda e às vezes dá um rasante baixinho.
export class Salgadinho extends Enemy {
  constructor(x, gy, flyHeight = 56) {
    super(x, gy, 18, 18);
    this.flying = true;
    this.baseY = gy - Math.min(flyHeight, 58);
    this.y = this.baseY;
    this.groundY = gy;
    this.swoop = 0;
    this.swoopCd = 120 + Math.random() * 80;
  }
  think(world) {
    const p = world.player;
    const dx = p.x + p.w / 2 - (this.x + this.w / 2);
    this.facing = dx < 0 ? -1 : 1;
    if (Math.abs(dx) > 30) this.vx += (Math.sign(dx) * 0.32 - this.vx) * 0.03;
    else this.vx *= 0.97;
    let targetY = this.baseY + Math.sin(this.t * 0.05) * 7;
    if (this.swoop > 0) {
      this.swoop--;
      const k = Math.sin((1 - this.swoop / 110) * Math.PI);
      targetY = this.baseY + (this.groundY - 34 - this.baseY) * k;
    } else if (--this.swoopCd <= 0 && Math.abs(dx) < 110) {
      this.swoop = 110;
      this.swoopCd = 170 + Math.random() * 90;
    }
    this.y += (targetY - this.y) * 0.08;
    this.x += this.vx;
  }
  draw(ctx, camX, camY) {
    this.drawSprite(ctx, camX, camY, ART.enemy.salgadinho.fly, this.t >> 2);
  }
}

// Pizza: rola como uma roda atrás do Miguel.
export class Pizza extends Enemy {
  constructor(x, gy, dir = -1) {
    super(x, gy, 18, 18);
    this.facing = dir;
    this.speed = 0.8;
  }
  think(world) {
    const p = world.player;
    if (this.onGround && Math.abs(p.x - this.x) > 8) this.facing = p.x < this.x ? -1 : 1;
    this.vx += (this.facing * this.speed - this.vx) * 0.05;
    this.gravity();
    const r = moveAndCollide(world.level, this);
    this.onGround = r.onGround;
    if (r.hitWall) {
      this.facing *= -1;
      this.vx = this.facing * 0.5;
    }
  }
  draw(ctx, camX, camY) {
    this.drawSprite(ctx, camX, camY, ART.enemy.pizza.roll, this.t >> 3);
  }
}

export function createEnemy(spawn) {
  switch (spawn.type) {
    case 'refri': return new Refri(spawn.x, spawn.y);
    case 'cookie': return new Cookie(spawn.x, spawn.y);
    case 'salgadinho': return new Salgadinho(spawn.x, spawn.y, spawn.fly);
    case 'pizza': return new Pizza(spawn.x, spawn.y);
    default: return null;
  }
}
