# 출시 후 1~3개월 백로그

출시 차단 요소는 아니지만 운영 안정성/사용자 신뢰/성장에 도움 되는 항목.
우선순위는 trafic 패턴이 모인 후 정렬해도 됨.

---

## 🔴 R99 (D7) — 대규모 2영역 (SEO·메타 / 영양 알고리즘 정확성)

### 이번 라운드 fix 완료
- **R99-A High**: brand/partners/newsletter 3개 페이지 OG 이미지 완전 누락 — `generateMetadata`/openGraph shallow-merge 라 부모(layout) images 가 안 내려와 공유 카드 썸네일 0. `ogImageUrl({title,subtitle,tag})` + `twitter:summary_large_image` 추가 (about 패턴 복제) ✅

### High 1주 내 fix 권장 (잔여)
- **R99-B H1 (영양)**: 임신/수유견 MER 매크로 미분기 — 임신 후기 ×3, 비유기 ×4~6 에너지 폭증을 표준 성견 ×1.6 으로 과소 산출. nutrition.ts 에 gestation/lactation 단계 입력 + 수의사 자문 필요 → vetConsult 완충 카피로 1차 대응, 알고리즘은 자문 후
- **R99-B H2 (영양)**: CKD(만성신장) 단백질 상한 미반영 — chronic-sku-mapper 가 신장 질환에도 고단백 라인 추천 가능. 단백질 제한 + 인(P) 제한 매트릭스 필요 (수의 처방식 영역이라 "수의사 상담" 게이트가 우선)
- **R99-B H3 (영양)**: 거대견(대형견 초과) 자견 MER 계수 — 성장기 거대견은 과영양 시 정형외과 질환(HOD/OCD) 위험이라 표준 자견 ×2.0 보다 보수적 계수 필요. puppy 분기에 거대견 sub-case
- **R99-A H2 (SEO)**: 동적 라우트(products/[slug], blog/[slug]) OG 이미지 generateMetadata 점검 — SKU OG 는 R21 적용됐으나 blog 글별 OG 확인 필요

### Medium / Low (잔여)
- **R99-A M1**: sitemap.xml lastmod 정적 — DB 글 updated_at 반영
- **R99-A M2**: JSON-LD Organization/Product 스키마는 견고하나 BreadcrumbList 일부 페이지 누락
- **R99-B M1**: 활동량(activity level) 4단계가 MER 계수에 선형 반영 — 실제 견종/중성화 상태 교차항 미반영 (현 수준도 업계 평균 이상)

### 견고 확인 (발견 0 / 모범)
- SEO: canonical 전 페이지, robots index/follow, JSON-LD Organization+Website+Product, /api/og 동적 생성, sitemap 동적 — 성숙
- 영양 표준: FEDIAF MER 95/110/125 (R-F2), 알러지 SSOT(R92), NSH Ca:P 가드(E1), 자견 분기(E2), 35견종 priority(E3) — 학술 근거 견고

---

## 🔴 R98 (D7) — 대규모 3영역 (타임존 / 카피·법적 / 파일업로드 보안)

### 이번 라운드 fix 완료
- **R98-C H-2**: ReviewForm 사진 EXIF(GPS) strip — review-photos public 버킷에 원본 거주지 좌표 무인증 노출(PIPA 위치정보). downscaleImage canvas 재인코딩 ✅
- **R98-A Medium**: 생일 푸시 하루 전 발송 — birth.getMonth/getDate UTC → birth_date split KST 비교 ✅
- **R98-C H-3**: progress-photos POST 가 클라 photoUrl path 무검증 insert → `${user.id}/` prefix 검증 ✅
- **R98-B Medium**: 블로그 효능 표현 3줄 ("가려움 잡혀요/염증 가라앉히는/80% 가라앉아요" → 보조·도움 톤) ✅

### High/Medium 1주 내 fix 권장 (잔여)
- **R98-C H-1**: dog-avatars 버킷이 public + 서버 MIME/size 재검증 0 + 사용자 파일명 그대로. 버킷을 migration 으로 MIME/size 명시 + uploadDogPhoto canvas 재인코딩 (호출흐름 서버/클라 검증 후). EXIF GPS 도 동시 해결
- **R98-A High**: cart 배송일 라벨 KST off-by-one (nextArrivalLabel getHours/getDate UTC). app/cart/page.tsx — web 공유지만 날짜 계산 로직만이라 헬퍼 교체 안전
- **R98-C M-1**: products 버킷 MIME/size migration 누락 (서버 라우트 8MB+image allowlist 로 1차 방어는 됨)
- **R98-C M-2**: 매직바이트 검증 없음 (Content-Type 헤더만). OCR/photo-upload 서버 경유처에 시그니처 검사

### Medium / Low (잔여)
- **R98-A**: DashboardDailyChecks localStorage 키 / ExpensesClient 날짜 기본값 / Vaccinations 필터 / dashboard makeWeekDays / formatAgeLabel / cart-abandoned 멱등키 — 클라 `.toISOString().slice(0,10)` → todayKstIsoDate
- **R98-C M-3~M-5**: OCR dogId 소유검증(현재 미사용), 이미지 폭탄 픽셀 차원 상한, photo-upload 토큰 만료 storage 고아 정리 cron
- **R98-B Low**: copy-strings 자기 블랙리스트("프리미엄") 모순 — 블랙리스트에서 제거 권장 / nutrition.ts getSupplements desc dead copy ("개선/강화/보장") / 호칭 강아지vs반려견 (의도적 분리 가능)

### 견고 확인 (발견 0 / 모범)
- 카피 법적: 효능표현 R86/R91 정리 견고 유지, voice §1 "신뢰도" 사용자노출 0, 환불/배송/정기결제 고지 terms↔refund↔FAQ 일치
- 파일 보안: SVG XSS 0 (allowlist 에 svg 없음), private 버킷 RLS self-folder + signed URL, path traversal 가드, next/image remotePatterns 제한
- 타임존: cron 결제/만료 판정 KST 정석 (Date.now+9h getUTC), 이메일 timeZone:Asia/Seoul (R94), 쿠폰 timestamp 비교

---

## 🔴 R97 (D7) — 대규모 4영역 (성능N+1 / 에러fallback / React hooks / rate limit·비용)

### 이번 라운드 fix 완료
- **R97-B High**: AnalysisView fetch 실패 시 무한 스피너 먹통 → `load().catch` 로 graceful (분석 화면 2개 라우트) ✅
- **R97-C High**: SurveyClient 2.8초 타이머 cleanup (언마운트 후 setState/navigation/중복insert) + !user setSaving(false) ✅
- **R97-A High**: first-box-checkin 무제한 조회 → `.limit(200)` ✅

### High 1주 내 fix 권장 (잔여)
- **R97-A H1**: pushToUser 호출당 4~6 쿼리 (모든 cron N+1 증폭기). `pushToUsers(ids[])` 배치 변형 — push_preferences/subscriptions/native_tokens `.in()` prefetch
- **R97-A H2**: mypage/orders 사용자 주문 전량 로드 + JS 통계. `.limit(20)` 페이지네이션 + count 쿼리
- **R97-A H4**: admin finance/insights/cohort 집계 (`.limit(50000/20000/10000)` 메모리 적재) → Postgres GROUP BY RPC. 6~12개월 후 시한폭탄
- **R97-D H1**: AI/OCR rate limit 이 IP-only + in-memory → isolate scale-out 시 한도 배수 + IP 로테이션 우회 + 일/월 cap 없음. user-id 키 + rateLimitDB 승격 + 사용자별 일일 cap (결제 confirm 패턴 재사용)
- **R97-D M2**: OCR(Sonnet ~5원/건) proxy RULES 누락 + 일일 cap 없음
- **R97-D M3**: chatbot/structured/ocr/blog-draft proxy RULES 누락 (핸들러 self-limit 1겹)

### Medium / Low (잔여)
- **R97-A M1~M5**: cron profile/dogs N+1 (배치 캡 안), push-lifecycle medication 무제한 스캔, cart-recovery JS dedup, dashboard weight_logs/checkins 무제한, ledger-reconcile 2000 적재
- **R97-A L1**: partners 페이지 raw img → next/image
- **R97-C Low**: Tooltip/TrackingView/AdjustSheet/OrderClient 단발 setTimeout cleanup, magazine primitives useReveal opts useMemo
- **R97-D M4**: Anthropic 일/월 누적 비용 cap (대시보드 spend limit + Sentry 권장)
- **R97-B Low**: AnalysisView 에러 시 "분석 없음" 대신 "불러오기 실패·재시도" 카드 (현재 EmptyState 로 graceful)

### 견고 확인 (발견 0 / 모범)
- 에러 boundary 3종 + EmptyState/ErrorScreen 전반, 체크아웃 timeout, /offline — 매우 성숙
- React hooks: 카메라 스트림/AbortController/realtime/Toast/모달 cleanup 전부 정석
- 결제·이메일 rate limit: confirm rateLimitDB 2겹, cron 35개 cron-secret 게이트, Idempotency-Key — 단단

---

## 🔴 R96 (D7) — 대규모 6영역 병렬 검토 (IDOR/race/validation/a11y/구독/admin)

### 이번 라운드 fix 완료
- **R96-C** admin/orders/export `.or()` PostgREST 인젝션 → sanitize 적용 ✅
- **R96-D** AppChrome skip-link 타깃 `#main` 추가 (장차법 §14 / WCAG 2.4.1) ✅
- **R96-D** CartList 행별 버튼 aria-label 에 상품명 (다중 상품 식별) ✅
- **R96-E** changeInterval KST 헬퍼 통일 (R85-D 누락분, 즉시청구 위험) ✅
- **R96-E** migration 20260527000010 — cancelled 구독 부활 차단 트리거 (작성, 적용 대기) ✅
- **R96-F** migration 20260527000011 — products price/stock/sale_price CHECK (NOT VALID, 작성) ✅

### migration 적용 필요 (출시 전, 데이터 확인 후)
- **20260527000010** subscription status guard — 안전 (트리거, 미래 UPDATE 만)
- **20260527000011** products CHECK — NOT VALID 라 안전. 적용 전 위반 데이터 확인 SQL 주석 참조

### 출시차단/High 1주 내 fix 권장 (잔여)
- **R96-E 출시차단**: paused→active resume 시 `billing_key IS NULL` 미체크 → 카드 미등록 구독이 active 되어 cron 청구 불가 (유령 active). cleanup 도 안 잡힘. `handleResume` 에 NULL 가드 + billing-auth redirect (Subscription 타입에 billing_key 추가 필요)
- **R96-E High**: 단일 SKU `/subscribe/[slug]` 중복 구독 가드 없음 (박스 흐름만 있음) → 같은 상품 N중 청구. user_id+product_id 중복 조회 추가
- **R96-E High**: subscription-charge `nextDeliveryDate(sub, today)` 가 today 기준 → 연체/cron지연 시 결제일 드리프트. base 를 `sub.next_delivery_date` 로 + `while(next<=today) advance`
- **R96-E High**: billing-issue 재등록 시 `next_delivery_date` 미갱신 → 즉시 청구 또는 NULL 영구 미청구. 정책 결정 후 set
- **R96-F High**: admin 정기배송 "일괄 주문 생성" 이 anon client 라 RLS 로 타 회원 건 전부 실패 (운영자 모름). `/api/admin/subscriptions/create-orders` route + createAdminClient 로 이전
- **R96-F High**: 일괄 주문 생성 비-트랜잭션 + order_items 에러 미체크 → 고아 주문. RPC 로 원자화
- **R96-B High**: 설문 재진단 30일 제한이 동시 제출(탭2개)로 우회 → AI 비용 + 1000P 중복 적립. analyses insert 를 서버 RPC (advisory lock + 직전 분석 재확인) 로
- **R96-D High**: 설문 입력 필드 (Diet/Status/Pregnancy 의 브랜드/처방식/약/임신주차/산자수/예상체중) 프로그램적 라벨 없음 (placeholder만) → 스크린리더 "편집창" 으로만. aria-label 추가

### Medium / Low (잔여)
- **R96-B Med**: 보상 연 cap(capAllowance) non-atomic — survey_completion 만 노출 (cap 초과 가능). RPC 트랜잭션화
- **R96-C 관찰**: partial-cancel refundReceiveAccount zod 검증 / push/preferences zPushPreferences 적용 / invitations dog_id UUID 검증
- **R96-D Med**: 설문 로딩 진행 aria-live + focus 셀렉터 확장 / login·signup label htmlFor+id 연결 / 쿠폰 코드 input aria-label
- **R96-E Med**: 해지 시 "마지막 배송 정상 발송" 안내 + orders.subscription_id FK / 청구 시 재고 0 검증 (현재 돈 받고 발송불가 가능)
- **R96-F Med**: 쿠폰 정률 >100% 입력 (계산시 클램프돼 무해하나 입력가드 없음) / admin UI write 경로 recordAdminAction 누락 / 쿠폰 만료일 과거 입력 / 단건 해지 confirm 없음
- **R96-A IDOR**: 발견 0건 (견고 — 모든 소유권 가드 + admin client 선검증)

---

## 🔴 R91 (D7) — 5개 영역 정밀 검토 잔여 (총 44건 발견)

### Critical 즉시 fix 완료 (5건)
- **R91-A A1**: 블로그 효능 표현 17줄 정리 (항염/예방/치료/회복/효능) — 식약처/공정위 신고 위험 해소 ✅
- **R91-A A2-A6**: copy-strings/nutrition/narrative/RecommendationBox/Status 효능 단어 정리 ✅
- **R91-D #1**: lib/sentry/alerts.ts 헬퍼 4개 실제 호출 (payments/confirm AMOUNT_MISMATCH + PRICE_TAMPERED 2곳 + webhook amount_mismatch + refund-retry permanent_failure) ✅
- **R91-E #1**: 환불 정책 "마이페이지 반품 신청" 문구 → "출고 전/배송 중 self-cancel + 수령 후 CS" 명확화 ✅
- **R91-E #2**: privacy 페이지의 `ft_consent` (쿠키) → `ft_cookie_consent` (localStorage) 정정 ✅

### Critical / High 1주 내 fix 권장 (잔여 14건)

**한국 법규**:
- **R91-A B1**: PDP에 사료 종류 등록번호 + 성분 등록번호 누락 (사료관리법 §13)
- **R91-A B2**: PDP에 동물용의약품 첨가 여부 표시 누락 (사료관리법 §13)
- **R91-A B3**: 사료 등급 + 주의사항 별도 컬럼 부재
- **R91-A C1**: 식약처 21종 알레르기 원료 자동 매칭 부재
- **R91-A D1**: 환불 기한 "3영업일" vs UI "3-5영업일" 불일치
- **R91-A F1**: NEXT_PUBLIC_BUSINESS_* env Vercel 실제 등록 검증 부재

**결제 흐름 corner case**:
- **R91-B F-1**: 0원 결제 시 사용자 안내 부재
- **R91-B F-2**: VA 환불 사용자 환불계좌 입력 UI 부재 (전자상거래법 §17)
- **R91-B F-3**: 가상계좌 부분 입금 / 초과 입금 처리 흐름 없음
- **R91-B F-4**: billing-auth 도중 이탈 → orphan subscription
- **R91-B F-5**: admin 가격 수정 후 사용자 결제 시 동의 흐름 없음
- **R91-B F-6**: Toss 결제 취소 후 orders pending 그대로 (사용자 중복 결제 위험)
- **R91-B F-7**: 정기구독 첫 결제 실패 시 사용자 알림 + UI 불일치

**PWA / 푸시**:
- **R91-C #1**: manifest start_url=/dashboard — 미인증 신규 PWA 진입 시 /login 무한 redirect
- **R91-C #2**: OAuth/Toss 외부 redirect 시 PWA standalone 컨텍스트 이탈
- **R91-C #3**: InstallPrompt가 (main) 그룹 안에만 mount — 비인증 사용자에게 안 보임
- **R91-C #4**: iOS Safari 16.4+ Web Push PWA 설치 필수 안내 부재
- **R91-C #5**: Service Worker tag default 'farmerstail' — 모든 푸시 같은 슬롯 덮어쓰기

**관측성**:
- **R91-D #2**: Sentry alert rule 실제 채널 연결 검증 불가
- **R91-D #3**: cron 연속 실패 패턴 감지 / 평균 실행 시간 트래킹 미구현
- **R91-D #4**: /api/health 외부 의존성 실제 ping 없음 (ENV 존재만 확인)

**콘텐츠 정합성**:
- **R91-E #3**: FAQ "결제일 변경 / 상품 변경" — UI 미구현
- **R91-E #4**: privacy "Anthropic 익명화" 표현 vs 강아지 이름 포함
- **R91-E #5**: FAQ "미개봉만 환불" — 환불 정책보다 엄격

### Medium / Low (잔여 17건)

**한국 법규**:
- R91-A E1: PIPA 탈퇴 보관 기간 문구 vs 실제 cron 매핑 검증 미흡

**관측성**:
- R91-D #5: CS 미응답 N시간 모니터링 cron 부재
- R91-D #6: Reorder/wishlist add-to-cart funnel 트래킹 누락
- R91-D #7: `/admin?tab=cron-health` dead link
- R91-D #8: contact route RESEND_API_KEY 미설정 silent
- R91-D #9: trackCron 부분 실패가 success 로 기록

**PWA / 푸시**:
- R91-C #6: notificationclick 매칭 query string 무시
- R91-C #7: Capacitor PushNotifications listener 일회성 — deep link / foreground 미처리
- R91-C #8: OS 알림 권한 변경 감지 없음

**결제 시나리오 미발견 (확인 완료)**:
- 시나리오 1 step 5 (성공 직후 새로고침): R84-B1 가드 OK
- 시나리오 3 step 3 (입금 후 webhook 안 옴): 마이페이지 영수증 가시화 OK

**콘텐츠**:
- R91-E #6: About §03 "AAFCO+WSAVA" vs FAQ "FEDIAF" 기준 표기 혼용
- R91-E #7: 환불 정책 "회사 3영업일" vs UI "3-5 영업일" (D1과 중복)
- R91-E #8: 이용약관 §4 회원가입 14세 명시 부재

---

## 🔴 R90 (D7) — 5개 영역 정밀 검토 잔여 (총 44건 발견)

### Critical 즉시 fix 완료 (4건)
- **R90-D C2**: `lib/business.ts` dynamic key access 가 client bundle inline 안 됨 → R89 fix 실수 교정 (`process.env[key]` → literal `process.env.NEXT_PUBLIC_X`) ✅
- **R90-A C1**: 8개 테이블 RLS UPDATE WITH CHECK 누락 → user_id 위조 방지 migration 작성 (적용은 supabase MCP 로 정책 이름 검증 후) ✅
- **R90-C C2**: `parseMedicalRecord` 모델 SSOT drift → `MODEL_VISION_HIGH` import 로 통일 ✅
- **R90-E H1**: OAuth callback `deleted_at` 가드 부재 → 탈퇴자 재로그인 차단 ✅

### Critical / High 1주 내 fix 권장 (잔여 9건)
- **R90-A C2**: `reserve_order_stock` RPC 가 variant stock 무시 → variant 옵션 있는 상품 oversell 위험. RPC signature 변경 + CheckoutForm reservePayload 에 variant_id 추가
- **R90-A C3**: `chatbot_messages` FK 없음 + 30일 cleanup cron 없음 → PIPA 보유기간 위반
- **R90-A H1**: `refunds` 테이블 FK + UNIQUE 누락 → 환불 이중 계산 위험
- **R90-A H2**: `product_reviews` UNIQUE 가 NULL order_id 로 무력 → 평점 조작 가능
- **R90-A H3**: `native_push_tokens` UNIQUE NULL device_id 무력 → push 중복
- **R90-C C1**: Anthropic 토큰 usage 모니터링 부재 → 비용 폭발 위험. `ai_usage_log` 테이블 + 일일 한도
- **R90-C H1**: Tractive fetch timeout 없음 → cron hang
- **R90-C H2**: Resend webhook svix-timestamp staleness 검증 없음 → replay 공격 가능
- **R90-C H3**: Daum Postcode CDN `onerror` 없음 → 체크아웃/가입 영구 hang
- **R90-D C1**: Supabase migration timestamp 충돌 4개 → 환경별 schema drift
- **R90-D H1**: `npm run verify` 가 next build 미실행 → Vercel 빌드 실패 사전 차단 불가
- **R90-E H2**: 비밀번호 변경 후 global signOut 부재 → 다른 디바이스 세션 잔존

### Medium / Low (잔여 27건 — 출시 1개월 내)
- **R90-A M1**: `issue_referral_milestones` balance race condition
- **R90-A M2**: `feeding_outcomes` FK 누락
- **R90-A M3**: UPDATE policy 누락 (feeding_outcomes / chatbot_messages)
- **R90-A L1**: `payment_events` admin 체크 `is_admin()` 미사용
- **R90-B H1**: 거래성 메일 fire-and-forget Sentry 미보고
- **R90-B H2**: pushToUser fire-and-forget Sentry 미보고
- **R90-B M1**: CheckoutForm Supabase raw error.message 노출
- **R90-B M2**: AdjustSheet / RecommendationBox fetch timeout 없음
- **R90-B M3**: admin async event handler try/catch 누락
- **R90-B M4**: RecommendationBox raw error.message 표시
- **R90-B L1**: `app/(auth)/error.tsx` 부재
- **R90-B L2**: VetShareButton / PartialCancelPanel / OrderStatusControl / CampaignBuilder native confirm 잔재
- **R90-C M1**: Resend rate limit 직렬 발송 (2000+ 구독자 시 timeout)
- **R90-C M2**: Toss webhook schema drift 방어 (zod parse)
- **R90-C M3**: APNs JWT 캐시 동시성 race
- **R90-C M4**: Web Push 403/412 dead 처리 누락
- **R90-C M5**: Apple SIWA private email relay 처리
- **R90-C M6**: Kakao SDK init 실패 silent
- **R90-C L1**: Resend Idempotency-Key 헤더 미전송
- **R90-C L2**: Anthropic timeout 일관성 (라우트별 20-45s)
- **R90-D H2**: Service Worker `farmerstail-v5` placeholder accidental commit 위험
- **R90-D M1**: `next.config.ts` Vercel preview 도 production cache TTL 적용
- **R90-E M1**: 비밀번호 5회 실패 lockout / brute force 방어 없음
- **R90-E M2**: 로그아웃 시 sessionStorage / localStorage cleanup 누락
- **R90-E M3**: 동일 디바이스 사용자 전환 시 push_subscriptions 잔존
- **R90-E L1**: 이메일 변경 흐름 부재 + admin 우회 시 sync 위험
- **R90-E L2**: admin 계정 2FA/MFA 부재
- **R90-E L3**: 세션 hijacking (IP/UA 변경) 감지 없음

---

## 🔴 R89 (D7) — 5개 영역 정밀 검토 잔여

### Critical / 출시 1주 내 fix 권장

- **R89-C #1**: Webhook idempotency race (`app/api/payments/webhook/route.ts:132-225`)
  - `.eq('payment_status','pending').select('id')` 가드 추가 또는 `webhook_events` 테이블 신설
- **R89-C #2**: 빌링키 만료 추적 부재
  - `subscriptions` 테이블에 `billing_key_issued_at` / `billing_key_expires_at` 컬럼 추가
  - 신규 cron `subscription-billing-expiry-notify` — D-30/14/7 사전 알림
  - 실제 만료자 발생 = 첫 정기구독자 +365일 — 출시 1년 시점에 임박
- **R89-C #3**: payment_events ledger race / 중복 insert
  - `UNIQUE(order_id, payment_key, event_type, source)` partial index 추가
- **R89-C #7**: Webhook PARTIAL_CANCELED cancelAmt 계산 오류
  - `cancels[0]` → `cancels[cancels.length - 1]` 또는 `totalAmount - balanceAmount - 기존 refunded_amount` delta

### High / 출시 2-4주 내

- **R89-C #4**: refund-retry concurrent run race
  - atomic claim — `FOR UPDATE SKIP LOCKED` 또는 advisory lock
- **R89-C #5**: subscription-charge cron 동시 실행 시 orphan order
  - chargeRow insert 와 orders insert 를 같은 RPC 트랜잭션으로
- **R89-C #6**: payment_refund_queue `(payment_key, reason)` UNIQUE 변형 무력화
  - `UNIQUE(payment_key)` partial (status='pending') 만 유지
- **R89-C #8**: self-cancel partial→full 환불 무효
  - 조건 `(payment_status === 'paid' || payment_status === 'partially_refunded')` 로 확장
- **R89-C #9**: confirm route 더블 클릭 race window
  - `payment_status='confirming'` 단기 lock state 도입
- **R89-B #4**: 안드로이드 백버튼 → 모달/시트 close 안 됨 (Capacitor APK)
  - `lib/capacitor.ts` 에 `onBackButton(cb)` 헬퍼 + BottomSheet/Modal hook
- **R89-D H1**: manifest start_url=/dashboard vs robots disallow 충돌
  - `/dashboard` → `/` 또는 robots 정책 정렬

### Medium / 출시 1개월 내

- **R89-A #3**: `lib/env.ts` SSOT 주석과 실제 코드 참조 18키 불일치
  - tractive / APNS / FCM / 기타 키 raw 객체에 추가 또는 주석 정정
- **R89-A #4**: `lib/integrations/tractive.ts` non-null assert 가드
- **R89-B #3**: `100vh` → `100dvh` 일괄 (iOS PWA viewport 짤림)
- **R89-B #5**: 햅틱 부재 — PDP 장바구니 / 카트 결제 / subscribe submit 에 추가
- **R89-B #6**: CartAddMoreButton 24×24 → 40×40 hit area
- **R89-B #7**: CatalogFilters sticky safe-area-inset-bottom 추가
- **R89-D M1**: root `opengraph-image.tsx` vs layout `/api/og` OG 중복
- **R89-D M2**: PDP/블로그 OG image width/height fallback
- **R89-D M3**: PDP description 120자 단절 → 160자 + 마침표 경계
- **R89-E #3**: CheckoutForm 폼 에러 inline `aria-invalid` + `aria-describedby`
- **R89-E #4**: checkout `text-[10-11px] text-muted` → `text-text` (contrast)

### Low / 출시 3개월 내 또는 nice-to-have

- **R89-A #2**: `.env.example` 의 `NEXT_PUBLIC_TOSS_WIDGET_CLIENT_KEY` dead key 삭제
- **R89-B #8**: Pull-to-refresh — 홈/주문내역/강아지 목록
- **R89-D L1**: maskable PNG 별도 (192/512-maskable)
- **R89-D L2**: `app/manifest.ts` 마이그레이션
- **R89-D L3**: `apple-touch-icon` 180×180 PNG
- **R89-D L4**: JSON-LD `sameAs` SNS URL 검증
- **R89-E #5**: payment confirm rate limit 중첩 정리

### 이번 라운드 (R89) fix 완료
- **R89-A #1**: `lib/business.ts` env-우선 패턴 8개 필드 확장 → NEXT_PUBLIC_BUSINESS_* 키로 redeploy 없이 footer/사업자정보 갱신 가능 ✅
- **R89-B #1, #2**: iOS Safari input/select zoom 방지 (5개 폼 + Select primitive) ✅
- **R89-E #1**: signup enumeration → `humanizeSignupError` 일반화 ✅
- **R89-E #2**: 비밀번호 재설정 — `/forgot-password` + `/reset-password` 페이지 + login 링크 ✅

---

## 🟠 1주차 — 운영 가동 직후

### a11y / WCAG
- 일기/리뷰 사진의 `alt=""` (decorative) → 사용자 업로드 사진은 alt 텍스트 입력 옵션 추가 (스크린 리더 사용자가 컨텍스트 파악 가능)
- DiaryClient 사진 첨부 시 "사진 설명 (선택)" 필드
- ReviewForm 사진에도 alt 옵션

### Sentry 알림 룰
- `order.payment.subtotal_mismatch` / `order.payment.total_mismatch` → Slack #alerts (위변조 시도)
- `order.payment.points_inflated` → Slack #alerts (포인트 어뷰징)
- `refund_queue.permanent_failure` → Slack #alerts (운영자 수동 처리 필요)
- `cron_health` 실패 → 매일 09시 요약 메일

### 모니터링 대시보드
- Vercel Analytics → Speed Insights (LCP/INP/CLS) 7일 트렌드
- Supabase Database → Performance → slow query (>500ms)
- Resend → Logs → 이메일 bounce/complaint rate

---

## 🟢 2-4주차 — 사용자 피드백 반영

### 결제 정밀화
- 부분 환불 UI (현재는 전체 환불만, 부분 환불은 Toss 대시보드 수동)
- 환불 사유 통계 → admin 대시보드 도넛 차트
- 결제 수단별 전환율 비교 (카드 vs 가상계좌)

### 카탈로그
- 카테고리/태그 필터 (현재 정렬만 있음)
- "방금 산 이웃" social proof (privacy 이슈로 익명화 필요)
- 재입고 알림 신청 → 도착 시 카카오톡 send (Resend 메일은 OK)

### 영양 알고리즘
- 사용자가 분석 결과에 대해 "주려고 했는데 안 먹어요" 피드백 → 라인 비율 학습
- 체중 변화 추적 → 자동 cycle 비율 조정 (이미 일부 있음, 정밀화)
- 만성질환 새 키워드 (피부염, 슬개골 등) 카테고리 확장

### 정기배송
- 일시 정지 ↔ 재시작 UX (현재 cancel + 재구독)
- 다음 결제일 7/3/1일 전 reminder 메일/푸시 단계화
- 박스 도착 후 만족도 점검 (간단 1~5점)

---

## 🟡 1-3개월차 — 성장 인프라

### 🔒 PIPA 강화 — 탈퇴자 데이터 익명화 (D+30, 1-2시간)

R82 검토 결과 발견된 PIPA 보강 항목 — 데이터 손실 위험이 있어 PMF 검증 후
신중하게 처리. 정책 페이지엔 이미 명시되어 있지만 실제 코드 동작은 불완전.

#### C2: orders.recipient_* 익명화
- 회원 탈퇴 시 `orders.recipient_name/phone/address/zip` 평문 5년 보관
- PIPA §21 "보존 기록은 별도 DB 분리 + 익명화" 원칙 위배 소지
- Fix: `/api/account/delete` 에 orders / subscriptions / cs_messages 익명화
  (이름→`탈퇴회원-{userId8}`, phone→마스킹, address→마스킹)

#### C3: auth.users hard-delete
- 현재 `supabase.auth.admin.deleteUser(id, true)` soft-delete → email 영구 보존
- privacy 정책 "5년 후 즉시 파기" 와 불일치
- Fix: `account-purge` cron 끝에 `deleteUser(id, false)` hard-delete 추가
- 주의: ON DELETE CASCADE 다른 테이블 영향 — orders 5년 보존 위해
  `orders.user_id ON DELETE SET NULL` 또는 별도 archive 테이블 필요

#### C5: 의료·일지·사진 데이터 정리
- 현재 `/api/account/delete` 가 dog_invitations / medical_records /
  progress_photos / sensitivity_snapshots / dog_diary / feed_intake_history /
  chatbot_history / cs_messages / coupon_redemptions / user_integrations /
  feeding_outcomes / meta_learning_events / inactive_coupons 정리 안 함
- auth.users soft-delete 라 ON DELETE CASCADE 도 동작 안 함
- Fix: delete route 의 Promise.all 에 명시 delete 추가

#### Migration 작업
별도 R-cycle (R90+) 로 진행. archive 테이블 + cron + 단위 테스트 필요.
PMF 후 베타 50명 데이터 안정화된 다음 진행 권장.

---

### 🐕 AI 사진 분석 (핵심 차별화 기능) — D+30 ~ D+60

펫푸드 D2C 의 진짜 차별화 — 사료 회사는 못 함. Claude vision (claude-haiku-4-5)
이미 사용 가능. 점진 출시: 변 사진 분석 → 피모 → 시계열 트렌드.

#### Phase 1: 변 사진 분석 (D+30 ~ D+45, 약 4시간 작업)
- 사용자가 변 사진 업로드 (모바일 카메라 직접 캡처)
- Claude vision → **Bristol Stool Scale 1-7 자동 분류**
  - 현재: `surveys.bristol_stool_score` 사용자 자가 입력 (주관적, 일관성 ↓)
  - 신규: AI 가 객관적·일관성 있게 분류
- 응답 형식:
  ```
  "Bristol 6 (묽음). 지난 주 4 → 이번 주 6 으로 악화.
  새 사료 전환 직후라면 정상. 5일째 같으면 사료 비율 25% 줄이고
  단호박 1티스푼 추가해보세요."
  ```
- DB: `dog_photo_analyses` 신규 테이블 (photo_url, category='stool', score, ai_response, created_at)
- 빈도 제한: 주 3-4회 (변 상태 변화 빠름)
- 비용: 1회 ~30-40원 (vision = text 대비 1.5배)

#### Phase 2: 피모(털) 상태 분석 (D+45 ~ D+60, 약 3시간 작업)
- 강아지 등·옆구리·꼬리 사진 → AI 분석:
  - 윤기/건조함/탈모 패턴
  - 비듬·발진 의심 부위
  - 영양 결핍 신호 (단백질·오메가-3·아연 부족)
- 응답: 추천 SKU + "2주 지켜보고 호전 없으면 동물병원" 등 행동 가이드
- 빈도: 주 1회 (피모 변화 느림)

#### Phase 3: 시계열 트렌드 + 푸시 자동화 (D+60 ~ D+90, 약 2시간)
- 일별/주별 차트 — Bristol score 추이, 피모 점수 추이
- "지난 주보다 묽어졌어요" 자동 알림
- 진단 결과를 다이어리(`dog_diary`) 항목으로 자동 저장

#### 비용 통제
- 무료 사용자: 일 1회 한도 (피모/변 각각)
- **정기배송 회원: 무제한** ← lock-in 강력 hook
- Anthropic monthly cap $200 (약 28만원) — 도달 시 503 fallback

#### 출시 전 검증
- 베타 50명한테 1주 동안 사진 50장 받아서 정확도 검증
- Bristol 점수 사람 vs AI 일치율 80%+ 목표
- 정확도 70% 미만이면 모델 변경 (claude-sonnet) 또는 출시 보류

#### 차별화 가치
- 매월 새 기능 출시 = 인스타 콘텐츠 + 뉴스레터 소재
- LTV ↑↑ (사진 분석 history 가 곧 lock-in)
- 펫푸드 D2C 의 진정한 "AI 영양사" 컨셉 핵심

---

### SEO / 콘텐츠
- 블로그 article 정기 (산지 이야기 / 영양 가이드 / 사용자 후기)
- 구조화 데이터 JSON-LD: Product / Article / Breadcrumb (이미 일부 있음)
- 카테고리 페이지 별 unique meta description
- Google Search Console 등록 + sitemap submit

### 마케팅
- Meta Pixel: 구매 이벤트 + 카트 이벤트 검증 (이미 코드 있음, 실제 이벤트 매니저에서 받아지는지 확인)
- 카카오톡 친구 추가 후 자동 환영 메시지 (카카오 채널 운영자 도구)
- 첫 구매 후 7일 / 14일 / 30일 시점 follow-up 메일 시퀀스
- 친구초대 보상 milestone 도달자 socials (인스타 / 카카오 채널)

### 모바일 네이티브
- Capacitor build → iOS App Store / Google Play 제출
- 푸시 토큰 native 등록 흐름 검증
- iOS / Android 결제 (Toss SDK 가 native WebView 에서 정상 동작)

### 데이터 / 인사이트
- 사용자 cohort 별 LTV 추적 (이미 `cohort_ltv_function` RPC 있음)
- 재구매율 / 이탈률 / NPS
- 카트 이탈 단계 추적 (어느 step 에서 가장 많이 이탈하는지)

---

## ⬜ 분기별 (3-6개월)

### 인프라
- Supabase → Pro plan 검토 (현재 free / 무료 한도 모니터링)
- Vercel → Pro 검토 (cron 빈도 / 도메인 / Analytics 무제한)
- Sentry → Team plan (사용자 quota)
- Resend → 발송량 따라 plan upgrade

### 법무 / 정책
- 개인정보처리방침 갱신 (분기 검토)
- 약관 변경 시 사용자 재동의 흐름
- 개인정보 처리 위탁 계약서 (Resend / Vercel / Supabase)
- 정보보호 자체 점검 (개인정보보호위원회 가이드)

### 운영 효율
- admin 대시보드 권한 분리 (사장 / CS / 마케터)
- 자동 응답 챗봇 (이미 chatbot 있음 — FAQ 데이터 보강)
- 배송 추적 자동 알림 (이미 review-prompts / order-delivered 있음)

---

## 🔬 깊은 디버깅 후보 (시간 여유 있을 때)

### TypeScript / 타입 정합성
- `payment_refund_queue` 테이블 generate types 후 cast 제거 (audit 2-2)
- `coupon_expiry_notifications` cast 우회 → types 갱신
- `as any` / `eslint-disable` 주석 검토

### 테스트 커버리지
- `lib/rewards/cap.ts` unit test
- `lib/rate-limit.ts` DB-backed 분기 test
- `app/api/cron/refund-retry/route.ts` mock Toss fail/success

### 성능
- LCP 이미지 next/image 최적화
- 카탈로그 grid virtualization (상품 100+ 시)
- Supabase RPC 인덱스 점검 (slow query 발견 시)

---

## 우선순위 매트릭스

| 영역 | 임팩트 | 노력 | 우선순위 |
|---|---|---|---|
| Sentry 알림 룰 | 운영 안전망 | 1h | 🔴 |
| 일기 alt 옵션 | a11y 보완 | 2h | 🟢 |
| Resend bounce 모니터 | 메일 전달률 | 1h | 🟠 |
| 카테고리 필터 | 카탈로그 UX | 1d | 🟠 |
| 정기배송 pause | 이탈 방지 | 2d | 🟠 |
| Meta Pixel 검증 | 광고 ROAS | 0.5d | 🟡 |
| 블로그 article 정기 | SEO 트래픽 | 매주 4h | 🟡 |
| 네이티브 앱 store 제출 | 채널 확장 | 1주 | ⬜ |

---

## 🔍 R83 6-agent audit deferred (출시 후 1-2주)

R83 (2026-05-27) 의 5개 그룹 병렬 audit 에서 발견된 32+ Critical 중 출시
차단급은 즉시 fix, 나머지는 베타 50명 데이터 누적 후 우선순위 재조정.

### 결제·환불 (B)
- **B3: webhook CANCELED race** — 동시 CANCELED webhook 두 개가 거의 동시에 들어오면
  payment_events 에 음수 amount row 두 개 insert 가능. 발생 확률 매우 낮음 (Toss 가
  같은 paymentKey 에 cancel 두 번 동시 안 보냄). 보강: payment_events 에
  (order_id, event_type, amount) partial unique index 추가.
- **B4: webhook DONE race** — `paid → paid` 동시 webhook 시 `.eq('payment_status', 'pending')`
  조건절을 update 에 추가하면 first-write-wins. ledger unique index 가 보호 중이라
  대부분 안전하지만 명시화.
- **B6: 부분 cancel 시 쿠폰 환급 누락** — cancel-items 코멘트에 명시. 부분 환불에서
  쿠폰 사용 카운트 그대로 유지. 베타에서 부분 환불 빈도 낮음 → post-PMF.
- **B8: subscription-charge orderId 비대칭** — confirm route 는 order_number(short)
  로 추적, subscription-charge 는 order.id(UUID). reconcile 시 cross-ref 어려움.
  운영 confusion 만 (catastrophic 아님).

### DB migration (C)
- **C4: 20260525000001/2 timestamp 중복 4개 파일** — Supabase CLI 가 사전식 정렬로
  실행하므로 실제 적용은 됐을 가능성. `select * from supabase_migrations.schema_migrations
  where version like '20260525%'` 로 row 수 확인 후 누락 있으면 재적용.

### 프론트엔드 (D)
- **D2: Toss SDK reject → 고아 주문** — `payment.requestPayment(...)` reject 시 catch
  에서 order 를 cancel/delete 처리. 사용자가 SDK 모달 ESC 로 닫으면 pending order 가
  DB 에 누적. 사용자 다음 결제 시 새 주문번호 생성 → 고아 누적. order-expire cron 이
  20시간 후 정리하지만 명시 cleanup 권장.
- **D3: CartList undo 토스트 stale user closure** — 다른 탭 로그아웃 후 클릭 시 만료
  user.id 로 insert 시도 → RLS 거부. UI 정합하지만 의도와 다름.
- **D4: RestockButton fetch 후 race** — `setSubscribed(!subscribed)` 가 클로저 값 사용.
  `setSubscribed((prev) => !prev)` 로 변경 + body.success 도 체크.
- **D6: CheckoutCouponSheet button-in-button** — `<button>` 안에 `<span role="button">`
  중첩. 브라우저별 동작 차이. 외부 sibling 으로 분리.
- **D7: addresses POST 응답 무시** — best-effort 의도지만 실패 시 토스트 1줄 안내.

### Cron / 인프라 (E)
- **E3: 21개 cron `trackCron` 누락** — 실패 시 cron_health 미기록 → Slack 알림 안 옴.
  cart-recovery / subscription-reminders / restock-alerts / birthday-coupons /
  review-prompts / coupon-expiry / dog-age-update / personalization-progression /
  personalization-approval-timeout / weight-reminder / subscription-cleanup /
  account-purge / onboarding-funnel / vip-coupons / inactive-coupons /
  sensitivity-snapshots / meta-weights / reanalyze-trigger / push-lifecycle /
  inventory-forecast / reanalysis-reminder-6m. 일괄 trackCron wrap.
- **E4: onboarding-funnel push ledger 누락** — push tag OS dedupe 만 의존 →
  사용자가 7일 이내 매일 같은 알림 받을 수 있음. `onboarding_push_log` 테이블 추가.
- **E5: inactive-coupons pagination 누락** — `listUsers({perPage:1000})` 단일 페이지.
  1000명 초과 시 영구 누락. nextPage 루프.
- **E6: 3개 cron UTC 0시 동시 발화** — subscription-reminders / birthday-coupons /
  reanalysis-reminder-6m 동시 발화 → DB connection burst. 1~3분 stagger.
- **E7: weight-reminder N+1** — RPC 없으면 dogs N마리 × weight_logs query.
  단일 join query 로 재작성.
- **E8: personalization-progression batch** — dogs 별 `for...of` sequential lookup.
  IN-list 단일 query 로.
- **E9: coupon-expiry 비결정적** — `profiles.limit(MAX_PER_RUN=200)` 을 쿠폰마다
  fetch. 5개 쿠폰이면 1000명 처리. cursor-based.
- **E10: restock-alerts 영구 실패 retry** — notifyRestock 실패 시 notified_at 안
  박혀서 다음 cron 재시도 → 푸시 폭주 가능. fail_count 컬럼 또는 강제 마킹.
- **E11: push-lifecycle 의도 vs 실제** — 주석 "hourly" 인데 schedule `0 10 * * *` 일
  1회. medication reminder 가 19시(KST)만 발화. Pro plan 으로 hourly 권장 또는 의도 명시.
- **E12: refund-retry schedule 누락** — vercel.json 에 cron 등록 없음. 일 1회 (`0 20`)
  로 추정되는데 backoff (5분/15분/1시간/6시간) 의미 무력. Pro plan `*/15 * * * *` 권장.

### 우선순위 (포스트-PMF, 베타 50명 데이터 후)
| 영역 | 임팩트 | 노력 |
|---|---|---|
| E3 trackCron 일괄 wrap | 운영 안전망 | 2h |
| E5 inactive-coupons pagination | 사용자 누락 | 1h |
| E4 onboarding-funnel ledger | UX (반복 알림) | 2h |
| D2 Toss SDK reject orphan | 결제 흐름 정합 | 1h |
| E7/E8/E9 N+1 + batch | cron timeout 회피 | 1d |
| E10 restock-alerts retry cap | 푸시 폭주 방지 | 1h |
| B6 부분 cancel 쿠폰 | 환불 정합 | 2h |
| C4 timestamp 중복 확인 | DB schema 점검 | 30m |

---

## 🔍 R84 user-journey audit deferred (출시 후 1-2주)

R84 (2026-05-27) 의 4개 사용자 동선 (온보딩 / 구매 / 사후 / 구독) audit 에서
발견된 14 Critical 중 출시 차단급은 즉시 fix, 나머지 deferred:

### 사용자 동선 잔여 (보강 영역)
- **C1 (확장)**: VA self-cancel 환불계좌 입력 UI** — 현재는 1:1 문의로 우회.
  사용자가 직접 은행/계좌/예금주 입력하고 self-cancel 완료할 수 있도록
  `CancelOrderButton` 에 `payment_method='가상계좌'/TRANSFER' 일 때 입력 폼 표시 +
  `cancelPayment` 에 `refundReceiveAccount` 옵션 추가 + cancel route 가 body 받아 전달.
  (R84 즉시: VA 사용자는 1:1 문의 안내 메시지 — 운영 부담 + UX↓)
- **C4: 사용자 부분 취소 UI** — `/api/orders/[id]/cancel-items` API 는 있지만
  `/mypage/orders/[id]` 에 부분 취소 버튼 없음. admin 만 부분 취소 가능. 사용자가
  "2번 상품만 빼고 싶다" 시 전체 취소 → 재주문 안내. 운영 CS 부담 증가.
- **C5: 환불 안내 문구 불일치** — `/legal/refund` "3-7영업일" vs `CancelOrderButton`
  "3-5영업일". 단일 문구로 통일 (refund 정책 + 알림 메시지 + push 내용).
- **B2: 재고 변종(variant) 단위 잠금** — `reserve_order_stock` RPC 가 `products.stock`
  만 잠금. PDP/cart 는 `product_variants.stock` 도 표시. 같은 variant 두 사용자
  동시 결제 시 oversell. variant_id 받는 RPC v2 필요 + 마이그레이션.
- **D2: subscription-charge 주소 우선순위** — cron 이 `addresses` 또는 `profiles`
  에서만 lookup. `subscriptions.address/zip/recipient_name` (R84-D1 fix 후) 이 1순위
  여야 함. 신청서 입력 주소가 silently 폐기됨.

### 온보딩 정책 결정 필요
- **A3: 알러지/만성질환 폼이 `/dogs/new` 에 없음** — 설계상 `/survey` 에서 입력하지만
  사용자 기대치는 "강아지 등록 = 모든 기본 정보". CS 폭주 우려. 결정:
  옵션 (a) `/dogs/new` 에 간단한 알러지 체크 한 줄 추가
  옵션 (b) `/survey` 진입 시 "알러지 정보는 다음 단계에서 입력해요" 안내 명시
- **A4: under-14 cleanup ordering** — Supabase 트리거가 UNDER_14 거부 시점에
  이미 consent_log row inserted. minor PII (생년월일/marketing opt-in) leak.
  consent_log inserts 를 profErr 체크 뒤로 이동.

### Admin 내부 도구
- **admin/subscriptions/page.tsx**: `SubscriptionRow` 타입이 `recipient_address/_detail/zip`
  로 선언돼 있지만 실제 DB 는 `zip/address/address_detail`. 화면이 NULL 표시.
  + 부분취소 시 orders.recipient_* 에 NULL 입력. admin 운영 시 발견 후 fix.

---

## 🔍 R85 deep-edge audit deferred (출시 후 1-2주)

R85 (2026-05-27) 의 5개 영역 audit (외부 API / 동시성 / OAuth / 시간 / schema)
에서 발견된 14 Critical 중 출시 차단급은 즉시 fix, 나머지 deferred.

### 즉시 fix 한 것 (참고):
- A1: tossFetch timeout(15s) + try/catch — 외부 hang 차단
- A2: /checkout/success 서버 fetch timeout(25s) + redirect
- B1: confirm UPDATE 에 payment_status='pending' 가드 + 0-row 자동 환불
- B2: cancel UPDATE 가드 + 0-row 감지 → 더블클릭 차단
- B3: subscription-charge mid-loop status 재확인 → 취소된 구독 결제 차단
- D1: push-lifecycle KST hour 비교 + schedule hourly
- D4: SubscriptionsClient/SubscribeClient/OrderClient KST off-by-one fix
- E1: orders CHECK 에 'partially_refunded' 추가 (R83 누락)
- E3: push-lifecycle dog_subscriptions → subscriptions
- E4: payment-ledger-reconcile 'partial_refund' → 'partially_refunded'
- vercel.json: push-lifecycle hourly, vip-coupons KST 0시

### Deferred (post-PMF)
- **D2 (남은 파일)**: admin/subscriptions/page.tsx + api/personalization/approve KST off-by-one
- **D5: vip-coupons schedule** — KST 1일 09시 의도 → `0 0 1 * *` (KST 9시) 또는 `0 0 1 * *`. (UI/KST 일치)
  → **수정 완료** (`0 20 1 * *` → `0 0 1 * *`)
- **D6: refund-retry backoff vs daily schedule**: 현재 `0 20 * * *` daily. backoff
  설계는 5분/15분/1h/6h 인데 daily 라 의미 무력. Vercel Hobby 한도 확인 후 `*/30 * * * *`.
- **D7: account-purge schedule comment 불일치**: `0 16 1 * *` = KST 1일 새벽 01시.
  주석은 KST 04시 의도. 주석 정정 또는 schedule `0 19 1 * *`.

### 외부 API 추가 보강
- **A3: AI 분석 retry button** — `StructuredAnalysis.tsx` 가 Anthropic 실패 시
  새로고침만 가능. "다시 시도" 버튼 + exponential backoff.
- **A4: 상품 이미지 CDN fallback** — `CatalogProductCard` 이미지 onError 핸들러 +
  CategoryIcon fallback.

### 동시성 보강
- **B4: cart_items quantity race** — 두 빠른 클릭이 read-then-update lost update.
  RPC 또는 atomic SQL `SET quantity = quantity + 1` 로 변경.

### OAuth 보강
- **C-minor: KakaoLoginButton 원본 에러 노출** — provider 에러 코드를
  사용자에게 그대로 표시. 안정 코드 매핑은 callback 만 있음.

---

## 🔍 R86 viewport audit deferred (출시 후 1-2주)

R86 (2026-05-27) 의 4개 viewport audit (iOS Safari / 카피 / 비즈니스 / PII+법적)
에서 발견된 issue 중 출시 차단급은 즉시 fix, 나머지 deferred.

### 즉시 fix
- A1: DatePicker inline fontSize → 16+ (iOS Safari zoom 차단)
- B: global-error 영어 → 한국어 / lib/email/index.ts + cron 5곳 "고객" → "보호자"
- C3: chronic-sku-mapper enum 확장 — guidelines.ts alias (allergy_skin/kidney/mmvd/ibd)
  + 추가 13종 chronic 인식 (long_term_steroid/epilepsy/epi/patellar/tracheal/hypothyroid/cushings/ivdd/pancreatitis/urinary_stone/cognitive_decline)
- C4: CheckoutForm 적립률 UI 하드코드 1% → earnRate (등급별) 표시 — 표시광고법 회피
- D1: nutrition.ts "초록입홍합 천연 항염, 관절 통증 완화" → "오메가-3 · 관절 윤활 보조"
- D2: RecommendationBox.tsx "오메가-3 · 항염증 지원" → "오메가-3 · 피부 장벽 보조"

### Deferred (post-PMF / 출시 후 첫 주)
- **A2: 100vh in 6 pages** → 100dvh (notifications/order/formulas/approve/checkin/SurveyClient).
  사용 막힘 아니지만 iOS 주소창 노출 시 페이지 하단 잘림.
- **B-minor: 합니다 vs 해요 혼재** — signup/checkout 폼 일부. 점진적 정리.
- **B-minor: CTA 4가지 표현** (구매/결제/주문) — PDP 는 "장바구니에 담기" + cart/checkout 은
  "결제하기" + restock/analysis 는 "주문하기" 로 통일.
- **C1+C2: SKU 식별 시스템** — `products` 에 `sku` 컬럼 추가 + `FT-C01..FT-B05` UPDATE
  (또는 mapper.SKU_META 에 `slug` 필드 추가). 현재는 OrderClient.LINE_TO_SLUG 한 곳만 매핑.
  사이즈 7종 알고리즘 vs DB 100g 단일 — `product_variants` 7 사이즈 row 추가 또는 단일 사이즈로 알고리즘 단순화.
- **C5: SUB10 per_user_limit null** — `coupons` DB 에 `per_user_limit = 1` UPDATE.
  현재는 정기배송 cycle 마다 무제한 사용 가능.
- **D-medium: personalization-cycle 이메일 (광고) prefix 누락** —
  `lib/email/templates/personalization-cycle.ts:28` subject 에 (광고) + 본문 unsubscribe.
- **D-low: 개인정보보호책임자 = 대표 동일** — 실무상 OK 지만 분리 권장.

---

## 🔍 R87 thin-viewport audit (출시 후 첫 주)

R87 (2026-05-27) — 이메일 deliverability / a11y 결제 동선 / admin+에러 경계.

### 즉시 fix
- A1: sendEmail 에 unsubscribeUrl 옵션 추가 + RFC 8058 List-Unsubscribe + One-Click 헤더 (Gmail/Yahoo 2024.2 mandatory). 뉴스레터 (welcome + vol-01) 적용 완료.
- B1: login/signup error 메시지 role="alert" + aria-live="assertive" 추가.

### Deferred (출시 후 첫 주)
- **A2 transactional vs marketing 도메인 분리** — 현재 같은 from. Resend Domains
  에 별도 서브도메인 (tx.farmerstail.kr vs news.farmerstail.kr) 추가 + EMAIL_FROM_MARKETING
  env 신설 + lib/email/client.ts 에 kind 인자 추가. 환경 변경 필요.
- **A3 cart-abandoned / vip / birthday / comeback 등 마케팅 메일 unsubscribeUrl**
  — 이 메일들은 newsletter_subscribers 가 아닌 app users 대상이라 별도 토큰 필요.
  HMAC(user_id) 기반 universal unsubscribe endpoint 신설 + 각 호출처에 unsubscribeUrl 전달.
- **B2 결제 폼 7개 input <label> 누락** — `app/checkout/CheckoutForm.tsx:753-824, 877-894`.
  WCAG 1.3.1 + 3.3.2 fail. 장차법 §14 직접 저촉. placeholder 만 사용 → 스크린리더 안 읽음.
  각 input 에 `<label htmlFor>` 추가 (signup 패턴 재사용). 1-2h 작업.
- **B3 CheckoutCouponSheet button-in-button** — 트리거 row `<button>` 안에
  `<span role="button" tabIndex={-1}>` 제거 X. 키보드 사용자 쿠폰 제거 불가.
  외부 sibling button 으로 분리 필요.
- **B4 Toss 테스트 모드 안내 text-muted 10px** — 폰트 크기 임계 아래.
  text-text (강 대비) 로 승격.

### C admin + 모니터링 (출시 후 운영 안정화)
- **C1 admin/subscriptions bulk create order — NULL recipient address** (R84-D1 후속):
  `recipient_zip/_address/_address_detail` 가 SubscriptionRow 타입은 있지만 DB 에 없음
  → bulk-created orders 에 NULL 주소 들어감 → 배송 못 함. 즉시 fix: silent fail 로그
  추가 (이번 commit). 본격 fix: API 라우트 추출 + addresses fallback (cron 의 resolveShippingTarget 재사용).
- **C2 bulk action audit log 누락**: admin_audit_log helper 미사용. 실수로 대량 생성
  시 rollback 단서 없음. `recordAdminAction({ action: 'subscription_bulk_orders_created' })` 추가.
- **C3 admin/users.limit(200) + admin/orders.limit(100)**: 페이지네이션 누락 → 그 이상 row 안 보임.
  cursor-based pagination + tab filter.
- **C4 admin/subscriptions full table scan**: `.limit()` 없음 → Supabase 1000-row default cap.
  `.limit(200)` + server filter.
- **C5 cron 실패 알림 누락**: cron_health 테이블만 기록, Slack/email 알림 없음.
  recordHealth() error branch 에 Resend / Sentry rule.
- **C6 error.tsx 누락 라우트**: /cart, /products, /mypage 별도 error.tsx 없음 (root 로 fallback).
- **C7 /dogs/[id] invalid id → redirect /dogs**: 다른 dog 라우트는 notFound() — 일관성.

---

## 🔍 R88 deep-perf audit (2/3 깨끗 — diminishing returns 확인)

R88 (2026-05-27) — CSP+XSS / 영수증+마스킹 / DB index.

### 즉시 fix
- C 6 hot path partial index 추가 (orders shipping/pending, products active sort/price/category, subscriptions charge_due) + 9 중복 index DROP.
  migration `20260527000007_r88_hot_path_indexes.sql` 적용. 1000명 규모 day-1 DB 부하 대비.

### 깨끗 (참고)
- A CSP + XSS: next.config.ts 보안 헤더 모두 적용 (HSTS/XFO/nosniff/Permissions-Policy)
  + dangerouslySetInnerHTML 11곳 모두 source-literal 또는 escapeHtml/whitelist 검증
  + Supabase PostgREST parametrized + EXECUTE format %I/%L 안전
  + Origin/Referer CSRF 검증 proxy.ts
  + 이미지 업로드 ALLOWED set + bucket allowed_mime_types 이중 검증.
- B 영수증 + 카드 마스킹: 현금영수증 UI (소득세법 §162의3) + 카드 last4만 저장
  (여신전문금융업법 + PIPA §28의2) + 사업자 정보 SSOT + 환불 audit
  + PII scrubber (Sentry 한국 특화 정규식).

### Deferred (post-launch)
- A-minor: ReviewForm.tsx:81 클라이언트 검증 startsWith('image/') → ALLOWED set 통일.
- C-medium: report-only CSP 30일 수집 후 enforce 전환 (next.config.ts 로드맵 명시).
| LTV 코호트 분석 | 의사결정 | 2d | ⬜ |
