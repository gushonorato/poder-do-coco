// Imagens em alta resolução ("HD") num jogo com coordenadas de 180 px de altura.
// A tela interna é renderizada com RENDER_SCALE vezes mais pixels. Uma imagem HD
// guarda quantos pixels reais tem por pixel lógico (__s) e expõe width/height
// LÓGICOS, para o resto do código continuar posicionando tudo como antes.

export const RENDER_SCALE = 4; // pixels reais por pixel lógico na tela interna
export const BG_SCALE = 2; // detalhe das faixas de cenário (economiza memória no celular)

// A tela mostra 135 px lógicos de altura (câmera "aproximada"). Cenários, chão e
// cenas foram desenhados para 180 px; LIFT é quanto sobe o desenho para o chão
// ficar no lugar certo.
export const VIEW_H = 135;
export const DESIGN_H = 180;
export const LIFT = DESIGN_H - VIEW_H;

// Marca um canvas (já pronto, não será mais redimensionado) como HD.
export function markHD(canvas, s = RENDER_SCALE) {
  if (!canvas || canvas.__s) return canvas;
  const rw = canvas.width;
  const rh = canvas.height;
  canvas.__s = s;
  canvas.__rw = rw;
  canvas.__rh = rh;
  Object.defineProperty(canvas, 'width', { value: rw / s, configurable: true });
  Object.defineProperty(canvas, 'height', { value: rh / s, configurable: true });
  return canvas;
}

// Tamanho real (em pixels) de um canvas, HD ou não.
export const realW = (c) => c.__rw || c.width;
export const realH = (c) => c.__rh || c.height;

// Ensina um contexto a desenhar imagens HD no tamanho lógico:
// drawImage(img, x, y) usa img.width/height lógicos e o recorte de origem é convertido.
export function hdContext(ctx) {
  if (ctx.__hd) return ctx;
  const orig = ctx.drawImage.bind(ctx);
  ctx.drawImage = function (img, ...a) {
    const s = img && img.__s;
    if (!s) return orig(img, ...a);
    if (a.length === 2) return orig(img, a[0], a[1], img.width, img.height);
    if (a.length === 4) return orig(img, a[0], a[1], a[2], a[3]);
    const [sx, sy, sw, sh, dx, dy, dw, dh] = a;
    return orig(img, sx * s, sy * s, sw * s, sh * s, dx, dy, dw, dh);
  };
  ctx.__hd = true;
  return ctx;
}

// Canvas HD novo para desenhar em coordenadas lógicas (w x h lógicos).
export function makeHDCanvas(w, h, s = RENDER_SCALE) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * s);
  c.height = Math.ceil(h * s);
  const ctx = hdContext(c.getContext('2d'));
  ctx.imageSmoothingEnabled = false;
  ctx.scale(s, s);
  return { canvas: c, ctx };
}

// Cópia HD de uma imagem HD (mesmo detalhe) — para tingir, clarear etc.
export function cloneHD(img) {
  const c = document.createElement('canvas');
  c.width = realW(img);
  c.height = realH(img);
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0, c.width, c.height);
  return { canvas: c, ctx: g };
}
