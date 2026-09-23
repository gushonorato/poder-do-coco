// Miguel! Anda, pula e... faz cocô nos monstros.
import { ART, frameOf } from '../art.js';
import { moveAndCollide } from '../world/level.js';
import { input } from '../input.js';
import { audio } from '../audio.js';
import { Poop } from './projectiles.js';

const GRAV = 0.26;
const MAX_FALL = 5;
const WALK = 1.35;
const STANCE_WALK = 0.55; // andando de bumbum empinado
const JUMP_V = -5.9;
const COYOTE = 7;
const JUMP_BUFFER = 8;
const POOP_DELAY = 5; // quadros de "força" antes do cocô sair
const NO_INPUT = { dir: 0, jump: false, jumpPressed: false, poop: false, poopPressed: false };

export class Player {
  constructor(x, groundY) {
    this.w = 14;
    this.h = 40;
    this.x = x - this.w / 2;
    this.y = groundY - this.h;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.onGround = false;
    this.maxHp = 5;
    this.hp = 5;
    this.inv = 0;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.shootCd = 0;
    this.poopT = 99; // quadros desde que começou a fazer força
    this.pendingShot = false;
    this.animT = 0;
    this.superT = 0;
    this.hurtT = 0;
    this.dying = false;
    this.dyingT = 0;
    this.locked = false; // cenas controlam o Miguel
    this.auto = null; // { dir } andar automático em cenas
    this.pose = null; // pose forçada em cenas ('victory', 'idle')
    this.minX = null;
    this.maxX = null;
    this.sq = 1; // achatar/esticar (1 = normal)
  }
  get inStance() {
    return this.poopT < 14 || (!this.locked && input.poop && !this.dying);
  }
  heal(n = 1) {
    this.hp = Math.min(this.maxHp, this.hp + n);
  }
  hurt(fromX, world) {
    if (this.inv > 0 || this.dying || this.locked) return;
    this.hp--;
    this.inv = 110;
    this.hurtT = 18;
    const dir = this.x + this.w / 2 < fromX ? -1 : 1;
    this.vx = dir * 2.2;
    this.vy = -2.6;
    audio.sfx('hurt');
    world.fx.shake(2, 10);
    world.fx.burst(this.x + this.w / 2, this.y + 8, ['#ff4d6d', '#ffffff'], 8, 1.5);
    if (this.hp <= 0) {
      this.dying = true;
      this.dyingT = 0;
      this.vy = -4;
      this.vx = 0;
    }
  }
  buttPos() {
    // Posição do bumbum (de onde sai o cocô) no mundo.
    const f = ART.miguel.frameW;
    const left = this.x + this.w / 2 - f / 2;
    const bx = this.facing > 0 ? left + ART.miguel.poopButt.x : left + (f - ART.miguel.poopButt.x);
    const top = this.y + this.h - ART.miguel.frameH;
    return { x: bx, y: top + ART.miguel.poopButt.y };
  }
  update(world) {
    this.animT++;
    if (this.dying) {
      this.dyingT++;
      if (this.dyingT > 20) {
        this.vy = Math.min(this.vy + 0.2, 4);
        this.y += this.vy;
      }
      return;
    }
    const inp = this.locked ? NO_INPUT : input;
    let dir = inp.dir;
    if (this.auto) dir = this.auto.dir;
    if (this.inv > 0) this.inv--;
    if (this.hurtT > 0) this.hurtT--;
    if (this.superT > 0) this.superT--;
    if (this.shootCd > 0) this.shootCd--;

    // Horizontal
    const stance = this.inStance && !this.auto;
    if (dir !== 0 && this.hurtT <= 0) this.facing = dir;
    const maxV = stance ? STANCE_WALK : this.auto ? this.auto.speed || WALK : WALK;
    const target = this.hurtT > 0 ? this.vx : dir * maxV;
    const accel = this.onGround ? 0.25 : 0.14;
    this.vx += Math.max(-accel, Math.min(accel, target - this.vx));
    if (dir === 0 && this.onGround && this.hurtT <= 0) this.vx *= 0.7;

    // Pulo (com "coyote time" e buffer, para perdoar o tempo do dedinho)
    if (this.onGround) this.coyote = COYOTE;
    else if (this.coyote > 0) this.coyote--;
    if (inp.jumpPressed) this.jumpBuf = JUMP_BUFFER;
    else if (this.jumpBuf > 0) this.jumpBuf--;
    if (this.jumpBuf > 0 && this.coyote > 0 && this.hurtT <= 0) {
      this.vy = JUMP_V;
      this.coyote = 0;
      this.jumpBuf = 0;
      this.onGround = false;
      this.sq = 1.14; // estica ao pular
      audio.sfx('jump');
    }
    if (!inp.jump && this.vy < -2) this.vy = -2;
    this.vy = Math.min(this.vy + GRAV, MAX_FALL);

    const res = moveAndCollide(world.level, this, { minX: this.minX, maxX: this.maxX });
    const wasOnGround = this.onGround;
    this.onGround = res.onGround;
    if (this.onGround && !wasOnGround) this.sq = 0.84; // achata ao cair
    this.sq += (1 - this.sq) * 0.22;
    if (this.onGround && !wasOnGround && this.vy === 0) {
      world.fx.spark(this.x + 2, this.y + this.h, '#e8d8b0', { vx: -0.6, vy: -0.3, g: 0, life: 12 });
      world.fx.spark(this.x + this.w - 2, this.y + this.h, '#e8d8b0', { vx: 0.6, vy: -0.3, g: 0, life: 12 });
    }

    // Cocô!
    this.poopT++;
    if (inp.poop && this.shootCd <= 0 && this.hurtT <= 0) {
      this.poopT = 0;
      this.pendingShot = true;
      this.shootCd = this.superT > 0 ? 11 : 17;
    }
    if (this.pendingShot && this.poopT === 2) {
      this.sq = 0.92; // agacha fazendo força
      const hx = this.x + this.w / 2 - this.facing * 4;
      for (const d of [-1, 1]) world.fx.spark(hx + d * 6, this.y + 6, '#9fd8ff', { vx: d * 0.5, vy: -0.9, g: 0.12, life: 18, size: 1 });
    }
    if (this.pendingShot && this.poopT >= POOP_DELAY) {
      this.pendingShot = false;
      this.sq = 1.12; // estica no alívio
      this.firePoop(world);
    }
  }
  firePoop(world) {
    const b = this.buttPos();
    const big = this.superT > 0;
    // Mira automática: calcula o arco para cair no monstro mais próximo à frente.
    const target = world.nearestEnemyAhead(b.x, this.facing, 190);
    const main = new Poop(b.x, b.y, this.facing, big, 0);
    if (target) main.aimAt(target, 0, world.level);
    world.projectiles.push(main);
    if (big) {
      const extra = new Poop(b.x, b.y - 3, this.facing, false, this.facing * 0.6);
      if (target) extra.aimAt(target, 0.3, world.level);
      world.projectiles.push(extra);
    }
    audio.sfx('fart', { pitch: big ? 0.8 : 1 });
    // nuvenzinha de pum atrás do bumbum + "PUM!" de vez em quando
    world.fx.puff(b.x + this.facing * 3, b.y + 1, this.facing, big ? 8 : 5);
    world.fx.sprite(b.x + this.facing * 6, b.y, ART.item.cloudFart[0], { vx: this.facing * 0.35, vy: -0.2, g: 0, life: 16, drag: 0.93 });
    if (Math.random() < 0.3) world.fx.popup(b.x - this.facing * 4, b.y - 10, 'PUM!', '#b8f5a0', { life: 30 });
  }
  draw(ctx, camX, camY) {
    if (this.inv > 0 && !this.dying && (this.inv >> 2) % 2 === 1) return;
    const M = ART.miguel.sets;
    let set;
    let frame = 0;
    if (this.dying) set = M.hurt;
    else if (this.pose === 'victory') {
      set = M.victory;
      frame = this.animT >> 4;
    } else if (this.hurtT > 0) set = M.hurt;
    else if (this.inStance) {
      set = M.poop;
      // agacha (0) -> força (1) -> alívio (2) -> orgulhoso (3) -> pronto de novo (0)
      const t = this.poopT;
      frame = this.pendingShot ? (t < 2 ? 0 : 1) : t < 11 ? 2 : t < 16 ? 3 : 0;
    } else if (!this.onGround) set = this.vy < 0 ? M.jump : M.fall;
    else if (Math.abs(this.vx) > 0.3) {
      set = M.walk;
      // mais rápido quando anda mais rápido
      this.walkT = (this.walkT || 0) + Math.abs(this.vx) / 1.35;
      frame = Math.floor(this.walkT / 4.5);
    } else {
      set = M.idle;
      frame = Math.floor(this.animT / 9);
    }
    const img = frameOf(set, this.facing, frame);
    // achatar/esticar ancorado nos pés
    const sq = Math.abs(this.sq - 1) > 0.02 ? this.sq : 1;
    const dh = Math.round(img.height * sq);
    const dw = Math.round(img.width * (2 - sq));
    let x = Math.round(this.x + this.w / 2 - dw / 2 - camX);
    const y = Math.round(this.y + this.h - dh - camY);
    // tremidinha fazendo força
    if (set === M.poop && frame === 1) x += this.animT % 2 ? 1 : 0;
    // brilho do super cocô
    if (this.superT > 0 && (this.animT >> 2) % 2 === 0) {
      ctx.globalAlpha = 0.5;
      ctx.drawImage(frameOf(set, this.facing, frame, true), x, y - 1, dw, dh);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(img, x, y, dw, dh);
  }
}
