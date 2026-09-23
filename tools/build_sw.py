#!/usr/bin/env python3
"""Gera sw.js com a lista de arquivos do jogo (para funcionar offline).
Rode depois de mudar qualquer arquivo: python3 tools/build_sw.py"""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
files = ['./', 'index.html', 'manifest.webmanifest']
for folder in ['css', 'js', 'assets']:
    for p in sorted((ROOT / folder).rglob('*')):
        if p.is_file() and not p.name.startswith('.'):
            files.append(p.relative_to(ROOT).as_posix())
h = hashlib.sha1()
for f in files[1:]:
    if f == 'js/version.js':
        continue
    h.update((ROOT / f).read_bytes())
version = h.hexdigest()[:10]
# versão visível no jogo (tela de título)
(ROOT / 'js' / 'version.js').write_text(f"// Gerado por tools/build_sw.py.\nexport const VERSION = '{version[:7]}';\n")
sw = f"""// Gerado por tools/build_sw.py — não edite à mão.
const CACHE = 'poder-do-coco-{version}';
const FILES = {json.dumps(files, indent=1)};

self.addEventListener('install', (e) => {{
  // cache: 'reload' = baixa da rede, sem aproveitar cópias antigas do navegador
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(FILES.map((f) => new Request(f, {{ cache: 'reload' }}))))
      .then(() => self.skipWaiting())
  );
}});
self.addEventListener('activate', (e) => {{
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
}});
self.addEventListener('fetch', (e) => {{
  if (e.request.method !== 'GET') return;
  // Tudo sai do cache desta versão (conjunto consistente de arquivos). Quando uma
  // versão nova é publicada, o service worker novo baixa tudo e a página recarrega sozinha.
  const req = e.request.mode === 'navigate' ? 'index.html' : e.request;
  e.respondWith(caches.match(req, {{ ignoreSearch: true }}).then((r) => r || fetch(e.request)));
}});
"""
(ROOT / 'sw.js').write_text(sw)
print(f'sw.js: {len(files)} arquivos, versão {version}')
