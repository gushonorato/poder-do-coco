// Todos os gráficos do jogo vêm dos atlas em assets/sprites: pixel art gerada
// com IA (Higgsfield) a partir das fotos de referência e processada por
// tools/sprites/process.py.
import { facingSet, flipH, makeCanvas } from './gfx/pixel.js';
import { markHD, RENDER_SCALE } from './gfx/hd.js';

export const ART = {};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar ' + src));
    img.src = src;
  });
}

// Recorta o atlas (células iguais lado a lado) em canvases por nome de quadro.
function slice(img, meta) {
  const out = {};
  meta.frames.forEach((name, i) => {
    const c = makeCanvas(meta.cellW, meta.cellH);
    c.getContext('2d').drawImage(img, i * meta.cellW, 0, meta.cellW, meta.cellH, 0, 0, meta.cellW, meta.cellH);
    out[name] = c;
  });
  return out;
}

// Achata/estica verticalmente mantendo os pés no chão (efeito de "fazer força").
function squash(src, k) {
  const c = makeCanvas(src.width, src.height);
  const h = Math.round(src.height * k);
  const w = Math.round(src.width * (1 + (1 - k) * 0.6));
  c.getContext('2d').drawImage(src, Math.round((src.width - w) / 2), src.height - h, w, h);
  return c;
}

// Corta as bordas transparentes (itens vêm em células do tamanho do maior item).
function trim(src) {
  const g = src.getContext('2d');
  const { data, width, height } = g.getImageData(0, 0, src.width, src.height);
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3] > 0) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return src;
  const c = makeCanvas(x1 - x0 + 1, y1 - y0 + 1);
  c.getContext('2d').drawImage(src, -x0, -y0);
  return c;
}

function rot90(src) {
  const c = makeCanvas(src.height, src.width);
  const g = c.getContext('2d');
  g.translate(src.height, 0);
  g.rotate(Math.PI / 2);
  g.drawImage(src, 0, 0);
  return c;
}

// Recorta um canvas deixando só a parte de cima (retrato no balão de fala).
function cropTop(src, h) {
  const c = makeCanvas(src.width, h);
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}

const sets = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, facingSet(v)]));

const BG_NAMES = ['congresso', 'catedral', 'ministerios', 'museu', 'torretv', 'ipe_amarelo', 'ipe_rosa', 'ipe_roxo', 'cerrado', 'pontejk', 'alvorada'];

export async function loadArt() {
  const index = await fetch('assets/sprites/atlas.json').then((r) => r.json());
  // Cartões-postais de Brasília (cenários)
  const bgScale = (await fetch('assets/bg/index.json').then((r) => r.json()).catch(() => ({}))).scale || 1;
  ART.bg = {};
  await Promise.all(
    BG_NAMES.map(async (n) => {
      try {
        const img = await loadImage(`assets/bg/${n}.png`);
        const c = makeCanvas(img.width, img.height);
        c.getContext('2d').drawImage(img, 0, 0);
        ART.bg[n] = markHD(c, bgScale);
      } catch {
        /* sem a imagem: o cenário usa o desenho em código */
      }
    })
  );
  const A = {};
  await Promise.all(
    Object.entries(index).map(async ([name, meta]) => {
      const img = await loadImage(`assets/sprites/${name}.png`);
      A[name] = slice(img, meta);
      A[name]._meta = meta;
    })
  );

  const S = A.miguel._meta.scale || 1; // pixels reais por pixel lógico nos atlas

  // ---------------- Miguel
  const m = A.miguel;
  const mm = m._meta;
  // Pose do cocô: vira de costas para o monstro (quadros espelhados) e faz força.
  // 0 = agachado pronto, 1 = fazendo força, 2 = alívio, 3 = orgulhoso
  const poop = [m.force0, m.force1, m.force2, m.force3].map((f) => flipH(f));
  ART.miguel = {
    sets: sets({
      // respiração: neutro, inspira, inspira, neutro, expira, expira, neutro, neutro, pisca, neutro
      idle: [m.idle0, m.idle1, m.idle1, m.idle0, m.idle3, m.idle3, m.idle0, m.idle0, m.blink, m.idle0],
      // ciclo de 6 quadros: pisa, passa a perna, estica o pé à frente (x2).
      // (os quadros 2 e 6 da IA repetiam o "pisa" e deixavam o passo manco)
      walk: [0, 1, 3, 4, 5, 7].map((i) => m['walk' + i]),
      jump: [m.jump],
      fall: [m.fall],
      hurt: [m.hurt],
      victory: [m.victory0, m.victory1, m.victory0, m.thumbs],
      poop,
    }),
    frameW: mm.cellW / S,
    frameH: mm.cellH / S,
    // de onde sai o cocô (quadro olhando para a direita = bumbum à direita)
    poopButt: { x: Math.round(mm.cellW / S / 2 + 7), y: mm.cellH / S - 18 },
  };

  // ---------------- Hérica
  const h = A.herica;
  ART.herica = {
    sets: sets({
      idle: [h.idle0],
      walk: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => h['walk' + i]),
      scared: [h.scared0, h.scared1],
      cheer: [h.cheer, h.hug],
      hug: [h.hug],
    }),
  };
  const p = A.portrait;
  ART.portraitFull = { closed: p.closed, half: p.half, open: p.open };
  // Balão de fala: recorte centrado no rosto (do topo do cabelo ao queixo),
  // reduzido para ~28 px lógicos de altura.
  const faceCrop = (src) => {
    const x0 = 9 * S, y0 = 3 * S, w = 31 * S, h = 35 * S;
    const outH = 28 * S;
    let outW = Math.round((w * outH) / h);
    outW += (S - (outW % S)) % S;
    const cv = makeCanvas(outW, outH);
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(src, x0, y0, w, h, 0, 0, outW, outH);
    return cv;
  };
  ART.portrait = {};
  for (const k of ['closed', 'half', 'open']) {
    ART.portrait[k] = faceCrop(p[k]);
    ART.portrait[k + 'Blink'] = ART.portrait[k];
  }

  // ---------------- Simba
  const s = A.simba;
  ART.simba = {
    sets: sets({
      idle: [s.idle0, s.idle1],
      run: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => s['run' + i]),
      bark: [s.bark, s.idle0],
      jump: [s.jump],
      sad: [s.sad],
    }),
  };

  // ---------------- Monstros
  const e = A.minions;
  const en = sets({
    refri: [e.refri0, e.refri1],
    cookie: [e.cookie_idle],
    cookieJump: [e.cookie_jump],
    salgadinho: [e.salg0, e.salg1],
    pizza: [e.pizza0, e.pizza1],
  });
  // ART.enemy.<nome>.<animação>
  ART.enemy = {
    refri: { walk: en.refri },
    cookie: { idle: en.cookie, jump: en.cookieJump },
    salgadinho: { fly: en.salgadinho },
    pizza: { roll: en.pizza },
  };
  const r = A.rolha;
  const c = A.constipador;
  ART.boss = {
    generalRolha: sets({ idle: [r.idle0, r.idle1], squash: [r.squash], jump: [r.jump], hurt: [r.hurt], throw: [r.throw] }),
    constipador: sets({ float: [c.float0, c.float1], laugh: [c.laugh0, c.laugh1], attack: [c.attack], hurt: [c.hurt] }),
  };
  // Vilões no balão de fala: sprite inteiro em meia escala, olhando para a esquerda.
  // vilão reduzido (cabeça e tronco), com altura lógica de ~30 px
  const half = (img) => {
    const t = trim(flipH(img));
    const k = (24 * S) / t.height;
    const w = Math.round(t.width * k);
    const cv = makeCanvas(w + ((S - (w % S)) % S), 24 * S);
    const g = cv.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(t, 0, 0, w, 24 * S);
    return cv;
  };
  ART.bossFace = {
    rolha: { closed: half(r.idle0), open: half(r.throw) },
    constipador: { closed: half(c.float0), open: half(c.laugh1), open2: half(c.laugh0) },
  };


  // ---------------- Itens e comidas
  ART.item = {};
  ART.junk = {};
  {
    const it = {};
    for (const [k, v] of Object.entries(A.items)) if (k !== '_meta') it[k] = trim(v);
    const pick = (k) => (it[k] ? [it[k]] : null);
    Object.assign(ART.item, {
      poop: [it.poop, flipH(it.poop)],
      poopBig: [it.poopBig, flipH(it.poopBig)],
      poopPile: [it.poopPile],
      cloudFart: [it.fart, flipH(it.fart)],
      heart: [it.heart],
      heartEmpty: [it.heartEmpty],
      star: [it.star],
      flag: [it.flag, it.flag],
    });
    for (const k of ['apple', 'water', 'broccoli', 'papaya', 'plum', 'orange', 'pear', 'watermelon']) {
      const f = pick(k);
      if (f) ART.item[k] = f;
    }
    for (const k of ['soda', 'pizza', 'burger', 'fries', 'chocolate', 'candy']) {
      if (it[k]) ART.junk[k] = [it[k], rot90(it[k])];
    }
  }

  // logo do título
  try {
    const li = await loadImage('assets/sprites/logo.png');
    const lc = makeCanvas(li.width, li.height);
    lc.getContext('2d').drawImage(li, 0, 0);
    ART.logo = lc;
  } catch {
    ART.logo = null;
  }

  markAll(ART, S);
  if (S !== RENDER_SCALE) console.warn(`atlas com escala ${S}, tela com ${RENDER_SCALE}`);
}

// Marca como HD todos os canvases prontos (width/height passam a ser lógicos).
function markAll(obj, s, seen = new Set()) {
  if (!obj || typeof obj !== 'object' || seen.has(obj)) return;
  seen.add(obj);
  if (obj instanceof HTMLCanvasElement) {
    markHD(obj, s);
    return;
  }
  for (const v of Object.values(obj)) markAll(v, s, seen);
}

// Escolhe o quadro de um facingSet.
export function frameOf(set, facing, i, white = false) {
  const arr = white ? (facing < 0 ? set.whiteLeft : set.whiteRight) : facing < 0 ? set.left : set.right;
  return arr[((i % arr.length) + arr.length) % arr.length];
}
