#!/usr/bin/env python3
"""Converte as folhas geradas por IA (PNG grande, fundo transparente) em
atlas de pixel art na escala do jogo.

Para cada folha: separa os quadros (colunas/linhas vazias), remove sujeirinhas,
reduz com a mesma escala para todos os quadros da folha (altura-alvo medida num
quadro de referência), unifica a paleta por personagem e monta um atlas com
células de tamanho igual, alinhadas pelos pés.

Uso: python3 tools/sprites/process.py <pasta_das_folhas> assets/sprites
"""
import json
import sys
from pathlib import Path

from PIL import Image

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else '.work/gen')
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else 'assets/sprites')
# Resolução dos sprites em relação à tela lógica do jogo (180 px de altura).
# 3 = cada pixel lógico tem 3x3 pixels de detalhe (jogo renderiza em 540p).
SCALE = 4

# personagem -> lista de folhas: (arquivo, grade (linhas), nomes dos quadros, quadro de referência, altura-alvo)
CONFIG = {
    'miguel': {
        'colors': 40,
        'sheets': [
            ('m_walk8.png', 1, [f'walk{i}' for i in range(8)], 0, 44),
            ('m_idle4.png', 1, ['idle0', 'idle1', 'blink', 'idle3'], 0, 44),
            ('m_misc.png', 1, ['stand0', 'stand1', 'jump', 'fall', 'hurt'], 0, 44),
            ('m_victory.png', 1, ['victory0', 'victory1', 'thumbs'], 2, 44),
            ('m_force.png', 1, ['force0', 'force1', 'force2', 'force3'], 3, 44),
        ],
    },
    'herica': {
        'colors': 40,
        'sheets': [
            ('h_walk8.png', 1, [f'walk{i}' for i in range(8)], 0, 54),
            ('h_sheet.png', 1, ['step0', 'step1', 'scared0', 'scared1', 'cheer', 'hug'], 0, 54),
            ('herica_v2.png', 1, ['idle0'], 0, 54),
        ],
    },
    'portrait': {
        'colors': 48,
        'anchor': 'bbox',
        'sheets': [('h_portrait.png', 1, ['closed', 'half', 'open'], 0, 56)],
    },
    'simba': {
        'colors': 32,
        'sheets': [
            ('s_run8.png', 1, [f'run{i}' for i in range(8)], 0, 29),
            ('s_run.png', 1, ['gallop0', 'gallop1', 'gallop2', 'gallop3', 'bark', 'jump'], 0, 30),
            ('s_idle.png', 1, ['idle0', 'idle1', 'sad'], 0, 32),
        ],
    },
    'rolha': {
        'colors': 40,
        'anchor': 'bbox',
        'sheets': [('b_rolha.png', 1, ['idle0', 'idle1', 'squash', 'jump', 'throw', 'hurt'], 0, 76)],
    },
    'constipador': {
        'colors': 40,
        'anchor': 'bbox',
        'sheets': [('b_constipador.png', 1, ['float0', 'float1', 'laugh0', 'laugh1', 'attack', 'hurt'], 0, 84)],
    },
    'minions': {
        'colors': 48,
        'anchor': 'bbox',
        'sheets': [
            # da primeira folha só o salgadinho voador continua
            ('e_minions.png', 2, [
                ['old_rolha0', 'old_rolha1', 'old_queijo0', 'old_queijo1'],
                ['salg0', 'salg1', 'old_pedra0', 'old_pedra1'],
            ], None, None),
            ('e_minions2.png', 2, [
                ['refri0', 'refri1', 'cookie_idle', 'cookie_jump'],
                ['pizza0', 'pizza1'],
            ], None, None),
        ],
        # alturas-alvo por quadro (a folha mistura monstros diferentes)
        'heights': {'old_': 20, 'salg': 26, 'refri': 26, 'cookie': 21, 'pizza': 20},
        'skip': 'old_',
    },
    'items': {
        'colors': 64,
        'anchor': 'bbox',
        'sheets': [
            ('i_healthy.png', 2, [['apple', 'water', 'broccoli', 'papaya'], ['plum', 'orange', 'pear', 'watermelon']], None, None),
            ('i_junk.png', 2, [['soda', 'pizza', 'burger'], ['fries', 'chocolate', 'candy']], None, None),
            ('i_misc.png', 2, [['poop', 'poopBig', 'poopPile', 'fart'], ['heart', 'heartEmpty', 'flag', 'star']], None, None),
        ],
        'heights': {
            'apple': 16, 'water': 16, 'broccoli': 17, 'papaya': 16, 'plum': 15, 'orange': 15, 'pear': 17, 'watermelon': 13,
            'soda': 15, 'pizza': 15, 'burger': 14, 'fries': 15, 'chocolate': 15, 'candy': 12,
            'poop': 13, 'poopBig': 17, 'poopPile': 8, 'fart': 13, 'heart': 11, 'heartEmpty': 11, 'flag': 46, 'star': 10,
        },
    },
}

ALPHA_T = 40


def runs(mask, min_gap):
    """Segmentos [a, b) de valores True em mask, unindo buracos menores que min_gap."""
    segs = []
    start = None
    gap = 0
    for i, v in enumerate(mask):
        if v:
            if start is None:
                start = i
            gap = 0
            end = i + 1
        elif start is not None:
            gap += 1
            if gap >= min_gap:
                segs.append((start, end))
                start = None
    if start is not None:
        segs.append((start, end))
    return segs


def best_cuts(profile, lo, hi, n):
    """Divide [lo, hi) em n partes cortando nas colunas/linhas menos ocupadas
    perto das posições esperadas (lida com quadros que se encostam)."""
    cuts = [lo]
    span = (hi - lo) / n
    for i in range(1, n):
        c = lo + span * i
        a, b = int(c - span * 0.35), int(c + span * 0.35)
        best = min(range(a, b), key=lambda k: (profile[k], abs(k - c)))
        cuts.append(best)
    cuts.append(hi)
    return list(zip(cuts[:-1], cuts[1:]))


def split_sheet(im, counts):
    """counts: número de quadros em cada linha."""
    a = im.split()[3].point(lambda v: 255 if v > ALPHA_T else 0)
    w, h = im.size
    px = a.load()
    row_prof = [sum(1 for x in range(0, w, 2) if px[x, y]) for y in range(h)]
    ys = [y for y in range(h) if row_prof[y]]
    y_lo, y_hi = ys[0], ys[-1] + 1
    bands = best_cuts(row_prof, y_lo, y_hi, len(counts)) if len(counts) > 1 else [(y_lo, y_hi)]
    out = []
    for (y0, y1), n in zip(bands, counts):
        col_prof = [sum(1 for y in range(y0, y1, 2) if px[x, y]) for x in range(w)]
        xs = [x for x in range(w) if col_prof[x]]
        cols = best_cuts(col_prof, xs[0], xs[-1] + 1, n)
        out.append([im.crop((x0, y0, x1, y1)) for (x0, x1) in cols])
    return out


def clean(frame):
    """Remove componentes pequenos (sombras, riscos de movimento) e recorta."""
    a = frame.split()[3].point(lambda v: 255 if v > ALPHA_T else 0)
    w, h = a.size
    px = a.load()
    seen = [[False] * w for _ in range(h)]
    comps = []
    for y in range(h):
        for x in range(w):
            if px[x, y] and not seen[y][x]:
                stack = [(x, y)]
                seen[y][x] = True
                pts = []
                while stack:
                    cx, cy = stack.pop()
                    pts.append((cx, cy))
                    for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                        if 0 <= nx < w and 0 <= ny < h and px[nx, ny] and not seen[ny][nx]:
                            seen[ny][nx] = True
                            stack.append((nx, ny))
                comps.append(pts)
    if not comps:
        return frame
    biggest = max(len(c) for c in comps)
    keep = Image.new('L', (w, h), 0)
    kp = keep.load()
    for c in comps:
        xs = [p[0] for p in c]
        touches_edge = min(xs) == 0 or max(xs) == w - 1
        if len(c) >= biggest * 0.02 and not (touches_edge and len(c) < biggest * 0.25):
            for (x, y) in c:
                kp[x, y] = 255
    f = frame.copy()
    fa = f.split()[3]
    f.putalpha(Image.composite(fa, Image.new('L', (w, h), 0), keep))
    bb = f.getbbox()
    return f.crop(bb) if bb else f


def downscale(frame, scale):
    w = max(1, round(frame.width * scale))
    h = max(1, round(frame.height * scale))
    sm = frame.resize((w, h), Image.BOX)
    a = sm.split()[3].point(lambda v: 255 if v > 120 else 0)
    sm.putalpha(a)
    return sm


def anchor_x(img, mode):
    if mode == 'bbox':
        return img.width / 2
    # centro de massa da parte de cima (cabeça/tronco): mais estável que a caixa
    a = img.split()[3].load()
    top = int(img.height * 0.55)
    sx = n = 0
    for y in range(top):
        for x in range(img.width):
            if a[x, y]:
                sx += x
                n += 1
    return sx / n if n else img.width / 2


def process(name, cfg):
    frames = {}
    for (file, rows, names, ref, target_h) in cfg['sheets']:
        sheet = Image.open(SRC / file).convert('RGBA')
        counts = [len(names)] if rows == 1 else [len(r) for r in names]
        grid = split_sheet(sheet, counts)
        flat_names = names if rows == 1 else [n for row in names for n in row]
        flat = [f for row in grid for f in row]
        if len(flat) != len(flat_names):
            raise SystemExit(f'{name}/{file}: esperava {len(flat_names)} quadros, achei {len(flat)}')
        flat = [clean(f) for f in flat]
        if ref is not None:
            scale = target_h * SCALE / flat[ref].height
            scaled = [downscale(f, scale) for f in flat]
        else:
            scaled = []
            for n, f in zip(flat_names, flat):
                exact = n in cfg['heights']
                key = n if exact else next(k for k in cfg['heights'] if n.startswith(k))
                # a mesma escala para os 2 quadros do mesmo monstro
                pair = [g for m, g in zip(flat_names, flat) if (m == key if exact else m.startswith(key))]
                s = cfg['heights'][key] * SCALE / max(p.height for p in pair)
                scaled.append(downscale(f, s))
        frames.update({n: f for n, f in zip(flat_names, scaled) if not (cfg.get('skip') and n.startswith(cfg['skip']))})

    # paleta única por personagem
    names = list(frames)
    total_w = sum(f.width for f in frames.values())
    max_h = max(f.height for f in frames.values())
    strip = Image.new('RGBA', (total_w, max_h), (0, 0, 0, 0))
    x = 0
    for n in names:
        strip.alpha_composite(frames[n], (x, 0))
        x += frames[n].width
    pal_img = strip.convert('RGB').quantize(colors=min(160, cfg['colors'] * 2), method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    for n in names:
        f = frames[n]
        q = f.convert('RGB').quantize(palette=pal_img, dither=Image.Dither.NONE).convert('RGBA')
        q.putalpha(f.split()[3])
        frames[n] = q

    # células iguais, pés na base, âncora horizontal no centro da célula
    mode = cfg.get('anchor', 'mass')
    anchors = {n: anchor_x(frames[n], mode) for n in names}
    left = max(anchors[n] for n in names)
    right = max(frames[n].width - anchors[n] for n in names)
    cell_w = int(left + right) + 2
    cell_h = max_h + 1
    # células com tamanho múltiplo da escala (tamanho lógico inteiro)
    cell_w += (-cell_w) % SCALE
    cell_h += (-cell_h) % SCALE
    atlas = Image.new('RGBA', (cell_w * len(names), cell_h), (0, 0, 0, 0))
    for i, n in enumerate(names):
        f = frames[n]
        ox = i * cell_w + round(cell_w / 2 - anchors[n])
        oy = cell_h - f.height
        atlas.alpha_composite(f, (ox, oy))
    OUT.mkdir(parents=True, exist_ok=True)
    atlas.save(OUT / f'{name}.png', optimize=True)
    meta = {'cellW': cell_w, 'cellH': cell_h, 'frames': names, 'scale': SCALE}
    return meta


def main():
    only = set(sys.argv[3:])
    index_path = OUT / 'atlas.json'
    index = json.loads(index_path.read_text()) if index_path.exists() else {}
    for name, cfg in CONFIG.items():
        if only and name not in only:
            continue
        index[name] = process(name, cfg)
        m = index[name]
        print(f"{name:12s} célula {m['cellW']}x{m['cellH']}  {len(m['frames'])} quadros")
    index_path.write_text(json.dumps(index, indent=1, ensure_ascii=False))


if __name__ == '__main__':
    main()
