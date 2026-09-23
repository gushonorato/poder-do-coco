// Tela de título: "PODER DO COCÔ" com o Miguel fazendo demonstração.
import { createBackground } from '../gfx/backgrounds.js';
import { createTiles } from '../gfx/tiles.js';
import { drawText } from '../gfx/font.js';
import { ART, frameOf } from '../art.js';
import { SCREEN_GROUND, drawGroundStrip, drawScaled, beginWorld, endWorld } from './common.js';
import { audio } from '../audio.js';
import { FX } from '../fx.js';
import { VERSION } from '../version.js';

// Letras do logo: contorno fino escuro + sombra colorida (efeito 3D).
function logo(ctx, text, x, y, scale, color, shadow) {
  const o = { align: 'center', scale };
  drawText(ctx, text, x + 2, y + 3, { ...o, color: '#2a1a14' });
  drawText(ctx, text, x + 1, y + 2, { ...o, color: shadow });
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) drawText(ctx, text, x + dx, y + dy, { ...o, color: '#2a1a14' });
  drawText(ctx, text, x, y, { ...o, color });
}

export class TitleScene {
  constructor(game) {
    this.game = game;
    this.wantsControls = false;
  }
  enter() {
    this.t = 0;
    this.fx = new FX();
    this.poops = [];
    this.enemy = null;
    this.enemyCd = 70;
    this.shootT = 999;
    this.scroll = 0;
    this.walkT = 0;
    this.mode = 'walk';
    this.modeT = 0;
    this.resize();
    const save = this.game.load();
    const items = [{ label: 'JOGAR', icon: '▶', action: () => this.start(0) }];
    if (save.unlocked >= 2) items.push({ label: 'FASE 2', icon: '⭐', action: () => this.start(1), small: true });
    this.game.showMenu(items);
    audio.playMusic('title');
  }
  exit() {
    this.game.hideMenu();
  }
  resize() {
    this.bg = createBackground('title', this.game.viewW, this.game.viewH);
    this.tiles = createTiles('esplanada');
  }
  start(level) {
    this.game.firstGesture();
    audio.sfx('select');
    this.game.hideMenu();
    if (level === 0) this.game.go('intro');
    else this.game.go('play', level);
  }
  update() {
    this.t++;
    const W = this.game.viewW;
    const SPEED = 0.8;
    const mx = this.scroll + Math.round(W * 0.16); // Miguel no mundo
    // Demonstração: o Miguel anda por Brasília; quando um monstrinho chega, para e faz cocô nele.
    if (this.mode === 'walk') {
      this.scroll += SPEED;
      this.walkT++;
      if (!this.enemy && --this.enemyCd <= 0) {
        const fly = Math.random() < 0.35;
        this.enemy = { x: this.scroll + W + 16, t: 0, hp: 2, fly, y: fly ? SCREEN_GROUND - 30 : SCREEN_GROUND };
      }
      if (this.enemy && this.enemy.x - mx < 105) {
        this.mode = 'shoot';
        this.shootT = 40;
      }
    } else if (this.mode === 'shoot') {
      if (++this.shootT >= 42 && this.enemy) this.shootT = 0;
    } else if (this.mode === 'yay' && ++this.modeT > 50) {
      this.mode = 'walk';
    }
    if (this.enemy) {
      const e = this.enemy;
      e.t++;
      e.x -= this.mode === 'walk' ? 0.35 : 0.25;
      if (e.fly) e.y = SCREEN_GROUND - 30 + Math.sin(e.t * 0.08) * 5;
    }
    if (this.mode === 'shoot' && this.shootT === 5 && this.enemy) {
      // arco mirado no monstro
      const e = this.enemy;
      const sx = mx + 12;
      const sy = SCREEN_GROUND - 18;
      const dx = e.x - sx;
      const tt = Math.max(8, dx / 2.4);
      const vy = (e.y - 10 - sy - 0.5 * 0.1 * tt * tt) / tt;
      this.poops.push({ x: sx, y: sy, vx: 2.4, vy, t: 0 });
      audio.sfx('fart', { vol: 0.5 });
      this.fx.puff(mx + 12, SCREEN_GROUND - 17, 1, 5);
    }
    for (const p of this.poops) {
      p.t++;
      p.vy += 0.1;
      p.x += p.vx;
      p.y += p.vy;
      const e = this.enemy;
      if (e && Math.abs(p.x - e.x) < 11 && Math.abs(p.y - (e.y - 10)) < 14) {
        p.dead = true;
        e.hp--;
        this.fx.splat(p.x, p.y);
        this.fx.popup(p.x, p.y - 8, e.hp > 0 ? 'SPLAT!' : 'PLOFT!', '#ffe08a', { life: 30 });
        if (e.hp <= 0) {
          this.fx.poof(e.x, e.y - 10);
          this.enemy = null;
          this.enemyCd = 140 + Math.random() * 80;
          this.mode = 'yay';
          this.modeT = 0;
        }
      }
      if (p.y > SCREEN_GROUND - 3) {
        p.dead = true;
        this.fx.splat(p.x, SCREEN_GROUND - 2);
      }
    }
    this.poops = this.poops.filter((p) => !p.dead);
    this.fx.update();
  }
  render(ctx) {
    const W = this.game.viewW;
    const camX = Math.floor(this.scroll);
    beginWorld(ctx);
    this.bg.draw(ctx, camX, this.t / 60);
    drawGroundStrip(ctx, this.tiles, W, camX);

    // Miguel: anda, para, faz cocô, comemora
    const M = ART.miguel.sets;
    const mx = Math.round(W * 0.16);
    let set = M.walk;
    let frame = Math.floor(this.walkT / 5);
    if (this.mode === 'shoot') {
      set = M.poop;
      frame = this.shootT < 2 ? 0 : this.shootT < 5 ? 1 : this.shootT < 16 ? 2 : this.shootT < 24 ? 3 : 0;
    } else if (this.mode === 'yay') {
      set = M.victory;
      frame = 3; // joinha
    }
    const img = frameOf(set, 1, frame);
    ctx.drawImage(img, mx - (img.width >> 1), SCREEN_GROUND - img.height);
    if (this.enemy) {
      const e = this.enemy;
      const ei = e.fly ? frameOf(ART.enemy.salgadinho.fly, -1, e.t >> 2) : frameOf(ART.enemy.refri.walk, -1, e.t >> 3);
      const bob = e.fly ? 0 : (e.t >> 2) % 2 ? -1 : 0;
      ctx.drawImage(ei, Math.round(e.x - camX - ei.width / 2), Math.round(e.y - ei.height + bob));
    }
    for (const p of this.poops) {
      const pi = ART.item.poop[(p.t >> 2) % 2];
      ctx.drawImage(pi, Math.round(p.x - camX - pi.width / 2), Math.round(p.y - pi.height / 2));
    }
    this.fx.draw(ctx, camX, 0);
    endWorld(ctx);

    drawText(ctx, 'V ' + VERSION, W - 3, this.game.viewH - 6, { align: 'right', scale: 0.5, color: 'rgba(255,255,255,0.7)' });

    // Logo (gerado por IA); sem ele, texto em pixel
    const bob = Math.round(Math.sin(this.t * 0.05) * 2);
    if (ART.logo) {
      const L = ART.logo;
      const lw = Math.min(L.width, W * 0.5);
      const lh = (L.height * lw) / L.width;
      ctx.drawImage(L, Math.round(W / 2 - lw / 2 + 12), 3 + bob, Math.round(lw), Math.round(lh));
    } else {
      logo(ctx, 'PODER DO', W / 2, 8 + bob, 2, '#ffe08a', '#c98a1c');
      logo(ctx, 'COCÔ', W / 2, 30 + bob, 4, '#a8652e', '#ffd23f');
    }
  }
}
