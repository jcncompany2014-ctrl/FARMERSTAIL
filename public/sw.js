const CACHE_NAME = 'farmerstail-v1'

// 앱 셸에 필요한 정적 자원
const PRECACHE_URLS = [
  '/offline',
  '/farmerstailLOGO.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

// 설치: 정적 자원 프리캐시
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // 일부 리소스 실패해도 설치 진행
        console.log('[SW] Some precache URLs failed, continuing...')
      })
    })
  )
  self.skipWaiting()
})

// 활성화: 이전 캐시 정리
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// 페치: 네트워크 우선, 실패 시 캐시
self.addEventListener('fetch', (event) => {
  const { request } = event

  // API/인증 요청은 캐시하지 않음
  if (
    request.url.includes('/api/') ||
    request.url.includes('supabase.co') ||
    request.url.includes('toss') ||
    request.method !== 'GET'
  ) {
    return
  }

  // 네비게이션 요청 (페이지 이동)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 성공 시 캐시에 저장
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          return response
        })
        .catch(() => {
          // 오프라인 시 캐시된 페이지 또는 오프라인 페이지
          return caches.match(request).then((cached) => {
            return cached || caches.match('/offline')
          })
        })
    )
    return
  }

  // 정적 자원 (JS, CSS, 이미지, 폰트)
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((response) => {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
            return response
          })
          .catch(() => cached)

        return cached || fetchPromise
      })
    )
    return
  }
})