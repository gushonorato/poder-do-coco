// PODER DO COCÔ — ponto de entrada: tela, laço principal, cenas e menus.
import { audio } from './audio.js';
import { initInput, input } from './input.js';
import { loadArt } from './art.js';
import { loadVoices } from './voices.js';
import { hdContext, RENDER_SCALE, VIEW_H } from './gfx/hd.js';
import { TitleScene } from './scenes/title.js';
import { IntroScene } from './scenes/intro.js';
import { PlayScene } from './scenes/play.js';
import { EndingScene } from './scenes/ending.js';

const STEP = 1 / 60;
const SAVE_KEY = 'pdc_save';

// Tela cheia: Android e iPad deixam o site ocupar a tela toda; iPhone não
// (lá só dá para ter tela cheia adicionando à Tela de Início).
const FS_SUPPORTED = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
const isStandalone = () =>
  navigator.standalone === true || matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches;
function enterFullscreen() {
  const el = document.documentElement;
  const fn = el.requestFullscreen || el.webkitRequestFullscreen;
  try {
    const p = fn?.call(el, { navigationUI: 'hide' });
    p?.then?.(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
  } catch {
    /* sem suporte: tudo bem */
  }
}

// Instalar como app: Android/Chrome oferece a janela de instalação
// (beforeinstallprompt); no iPhone/iPad mostramos o passo a passo.
const IS_IOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  updateControls();
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  updateControls();
});

// Celular/tablet? Vários sinais, porque cada navegador expõe coisas diferentes.
function detectTouch() {
  const mq = (q) => window.matchMedia && matchMedia(q).matches;
  return (
    mq('(pointer: coarse)') ||
    mq('(any-pointer: coarse)') ||
    (navigator.maxTouchPoints || 0) > 0 ||
    'ontouchstart' in window ||
    /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|Opera Mini/i.test(navigator.userAgent)
  );
}

const root = document.getElementById('game');
const screen = document.getElementById('screen');
const sctx = screen.getContext('2d');
const $ = (sel) => root.querySelector(sel);

const game = {
  viewW: 320,
  viewH: VIEW_H,
  touch: detectTouch(),
  vcanvas: null,
  vctx: null,
  scene: null,
  paused: false,
  fade: { a: 1, target: 0, speed: 1 / 20 },
  pendingScene: null,
  gestured: false,

  go(name, arg) {
    if (this.pendingScene) return;
    this.pendingScene = { name, arg };
    this.fadeOut(18);
  },
  fadeOut(frames = 18) {
    this.fade.target = 1;
    this.fade.speed = 1 / frames;
  },
  fadeIn(frames = 18) {
    this.fade.target = 0;
    this.fade.speed = 1 / frames;
  },
  setScene(name, arg) {
    this.scene?.exit?.();
    input.releaseAll();
    const S = { title: TitleScene, intro: IntroScene, play: PlayScene, ending: EndingScene }[name];
    this.scene = new S(this, arg);
    this.scene.enter();
    updateControls();
  },
  load() {
    try {
      return JSON.parse(localStorage.getItem(SAVE_KEY)) || {};
    } catch {
      return {};
    }
  },
  save(patch) {
    try {
      const cur = this.load();
      localStorage.setItem(SAVE_KEY, JSON.stringify({ ...cur, ...patch, unlocked: Math.max(cur.unlocked || 1, patch.unlocked || 1) }));
    } catch {
      /* sem armazenamento: tudo bem */
    }
  },
  // Primeiro toque do usuário: libera áudio, tela cheia e paisagem.
  // Toque em JOGAR/FASE 2: libera o áudio e, no celular, entra em tela cheia.
  firstGesture() {
    audio.unlock();
    this.gestured = true;
    if (this.touch && FS_SUPPORTED && !isFullscreen() && !isStandalone()) enterFullscreen();
  },
  setHint(on) {
    $('.btn.poop').classList.toggle('hint', !!on);
  },
  showSkip(cb) {
    const b = $('#btn-skip');
    b.hidden = false;
    b.onclick = (e) => {
      e.stopPropagation();
      cb();
    };
  },
  hideSkip() {
    $('#btn-skip').hidden = true;
  },
  showMenu(items, title) {
    const m = $('#menu');
    m.innerHTML = '';
    if (title) {
      const h = document.createElement('div');
      h.className = 'menu-title';
      h.textContent = title;
      m.appendChild(h);
    }
    for (const it of items) {
      const b = document.createElement('button');
      b.className = 'menu-btn' + (it.small ? ' small' : '');
      b.innerHTML = `<span class="ico">${it.icon || ''}</span><span>${it.label}</span>`;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        it.action();
      });
      m.appendChild(b);
    }
    m.hidden = false;
  },
  hideMenu() {
    $('#menu').hidden = true;
  },
  pause(on) {
    if (on === this.paused) return;
    if (!(this.scene instanceof PlayScene) && on) return;
    this.paused = on;
    input.releaseAll();
    if (on) {
      audio.pause();
      this.showMenu(
        [
          { label: 'CONTINUAR', icon: '▶', action: () => this.pause(false) },
          { label: 'RECOMEÇAR FASE', icon: '↻', small: true, action: () => { this.pause(false); this.go('play', this.scene.levelIndex); } },
          { label: 'INÍCIO', icon: '⌂', small: true, action: () => { this.pause(false); this.go('title'); } },
        ],
        'PAUSA'
      );
    } else {
      audio.resume();
      this.hideMenu();
    }
    updateControls();
  },
};
window.__game = game; // útil para depurar no console

function updateControls() {
  const playing = game.scene?.wantsControls && !game.paused;
  const inPlay = game.scene instanceof PlayScene;
  const inTitle = game.scene instanceof TitleScene;
  $('#controls').hidden = !(playing && game.touch);
  $('#topbar').hidden = !((inPlay && !game.paused) || inTitle);
  $('#btn-pause').hidden = !inPlay;
  $('#btn-fs').hidden = !(game.touch && FS_SUPPORTED && !isFullscreen() && !isStandalone());
  $('#btn-install').hidden = !(inTitle && !isStandalone() && (installPrompt || IS_IOS));
}

// ------------------------------------------------------------------ tela
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  screen.width = Math.round(w * dpr);
  screen.height = Math.round(h * dpr);
  const newW = Math.max(192, Math.min(300, Math.round((VIEW_H * w) / h)));
  const changed = newW !== game.viewW || !game.vcanvas;
  game.viewW = newW;
  if (changed) {
    // tela interna com RENDER_SCALE x mais pixels; o jogo desenha em coordenadas lógicas
    game.vcanvas = document.createElement('canvas');
    game.vcanvas.width = newW * RENDER_SCALE;
    game.vcanvas.height = VIEW_H * RENDER_SCALE;
    game.vctx = hdContext(game.vcanvas.getContext('2d'));
    game.scene?.resize?.();
  }
  const portrait = game.touch && h > w;
  $('#rotate').hidden = !portrait;
  if (portrait) {
    if (!game.paused && game.scene instanceof PlayScene) {
      game.pause(true);
      game.pausedByRotate = true;
    }
  } else if (game.pausedByRotate) {
    // voltou para a horizontal: continua o jogo sozinho
    game.pausedByRotate = false;
    game.pause(false);
  }
}

function blit() {
  const W = screen.width;
  const H = screen.height;
  const vw = game.vcanvas.width;
  const vh = game.vcanvas.height;
  const scale = Math.min(W / vw, H / vh);
  const dw = Math.round(vw * scale);
  const dh = Math.round(vh * scale);
  sctx.imageSmoothingEnabled = false;
  sctx.fillStyle = '#140a1f';
  sctx.fillRect(0, 0, W, H);
  sctx.drawImage(game.vcanvas, Math.round((W - dw) / 2), Math.round((H - dh) / 2), dw, dh);
}

// ------------------------------------------------------------------ laço
let last = performance.now();
let acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;
  if (!game.paused && !document.hidden) {
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 5) {
      if (input.pausePressed && game.scene instanceof PlayScene) {
        game.pause(true);
        break;
      }
      game.scene.update(STEP);
      input.endFrame();
      acc -= STEP;
      steps++;
      // transições
      const f = game.fade;
      if (f.a !== f.target) f.a = f.target > f.a ? Math.min(f.target, f.a + f.speed) : Math.max(f.target, f.a - f.speed);
      if (game.pendingScene && f.a >= 1) {
        const { name, arg } = game.pendingScene;
        game.pendingScene = null;
        game.setScene(name, arg);
        game.fadeIn(18);
      }
    }
    if (acc > STEP * 5) acc = 0;
  } else {
    if (input.pausePressed && game.paused) game.pause(false);
    input.endFrame();
  }
  const ctx = game.vctx;
  ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 1;
  ctx.save();
  game.scene.render(ctx);
  ctx.restore();
  if (game.fade.a > 0) {
    ctx.fillStyle = `rgba(20,10,31,${game.fade.a})`;
    ctx.fillRect(0, 0, game.viewW, VIEW_H);
  }
  if (game.paused) {
    ctx.fillStyle = 'rgba(20,10,31,0.55)';
    ctx.fillRect(0, 0, game.viewW, VIEW_H);
  }
  blit();
}

// ------------------------------------------------------------------ início
async function boot() {
  await loadArt();
  initInput(root);
  loadVoices();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (game.scene instanceof PlayScene) game.pause(true);
      else audio.pause();
    } else if (!game.paused) audio.resume();
  });
  // Primeiro toque na tela: garante que os botões de celular apareçam.
  const becomeTouch = () => {
    if (game.touch) return;
    game.touch = true;
    updateControls();
    resize();
  };
  window.addEventListener('touchstart', becomeTouch, { passive: true });
  window.addEventListener('pointerdown', (e) => e.pointerType === 'touch' && becomeTouch(), { passive: true });

  // Qualquer toque libera o áudio (política dos navegadores).
  root.addEventListener('pointerup', () => audio.unlock(), { passive: true });
  window.addEventListener('keydown', () => audio.unlock(), { once: false });

  $('#btn-fs').addEventListener('click', (e) => {
    e.stopPropagation();
    audio.unlock();
    enterFullscreen();
  });
  for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(ev, () => { updateControls(); resize(); });
  $('#btn-install').addEventListener('click', (e) => {
    e.stopPropagation();
    audio.unlock();
    audio.sfx('select');
    if (IS_IOS) {
      $('#install-help').hidden = false;
    } else if (installPrompt) {
      installPrompt.prompt();
      installPrompt.userChoice.finally(() => {
        installPrompt = null;
        updateControls();
      });
    }
  });
  $('#install-ok').addEventListener('click', (e) => {
    e.stopPropagation();
    $('#install-help').hidden = true;
  });

  $('#btn-pause').addEventListener('click', (e) => {
    e.stopPropagation();
    game.pause(true);
  });
  const mute = $('#btn-mute');
  const syncMute = () => (mute.textContent = audio.muted ? '🔇' : '🔊');
  syncMute();
  mute.addEventListener('click', (e) => {
    e.stopPropagation();
    audio.setMuted(!audio.muted);
    syncMute();
  });

  resize();
  const params = new URLSearchParams(location.search);
  const start = params.get('cena');
  if (start === 'fase1') game.setScene('play', 0);
  else if (start === 'fase2') game.setScene('play', 1);
  else if (start === 'intro') game.setScene('intro');
  else if (start === 'fim') game.setScene('ending');
  else game.setScene('title');
  game.fadeIn(30);
  requestAnimationFrame(frame);

  if ('serviceWorker' in navigator && !/^(localhost|127\.|192\.168\.|10\.)/.test(location.hostname)) {
    // Versão nova publicada: quando o service worker novo assume, recarrega uma vez
    // (só se já havia uma versão antiga controlando a página, e fora das fases).
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloaded) return;
      reloaded = true;
      if (!(game.scene instanceof PlayScene)) location.reload();
    });
    navigator.serviceWorker.register('sw.js').then((reg) => reg.update()).catch(() => {});
  }
}

boot().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', `<pre style="color:#fff;position:fixed;top:0;left:0;z-index:99;white-space:pre-wrap">${String(err.stack || err)}</pre>`);
});
