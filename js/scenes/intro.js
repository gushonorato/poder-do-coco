// Cena de abertura: o Constipador rapta a Hérica e o Simba, e a mamãe manda o recado.
import { createBackground } from '../gfx/backgrounds.js';
import { createTiles } from '../gfx/tiles.js';
import { drawText, wrapText } from '../gfx/font.js';
import { ART, frameOf } from '../art.js';
import { SCREEN_GROUND, drawGroundStrip, drawFeet, drawBubble, drawScaled } from './common.js';
import { audio } from '../audio.js';
import { FX } from '../fx.js';
import { Speaker } from '../voices.js';
import { drawVoiceBox } from '../hud.js';
import { drawCage } from '../gfx/cage.js';
import { LIFT } from '../gfx/hd.js';

const lerp = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));
const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

export class IntroScene {
  constructor(game) {
    this.game = game;
    this.wantsControls = false;
  }
  enter() {
    this.t = 0;
    this.fx = new FX();
    this.speaker = new Speaker();
    this.phase = 'street';
    this.resize();
    audio.playMusic('cutscene');
    this.game.showSkip(() => this.finish());
  }
  exit() {
    this.speaker.stop();
    this.game.hideSkip();
  }
  resize() {
    this.bg = createBackground('intro', this.game.viewW, this.game.viewH);
    this.tiles = createTiles('esplanada');
  }
  finish() {
    if (this.done) return;
    this.done = true;
    this.speaker.stop();
    this.game.save({ seenIntro: true });
    this.game.go('play', 0);
  }
  update() {
    const t = ++this.t;
    const W = this.game.viewW;
    this.hx = Math.round(W * 0.44);
    this.sx = this.hx + 48;
    if (this.phase === 'street') {
      if (t % 50 === 0 && t < 150) this.fx.sprite(this.hx + 10, SCREEN_GROUND - 30, ART.item.heart[0], { vx: 0.1, vy: -0.5, g: 0, life: 50 });
      if (t === 150) {
        audio.playMusic('danger');
        audio.sfx('thunder');
      }
      if (t === 205) audio.sfx('thunder');
      if (t === 215) audio.sfx('laugh');
      if (t === 225 || t === 262) audio.sfx('bark');
      if (t === 290) this.speaker.say('socorro');
      if (t === 345) {
        audio.sfx('cage');
        this.fx.shake(2, 10);
        this.fx.burst(this.hx, SCREEN_GROUND - 2, ['#e8d8b0', '#ffffff'], 12, 2);
      }
      if (t === 470) this.game.fadeOut(20);
      if (t === 492) {
        this.phase = 'message';
        this.t = 0;
        this.game.fadeIn(20);
      }
    } else if (this.phase === 'message') {
      if (t === 30) {
        audio.playMusic('cutscene');
        this.speaker.say('intro').then(() => {
          this.msgDone = this.t;
        });
      }
      if (this.msgDone && t === this.msgDone + 30) {
        this.phase = 'go';
        this.t = 0;
      }
    } else if (this.phase === 'go') {
      if (t === 90) this.finish();
    }
    this.fx.update();
  }

  render(ctx) {
    if (this.phase === 'street') this.renderStreet(ctx);
    else this.renderMessage(ctx);
  }

  renderStreet(ctx) {
    const t = this.t;
    const W = this.game.viewW;
    const dark = ease((t - 150) / 60);
    const flash = t === 150 || t === 151 || t === 205 || t === 206;
    const shake = this.fx.shakeOffset();
    ctx.save();
    ctx.translate(shake.x, shake.y - LIFT);
    this.bg.draw(ctx, 0, t / 60, { dark, tintLater: true });
    drawGroundStrip(ctx, this.tiles, W, 0);

    const hx = this.hx;
    const sx = this.sx;
    // Monstro: desce, prende, sai voando levando as gaiolas.
    const mIn = ease((t - 175) / 90);
    const mOut = ease((t - 385) / 80);
    const mx = lerp(W + 50, hx + 12, mIn) + lerp(0, W, mOut);
    const my = lerp(-100, -6, mIn) + lerp(0, -60, mOut) + Math.sin(t * 0.06) * 3;
    const cageDrop = ease((t - 318) / 27);
    const carried = t > 385;
    const cageLift = lerp(0, 1, ease((t - 360) / 25));

    const scared = t > 185;
    // posições dos presos (vão junto com o monstro)
    const hOffX = carried ? mx - (hx + 12) : 0;
    const liftY = carried || t > 360 ? -cageLift * 22 + (carried ? my + 6 : 0) : 0;
    const hDrawX = hx + hOffX;
    const sDrawX = sx + hOffX;
    const gy = SCREEN_GROUND + liftY;

    // Hérica e Simba
    const H = ART.herica.sets;
    const S = ART.simba.sets;
    drawFeet(ctx, scared ? H.scared : H.idle, scared ? 1 : 1, scared ? t >> 4 : (t >> 5) % 1, hDrawX, gy - (t > 345 ? 3 : 0));
    const barking = scared && (t >> 4) % 3 === 0;
    drawFeet(ctx, barking ? S.bark : S.idle, scared ? 1 : -1, t >> 4, sDrawX, gy - (t > 345 ? 2 : 0));

    // Gaiolas
    if (t > 318) {
      const fallH = lerp(my + 60 - SCREEN_GROUND, 0, cageDrop);
      const base = t > 345 ? gy : SCREEN_GROUND + fallH;
      drawCage(ctx, hDrawX, base, 40, 66);
      drawCage(ctx, sDrawX, base, 44, 42);
      if (t > 345) {
        // correntes até o monstro
        ctx.fillStyle = '#8d8d99';
        for (let y = Math.round(my + 70); y < base - 70; y += 3) ctx.fillRect(Math.round(hDrawX), y, 1, 2);
        for (let y = Math.round(my + 70); y < base - 46; y += 3) ctx.fillRect(Math.round(sDrawX), y, 1, 2);
      }
    }

    if (t > 170) {
      const B = ART.boss.constipador;
      const set = t < 300 ? B.laugh : t < 385 ? B.attack : B.laugh;
      const img = frameOf(set, -1, t >> 4);
      ctx.drawImage(img, Math.round(mx - img.width / 2), Math.round(my));
    }
    this.fx.draw(ctx, 0, 0);
    this.bg.tint(ctx, t / 60, { dark: dark * 0.6, flash });
    ctx.restore();

    // Textos
    if (t < 150) drawText(ctx, 'UM DIA LINDO EM BRASÍLIA...', W / 2, 118, { align: 'center', color: '#ffffff', outline: '#2a1a14' });
    else if (t > 190 && t < 300) {
      drawText(ctx, 'O MONSTRO CONSTIPADOR!', W / 2, 112, { align: 'center', scale: W >= 270 ? 2 : 1, color: '#d8b8ff', outline: '#2a1a14' });
    }
    if (t > 290 && t < 380) drawBubble(ctx, 'SOCORRO!', hDrawX - 6, gy - 60 - LIFT, drawText);
    if (t > 225 && t < 280 && (t >> 3) % 2) drawBubble(ctx, 'AU AU!', sDrawX + 8, gy - 36 - LIFT, drawText);
  }

  renderMessage(ctx) {
    const t = this.t;
    const W = this.game.viewW;
    const H = this.game.viewH;
    const floorY = H - 8;
    // Prisão do Constipador: parede de pedra roxa, tochas e chão de pedra
    ctx.fillStyle = '#231334';
    ctx.fillRect(0, 0, W, H);
    for (let y = 0, row = 0; y < floorY; y += 9, row++) {
      for (let x = (row % 2) * -9; x < W; x += 18) {
        ctx.fillStyle = (x + y) % 36 === 0 ? '#3d2459' : '#35204f';
        ctx.fillRect(x + 1, y + 1, 16, 7);
        ctx.fillStyle = '#4a2d6b';
        ctx.fillRect(x + 1, y + 1, 16, 1);
      }
    }
    ctx.fillStyle = '#1a0d27';
    ctx.fillRect(0, floorY, W, H - floorY);
    ctx.fillStyle = '#2e1a44';
    for (let x = 0; x < W; x += 12) ctx.fillRect(x, floorY + 2, 10, 3);
    // tochas
    for (const tx of [Math.round(W * 0.12), Math.round(W * 0.88)]) {
      ctx.fillStyle = '#5a3a2a';
      ctx.fillRect(tx - 1, 76, 3, 12);
      const f = (t >> 3) % 3;
      ctx.fillStyle = '#ff9f1c';
      ctx.fillRect(tx - 2, 70 - f, 5, 7 + f);
      ctx.fillStyle = '#ffe08a';
      ctx.fillRect(tx - 1, 72 - f, 3, 4 + f);
      ctx.globalAlpha = 0.12 + f * 0.03;
      ctx.fillStyle = '#ffb347';
      ctx.fillRect(tx - 14, 60, 29, 30);
      ctx.globalAlpha = 1;
    }

    // Hérica e Simba juntos na gaiola; ela gesticula enquanto fala
    const cx = Math.round(W * 0.42);
    const lvl = audio.voiceLevel();
    const talking = this.speaker.speaking && lvl > 0.12;
    const H_ = ART.herica.sets;
    const hSet = talking ? H_.scared : H_.idle;
    const hFrame = talking ? (t >> 4) % 2 : 0;
    const hImg = frameOf(hSet, 1, hFrame);
    const bob = talking && lvl > 0.35 ? -1 : 0;
    ctx.drawImage(hImg, Math.round(cx - 22 - hImg.width / 2), floorY - hImg.height - 3 + bob);
    const barking = (t % 150) > 120;
    const sImg = frameOf(barking ? ART.simba.sets.bark : ART.simba.sets.sad, -1, t >> 3);
    ctx.drawImage(sImg, Math.round(cx + 28 - sImg.width / 2), floorY - sImg.height - 3);
    if (barking && (t >> 3) % 2) drawText(ctx, 'AU!', cx + 38, floorY - sImg.height - 12, { color: '#ffe08a', outline: '#2a1a14' });
    drawCage(ctx, cx + 4, floorY + 1, 100, 78, 12);

    // Constipador rindo do lado de fora
    const ci = frameOf(ART.boss.constipador.laugh, -1, t >> 4);
    const cw = Math.round(ci.width * 0.7);
    const chh = Math.round(ci.height * 0.7);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(ci, Math.round(Math.min(W - cw + 8, cx + 58)), floorY - chh - 6 + Math.round(Math.sin(t * 0.05) * 3), cw, chh);
    ctx.imageSmoothingEnabled = false;

    // fala com o rostinho da mamãe
    if (this.phase !== 'go') drawVoiceBox(ctx, this.speaker, W, H, { top: true });
    if (this.phase === 'go') {
      const s = Math.min(3, 1 + Math.floor(t / 6));
      ctx.fillStyle = 'rgba(20,10,31,0.75)';
      ctx.fillRect(0, H - 50, W, 50);
      const M = ART.miguel.sets.victory;
      const mi = frameOf(M, 1, t >> 4);
      ctx.drawImage(mi, Math.round(W / 2 - 90 - mi.width / 2), H - 2 - mi.height);
      drawText(ctx, 'VAMOS LÁ, MIGUEL!', W / 2 + 22, H - 30, { align: 'center', scale: s > 2 && W >= 270 ? 2 : 1, color: '#ffe08a', outline: '#2a1a14' });
    }
  }
}
