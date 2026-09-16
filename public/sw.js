// Service Worker para OrganizaIA - Suporte a PWA & Notificações em Segundo Plano
const CACHE_NAME = 'organizaia-pwa-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
  '/manifest.json'
];

// Instalação do Service Worker e pré-cache de recursos essenciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Falha ao pré-carregar alguns recursos:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Ativação e limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estratégia de Fetch (Network-first para dados dinâmicos com fallback de cache)
self.addEventListener('fetch', (event) => {
  // Ignora requisições não GET ou do Firebase / APIs externas
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  }
});

// Manipulador de Notificações em Segundo Plano (Push e Local Triggers)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if (client.url.includes(self.location.origin)) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Mensagens vindas do React App para disparar notificações imediatas ou agendadas
self.addEventListener('message', (event) => {
  if (!event.data) return;

  const { type, title, body, icon, badge, data, actions } = event.data;

  if (type === 'SHOW_NOTIFICATION') {
    self.registration.showNotification(title || 'OrganizaIA', {
      body: body || 'Lembrete de compromisso financeiro.',
      icon: icon || '/favicon.svg',
      badge: badge || '/favicon.svg',
      tag: data?.tag || 'organizaia-alert',
      renotify: true,
      requireInteraction: false,
      data: data || { url: '/' },
      actions: actions || [
        { action: 'open', title: 'Abrir App' }
      ]
    });
  }
});
