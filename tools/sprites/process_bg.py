#!/usr/bin/env python3
"""Reduz os marcos de Brasília gerados por IA (PNG transparente) para a escala
dos cenários e salva um PNG por marco em assets/bg/.

Uso: python3 tools/sprites/process_bg.py .work/gen assets/bg
"""
import sys
from pathlib import Path

from PIL import Image

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else '.work/gen')
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else 'assets/bg')

SCALE = 2  # faixas de cenário são desenhadas com 2x de detalhe

# nome -> altura-alvo em pixels lógicos do jogo (tela tem 180 de altura)
TARGETS = {
    'congresso': 96,
    'catedral': 62,
    'ministerios': 42,
    'museu': 36,
    'torretv': 104,
    'ipe_amarelo': 64,
    'ipe_rosa': 60,
    'ipe_roxo': 62,
    'cerrado': 50,
    'pontejk': 62,
    'alvorada': 46,
}


def process(name, h):
    im = Image.open(SRC / f'bg_{name}.png').convert('RGBA')
    a = im.split()[3].point(lambda v: 255 if v > 40 else 0)
    im.putalpha(a)
    im = im.crop(im.getbbox())
    h *= SCALE
    w = max(1, round(im.width * h / im.height))
    w += (-w) % SCALE
    sm = im.resize((w, h), Image.BOX)
    alpha = sm.split()[3].point(lambda v: 255 if v > 110 else 0)
    q = sm.convert('RGB').quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGBA')
    q.putalpha(alpha)
    # corta a transparência sem perder o alinhamento com a escala
    x0, y0, x1, y1 = q.getbbox()
    x0 -= x0 % SCALE
    y0 -= y0 % SCALE
    x1 += (-x1) % SCALE
    y1 += (-y1) % SCALE
    q = q.crop((x0, y0, x1, y1))
    OUT.mkdir(parents=True, exist_ok=True)
    q.save(OUT / f'{name}.png', optimize=True)
    return q.size


if __name__ == '__main__':
    for name, h in TARGETS.items():
        print(f'{name:12s} {process(name, h)}')
