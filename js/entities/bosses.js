// Chefões: General Rolha (fase 1) e Constipador (fase 2).
// Ataques lentos e bem avisados — pensado para uma criança de 5 anos.
import { ART, frameOf } from '../art.js';
import { moveAndCollide, GROUND_ROW, TILE } from '../world/level.js';
import { audio } from '../audio.js';
import { cloneHD, markHD } from '../gfx/hd.js';
import { JunkFood, FallingJunk } from './projectiles.js';

const ROLHA_FOODS = ['soda', 'pizza', 'fries', 'burger'];
const CONSTIPADOR_FOODS = ['chocolate', 'burger', 'soda', 'candy', 'pizza'];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
import { Refri, Pizza, Salgadinho } from './enemies.js';

const GROUND_Y = GROUND_ROW * TILE;

class Boss {
  constructor(x, name, maxHp) {
    this.isBoss = true;
    this.name = name;
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.facing = -1;
    this.flash = 0;
    this.hurtT = 0;
    this.t = 0;
    this.stateT = 0;
    this.state = 'wait';
    this.dead = false;
    this.defeated = false;
    this.hittable = false;
    this.contactDamage = false;
    this.flying = false;
    this.vx = 0;
    this.vy = 0;
    this.homeX = x;
    this.shakeX = 0;
  }
  get phase2() {
    return this.hp <= this.maxHp / 2;
  }
  setState(s) {
    this.state = s;
    this.stateT = 0;
  }
  hit(dmg, dir, world) {
    if (!this.hittable) return;
    this.hp = Math.max(0, this.hp - dmg);
    this.flash = 6;
    this.hurtT = 10;
    audio.sfx('bossHit');
    if (this.hp <= 0) {
      this.hittable = false;
      this.contactDamage = false;
      this.setState('dying');
      world.onBossDying(this);
    }
  }
  // Terminou o discurso do vilão: começa a luta.
  endTaunt() {
    if (this.state !== 'taunt') return;
    if (this.flying) {
      this.hittable = true;
      this.contactDamage = true;
      this.setState('hover');
    } else this.setState('roar');
  }
  // O Miguel encosta na caixa de dano do chefão.
  hitbox() {
    return this;
  }
  facePlayer(world) {
    const p = world.player;
    this.facing = p.x + p.w / 2 < this.x + this.w / 2 ? -1 : 1;
  }
  arenaClamp(world) {
    const a = world.level.arena;
    if (this.x < a.x0 + 4) { this.x = a.x0 + 4; this.vx = Math.abs(this.vx) * 0.5; }
    if (this.x + this.w > a.x1 - 4) { this.x = a.x1 - 4 - this.w; this.vx = -Math.abs(this.vx) * 0.5; }
  }
  dyingUpdate(world) {
    this.shakeX = (Math.random() - 0.5) * 4;
    if (this.stateT % 6 === 0) {
      const px = this.x + Math.random() * this.w;
      const py = this.y + Math.random() * this.h;
      world.fx.poof(px, py);
      world.fx.splat(px, py);
      audio.sfx('enemyDie', { pitch: 0.7 + Math.random() * 0.6 });
    }
    if (this.stateT === 1) {
      audio.sfx('bossDie');
      world.fx.shake(3, 90);
    }
  }
  drawImg(ctx, camX, camY, img) {
    const white = this.flash > 0 && this.flash % 3 === 0;
    const x = Math.round(this.x + this.w / 2 - img.width / 2 - camX + this.shakeX);
    const y = Math.round(this.y + this.h - img.height - camY + (this.drawOffsetY || 0));
    ctx.drawImage(img, x, y);
    if (white) {
      ctx.globalAlpha = 0.55;
      ctx.drawImage(whiteOf(img), x, y);
      ctx.globalAlpha = 1;
    }
  }
}

const whiteCache = new WeakMap();
function whiteOf(img) {
  let w = whiteCache.get(img);
  if (!w) {
    const { canvas, ctx } = cloneHD(img);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    w = img.__s ? markHD(canvas, img.__s) : canvas;
    whiteCache.set(img, w);
  }
  return w;
}

// ------------------------------------------------------------------ GENERAL ROLHA
export class GeneralRolha extends Boss {
  constructor(x) {
    super(x, 'GENERAL ROLHA', 30);
    this.w = 42;
    this.h = 66;
    this.x = x - this.w / 2;
    this.y = -80;
    this.nextAttack = 0;
    this.drawOffsetY = 0;
  }
  start() {
    this.setState('intro');
    this.y = -60;
    this.vy = 0;
  }
  update(world) {
    this.t++;
    this.stateT++;
    if (this.flash > 0) this.flash--;
    if (this.hurtT > 0) this.hurtT--;
    this.shakeX = 0;
    const L = world.level;
    const onGround = () => this.y + this.h >= GROUND_Y - 0.5;

    switch (this.state) {
      case 'wait':
        return;
      case 'intro': {
        this.vy = Math.min(this.vy + 0.3, 7);
        this.y += this.vy;
        if (this.y + this.h >= GROUND_Y) {
          this.y = GROUND_Y - this.h;
          this.vy = 0;
          world.fx.shake(4, 20);
          audio.sfx('stomp');
          world.fx.burst(this.x + this.w / 2, GROUND_Y - 2, ['#c9a36a', '#e8d2a8'], 16, 2.5);
          this.setState('taunt');
        }
        return;
      }
      case 'taunt':
        this.facePlayer(world);
        return;
      case 'roar':
        this.facePlayer(world);
        if (this.stateT === 1) audio.sfx('bossRoar');
        if (this.stateT > 40) {
          this.hittable = true;
          this.contactDamage = true;
          this.setState('walk');
        }
        return;
      case 'walk': {
        this.facePlayer(world);
        const sp = this.phase2 ? 0.6 : 0.45;
        this.vx = this.facing * sp;
        this.vy += 0.3;
        moveAndCollide(L, this);
        this.arenaClamp(world);
        if (this.stateT > (this.phase2 ? 80 : 110)) {
          this.nextAttack = (this.nextAttack + 1) % 2;
          this.setState(this.nextAttack === 1 ? 'throwPrep' : 'jumpPrep');
        }
        return;
      }
      case 'throwPrep':
        this.facePlayer(world);
        this.shakeX = this.stateT % 4 < 2 ? 1 : -1;
        if (this.stateT > 34) {
          const n = this.phase2 ? 3 : 2;
          for (let i = 0; i < n; i++) {
            const hx = this.x + this.w / 2 + this.facing * 22;
            world.hazards.push(new JunkFood(pick(ROLHA_FOODS), hx, this.y + 6, this.facing * (1.0 + i * 0.55), -3.2 - i * 0.35));
          }
          audio.sfx('throw');
          this.setState('throwRecover');
        }
        return;
      case 'throwRecover':
        if (this.stateT > 30) {
          if (this.phase2 && Math.random() < 0.5 && world.enemies.filter((e) => !e.dead && !e.isBoss).length < 2) {
            const r = new Refri(this.x + this.w / 2 - this.facing * 24, GROUND_Y);
            r.facing = this.facing;
            r.active = true;
            world.enemies.push(r);
          }
          this.setState('walk');
        }
        return;
      case 'jumpPrep':
        this.facePlayer(world);
        this.shakeX = (Math.random() - 0.5) * 2;
        if (this.stateT > 40) {
          const p = world.player;
          const dx = p.x + p.w / 2 - (this.x + this.w / 2);
          this.vx = Math.max(-2, Math.min(2, dx / 62));
          this.vy = -4.8;
          audio.sfx('jump', { pitch: 0.5 });
          this.setState('jump');
        }
        return;
      case 'jump': {
        this.vy = Math.min(this.vy + 0.18, 6);
        const r = moveAndCollide(L, this);
        this.arenaClamp(world);
        if (r.onGround || onGround()) {
          this.vx = 0;
          world.fx.shake(4, 16);
          audio.sfx('stomp');
          world.fx.burst(this.x + this.w / 2, GROUND_Y - 2, ['#c9a36a', '#e8d2a8'], 14, 2.2);
          world.hazards.push(new JunkFood(pick(ROLHA_FOODS), this.x, GROUND_Y - 8, -1.2, -2.6));
          world.hazards.push(new JunkFood(pick(ROLHA_FOODS), this.x + this.w, GROUND_Y - 8, 1.2, -2.6));
          this.setState('land');
        }
        return;
      }
      case 'land':
        if (this.stateT > 36) this.setState('walk');
        return;
      case 'dying':
        this.dyingUpdate(world);
        if (this.stateT > 100) {
          world.fx.confetti(this.x + this.w / 2, this.y + this.h / 2, 60);
          this.dead = true;
          this.defeated = true;
          world.onBossDefeated(this);
        }
        return;
    }
  }
  draw(ctx, camX, camY) {
    if (this.state === 'wait') return;
    const B = ART.boss.generalRolha;
    let set = B.idle;
    let frame = this.t >> 4;
    if (this.state === 'dying' || this.hurtT > 0) set = B.hurt;
    else if (this.state === 'jumpPrep' || this.state === 'land') set = B.squash;
    else if (this.state === 'jump' || this.state === 'intro') set = B.jump;
    else if (this.state === 'throwPrep') set = B.throw;
    else if (this.state === 'roar') set = this.stateT % 16 < 8 ? B.idle : B.squash;
    this.drawImg(ctx, camX, camY, frameOf(set, this.facing, frame));
  }
}

// ------------------------------------------------------------------ CONSTIPADOR
export class Constipador extends Boss {
  constructor(x) {
    super(x, 'CONSTIPADOR', 44);
    this.w = 56;
    this.h = 66;
    this.x = x - this.w / 2;
    this.y = -90;
    this.flying = true;
    this.hoverY = GROUND_Y - 30 - this.h; // parte de baixo fica 30px acima do chão
    this.attackIdx = 0;
    this.drawOffsetY = 8;
  }
  start() {
    this.setState('intro');
    this.y = -70;
  }
  update(world) {
    this.t++;
    this.stateT++;
    if (this.flash > 0) this.flash--;
    if (this.hurtT > 0) this.hurtT--;
    this.shakeX = 0;
    const p = world.player;
    const a = world.level.arena;

    switch (this.state) {
      case 'wait':
        return;
      case 'intro':
        this.y += (this.hoverY - this.y) * 0.04;
        if (this.stateT > 90) this.setState('taunt');
        return;
      case 'taunt':
        this.facePlayer(world);
        this.y += (this.hoverY + Math.sin(this.t * 0.04) * 4 - this.y) * 0.1;
        return;
      case 'hover': {
        this.facePlayer(world);
        // Segue o Miguel de longe, flutuando.
        const targetX = Math.max(a.x0 + 30, Math.min(a.x1 - 30 - this.w, p.x + p.w / 2 - this.w / 2 - this.facing * 50));
        this.vx += Math.sign(targetX - this.x) * 0.03;
        this.vx = Math.max(-0.7, Math.min(0.7, this.vx)) * 0.98;
        this.x += this.vx;
        this.y += (this.hoverY + Math.sin(this.t * 0.04) * 4 - this.y) * 0.1;
        this.arenaClamp(world);
        if (this.stateT > (this.phase2 ? 100 : 140)) {
          const order = ['rocks', 'minions', 'slamUp'];
          this.setState(order[this.attackIdx++ % order.length]);
        }
        return;
      }
      case 'rocks':
        if (this.stateT === 1) audio.sfx('laugh');
        if (this.stateT === 40) {
          const n = this.phase2 ? 5 : 3;
          const xs = [p.x + p.w / 2];
          for (let i = 1; i < n; i++) xs.push(a.x0 + 24 + Math.random() * (a.x1 - a.x0 - 48));
          xs.forEach((x, i) => world.hazards.push(new FallingJunk(pick(CONSTIPADOR_FOODS), x, GROUND_Y, 55 + i * 18)));
        }
        if (this.stateT > 90) this.setState('hover');
        return;
      case 'minions':
        this.facePlayer(world);
        if (this.stateT === 30) {
          const alive = world.enemies.filter((e) => !e.dead && !e.isBoss).length;
          if (alive < 3) {
            for (const d of [-1, 1]) {
              const pd = new Pizza(this.x + this.w / 2 + d * 26, this.y + this.h, d);
              pd.y = this.y + this.h - pd.h;
              pd.vx = d * 1.2;
              pd.active = true;
              world.enemies.push(pd);
            }
            if (this.phase2) {
              const s = new Salgadinho(this.x + this.w / 2, GROUND_Y, 64);
              s.y = this.y;
              s.active = true;
              world.enemies.push(s);
            }
            audio.sfx('throw');
          }
        }
        if (this.stateT > 70) this.setState('hover');
        return;
      case 'slamUp':
        this.y += (this.hoverY - 14 - this.y) * 0.08;
        this.x += (p.x + p.w / 2 - this.w / 2 - this.x) * 0.02;
        this.arenaClamp(world);
        if (this.stateT > 40) this.setState('slamWarn');
        return;
      case 'slamWarn':
        this.shakeX = (Math.random() - 0.5) * 3;
        if (this.stateT > 50) {
          this.vy = 1;
          this.setState('slamDown');
        }
        return;
      case 'slamDown':
        this.vy = Math.min(this.vy + 0.5, 6);
        this.y += this.vy;
        if (this.y + this.h >= GROUND_Y) {
          this.y = GROUND_Y - this.h;
          world.fx.shake(5, 22);
          audio.sfx('stomp');
          world.fx.burst(this.x + this.w / 2, GROUND_Y - 2, ['#9b7bb8', '#d8c8e8', '#6d4c8f'], 20, 3);
          this.setState('dizzy');
        }
        return;
      case 'dizzy':
        // Tonto no chão: alvo fácil!
        if (this.stateT % 20 === 0) world.fx.sprite(this.x + this.w / 2 + (Math.random() - 0.5) * 20, this.y - 2, ART.item.star[0], { vx: 0, vy: -0.6, g: 0, life: 30 });
        if (this.stateT > (this.phase2 ? 80 : 110)) this.setState('rise');
        return;
      case 'rise':
        this.y += (this.hoverY - this.y) * 0.05;
        if (this.stateT > 50) this.setState('hover');
        return;
      case 'dying':
        this.dyingUpdate(world);
        this.y += (GROUND_Y - this.h - this.y) * 0.02;
        if (this.stateT > 120) {
          world.fx.confetti(this.x + this.w / 2, this.y + this.h / 2, 80);
          this.dead = true;
          this.defeated = true;
          world.onBossDefeated(this);
        }
        return;
    }
  }
  draw(ctx, camX, camY) {
    if (this.state === 'wait') return;
    const B = ART.boss.constipador;
    let set = B.float;
    let frame = this.t >> 4;
    if (this.state === 'dying' || this.hurtT > 0 || this.state === 'dizzy') set = B.hurt;
    else if (this.state === 'intro' || this.state === 'rocks' || this.state === 'taunt') set = B.laugh;
    else if (this.state === 'minions' || this.state === 'slamWarn' || this.state === 'slamDown') set = B.attack;
    // Sombra no chão (aviso do pisão)
    const shadowW = this.state === 'slamWarn' || this.state === 'slamUp' ? 50 + (this.stateT % 10) : 40;
    ctx.fillStyle = this.state === 'slamWarn' ? 'rgba(200,30,60,0.45)' : 'rgba(30,10,40,0.35)';
    const sx = Math.round(this.x + this.w / 2 - shadowW / 2 - camX);
    ctx.fillRect(sx, Math.round(GROUND_Y - 2 - camY), shadowW, 2);
    this.drawImg(ctx, camX, camY, frameOf(set, this.facing, frame));
    if (this.state === 'slamWarn' && (this.stateT >> 3) % 2 === 0) {
      ctx.fillStyle = '#ff4d6d';
      const ex = Math.round(this.x + this.w / 2 - camX);
      const ey = Math.round(this.y - 20 - camY);
      ctx.fillRect(ex - 1, ey, 3, 7);
      ctx.fillRect(ex - 1, ey + 9, 3, 3);
    }
  }
}

export function createBoss(spawn) {
  if (spawn.type === 'boss_rolha') return new GeneralRolha(spawn.x);
  if (spawn.type === 'boss_constipador') return new Constipador(spawn.x);
  return null;
}
