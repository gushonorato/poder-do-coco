// Cena de jogo: fases, chefões, resgates.
import { LEVELS } from '../world/levels.js';
import { TILE, CAM_Y, T_SOLID, T_ONEWAY, T_BLOCK, T_EMPTY, GROUND_ROW, overlap } from '../world/level.js';
import { createBackground } from '../gfx/backgrounds.js';
import { createTiles } from '../gfx/tiles.js';
import { makeCanvas } from '../gfx/pixel.js';
import { Player } from '../entities/player.js';
import { createEnemy } from '../entities/enemies.js';
import { createBoss } from '../entities/bosses.js';
import { Pickup, Flag, Captive, Follower } from '../entities/pickups.js';
import { PoopPile } from '../entities/projectiles.js';
import { FX } from '../fx.js';
import { ART } from '../art.js';
import { audio } from '../audio.js';
import { input } from '../input.js';
import { Speaker } from '../voices.js';
import { drawHearts, drawBossBar, drawVoiceBox, drawBanner } from '../hud.js';
import { drawText } from '../gfx/font.js';

const GROUND_Y = GROUND_ROW * TILE;
const FOOD_NAMES = { apple: 'MAÇÃ', water: 'ÁGUA', papaya: 'MAMÃO', plum: 'AMEIXA', orange: 'LARANJA', pear: 'PERA', watermelon: 'MELANCIA', heart: '' };
const DROPS = ['apple', 'papaya', 'orange', 'plum', 'pear', 'watermelon', 'water'];
const HEALS = DROPS;
const said = new Set(); // falas "educativas" tocam uma vez por sessão

export class PlayScene {
  constructor(game, levelIndex) {
    this.game = game;
    this.levelIndex = levelIndex;
    this.def = LEVELS[levelIndex];
    this.wantsControls = true;
  }

  enter() {
    const L = (this.level = this.def.build());
    this.fx = new FX();
    this.speaker = new Speaker();
    this.time = 0;
    this.frame = 0;
    this.player = new Player(L.start.x, L.start.y);
    this.respawnX = L.start.x;
    this.enemies = [];
    this.items = [];
    this.flags = [];
    this.projectiles = [];
    this.hazards = [];
    this.piles = [];
    this.followers = [];
    this.captive = null;
    this.boss = null;
    this.bossShownHp = 0;
    this.bossStarted = false;
    this.broccoliCd = 0;
    this.healCd = 0;
    this.state = 'play';
    this.stateT = 0;
    this.banner = { title: this.def.name, sub: this.def.title, t: 0, life: 170 };
    this.hintPoop = levelIndex0(this) ? 0 : -1;
    this.lastRetryVoice = -99999;
    for (const s of L.spawns) {
      if (s.item) this.items.push(new Pickup(s.type, s.x, s.y));
      else if (s.type === 'flag') this.flags.push(new Flag(s.x, s.y));
      else if (s.type.startsWith('boss_')) {
        this.boss = createBoss(s);
        this.enemies.push(this.boss);
      } else if (s.type.startsWith('captive_')) this.captive = new Captive(s.type.slice(8), s.x, s.y);
      else {
        const e = createEnemy(s);
        if (e) this.enemies.push(e);
      }
    }
    if (this.levelIndex === 1) {
      const simba = new Follower('simba', L.start.x - 30, GROUND_Y);
      this.followers.push(simba);
    }
    this.buildGraphics();
    this.camX = 0;
    this.camY = CAM_Y;
    this.updateCamera(true);
    audio.playMusic(this.def.music);
    if (this.levelIndex === 1) setTimeout(() => this.state === 'play' && this.speaker.say('fase2'), 2600);
  }

  exit() {
    this.speaker.stop();
    this.game.setHint(false);
  }

  resize() {
    this.buildGraphics();
  }

  get viewW() {
    return this.game.viewW;
  }
  get viewH() {
    return this.game.viewH;
  }

  buildGraphics() {
    const L = this.level;
    this.bg = createBackground(L.theme, this.viewW, this.viewH);
    this.tiles = createTiles(L.theme);
    // Pré-renderiza todos os tiles da fase numa imagem só.
    const c = makeCanvas(L.width, L.height);
    const g = c.getContext('2d');
    for (let cx = 0; cx < L.cols; cx++) {
      for (let cy = 0; cy < L.rows; cy++) {
        const t = L.tiles[cy * L.cols + cx];
        if (t === T_EMPTY) continue;
        let img;
        if (t === T_SOLID) {
          const above = cy > 0 ? L.tiles[(cy - 1) * L.cols + cx] : T_EMPTY;
          if (above === T_SOLID) img = this.tiles.fill;
          else {
            const leftOpen = cx > 0 && L.tiles[cy * L.cols + cx - 1] !== T_SOLID;
            const rightOpen = cx < L.cols - 1 && L.tiles[cy * L.cols + cx + 1] !== T_SOLID;
            img = leftOpen && this.tiles.topLeft ? this.tiles.topLeft : rightOpen && this.tiles.topRight ? this.tiles.topRight : this.tiles.top;
          }
        } else if (t === T_ONEWAY) img = this.tiles.platform;
        else if (t === T_BLOCK) img = this.tiles.block;
        if (img) g.drawImage(img, cx * TILE, cy * TILE);
      }
    }
    this.tileLayer = c;
  }

  // ---------------------------------------------------------------- API usada pelas entidades
  nearestEnemyAhead(x, dir, range) {
    let best = null;
    let bestD = range;
    for (const e of this.enemies) {
      if (e.dead || !e.hittable || (!e.active && !e.isBoss)) continue;
      const d = (e.x + e.w / 2 - x) * dir;
      if (d > 0 && d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }
  addPile(x, groundY, big) {
    this.piles.push(new PoopPile(x, groundY, big));
    if (this.piles.length > 6) this.piles.shift();
  }
  onEnemyKilled(e) {
    if (e.isBoss) return;
    const p = this.player;
    if (p.hp < p.maxHp && Math.random() < 0.3) {
      const h = new Pickup(DROPS[Math.floor(Math.random() * DROPS.length)], e.x + e.w / 2, e.y + e.h);
      h.falling = true;
      h.vy = -2;
      this.items.push(h);
    }
    if (this.hintPoop >= 0) {
      this.hintPoop = -1;
      this.game.setHint(false);
    }
  }
  collect(item) {
    const p = this.player;
    const cx = item.x + item.w / 2;
    if (item.type === 'broccoli') {
      p.superT = 600;
      audio.sfx('power');
      this.fx.popup(cx, item.y - 14, 'BRÓCOLIS', '#ffffff', { life: 70 });
      this.fx.popup(cx, item.y - 4, 'SUPER COCÔ!', '#7bd389', { life: 70 });
      this.fx.burst(cx, item.y, ['#7bd389', '#fff6a0', '#ffffff'], 16, 2);
      this.sayOnce('super');
    } else {
      p.heal(1);
      audio.sfx('pickup');
      this.fx.popup(cx, item.y - 6, FOOD_NAMES[item.type] || '+1 ♥', '#ffffff', { life: 60 });
      this.fx.popup(cx, item.y + 4, '+1 ♥', '#ff8fa3', { life: 60 });
      this.fx.burst(cx, item.y, ['#ff4d6d', '#ffffff'], 8, 1.5);
      if (item.type !== 'heart') this.sayOnce('fruta');
    }
  }
  // Faz cair um item de ajuda do céu, do lado do Miguel longe do chefão.
  dropHelp(type, dist) {
    const A = this.level.arena;
    const p = this.player;
    const b = this.boss;
    const away = b && b.x + b.w / 2 > p.x ? -1 : 1;
    let x = p.x + p.w / 2 + away * dist;
    if (x < A.x0 + 16 || x > A.x1 - 16) x = p.x + p.w / 2 - away * dist; // sem espaço: do outro lado
    x = Math.max(A.x0 + 16, Math.min(A.x1 - 16, x));
    const it = new Pickup(type, x, GROUND_Y);
    it.y = this.camY - 20;
    it.falling = true;
    this.items.push(it);
    if (type === 'broccoli') {
      this.fx.popup(x, GROUND_Y - 40, 'BRÓCOLIS!', '#7bd389', { life: 70 });
      audio.sfx('power', { vol: 0.6 });
      this.broccoliCd = 60 * 12; // no máximo um a cada 12 s
    } else {
      this.fx.popup(x, GROUND_Y - 40, FOOD_NAMES[type] + '!', '#ffffff', { life: 60 });
      audio.sfx('pickup', { vol: 0.5 });
      this.healCd = 60 * 5; // no máximo uma a cada 5 s
    }
  }
  sayOnce(name) {
    if (said.has(name) || this.speaker.speaking) return;
    said.add(name);
    this.speaker.say(name);
  }
  reachCheckpoint(flag) {
    this.respawnX = flag.x;
    audio.sfx('checkpoint');
    this.fx.confetti(flag.x + 6, flag.y, 24);
    this.fx.popup(flag.x + 6, flag.y - 8, 'MUITO BEM!', '#ffe08a', { life: 70 });
    if (!this.speaker.speaking) this.speaker.say('cheer');
  }
  onBossDying() {
    audio.stopMusic(0.3);
    for (const h of this.hazards) h.dead = true;
    // nada mais machuca o Miguel: somem os monstrinhos e ele fica protegido
    for (const e of this.enemies) {
      if (!e.dead && !e.isBoss) {
        e.dead = true;
        this.fx.poof(e.x + e.w / 2, e.y + e.h / 2);
      }
    }
    this.player.inv = Math.max(this.player.inv, 600);
  }
  onBossDefeated() {
    this.state = 'rescue';
    this.stateT = 0;
    // some com os monstrinhos restantes
    for (const e of this.enemies) {
      if (!e.dead && !e.isBoss) {
        e.dead = true;
        this.fx.poof(e.x + e.w / 2, e.y + e.h / 2);
      }
    }
    this.player.locked = true;
    audio.playMusic('victory');
  }

  // ---------------------------------------------------------------- lógica
  update(dt) {
    this.frame++;
    this.time += dt;
    this.stateT++;
    if (this.banner) {
      this.banner.t++;
      if (this.banner.t > this.banner.life) this.banner = null;
    }
    const p = this.player;

    if (this.state === 'dead') {
      p.update(this);
      if (this.stateT === 70) this.game.fadeOut(18);
      if (this.stateT === 90) this.respawn();
      this.fx.update();
      return;
    }

    p.update(this);
    if (p.dying && this.state !== 'dead') {
      this.state = 'dead';
      this.stateT = 0;
      audio.sfx('hurt', { pitch: 0.6 });
    }

    // Dica: fazer o botão de cocô piscar quando aparece o primeiro monstro.
    if (this.hintPoop >= 0) {
      const near = this.enemies.find((e) => !e.dead && e.active && !e.isBoss);
      this.game.setHint(!!near && this.frame % 60 < 40);
      if (input.poopPressed) this.hintPoop++;
      if (this.hintPoop > 3) {
        this.hintPoop = -1;
        this.game.setHint(false);
      }
    }

    // Arena do chefão
    const A = this.level.arena;
    if (A && !this.bossStarted && p.x > A.x0 + 40 && this.state === 'play') this.startBoss();

    for (const e of this.enemies) {
      e.update(this);
      if (!e.dead && e.contactDamage !== false && e.active !== false && !p.dying) {
        const hb = e.hitbox ? e.hitbox() : e;
        if (overlap(shrink(p, 2), hb)) p.hurt(hb.x + hb.w / 2, this);
      }
    }
    for (const h of this.hazards) {
      h.update(this);
      if (!h.dead && (h.active === undefined || h.active) && overlap(shrink(p, 2), h)) {
        if (p.inv <= 0 && h.junk) this.fx.popup(p.x + p.w / 2, p.y - 6, 'ECA!', '#b8f5a0', { life: 40 });
        p.hurt(h.x + h.w / 2, this);
        h.dead = true;
      }
    }
    for (const pr of this.projectiles) pr.update(this);
    for (const pl of this.piles) pl.update(this);
    for (const it of this.items) it.update(this);
    for (const f of this.flags) f.update(this);
    for (const f of this.followers) f.update(this);
    if (this.captive) this.captive.update(this);

    this.enemies = this.enemies.filter((e) => !e.dead || (e.isBoss && !e.defeated));
    this.projectiles = this.projectiles.filter((x) => !x.dead);
    this.hazards = this.hazards.filter((x) => !x.dead);
    this.piles = this.piles.filter((x) => !x.dead);
    this.items = this.items.filter((x) => !x.dead);

    if (this.boss) this.bossShownHp += (this.boss.hp - this.bossShownHp) * 0.15;
    // Ajuda nas lutas: com 3 corações ou menos cai brócolis (SUPER COCÔ);
    // com 2 ou menos cai água ou fruta.
    if (this.bossStarted && this.boss && this.boss.hittable && !p.dying) {
      const A = this.level.arena;
      const inArena = (fn) => this.items.some((it) => it.x > A.x0 && it.x < A.x1 && fn(it));
      if (this.broccoliCd > 0) this.broccoliCd--;
      if (this.healCd > 0) this.healCd--;
      if (p.hp <= 3 && p.superT <= 0 && this.broccoliCd <= 0 && !inArena((it) => it.type === 'broccoli')) this.dropHelp('broccoli', 34);
      if (p.hp <= 2 && this.healCd <= 0 && !inArena((it) => HEALS.includes(it.type))) this.dropHelp(HEALS[Math.floor(Math.random() * HEALS.length)], 58);
    }
    if (this.boss && this.bossStarted && this.boss.hp <= 0 && !this.boss.defeated && this.boss.state !== 'dying') {
      this.boss.hittable = false;
      this.boss.contactDamage = false;
      this.boss.setState('dying');
      this.onBossDying(this.boss);
    }
    // Discurso do vilão antes da luta (Miguel fica parado ouvindo).
    if (this.boss && this.boss.state === 'taunt' && !this.tauntStarted) {
      this.tauntStarted = true;
      this.player.locked = true;
      this.speaker.stop();
      this.speaker.say(this.def.tauntVoice).then(() => {
        this.boss.endTaunt();
        this.player.locked = false;
        this.speaker.say(this.def.bossVoice);
      });
    }

    if (this.state === 'rescue') this.updateRescue();

    this.fx.update();
    this.updateCamera(false);
  }

  startBoss() {
    const A = this.level.arena;
    this.bossStarted = true;
    this.player.minX = A.x0;
    this.player.maxX = A.x1;
    this.boss.start();
    this.bossShownHp = this.boss.hp;
    audio.playMusic('boss');
    this.speaker.stop();
    this.banner = { title: this.def.bossName, sub: null, t: 0, life: 110 };
  }

  respawn() {
    const p = this.player;
    const A = this.level.arena;
    let x = this.respawnX + 8;
    if (this.bossStarted) x = A.x0 + 30;
    const np = new Player(x, GROUND_Y);
    np.inv = 150;
    if (this.bossStarted) {
      np.minX = A.x0;
      np.maxX = A.x1;
    }
    np.superT = 0;
    this.player = np;
    this.hazards = [];
    this.projectiles = [];
    for (const f of this.followers) {
      f.x = x - 20;
      f.y = GROUND_Y - f.h - 10;
    }
    // Afasta monstrinhos que estejam em cima do ponto de volta.
    for (const e of this.enemies) {
      if (!e.isBoss && !e.dead && Math.abs(e.x - x) < 60) e.x = x + 90 + Math.random() * 30;
    }
    if (this.boss && this.bossStarted && !this.boss.dead) {
      // chefão volta para o lado direito, sem recuperar vida
      this.boss.x = Math.min(A.x1 - this.boss.w - 20, Math.max(this.boss.x, A.x0 + 180));
      const busy = ['intro', 'roar', 'taunt', 'dying'].includes(this.boss.state);
      if (!busy && this.boss.hp > 0) this.boss.setState(this.boss.flying ? 'hover' : 'walk');
    }
    this.state = 'play';
    this.stateT = 0;
    this.camX = -1;
    this.updateCamera(true);
    this.game.fadeIn(18);
    if (this.frame - this.lastRetryVoice > 60 * 40) {
      this.lastRetryVoice = this.frame;
      this.speaker.stop();
      this.speaker.say('retry');
    }
  }

  updateRescue() {
    const t = this.stateT;
    const p = this.player;
    const cap = this.captive;
    if (t === 20) p.pose = 'victory';
    if (t === 70 && cap) {
      cap.caged = false;
      audio.sfx('cage');
      this.fx.poof(cap.x, cap.groundY - 20);
      this.fx.confetti(cap.x, cap.groundY - 30, 50);
      const f = new Follower(cap.who, cap.x, GROUND_Y);
      f.target = p.x + p.w / 2 + (cap.who === 'simba' ? 22 : 20) - f.w / 2;
      this.followers.push(f);
      this.rescued = f;
      if (cap.who === 'simba') audio.sfx('bark');
    }
    if (t === 80) audio.playMusic('rescue');
    if (this.rescued && t > 80 && t % 14 === 0) {
      this.fx.sprite(this.rescued.x + this.rescued.w / 2, this.rescued.y - 4, heartImg(), { vx: (Math.random() - 0.5) * 0.6, vy: -0.8, g: -0.01, life: 50 });
    }
    if (t === 90 && this.rescued) this.rescued.facing = -1;
    if (t === 150) {
      if (this.rescued) this.rescued.pose = 'cheer';
      this.speaker.stop();
      const line = this.levelIndex === 0 ? 'simba' : 'final';
      this.banner = {
        title: this.levelIndex === 0 ? 'SIMBA SALVO!' : 'MAMÃE SALVA!',
        sub: null,
        t: 0,
        life: 150,
      };
      this.speaker.say(line).then(() => {
        this.rescueVoiceDone = true;
      });
    }
    if (this.rescueVoiceDone && !this.leaving) {
      this.leaving = true;
      setTimeout(() => {
        if (this.levelIndex === 0) {
          this.game.save({ unlocked: 2 });
          this.game.go('play', 1);
        } else {
          this.game.save({ unlocked: 2, finished: true });
          this.game.go('ending');
        }
      }, 900);
    }
  }

  updateCamera(snap) {
    const p = this.player;
    const vw = this.viewW;
    let target = p.x + p.w / 2 - vw * 0.42 + p.facing * 18;
    // na luta, enquadra o Miguel e o chefão juntos
    const b = this.boss;
    if (this.bossStarted && b && !b.defeated && b.state !== 'wait') {
      const mid = (p.x + p.w / 2 + b.x + b.w / 2) / 2;
      target = mid - vw / 2;
    }
    let min = 0;
    let max = this.level.width - vw;
    const A = this.level.arena;
    if (A && this.bossStarted) {
      min = A.x0;
      max = A.x1 - vw;
      if (max < min) min = max = Math.round((A.x0 + A.x1) / 2 - vw / 2);
    }
    target = Math.max(min, Math.min(max, target));
    if (snap || this.camX < 0) this.camX = target;
    else this.camX += (target - this.camX) * 0.12;
    this.camX = Math.max(min, Math.min(max, this.camX));
    // vertical: fica no chão e sobe quando o Miguel pula alto (cabeça sempre à vista)
    const ty = Math.max(-40, Math.min(CAM_Y, p.y - 34));
    if (snap) this.camY = ty;
    else this.camY += (ty - this.camY) * (ty < this.camY ? 0.2 : 0.08);
  }

  // ---------------------------------------------------------------- desenho
  render(ctx) {
    const shake = this.fx.shakeOffset();
    const camX = Math.round(this.camX) - shake.x;
    const camY = Math.round(this.camY) - shake.y;
    // cenário (desenhado para uma câmera em y=12) acompanha o chão
    ctx.fillStyle = this.bg.topColor || '#2c78d4';
    ctx.fillRect(0, 0, this.viewW, this.viewH);
    ctx.save();
    ctx.translate(0, 12 - camY);
    this.bg.draw(ctx, camX, this.time);
    ctx.restore();
    // chão/plataformas (recorte seguro dentro do canvas)
    const sy = Math.max(0, camY);
    const sh = Math.min(this.level.height - sy, this.viewH - (sy - camY));
    if (sh > 0) ctx.drawImage(this.tileLayer, camX, sy, this.viewW, sh, 0, sy - camY, this.viewW, sh);
    const vis = (o) => o.x + (o.w || 32) > camX - 40 && o.x < camX + this.viewW + 40;
    for (const f of this.flags) if (vis(f)) f.draw(ctx, camX, camY);
    if (this.captive) this.captive.draw(ctx, camX, camY);
    for (const pl of this.piles) pl.draw(ctx, camX, camY);
    for (const it of this.items) if (vis(it)) it.draw(ctx, camX, camY);
    for (const e of this.enemies) if (e.isBoss || vis(e)) e.draw(ctx, camX, camY);
    for (const f of this.followers) f.draw(ctx, camX, camY);
    this.player.draw(ctx, camX, camY);
    for (const pr of this.projectiles) pr.draw(ctx, camX, camY);
    for (const h of this.hazards) h.draw(ctx, camX, camY);
    this.fx.draw(ctx, camX, camY);

    // HUD
    drawHearts(ctx, this.player);
    if (this.boss && this.bossStarted && !this.boss.defeated) drawBossBar(ctx, this.boss, this.viewW, this.bossShownHp);
    if (this.banner) drawBanner(ctx, this.viewW, this.viewH, this.banner.title, this.banner.sub, this.banner.t, this.speaker.speaking ? 0.62 : 0.36);
    if (this.speaker.speaking) drawVoiceBox(ctx, this.speaker, this.viewW, this.viewH, { top: true, compact: true });
    if (this.state === 'play' && this.frame < 400 && this.levelIndex === 0 && !this.game.touch) {
      drawText(ctx, 'SETAS: ANDAR   ESPAÇO: PULAR   X: COCÔ', this.viewW / 2, this.viewH - 12, { align: 'center', color: '#ffffff', outline: '#2a1a14' });
    }
  }
}

function levelIndex0(scene) {
  return scene.levelIndex === 0;
}
function shrink(b, n) {
  return { x: b.x + n, y: b.y + n, w: b.w - n * 2, h: b.h - n * 2 };
}
function heartImg() {
  return ART.item.heart[0];
}
