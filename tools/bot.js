// Robô de teste: joga sozinho para verificar chefões e transições.
// Uso (no console ou via Playwright): import('/tools/bot.js').then(m => m.startBot())
const keys = { left: 'ArrowLeft', right: 'ArrowRight', jump: 'Space', poop: 'KeyX' };
const held = new Set();
function set(name, on) {
  const code = keys[name];
  if (on && !held.has(code)) {
    held.add(code);
    window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code }));
  } else if (!on && held.has(code)) {
    held.delete(code);
    window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code }));
  }
}

export function startBot(opts = {}) {
  const log = (window.__botLog = []);
  let jumpT = 0;
  let lastX = 0;
  let stuck = 0;
  let sameTarget = 0;
  let lastTarget = null;
  let lastHp = 0;
  const id = setInterval(() => {
    const g = window.__game;
    const s = g.scene;
    if (!s || !s.player) {
      for (const k of Object.keys(keys)) set(k, false);
      return;
    }
    const p = s.player;
    if (s.state !== 'play' || p.locked) {
      for (const k of Object.keys(keys)) set(k, false);
      return;
    }
    const px = p.x + p.w / 2;
    // alvo: inimigo mais próximo à frente (ou chefão)
    let target = null;
    let best = 1e9;
    for (const e of s.enemies) {
      if (e.dead || (!e.active && !e.isBoss) || (e.isBoss && !e.hittable)) continue;
      const d = Math.abs(e.x + e.w / 2 - px);
      if (d < best && d < 220) {
        best = d;
        target = e;
      }
    }
    let dir = 1;
    let poop = false;
    // alvo que não morre há muito tempo (atrás de um bloco?): chega perto pulando
    if (target && target === lastTarget && target.hp === lastHp) sameTarget++;
    else sameTarget = 0;
    lastTarget = target;
    lastHp = target ? target.hp : 0;
    if (target && sameTarget > 70 && !target.isBoss) {
      dir = target.x > px ? 1 : -1;
      poop = true;
      stuck = 99;
    } else if (target) {
      const tx = target.x + target.w / 2;
      const side = tx > px ? 1 : -1;
      const want = target.isBoss ? 75 : 55;
      if (best > want + 15) dir = side;
      else if (best < want - 15) dir = -side;
      else dir = 0;
      poop = true;
      // vira para o alvo antes de atirar
      if (dir === 0 && p.facing !== side) dir = side;
    } else if (opts.stay) dir = 0;
    // pula projéteis que chegam perto
    const danger = s.hazards.some((h) => Math.abs(h.x + h.w / 2 - px) < 26 && h.y > p.y - 40 && (h.active === undefined || h.active));
    set('left', dir < 0);
    set('right', dir > 0);
    set('poop', poop && dir !== -Math.sign((target?.x || 0) - p.x) * 1 ? poop : poop);
    // preso numa parede/bloco: pula
    if (dir !== 0 && Math.abs(p.x - lastX) < 0.2 && p.onGround) stuck++;
    else stuck = 0;
    lastX = p.x;
    if ((danger || stuck > 3) && jumpT <= 0) {
      set('jump', true);
      jumpT = 6;
    } else if (jumpT-- <= 0) set('jump', false);
  }, 50);
  window.__stopBot = () => {
    clearInterval(id);
    for (const k of Object.keys(keys)) set(k, false);
  };
  return log;
}
