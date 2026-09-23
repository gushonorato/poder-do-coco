// Gerado por tools/build_sw.py — não edite à mão.
const CACHE = 'poder-do-coco-73f0743e11';
const FILES = [
 "./",
 "index.html",
 "manifest.webmanifest",
 "css/style.css",
 "js/art.js",
 "js/audio.js",
 "js/entities/bosses.js",
 "js/entities/enemies.js",
 "js/entities/pickups.js",
 "js/entities/player.js",
 "js/entities/projectiles.js",
 "js/fx.js",
 "js/gfx/backgrounds.js",
 "js/gfx/cage.js",
 "js/gfx/font.js",
 "js/gfx/hd.js",
 "js/gfx/pixel.js",
 "js/gfx/tiles.js",
 "js/hud.js",
 "js/input.js",
 "js/main.js",
 "js/scenes/common.js",
 "js/scenes/ending.js",
 "js/scenes/intro.js",
 "js/scenes/play.js",
 "js/scenes/title.js",
 "js/version.js",
 "js/voices.js",
 "js/world/level.js",
 "js/world/levels.js",
 "assets/bg/alvorada.png",
 "assets/bg/catedral.png",
 "assets/bg/cerrado.png",
 "assets/bg/congresso.png",
 "assets/bg/index.json",
 "assets/bg/ipe_amarelo.png",
 "assets/bg/ipe_rosa.png",
 "assets/bg/ipe_roxo.png",
 "assets/bg/ministerios.png",
 "assets/bg/museu.png",
 "assets/bg/pontejk.png",
 "assets/bg/torretv.png",
 "assets/icons/icon-180.png",
 "assets/icons/icon-192.png",
 "assets/icons/icon-512.png",
 "assets/icons/icon-maskable-512.png",
 "assets/sprites/atlas.json",
 "assets/sprites/constipador.png",
 "assets/sprites/herica.png",
 "assets/sprites/items.png",
 "assets/sprites/logo.png",
 "assets/sprites/miguel.png",
 "assets/sprites/minions.png",
 "assets/sprites/portrait.png",
 "assets/sprites/rolha.png",
 "assets/sprites/simba.png",
 "assets/voice/boss1.mp3",
 "assets/voice/boss2.mp3",
 "assets/voice/cheer.mp3",
 "assets/voice/fase2.mp3",
 "assets/voice/final.mp3",
 "assets/voice/fruta.mp3",
 "assets/voice/intro.mp3",
 "assets/voice/moral.mp3",
 "assets/voice/retry.mp3",
 "assets/voice/simba.mp3",
 "assets/voice/socorro.mp3",
 "assets/voice/super.mp3",
 "assets/voice/taunt1.mp3",
 "assets/voice/taunt2.mp3"
];

self.addEventListener('install', (e) => {
  // cache: 'reload' = baixa da rede, sem aproveitar cópias antigas do navegador
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Tudo sai do cache desta versão (conjunto consistente de arquivos). Quando uma
  // versão nova é publicada, o service worker novo baixa tudo e a página recarrega sozinha.
  const req = e.request.mode === 'navigate' ? 'index.html' : e.request;
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((r) => r || fetch(e.request)));
});
