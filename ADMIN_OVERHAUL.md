# Admin 전면 개편 계획 (2026-07-01 착수)

사장님 지시: 시스템이 많이 바뀌었으니(구독전용 전환·제품페이지 제거·쿠폰→자동할인·디자인) admin을 시작부터 끝까지 갈아엎기.
방향 확정: **①낡은 내용부터 정리 → ②기능형 클린 어드민 디자인**(데이터 밀도·명확한 위계·중립 톤, 회색조+포인트색, 표·필터·상태배지 중심).

## 감사 요약 (41 페이지)
- 디자인: admin은 FD·v3 안 씀, 자체 옛 스타일(Archivo Black 등). 페이지마다 제각각.
- 죽은/스테일: **collections**(낱개커머스용, 라이브참조0) · **events**(쿠폰-claim·무료배송 잔재) · **products**("상품·커머스" 프레임, 구독 레시피 관점 재정비 필요) · **대시보드**(주문 위주, 구독 중심 재편) · **자동할인 가시화 페이지 없음**.
- 깨끗: 레퍼럴·위시리스트·장바구니 참조 0.

## Phase A — 낡은 내용 정리 (기능적 부채)
- [x] A1. /admin/collections 제거 (죽은 기능) — 페이지+클라+AdminNav 링크 (커밋 166235c)
- [x] A2. /admin/events 쿠폰 잔재 정리 → benefit-auto 전용 (coupon-claim variant·coupon_code·쿠폰컬럼·죽은 /admin/coupons 링크 제거)
- [x] A3. /admin/products — **검토결과 손댈 것 없음**: 죽은 커머스필드/참조 0, 필드 전부 구독 레시피에 유효(sale_price도 subscribe 페이지가 사용). "상품" 표현만 커머스톤(Phase B 카피에서 정리). 기능 정상 → 미변경(잘 되는 코드 보존).
- [x] A4. 대시보드 — **검토결과 이미 구독 중심**: 활성구독·MRR·신규/해지·churn율·코호트 리텐션/LTV·처리대기큐(카드재등록·정기결제실패·환불). 커머스 유물 아님 → 미변경. (낱개-분석 위젯 '많이팔린상품·카테고리매출'은 구독청구가 order 생성하므로 데이터 유효, 유지.)
- [~] A5. 자동할인 가시화 — 별도 페이지는 과함. 필요시 Phase B에서 대시보드에 '이번주 적용 할인' 소위젯 정도 검토(선택).

**→ Phase A 결론: 실질 스테일 콘텐츠는 A1(collections)·A2(events쿠폰)뿐이었고 정리 완료. A3/A4는 이미 구독전용에 맞게 되어있어 미변경(파괴 방지). 남은 진짜 '갈아엎기' = Phase B 디자인 통일.**

## Phase B — 기능형 클린 어드민 디자인 통일 (사장님 "전체 일괄" 선택, 스크린샷 불가→배포후 확인)
방향: 중립 회색조(zinc) + terracotta 절제 포인트. Archivo Black·rounded-2xl·웜톤 → 클린 sans·rounded-lg·zinc.
- [x] B1. 공통 프리미티브 `components/admin/ui.tsx` — AdminHeader·AdminCard·Badge·AdminButton
- [x] B2. chrome 중립화 — layout.tsx 사이드바(#2A2118→#16181d)·bg(웜크림→#f6f7f9)·헤더바 + AdminNav zinc톤
- [x] B3-sample. 대시보드(app/admin/page.tsx) — AdminHeader + MetricCard 중립화(rounded-lg·zinc·클린 sans). **flagship 샘플로 먼저 배포 → 방향 확인**
- [ ] B3-rollout. 나머지 ~27 페이지 헤더(AdminHeader)·카드·배지 적용 (사장님 방향 OK 후 배치별 진행). Archivo Black 28파일 목록 = 롤아웃 대상.

## 규칙
- 잘게 꾸준히, 페이지별 tsc+eslint+build 검증 후 커밋. 워크플로우 금지(직접).
- admin/orders·subscriptions·finance·refunds는 결제데이터 표시 → 로직 불변, 표시/디자인만.
- 진행상황 이 문서 체크박스로 갱신.
