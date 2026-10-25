/* Service worker: network-first cho shell để nhận giao diện mới ngay,
   hỗ trợ cache nhạc offline (cache 'nhac-audio-v1') và Web Push notification. */
const SHELL_CACHE = 'nhac-shell-v2';
const AUDIO_CACHE = 'nhac-audio-v1';
const SHELL = [
  './',
  'index.html',
  'register.html',
  'app.js',
  'register.js',
  'style.css',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'js/config.js',
  'js/i18n.js',
  'js/theme.js',
  'js/auth.js',
  'js/player.js',
  'js/library.js',
  'js/admin.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL_CACHE)
      .then(c => c.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== SHELL_CACHE && k !== AUDIO_CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Kiểm tra nếu file nhạc đã được người dùng lưu offline trong AUDIO_CACHE
  if (url.pathname.includes('/storage/v1/object/') || req.destination === 'audio') {
    const cleanKey = url.origin + url.pathname;
    e.respondWith(
      caches.open(AUDIO_CACHE).then(cache =>
        cache.match(cleanKey).then(cached => cached || fetch(req))
      )
    );
    return;
  }

  // Chỉ xử lý file cùng origin (shell giao diện)
  if (url.origin !== location.origin) return;

  e.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(SHELL_CACHE).then(c => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match('index.html')))
  );
});

self.addEventListener('push', e => {
  let data = { title: '🎧 Nhạc của tôi', body: '✨ Có bài hát mới vừa được thêm!' };
  try {
    if (e.data) data = { ...data, ...e.data.json() };
  } catch (_) {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png'
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      if (list.length > 0) return list[0].focus();
      return clients.openWindow('./');
    })
  );
});
