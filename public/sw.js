// =============================================================================
// Service Worker — farmerstail PWA (audit #94, #97, #85, #104 통합 수정)
// =============================================================================
//
// # 핵심 정책 (이전 버전과 다른 점)
//
// 1) **Next.js _next/static/* hashed chunk 는 캐시 안 함** (audit #94)
//    - Next 가 빌드 시 chunk URL 에 content hash 박음 → 브라우저 HTTP 캐시
//      (immutable, max-age=31536000) 가 이미 최적. SW 가 추가 캐시하면 새
//      배포 후 옛 chunk 가 영구 보관 → ChunkLoadError / 흰 화면.
//    - 네트워크에 위임 → 새 배포 시 브라우저가 새 hash 자동 인지.
//
// 2) **인증 페이지 SW 캐시 제외** (audit #97)
//    - /dashboard, /mypage, /dogs, /cart, /checkout, /survey, /admin 같은
//      개인 정보 페이지가 SW 캐시에 평문 저장되면 가족 공유 폰에서 다른
//      사용자에게 노출 위험.
//
// 3) **/monitoring (Sentry tunnel) 명시 bypass** (audit #85)
//    - SW 가 가로채면 source map 업로드/이벤트 전송 실패.
//
// 4) **CACHE_NAME 에 빌드 SHA 자동 주입** (audit #85)
//    - 수동 v3 → v4 bump 대신 BUILD_SHA 으로 자동 invalidate.
//    - sw.js 자체가 매 빌드마다 새 hash 라 자동 update 사이클 작동.
//
// # 캐시 한도 (iOS Safari ~50MB)
//   - NAV: 평균 ~5KB · 60개 ≈ 300KB
//   - ASSET: 평균 ~80KB · 80개 ≈ 6.4MB (단 _next/static 제외라 더 작음)
// =============================================================================

// 캐시 버전 — 매 빌드마다 scripts/inject-build-sha.mjs (prebuild) 가 자동
// 으로 git SHA + timestamp 주입. 이 placeholder 'farmerstail-v5' 는 dev 용
// 기본값이며 build 시점에 'farmerstail-<sha12>-<ts>' 로 교체됨. SW 자체
// 내용이 변경되면 브라우저가 새 sw.js 받아 → install → activate → 옛 캐시
// 자동 정리. 사용자가 PWA 다시 켤 때 toast "새 버전이 준비됐어요" 노출.
// (audit #85 후반 — R29 에서 prebuild 자동화 완성)
const CACHE_NAME = 'farmerstail-v5'

const NAV_CACHE_MAX_ENTRIES = 60
const ASSET_CACHE_MAX_ENTRIES = 80

const PRECACHE_URLS = [
  '/offline',
  '/logo.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

/**
 * SW 캐시 제외 navigation prefix (개인 정보 페이지 — audit #97).
 * 다중 사용자 공유 폰 시나리오에서 옛 사용자 HTML 이 새 사용자에게 노출되는
 * 위험 차단. 캐시 대신 매번 네트워크 — 오프라인 시 /offline fallback.
 */
const AUTH_PATH_PREFIXES = [
  '/dashboard',
  '/mypage',
  '/dogs',
  '/cart',
  '/checkout',
  '/survey',
  '/admin',
  '/vet/', // 외부 수의사 토큰 페이지
]

function isAuthPath(url) {
  try {
    const u = new URL(url)
    return AUTH_PATH_PREFIXES.some((p) => u.pathname.startsWith(p))
  } catch {
    return false
  }
}

/**
 * SW 캐시 제외 자원 — Next.js hashed chunk 와 Sentry tunnel (audit #94, #85).
 * - _next/static/* : 이미 immutable HTTP 캐시. SW 캐시는 stale chunk 원인.
 * - _next/image     : Next.js 이미지 변환 endpoint — 자체 캐시 보유.
 * - /monitoring     : Sentry tunnel — SW 가로채면 source map 업로드 실패.
 */
function shouldSkipCache(url) {
  try {
    const u = new URL(url)
    return (
      u.pathname.startsWith('/_next/static/') ||
      u.pathname.startsWith('/_next/image') ||
      u.pathname.startsWith('/monitoring')
    )
  } catch {
    return false
  }
}

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

// 설치: 정적 자원 프리캐시. skipWaiting 호출 안 함 (audit #104 와 호환).
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        console.log('[SW] Some precache URLs failed, continuing...')
      })
    }),
  )
})

// SKIP_WAITING — 사용자 명시 액션 후 ServiceWorkerRegister 가 메시지 보냄.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// 활성화: 이전 캐시 정리 (BUILD_SHA 다른 모든 farmerstail-* 캐시).
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      ),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  // API/인증/외부 도메인 요청은 캐시하지 않음.
  if (
    request.url.includes('/api/') ||
    request.url.includes('supabase.co') ||
    request.url.includes('toss') ||
    request.method !== 'GET'
  ) {
    return
  }

  // _next/static/*, _next/image, /monitoring 은 SW 가로채지 않음 (audit #94, #85).
  if (shouldSkipCache(request.url)) {
    return
  }

  // 네비게이션 요청 (페이지 이동).
  if (request.mode === 'navigate') {
    // 인증 페이지는 캐시 대신 매번 네트워크 — audit #97 다중 사용자 노출 차단.
    if (isAuthPath(request.url)) {
      event.respondWith(
        fetch(request).catch(() => caches.match('/offline')),
      )
      return
    }

    event.respondWith(
      fetch(request)
        .then((response) => {
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
          // 파라미터가 다른 진입은 캐시 hit 로 인정해 SPA-스러운 오프라인 동작.
          return caches
            .match(request, { ignoreSearch: true })
            .then((cached) => cached || caches.match('/offline'))
        }),
    )
    return
  }

  // 정적 자원 (JS, CSS, 이미지, 폰트) — 단 _next/static 은 위에서 제외됨.
  // 남은 건 /logo.png, /icons/*, /fonts/* 같은 long-term 정적.
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
      }),
    )
    return
  }
})

// --- Web Push ---
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

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target =
    (event.notification.data && event.notification.data.url) || '/'
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
    })(),
  )
})
