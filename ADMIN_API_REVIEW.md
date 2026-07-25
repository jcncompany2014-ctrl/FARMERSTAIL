# Admin API 라우트 점검 (계획 B4) — 2026-07-25

`app/api/admin/**` 11개 라우트 일관성 검사. 결론: **isAdmin 가드 누락 0건**(전부 방어됨),
DB 원본 에러 노출 3건만 수정. 나머지는 개선 후보로 기록.

| 라우트 | isAdmin | 입력 검증 | 에러 형식 | rate limit | DB에러 노출 | 비고 |
|---|---|---|---|---|---|---|
| `blog/draft` | ✅ | ✅ zod | `{code,message}` | ✅ | — | 모범 사례 |
| `blog/upload` | ✅ | mime·size 수동 | `{code,message}` | — | — | 업로드류 공통 패턴 |
| `events/upload` | ✅ | mime·size 수동 | `{code,message}` | — | — | 동상 |
| `orders/[id]/partial-cancel` | ✅ | 수동(금액·잔액) | `{code,message}` | — | — | 잔액 초과 거부·멱등키 |
| `orders/[id]/status` | ✅ | FSM 전이 검증 | `{code,message}` | — | — | canTransition 게이트 |
| `orders/export` | ✅ | 쿼리 파라미터 | CSV/텍스트 | — | — | 내보내기 |
| `products/upload` | ✅ | mime·size 수동 | `{code,message}` | — | — | |
| `promotions/qr` | ✅ | 코드 정규화 | `{code,message}` | — | — | |
| `promotions` | ✅ | 수동 | `{code,message}` | — | ~~3건~~ → **수정됨** | dbError 패턴 적용(B4) |
| `push-campaigns` | ✅ | ✅ zod | dbError | — | — | 이미 audit #69 적용 |
| `users/[id]/message` | ✅ | 수동(길이) | `{code,message}` | ✅ | — | CS 발송 |

## 수정 내역 (B4-2)
- `promotions/route.ts` — 목록·생성·수정 3곳에서 `error.message` 를 그대로 반환하던 것을
  `dbError(err, context, 사용자문구)` 로 교체. 원본은 Sentry 로만 가고 클라이언트엔
  "프로모션 목록을 불러오지 못했어요" 같은 일반 문구가 간다(audit #69 패턴).

## 개선 후보 (기록만 — 지금 조치 불요)
1. **rate limit 부재 9곳** — admin 전용이고 운영자 1인이라 남용 위험이 낮다. 업로드류
   (`blog/upload`·`events/upload`·`products/upload`)는 스토리지 비용과 직결되므로
   계정이 늘면 우선 적용 후보.
2. **zod 검증 2곳만 사용** — 나머지는 수동 검증. 동작은 정상이나 새 라우트를 만들 땐
   `blog/draft` 의 zod 패턴을 복사하는 편이 일관적.
3. **에러 shape** — `{code,message}` 가 사실상 표준. `orders/export` 만 CSV 라 예외(정상).

## AdminHeader 채택 현황 (계획 B5-2)
`components/admin/ui.tsx` 의 `AdminHeader` 를 쓰지 않고 raw `<h1>` 을 쓰는 페이지가 다수지만,
2026-07-24 대개편에서 **문자열 자체가 표준(`text-[22px] font-bold tracking-tight
text-zinc-900 leading-tight` + 13px zinc-500 설명)으로 통일**돼 시각 차이는 없다.
마이그레이션은 선택 — 하더라도 시각은 동일하게 유지할 것.
