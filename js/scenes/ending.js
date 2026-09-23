// Final: família reunida em Brasília, recado da mamãe e festa.
import { createBackground } from '../gfx/backgrounds.js';
import { createTiles } from '../gfx/tiles.js';
import { drawText } from '../gfx/font.js';
import { ART } from '../art.js';
import { SCREEN_GROUND, drawGroundStrip, drawFeet, beginWorld, endWorld } from './common.js';
import { audio } from '../audio.js';
import { FX } from '../fx.js';
import { Speaker } from '../voices.js';
import { drawVoiceBox } from '../hud.js';

export class EndingScene {
  constructor(game) {
    this.game = game;
    this.wantsControls = false;
  }
  enter() {
    this.t = 0;
    this.fx = new FX();
    this.speaker = new Speaker();
    this.showEnd = false;
    this.resize();
    audio.playMusic('rescue');
  }
  exit() {
    this.speaker.stop();
    this.game.hideMenu();
  }
  resize() {
    this.bg = createBackground('intro', this.game.viewW, this.game.viewH);
    this.tiles = createTiles('esplanada');
  }
  update() {
    const t = ++this.t;
    const W = this.game.viewW;
    if (t === 50) {
      this.speaker.say('moral').then(() => {
        this.showEnd = true;
        this.endT = 0;
        audio.playMusic('victory');
        audio.sfx('cheer');
        setTimeout(() => this.game.showMenu([{ label: 'JOGAR DE NOVO', icon: '↻', action: () => this.again() }]), 1500);
      });
    }
    if (t % 45 === 0) this.fx.confetti(20 + Math.random() * (W - 40), -5, 24);
    if (t % 30 === 0) this.fx.sprite(W / 2 + (Math.random() - 0.5) * 60, SCREEN_GROUND - 34, ART.item.heart[0], { vx: (Math.random() - 0.5) * 0.4, vy: -0.6, g: -0.005, life: 70 });
    if (this.showEnd) this.endT++;
    this.fx.update();
  }
  again() {
    this.game.firstGesture();
    audio.sfx('select');
    this.game.hideMenu();
    this.game.go('title');
  }
  render(ctx) {
    const t = this.t;
    const W = this.game.viewW;
    const cx = W / 2;
    beginWorld(ctx);
    this.bg.draw(ctx, 0, t / 60, {});
    drawGroundStrip(ctx, this.tiles, W, 0);
    const hop = (ph) => -Math.max(0, Math.round(Math.sin(t * 0.12 + ph) * 6));
    drawFeet(ctx, ART.herica.sets.cheer, 1, t >> 4, cx - 30, SCREEN_GROUND + hop(1));
    drawFeet(ctx, ART.miguel.sets.victory, 1, t >> 4, cx, SCREEN_GROUND + hop(0));
    drawFeet(ctx, (t >> 5) % 2 ? ART.simba.sets.bark : ART.simba.sets.jump, -1, t >> 3, cx + 34, SCREEN_GROUND + hop(2));
    this.fx.draw(ctx, 0, 0);
    endWorld(ctx);
    if (this.speaker.speaking) drawVoiceBox(ctx, this.speaker, W, this.game.viewH, { top: true });
    if (this.showEnd) {
      const s = this.endT < 10 ? 2 : 3;
      drawText(ctx, 'FIM!', cx, 8, { align: 'center', scale: s, color: '#ffe08a', outline: '#2a1a14' });
      if (this.endT > 20) drawText(ctx, 'MIGUEL, O HERÓI DO COCÔ!', cx, 36, { align: 'center', scale: 1, color: '#ffffff', outline: '#2a1a14' });
    }
  }
}
