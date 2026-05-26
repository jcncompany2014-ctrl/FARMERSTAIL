# i18n 로드맵 — 글로벌 진출 준비 (XL-12 #50)

## 현 상태 (R51, 2026-05-26)

✅ **Foundation 완료** — Production deploy 가능. 아직 실 surface 적용은 안 됨.

- `lib/i18n/dictionaries.ts`: 사전 (ko/en), `t(locale, key)` helper,
  `detectLocale(acceptLanguage)` 함수.
- `lib/i18n/locale-cookie.ts`: 쿠키 기반 locale 저장 (`ft_locale`, 30일).
- 23개 사전 key (액션·강아지 메타·상태·영양·권한). 향후 확장.

## 단계별 적용 계획

### Step 1 (즉시 가능) — Settings 토글
- `<LanguageToggle>` 컴포넌트 추가
- /mypage/notifications 또는 /mypage hub 에 추가
- 사용자가 선택 → `writeLocaleCookie('en')`

### Step 2 (PMF 검증 후) — App surface 우선
적용 우선 순위 (impact / effort):

1. **/dogs/[id]/vet-report + /vet/[token]** — 수의사 공유 (해외 수의사 대응)
2. **/products/[slug] PDP** — 제품 상세
3. **/cart, /checkout** — 결제 흐름
4. **/dashboard** — 홈
5. **모든 app surface** — 일괄 마이그레이션

각 surface 적용 패턴:
```tsx
import { t } from '@/lib/i18n/dictionaries'
import { readLocaleCookie } from '@/lib/i18n/locale-cookie'

export default async function Page() {
  const locale = await readLocaleCookie()
  return <div>{t(locale, 'action.save')}</div>
}
```

### Step 3 — Web (랜딩) surface
- `app/page.tsx` 랜딩 페이지
- SEO 메타데이터 (hreflang)
- 로봇 sitemap 별 locale

### Step 4 — Backend / 이메일 / 푸시
- 결제 영수증 이메일 templates
- Push notification body
- API error messages
- 카카오톡 메시지 templates

## 미해결 결정 사항 (PMF 후 재검토)

| 결정 | 옵션 | 권장 |
|---|---|---|
| URL 패턴 | `/en/products` vs `/products?lang=en` vs cookie only | cookie only (현 방식) — SEO 미세 손실 vs 솔로 운영 안정성 |
| 라이브러리 | next-intl vs 자체 lib | 자체 lib (현재) — Next.js 16 + Turbopack 호환성 우선. 100+ surface 적용 시 next-intl 재평가 |
| 통화 / 단위 | KRW only vs 다중 currency | KRW only (현재) — 해외 결제 인프라 (Stripe 등) 셋업 시점에 재검토 |
| 날짜 / 시간 | `toLocaleDateString(locale)` | OK (브라우저 내장) |

## 비고

본 foundation 은 무중단으로 적용 가능. 기존 ko-only 코드는 *변경 없음*.
새 컴포넌트에서 `t(locale, key)` 패턴을 도입하기 시작 → 점진적 마이그레이션.
