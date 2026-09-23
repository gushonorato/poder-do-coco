// HUD: corações, barra do chefão, super cocô, caixa de fala da Hérica e letreiros.
import { ART } from './art.js';
import { drawText, wrapText, textWidth } from './gfx/font.js';
import { audio } from './audio.js';

export function drawHearts(ctx, player) {
  const hw = ART.item.heart[0].width + 2;
  for (let i = 0; i < player.maxHp; i++) {
    const img = i < player.hp ? ART.item.heart[0] : ART.item.heartEmpty[0];
    ctx.drawImage(img, 6 + i * hw, 6);
  }
  if (player.superT > 0) {
    const b = ART.item.broccoli[0];
    const y = 8 + ART.item.heart[0].height;
    ctx.drawImage(b, 6, y);
    const w = Math.round((player.superT / 600) * 40);
    ctx.fillStyle = '#2a1a14';
    ctx.fillRect(8 + b.width, y + 4, 42, 5);
    ctx.fillStyle = (player.superT >> 3) % 2 && player.superT < 120 ? '#ffffff' : '#7bd389';
    ctx.fillRect(9 + b.width, y + 5, w, 3);
  }
}

export function drawBossBar(ctx, boss, viewW, shownHp) {
  const w = Math.min(150, viewW - 140);
  const x = Math.round(viewW / 2 - w / 2);
  const y = 8;
  drawText(ctx, boss.name, viewW / 2, y - 1, { align: 'center', color: '#ffe08a', outline: '#2a1a14' });
  ctx.fillStyle = '#2a1a14';
  ctx.fillRect(x - 1, y + 9, w + 2, 7);
  ctx.fillStyle = '#5a3a4a';
  ctx.fillRect(x, y + 10, w, 5);
  const fw = Math.round((shownHp / boss.maxHp) * w);
  ctx.fillStyle = '#ff4d6d';
  ctx.fillRect(x, y + 10, fw, 5);
  ctx.fillStyle = '#ff99aa';
  ctx.fillRect(x, y + 10, fw, 1);
}

// Retrato pequeno da Hérica falando + legenda.
export function drawVoiceBox(ctx, speaker, viewW, viewH, opts = {}) {
  const text = speaker.text;
  if (!text) return;
  const who = speaker.who;
  const portrait = who === 'herica' ? pickPortrait(performance.now()) : pickBossPortrait(who);
  // balão compacto: letra pequena (0,5) e rostinho de 15 px; largura acompanha a fala
  const ts = 0.5;
  const ph = 15;
  const pw = Math.round((portrait.width * ph) / portrait.height);
  const maxW = Math.min(viewW - 12, Math.round(viewW * 0.7), 200);
  const lines = wrapText(text, maxW - pw - 10, ts);
  const textW = Math.max(...lines.map((l) => textWidth(l, ts)));
  const boxW = Math.min(maxW, pw + 10 + Math.ceil(textW));
  const x = Math.round(viewW / 2 - boxW / 2);
  const lineH = 6;
  const boxH = Math.max(ph + 4, lines.length * lineH + 5);
  const y = opts.top ? 19 : viewH - boxH - (opts.bottomMargin ?? 44);
  ctx.fillStyle = opts.compact ? 'rgba(30,16,40,0.66)' : 'rgba(30,16,40,0.88)';
  ctx.fillRect(x, y, boxW, boxH);
  ctx.fillStyle = '#ffe08a';
  ctx.fillRect(x, y, boxW, 1);
  ctx.fillRect(x, y + boxH - 1, boxW, 1);
  ctx.fillRect(x, y, 1, boxH);
  ctx.fillRect(x + boxW - 1, y, 1, boxH);
  ctx.fillStyle = who === 'herica' ? '#3c2a3a' : '#4a2a5a';
  ctx.fillRect(x + 2, y + 2, pw, ph);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(portrait, x + 2, y + 2, pw, ph);
  ctx.imageSmoothingEnabled = false;
  const ty = y + (boxH - lines.length * lineH) / 2 + 1.5;
  lines.forEach((l, i) => drawText(ctx, l, x + pw + 6, ty + i * lineH, { color: '#ffffff', scale: ts, outline: opts.compact ? '#1e1028' : null }));
}

let blinkUntil = 0;
let nextBlink = 0;
export function pickPortrait(now) {
  const P = ART.portrait;
  if (now > nextBlink) {
    blinkUntil = now + 120;
    nextBlink = now + 2200 + Math.random() * 2500;
  }
  const blink = now < blinkUntil;
  const lvl = audio.voiceLevel();
  const mouth = lvl > 0.3 ? 'open' : lvl > 0.12 ? 'half' : 'closed';
  return P[mouth + (blink ? 'Blink' : '')];
}

// Vilão falando: alterna boca aberta/fechada com o volume da voz.
function pickBossPortrait(who) {
  const lvl = audio.voiceLevel();
  const F = ART.bossFace[who];
  if (lvl <= 0.25) return F.closed;
  return F.open2 && (performance.now() / 150) & 1 ? F.open2 : F.open;
}

// Letreiro grande no meio da tela.
export function drawBanner(ctx, viewW, viewH, title, sub, t, at = 0.36) {
  const h = sub ? 44 : 30;
  const y = Math.round(viewH * at - h / 2);
  const slide = Math.min(1, t / 12);
  const w = Math.round(viewW * slide);
  ctx.fillStyle = 'rgba(30,16,40,0.82)';
  ctx.fillRect(Math.round(viewW / 2 - w / 2), y, w, h);
  if (slide < 1) return;
  drawText(ctx, title, viewW / 2, y + 7, { align: 'center', scale: 2, color: '#ffe08a', outline: '#2a1a14' });
  if (sub) drawText(ctx, sub, viewW / 2, y + 30, { align: 'center', color: '#ffffff' });
}

export { textWidth };
