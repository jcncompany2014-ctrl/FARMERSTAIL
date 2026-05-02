// CACHE_NAME 변경은 모든 사용자의 SW cache 를 invalidate 한다.
// 새 배포 직후 stale chunks 문제 (Next 의 _next/static 해시 파일이 SW 캐시에
// 영구 보관) 발생 시 버전 bump.
// 버전 정책: 의도적 invalidate 필요할 때만 수동 증가. 일상적 deploy 마다
// 올리면 사용자 매번 첫 진입 시 SW 가 모든 자산 재캐시 → 느려짐.
const CACHE_NAME = 'farmerstail-v2'

// 앱 셸에 필요한 정적 자원
// 주의: 여기 있는 경로가 실제 public/ 에 존재해야 함. 누락 파일은 .catch 로
// 통과하지만 의도된 자산이 캐시 안 되면 offline 상태에서 깨질 수 있음.
const PRECACHE_URLS = [
  '/offline',
  '/logo.png',
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

// --- Web Push ---
// 서버에서 웹푸시를 보내면 여기로 수신. payload가 JSON이면 title/body/url 사용.
self.addEventListener('push', (event) => {
  let data = {}
  if (event.data) {
    try {
      data = event.data.json()
    } catch {
      data = { title: '파머스테일', body: event.data.text() }
    }
  }
  const title = data.title || '파머스테일'
  const body = data.body || ''
  const url = data.url || '/'
  const tag = data.tag || 'farmerstail'

  const options = {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag,
    data: { url },
    requireInteraction: data.requireInteraction === true,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

// 알림 클릭 → 해당 URL로 포커스 또는 새 창 열기
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      for (const client of all) {
        try {
          const u = new URL(client.url)
          if (u.pathname === target || client.url === target) {
            await client.focus()
            return
          }
        } catch {
          /* ignore */
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(target)
    })()
  )
})