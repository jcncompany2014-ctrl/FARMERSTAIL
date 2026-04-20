# 파머스테일(Farmer's Tail) PWA 프로젝트 — Claude Code 핸드오프

> 이 문서를 읽고 프로젝트를 완전히 이해한 뒤 작업을 시작해줘.
> 프로젝트 경로: `C:\Users\A\Desktop\projects\farmerstail-app`

---

## 1. 프로젝트 개요

**파머스테일(Farmer's Tail)**은 프리미엄 반려견 식품 브랜드의 자체 D2C 쇼핑몰 PWA야.
고객이 강아지를 등록하고, 맞춤 영양 설문/분석을 받고, 화식·간식·체험팩을 주문하거나 정기배송을 신청할 수 있어.
관리자(나)는 /admin에서 주문·제품·회원·구독을 관리해.

**한 줄 요약:** 마켓컬리의 프리미엄 식품 커머스 UX + 오늘의집의 깔끔한 UI, 하지만 덜 복잡하게. 반려견 식품에 특화.

---

## 2. 기술 스택

| 항목 | 기술 | 비고 |
|------|------|------|
| 프레임워크 | Next.js 16.2.3 (App Router, TypeScript, Turbopack) | `app/` 디렉토리 구조 |
| 스타일 | Tailwind CSS | `globals.css`에 커스텀 유틸 포함 |
| 백엔드 | Supabase (Auth + PostgreSQL + RLS + Storage) | URL: `https://adynmnrzffidoilnxutg.supabase.co` |
| 결제 | 토스페이먼츠 SDK v2 (테스트 키) | 카드 결제, 빌링키는 사업자 등록 후 |
| 배포 | Vercel (`vercel --prod` 직접 배포) | GitHub 연동 불안정해서 CLI 사용 중 |
| PWA | manifest.json + sw.js + ServiceWorkerRegister | 홈화면 설치 가능 |

### 환경변수 (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://adynmnrzffidoilnxutg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=(실제 키)
NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_Ba5PzR0Arnx9xbpBJ0Mx3vmYnNeD
TOSS_SECRET_KEY=test_sk_(실제 키)
NEXT_PUBLIC_SITE_URL=https://farmerstail.vercel.app
```

---

## 3. 브랜드 디자인 시스템

### 컬러 팔레트
| 이름 | 메인 | 변형 | 용도 |
|------|------|------|------|
| Bone White | #FDFDFD | — | 입력 필드 배경 |
| Dark Walnut | #3D2B1F | #5C4A3A, #8A7668 | 텍스트, 헤더, 다크 배경 |
| Brick Red | #A0452E | #8A3822 | CTA 버튼, 할인가, 액센트 |
| Sage Green | #6B7F3A | #8BA05A | 정기배송, 성공 상태 |
| Cream | #F5F0E6 | #EDE6D8 | 앱 배경, 카드 보더 |
| Wheat/Gold | #D4B872 | — | 일시정지 상태, 서브 액센트 |
| Ink | #2A2118 | — | 최고 대비 텍스트 |
| Error | #B83A2E | — | 에러 메시지 |

### 타이포그래피
- 제목: Archivo Black (로고, 대제목)
- 본문: Pretendard (시스템 폰트 대체 가능)
- 참고: 현재 코드에서는 Tailwind 기본 + font-black으로 처리 중

### UI 컴포넌트 규칙 (현재 적용된 스타일)
- 카드: `bg-white rounded-xl border border-[#EDE6D8]`
- 카드 내 이미지→텍스트 구분: `border-t border-[#EDE6D8]`
- 텍스트 패딩: `px-4 py-3.5` (여유 있게)
- 버튼 (CTA): `rounded-xl bg-[#A0452E] text-white font-bold active:scale-[0.98]`
- 버튼 (보조): `rounded-xl border border-[#EDE6D8] text-[#8A7668]`
- 뱃지 (할인): `bg-[#A0452E] text-white text-[10px] font-black px-1.5 py-0.5 rounded-md`
- 뱃지 (정기배송): `bg-[#6B7F3A] text-white text-[8px] font-bold px-1.5 py-0.5 rounded-md`
- 입력 필드: `rounded-lg border border-[#EDE6D8] bg-[#FDFDFD] text-sm focus:border-[#A0452E]`
- **중요: 이전 두꺼운 border-2 + shadow-[3px_3px_0] 스타일은 제거 중. 새 코드에서는 쓰지 마.**

### 로고
- 파일: `public/icons/icon-192.png`, `public/icons/icon-512.png` (스탬프 로고)
- 헤더 로고: `public/logo.png` (가로형, 밝은 배경에서 사용)
- 파비콘: PWA manifest에서 icon-192 사용

---

## 4. 데이터베이스 스키마 (Supabase)

### 테이블 구조
```
profiles        — 회원 (id, email, name, phone, zip, address, address_detail, agree_sms, agree_email, role)
dogs            — 강아지 (user_id, name, breed, gender, neutered, birth_date, weight, body_condition, activity_level, food_type, snack_freq, taste, allergies[], health_concerns[])
surveys         — 설문 결과 (dog_id, user_id, answers jsonb)
analyses        — 영양 분석 (dog_id, survey_id, rer, mer, factor, bcs, 영양소별 g/%, micronutrients jsonb, ca_p_ratio, supplements[])
products        — 제품 (name, slug, description, short_description, price, sale_price, image_url, category, tags[], stock, is_subscribable, is_active, sort_order)
cart_items      — 장바구니 (user_id, product_id, quantity)
orders          — 주문 (user_id, order_number, subtotal, shipping_fee, total_amount, recipient_*, payment_status, payment_method, payment_key, paid_at, order_status, subscription_id)
order_items     — 주문 상품 (order_id, product_id, product_name, product_image_url, unit_price, quantity, line_total)
subscriptions   — 정기배송 (user_id, interval_weeks, status, next_delivery_date, last_delivery_date, total_deliveries, recipient_*, subtotal, shipping_fee, total_amount)
subscription_items — 구독 상품 (subscription_id, product_id, quantity, unit_price, product_name, product_image_url)
```

### 핵심 RLS 정책
- 모든 테이블: 본인 데이터만 CRUD
- products: 누구나 읽기, admin만 수정
- `public.is_admin()` 함수: `auth.users.raw_user_meta_data->>'role' = 'admin'`
- 관리자 이메일: `ian020529@gmail.com`

### Supabase Storage
- 버킷 `products` (Public): 상품 이미지
- URL 형식: `https://adynmnrzffidoilnxutg.supabase.co/storage/v1/object/public/products/파일명.jpg`

---

## 5. 파일 구조 & 완료된 페이지

```
app/
├── (auth)/
│   ├── login/page.tsx          ✅ 리디자인 완료
│   └── signup/page.tsx         ✅ 리디자인 완료
├── (main)/
│   ├── layout.tsx              ✅ 헤더(로고+장바구니) + 하단탭 5개(홈/강아지/제품/장바구니/내정보)
│   ├── dashboard/page.tsx      ✅ 리디자인 완료 (홈: 인사, 구독배너, 내강아지, 카테고리, 할인상품, 전체상품, 영양분석CTA, 브랜드소개)
│   ├── dogs/                   ✅ 목록/등록/상세/수정/설문/분석
│   ├── products/
│   │   ├── page.tsx            ✅ 리디자인 완료 (2열 그리드, 카테고리 탭)
│   │   └── [slug]/page.tsx     ✅ 리디자인 완료 (풀너비 이미지, 깔끔한 CTA)
│   ├── subscribe/[slug]/page.tsx ✅ 정기배송 신청 (카카오 주소검색 내장)
│   ├── cart/
│   │   ├── page.tsx            ⬜ 리디자인 필요
│   │   └── CartList.tsx        ⬜ 리디자인 필요
│   ├── checkout/
│   │   ├── page.tsx            ⬜ 리디자인 필요
│   │   ├── CheckoutForm.tsx    ✅ 카카오 주소검색 연동 완료, 디자인 리디자인 필요
│   │   ├── success/page.tsx    ⬜ 리디자인 필요
│   │   └── fail/page.tsx       ⬜ 리디자인 필요
│   ├── mypage/
│   │   ├── page.tsx            ✅ 정기배송 링크 추가됨, 디자인 리디자인 필요
│   │   ├── orders/             ⬜ 리디자인 필요
│   │   └── subscriptions/page.tsx ✅ 구독 관리 (일시정지/재개/해지/주기변경)
│   └── offline/page.tsx        ✅ 오프라인 페이지
├── admin/                      ✅ 대시보드/주문/제품/회원/구독 관리 (리디자인 불필요)
├── api/payments/confirm/route.ts ✅ 토스 결제 승인 API
├── page.tsx                    ⬜ 랜딩 페이지 (미구현, 현재 리다이렉트만)
└── layout.tsx                  ✅ PWA 메타태그, 서비스워커 등록

components/
├── AddressSearch.tsx           ✅ 카카오 우편번호 검색 (재사용 컴포넌트)
└── ServiceWorkerRegister.tsx   ✅ SW 등록

lib/
├── supabase/client.ts          ✅ 클라이언트용
├── supabase/server.ts          ✅ 서버용
└── nutrition.ts                ✅ NRC 2006 RER + AAFCO 2024 계산

public/
├── manifest.json               ✅ PWA
├── sw.js                       ✅ 서비스워커
├── logo.png                    ✅ 가로형 로고
├── icons/icon-192.png          ✅ PWA 아이콘
└── icons/icon-512.png          ✅ PWA 아이콘

global.d.ts                     ✅ daum 타입 선언 (중복 금지)
```

---

## 6. 지금 해야 할 작업 (우선순위순)

### 🔴 즉시 해야 할 것

**A. 장바구니 리디자인** (`cart/page.tsx`, `CartList.tsx`)
- 현재: 기능만 있는 리스트
- 목표: 상품 이미지 크게, 수량 +-  깔끔하게, 총액/배송비 요약 카드, "결제하기" CTA 하단 고정
- 배송비 기준: 3만원 이상 무료, 미만 3,000원
- 빈 장바구니 상태도 예쁘게 (이모지 + "제품 둘러보기" 링크)

**B. 체크아웃 리디자인** (`checkout/page.tsx`, `CheckoutForm.tsx`, `success/page.tsx`, `fail/page.tsx`)
- CheckoutForm에 카카오 주소검색 이미 연동됨 (AddressSearch 컴포넌트)
- 디자인만 리디자인된 다른 페이지들과 통일
- success: 주문 완료 축하 화면 (주문번호, 배송 예정, 쇼핑 계속하기)
- fail: 실패 안내 + 다시 시도 버튼

**C. 마이페이지 리디자인** (`mypage/page.tsx`)
- 프로필 정보 카드 (이름, 이메일)
- 메뉴: 주문내역, 정기배송, (알림설정, 배송지관리는 "준비 중")
- 로그아웃 버튼

**D. 주문내역 리디자인** (`mypage/orders/page.tsx`, `mypage/orders/[id]/page.tsx`)
- 목록: 주문번호, 날짜, 상태뱃지, 금액, 상품 썸네일
- 상세: 배송 타임라인, 상품 목록, 결제 정보

### 🟡 그 다음

**E. Step 23: SEO + 성능**
- 각 페이지별 메타태그 (title, description)
- OG 이미지 (기본 1장이면 충분)
- 제품 상세 페이지 동적 메타태그 (generateMetadata)
- next/image 최적화 (현재 img 태그 사용 중인 것들)
- 로딩 스켈레톤 (shimmer 효과)

**F. 랜딩 페이지** (`app/page.tsx`)
- 비로그인 사용자가 처음 보는 페이지
- 히어로 섹션 (브랜드 메시지 + CTA)
- 제품 하이라이트
- 브랜드 스토리 (Farm to Tail)
- 로그인/회원가입 유도

### 🟢 추후

- 에러 바운더리 + 로딩 스켈레톤 전체 적용
- 모바일 반응형 전체 QA
- 비밀번호 찾기 / 이메일 인증
- Supabase Storage 직접 업로드 (관리자 제품 편집 시)
- 토스 빌링키 연동 (사업자 등록 후)
- 건강 저널 / 커뮤니티 / Q&A
- 알림 시스템 (이메일/카카오톡)

---

## 7. 결제 흐름

```
/cart → [결제하기]
  → /checkout (배송지+수단 확인, orders+order_items INSERT with 'pending')
  → 토스 결제창 (SDK: loadTossPayments → payment.requestPayment)
  → /checkout/success?paymentKey=xxx&orderId=xxx&amount=xxx
  → /api/payments/confirm (서버: 금액 검증 → 토스 승인 API → orders UPDATE 'paid' → cart 비우기)
  → 주문 완료 화면
```

---

## 8. 개발 컨벤션

### 코드 스타일
- 'use client' 필요한 곳만 (이벤트핸들러, useState, useEffect)
- Supabase 클라이언트: `createClient()` from `@/lib/supabase/client`
- Supabase 서버: `createClient()` from `@/lib/supabase/server` (서버 컴포넌트/API)
- 이미지: 현재 `<img>` 태그 사용 중 (eslint-disable 주석 포함). 가능하면 next/image로 전환
- 가격 표시: `toLocaleString()` + "원"
- 날짜 표시: `toLocaleDateString('ko-KR', { ... })`

### 주의사항
- `declare global { interface Window { daum: ... } }` → global.d.ts에만 있음. 다른 파일에서 중복 선언하지 마.
- AddressSearch 컴포넌트: `useRef`로 콜백 참조 유지 (Daum Postcode 클로저 문제 해결됨)
- `.next` 캐시 문제 시: `Remove-Item -Recurse -Force .next` 후 `npm run dev`
- 좀비 서버: `npm run dev:clean` (package.json에 스크립트 있음)
- 배포: `vercel --prod` (GitHub 연동 불안정)

### globals.css에 추가된 커스텀 유틸
```css
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
```

---

## 9. 작업 시작 방법

1. 먼저 `ls`로 프로젝트 구조 확인
2. `cat app/(main)/cart/page.tsx`로 현재 코드 확인
3. 리디자인된 다른 페이지 참고: `cat app/(main)/dashboard/page.tsx` (홈), `cat app/(main)/products/page.tsx` (목록)
4. 동일한 디자인 시스템으로 장바구니 리디자인 시작
5. 한 파일 수정할 때마다 `npm run dev`로 확인 가능 (localhost:3000)
6. 배포는 전부 다 끝나고 `vercel --prod`

**작업할 때 꼭 기존 리디자인된 페이지의 스타일을 참고해서 일관성 유지해줘.**
**각 페이지 작업 전에 현재 코드를 먼저 읽고, 기능은 그대로 유지하면서 디자인만 업그레이드해.**

자 시작하자. 장바구니부터!
