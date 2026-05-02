// CACHE_NAME 변경은 모든 사용자의 SW cache 를 invalidate 한다.
// 새 배포 직후 stale chunks 문제 (Next 의 _next/static 해시 파일이 SW 캐시에
// 영구 보관) 발생 시 버전 bump.
// 버전 정책: 의도적 invalidate 필요할 때만 수동 증가. 일상적 deploy 마다
// 올리면 사용자 매번 첫 진입 시 SW 가 모든 자산 재캐시 → 느려짐.
const CACHE_NAME = 'farmerstail-v3'

// iOS Safari 의 SW cache 한도가 ~50MB 라 무제한 캐싱은 위험 — 한도 초과 시
// OS 가 SW 등록 자체를 evict 해버려서 PWA 가 깨진다. 카테고리별 entry 수를
// 보수적으로 제한해 LRU 근사 트리밍한다 (cache.keys() 가 삽입 순서대로
// 반환되는 Chrome/Safari/Firefox 모두에서의 사실상 동작에 의존).
//   - NAV: navigation HTML 응답 캐시. 평균 ~5KB · 60개 ≈ 300KB
//   - ASSET: 정적 자원 (스크립트/스타일/이미지/폰트). 평균 ~80KB · 80개 ≈ 6.4MB
const NAV_CACHE_MAX_ENTRIES = 60
const ASSET_CACHE_MAX_ENTRIES = 80

// 앱 셸에 필요한 정적 자원
// 주의: 여기 있는 경로가 실제 public/ 에 존재해야 함. 누락 파일은 .catch 로
// 통과하지만 의도된 자산이 캐시 안 되면 offline 상태에서 깨질 수 있음.
const PRECACHE_URLS = [
  '/offline',
  '/logo.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

/**
 * 캐시 LRU 근사 트리밍.
 *
 * 정확한 LRU 가 아니라 "가장 오래 전에 put 된 것부터 삭제" — Cache API 의
 * keys() 는 명세상 순서를 보장하지 않지만 모든 메이저 브라우저(Chrome/Safari/
 * Firefox) 가 삽입 순으로 반환한다. iOS 50MB 안전망용으로는 충분.
 *
 * 모든 cache.put 직후에 호출. 비용은 keys() 를 한 번 얻고 overflow 만큼만
 * delete — 보통 0~1 entry 라 무시할 수 있다.
 */
async function trimCache(cacheName, maxEntries) {
  try {
    const cache = await caches.open(cacheName)
    const keys = await cache.keys()
    if (keys.length <= maxEntries) return
    const overflow = keys.length - maxEntries
    for (let i = 0; i < overflow; i++) {
      await cache.delete(keys[i])
    }
  } catch {
    // 실패해도 정상 동작에 영향 없음 — silently 통과.
  }
}

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
          // 성공 시 캐시에 저장 + LRU 트리밍.
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone)
            trimCache(CACHE_NAME, NAV_CACHE_MAX_ENTRIES)
          })
          return response
        })
        .catch(() => {
          // 오프라인 시 캐시된 페이지 또는 오프라인 페이지.
          // ignoreSearch:true — 같은 path 의 ?utm=xxx / ?ref=xxx 등 마케팅
          // 파라미터가 다른 진입은 캐시 hit 로 인정해 SPA-스러운 오프라인
          // 동작. utm 의 추적 손실은 어차피 오프라인 상황에선 영향 없음.
          return caches
            .match(request, { ignoreSearch: true })
            .then((cached) => {
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
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone)
              trimCache(CACHE_NAME, ASSET_CACHE_MAX_ENTRIES)
            })
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