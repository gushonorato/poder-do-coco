// Entrada unificada: teclado + controles de toque na tela.
// Estado "held" (segurando) e "pressed" (apertou neste quadro).

const state = {
  left: false,
  right: false,
  jump: false,
  poop: false,
  jumpPressed: false,
  poopPressed: false,
  tapPressed: false, // qualquer toque/tecla (para pular cenas)
  pausePressed: false,
};

const keyMap = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyK: 'jump',
  KeyX: 'poop', KeyJ: 'poop', KeyZ: 'poop', KeyC: 'poop', Enter: 'poop',
};
const keysDown = new Set();
const touch = { left: false, right: false, jump: false, poop: false };

function recompute() {
  const k = (name) => [...keysDown].some((code) => keyMap[code] === name);
  const prevJump = state.jump;
  const prevPoop = state.poop;
  state.left = k('left') || touch.left;
  state.right = k('right') || touch.right;
  state.jump = k('jump') || touch.jump;
  state.poop = k('poop') || touch.poop;
  if (state.jump && !prevJump) state.jumpPressed = true;
  if (state.poop && !prevPoop) state.poopPressed = true;
}

export const input = {
  get left() { return state.left; },
  get right() { return state.right; },
  get jump() { return state.jump; },
  get poop() { return state.poop; },
  get jumpPressed() { return state.jumpPressed; },
  get poopPressed() { return state.poopPressed; },
  get tapPressed() { return state.tapPressed; },
  get pausePressed() { return state.pausePressed; },
  get dir() { return (state.right ? 1 : 0) - (state.left ? 1 : 0); },
  // Chamado ao fim de cada passo de lógica.
  endFrame() {
    state.jumpPressed = false;
    state.poopPressed = false;
    state.tapPressed = false;
    state.pausePressed = false;
  },
  releaseAll() {
    keysDown.clear();
    Object.keys(touch).forEach((k) => (touch[k] = false));
    recompute();
    document.querySelectorAll('.btn.on').forEach((b) => b.classList.remove('on'));
  },
  tap() { state.tapPressed = true; },
};

export function initInput(root) {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      state.pausePressed = true;
      return;
    }
    if (keyMap[e.code]) e.preventDefault();
    if (e.repeat) return;
    keysDown.add(e.code);
    state.tapPressed = true;
    recompute();
  });
  window.addEventListener('keyup', (e) => {
    keysDown.delete(e.code);
    recompute();
  });
  window.addEventListener('blur', () => input.releaseAll());
  document.addEventListener('visibilitychange', () => document.hidden && input.releaseAll());

  // --- Controles de toque ---
  // Direcional: uma zona única; a posição do dedo decide esquerda/direita
  // (assim dá para deslizar o dedo de um lado para o outro).
  const pad = root.querySelector('#pad-move');
  const padPointers = new Map();
  const btnL = pad.querySelector('.left');
  const btnR = pad.querySelector('.right');
  function updatePad() {
    let l = false, r = false;
    const rect = pad.getBoundingClientRect();
    const mid = rect.left + rect.width / 2;
    for (const x of padPointers.values()) {
      if (x < mid) l = true;
      else r = true;
    }
    touch.left = l;
    touch.right = r;
    btnL.classList.toggle('on', l);
    btnR.classList.toggle('on', r);
    recompute();
  }
  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    pad.setPointerCapture?.(e.pointerId);
    padPointers.set(e.pointerId, e.clientX);
    updatePad();
  });
  pad.addEventListener('pointermove', (e) => {
    if (!padPointers.has(e.pointerId)) return;
    padPointers.set(e.pointerId, e.clientX);
    updatePad();
  });
  const padUp = (e) => {
    padPointers.delete(e.pointerId);
    updatePad();
  };
  pad.addEventListener('pointerup', padUp);
  pad.addEventListener('pointercancel', padUp);
  pad.addEventListener('lostpointercapture', padUp);

  for (const name of ['jump', 'poop']) {
    const btn = root.querySelector(`.btn.${name}`);
    const ids = new Set();
    const set = () => {
      touch[name] = ids.size > 0;
      btn.classList.toggle('on', touch[name]);
      recompute();
    };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btn.setPointerCapture?.(e.pointerId);
      ids.add(e.pointerId);
      set();
      navigator.vibrate?.(8);
    });
    const up = (e) => {
      ids.delete(e.pointerId);
      set();
    };
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('lostpointercapture', up);
  }

  // Toque em qualquer lugar (fora dos botões) conta como "tap" para cenas.
  root.addEventListener('pointerdown', () => (state.tapPressed = true));

  // Evita zoom/menu de contexto em toques longos.
  root.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
}
