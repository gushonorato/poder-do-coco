// Itens (frutas, água, brócolis), bandeiras de checkpoint, gaiolas e o Simba ajudante.
import { ART, frameOf } from '../art.js';
import { overlap, moveAndCollide, GROUND_ROW, TILE } from '../world/level.js';
import { audio } from '../audio.js';
import { drawCage } from '../gfx/cage.js';

export class Pickup {
  constructor(type, x, bottomY) {
    this.type = type;
    const img = ART.item[type][0];
    this.w = img.width;
    this.h = img.height;
    this.x = x - this.w / 2;
    this.baseY = bottomY - this.h - 2;
    this.y = this.baseY;
    this.t = Math.random() * 100;
    this.dead = false;
    this.vy = 0;
    this.falling = false;
  }
  update(world) {
    this.t++;
    if (this.falling) {
      // itens que caem de inimigos
      this.vy = Math.min(this.vy + 0.2, 4);
      this.y += this.vy;
      const gy = world.level.groundBelow(this.x + this.w / 2, this.y);
      if (gy != null && this.y + this.h >= gy) {
        this.y = gy - this.h;
        this.baseY = this.y - 2;
        this.falling = false;
      }
    } else this.y = this.baseY + Math.round(Math.sin(this.t * 0.08) * 2);
    const p = world.player;
    if (!p.dying && overlap(this, { x: p.x - 2, y: p.y, w: p.w + 4, h: p.h })) {
      this.dead = true;
      world.collect(this);
    }
  }
  draw(ctx, camX, camY) {
    const img = ART.item[this.type][0];
    ctx.drawImage(img, Math.round(this.x - camX), Math.round(this.y - camY));
    if (this.type === 'broccoli' && (this.t >> 3) % 3 === 0) {
      ctx.fillStyle = '#fff6a0';
      ctx.fillRect(Math.round(this.x - 2 - camX), Math.round(this.y + 1 - camY), 1, 1);
      ctx.fillRect(Math.round(this.x + this.w + 1 - camX), Math.round(this.y + 5 - camY), 1, 1);
    }
  }
}

export class Flag {
  constructor(x, groundY) {
    this.x = x - 4;
    this.y = groundY - 44;
    this.w = 8;
    this.h = 44;
    this.groundY = groundY;
    this.active = false;
    this.t = 0;
    this.dead = false;
    this.rise = 0;
  }
  update(world) {
    this.t++;
    if (!this.active && world.player.x > this.x - 4) {
      this.active = true;
      world.reachCheckpoint(this);
    }
    if (this.active && this.rise < 1) this.rise = Math.min(1, this.rise + 0.04);
  }
  draw(ctx, camX, camY) {
    const img = ART.item.flag[0];
    const x = Math.round(this.x - camX);
    const gy = Math.round(this.groundY - camY);
    if (this.active) {
      // bandeira hasteada (sobe devagar)
      const drop = Math.round((1 - this.rise) * (img.height - 16));
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - 40, gy - img.height, 120, img.height);
      ctx.clip();
      ctx.drawImage(img, x, gy - img.height + drop);
      ctx.restore();
    } else {
      // só o mastro, esperando o Miguel passar
      ctx.fillStyle = '#2a1a14';
      ctx.fillRect(x + 1, gy - 42, 4, 42);
      ctx.fillStyle = '#c8c8d4';
      ctx.fillRect(x + 2, gy - 41, 2, 41);
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(x + 1, gy - 45, 4, 3);
    }
  }
}

// Simba ou Hérica presos na gaiola.
export class Captive {
  constructor(who, x, groundY) {
    this.who = who; // 'simba' | 'herica'
    this.x = x;
    this.groundY = groundY;
    this.caged = true;
    this.t = 0;
    this.dead = false;
    this.bubble = 0;
  }
  update(world) {
    this.t++;
    if (this.caged && this.t % 170 === 60) {
      this.bubble = 70;
      if (this.who === 'simba') audio.sfx('bark', { vol: 0.6 });
    }
    if (this.bubble > 0) this.bubble--;
  }
  draw(ctx, camX, camY) {
    const cx = Math.round(this.x - camX);
    const gy = Math.round(this.groundY - camY);
    if (!this.caged) return;
    if (this.who === 'simba') {
      const set = this.bubble > 40 ? ART.simba.sets.bark : ART.simba.sets.sad;
      const img = frameOf(set, -1, this.t >> 4);
      ctx.drawImage(img, cx - (img.width >> 1), gy - img.height - 4);
      drawCage(ctx, cx, gy, 46, 44);
    } else {
      const img = frameOf(ART.herica.sets.scared, -1, this.t >> 5);
      ctx.drawImage(img, cx - (img.width >> 1), gy - img.height - 4);
      drawCage(ctx, cx, gy, 40, 66);
    }
  }
}

// Personagem que segue o Miguel (Simba na fase 2, e os dois no final).
export class Follower {
  constructor(who, x, groundY) {
    this.who = who;
    const img = who === 'simba' ? ART.simba.sets.idle.right[0] : ART.herica.sets.idle.right[0];
    this.w = who === 'simba' ? 24 : 14;
    this.h = who === 'simba' ? 26 : 50;
    this.imgH = img.height;
    this.x = x - this.w / 2;
    this.y = groundY - this.h;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.onGround = false;
    this.t = 0;
    this.dead = false;
    this.offset = who === 'simba' ? -32 : -50;
    this.target = null; // alvo fixo (cenas)
    this.pose = null;
    this.barkT = 0;
  }
  update(world) {
    this.t++;
    const p = world.player;
    const tx = this.target != null ? this.target : p.x + p.w / 2 + p.facing * this.offset - this.w / 2;
    const dx = tx - this.x;
    const speed = this.who === 'simba' ? 1.6 : 1.3;
    if (Math.abs(dx) > 6) {
      this.vx += (Math.sign(dx) * speed - this.vx) * 0.15;
      this.facing = Math.sign(dx);
    } else {
      this.vx *= 0.7;
      if (this.target == null) this.facing = p.x > this.x ? 1 : -1;
    }
    // pula junto se o Miguel estiver mais alto ou se bater numa parede
    this.vy = Math.min(this.vy + 0.26, 5);
    const r = moveAndCollide(world.level, this, { dropThrough: false });
    if (r.onGround) {
      this.onGround = true;
      if ((r.hitWall || p.y + p.h < this.y + this.h - 20) && Math.abs(dx) > 10) this.vy = -5.2;
    } else this.onGround = false;
    if (r.hitWall && this.onGround) this.vy = -5.2;
    // se ficou muito para trás, aparece perto
    if (Math.abs(dx) > 260) {
      this.x = p.x - p.facing * 30;
      this.y = p.y + p.h - this.h - 30;
      this.vy = 0;
    }
    // Simba late quando tem monstro perto
    if (this.who === 'simba' && this.barkT-- <= 0) {
      const near = world.enemies.find((e) => !e.dead && e.active && Math.abs(e.x - this.x) < 90);
      if (near) {
        audio.sfx('bark', { vol: 0.35 });
        world.fx.popup(this.x + this.w / 2, this.y - 6, 'AU!', '#ffe08a', { life: 30 });
        this.barkT = 200 + Math.random() * 200;
      } else this.barkT = 30;
    }
  }
  draw(ctx, camX, camY) {
    let set;
    let frame = Math.floor(this.t / 5);
    if (this.who === 'simba') {
      set = !this.onGround ? ART.simba.sets.jump : Math.abs(this.vx) > 0.3 ? ART.simba.sets.run : this.barkT > 170 ? ART.simba.sets.bark : ART.simba.sets.idle;
      if (set === ART.simba.sets.run) frame = Math.floor(this.t / 4);
      else if (set !== ART.simba.sets.bark) frame = this.t >> 5;
    } else {
      set = this.pose === 'cheer' ? ART.herica.sets.cheer : Math.abs(this.vx) > 0.3 ? ART.herica.sets.walk : ART.herica.sets.idle;
      frame = this.pose === 'cheer' ? this.t >> 5 : Math.floor(this.t / 5);
    }
    const img = frameOf(set, this.facing, frame);
    const x = Math.round(this.x + this.w / 2 - img.width / 2 - camX);
    const y = Math.round(this.y + this.h - img.height - camY);
    ctx.drawImage(img, x, y);
  }
}

export const GROUND_Y = GROUND_ROW * TILE;
