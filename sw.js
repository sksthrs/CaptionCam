const cacheName = 'NowMemo-v1.1.0'
const cacheUrls = [
  './',
  './index.html',
  './app.js',
  './style.css',
  './favicon.ico',
  './icon-192x192.png',
  './icon-512x512.png',
  './apple-touch-icon.png'
]

self.addEventListener('install', (ev) => {
  console.log('[Service Worker] installing...')
  ev.waitUntil((async () => {
    const cache = await caches.open(cacheName)
    console.log('[Service Worker] caching...')
    await cache.addAll(cacheUrls)
  })())
})

self.addEventListener('activate', (ev) => {
  console.log('[Service Worker] activation...')
  ev.waitUntil(caches.keys().then((keyList) => {
    return Promise.all(keyList.map((key) => {
      if (key !== cacheName) {
        return caches.delete(key)
      }
    }))
  }))
})

self.addEventListener('fetch', (ev) => {
  console.log('[Service Worker] fetching...')
  // network first, cache second
  ev.respondWith((async () => {
    try
    {
      const response = await fetch(ev.request)
      const cache = await caches.open(cacheName)
      cache.put(ev.request, response.clone())
      return response
    }
    catch (error)
    {
      const r = await caches.match(ev.request)
      if (r) return r
    }
  })())
})
