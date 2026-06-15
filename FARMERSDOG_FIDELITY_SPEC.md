# FD 충실 복제 스펙 (thefarmersdog.com 실구조 분석 — 2026-06-13)

> 사장님 지시: "FD 톤 흉내가 아니라 **실제 레이아웃 순서·각 요소 모션/슬라이드·디자인요소·상단 메뉴까지 그대로 복제**."
> 리더 프록시(r.jina.ai)로 thefarmersdog.com 실구조 추출(직접/Wayback 은 403 차단). 아래는 **구조·UI·인터랙션 청사진** — 텍스트/이미지/로고는 복제 안 함(한글 원본 + PhotoSlot + 로고 제외).

## 정직 가드(이 스펙 적용 시 필수)
- ❌ 가짜 기관/언론 보증(코넬대·구글리뷰·Today Show·CBS 등 FD 실제 파트너) → 우리 건 **사실 기반 타일**(수의영양 기준·국내농가 직계약·무항생제·콜드체인) 또는 PhotoSlot("언론 보도 자리").
- ❌ 가짜 임상연구(코넬 연구 섹션) → "영양 설계 **근거**" 섹션으로(가이드라인 기반, /science 링크). 단정·수치 날조 금지.
- ❌ 가짜 후기/별점/이름 → 캐러셀 **구조는 복제**하되 카드 내용은 후기 placeholder("실사용 후기 자리").
- 모든 CTA → 설문 퍼널(planHref). 사진 자리 → PhotoSlot.

## 상단 헤더 (그대로 복제 대상)
- 프로모바(Tier1): "첫 구매 혜택" 류 (현 pine 바 유지·문구만 한글).
- 메인 내비(Tier2): **우리 음식 / 후기 / 브랜드 이야기 / 자주 묻는 질문 / 수의사 전문가** + 우측 CTA.
  - FD 우측은 "Log In" — 우리는 로그인 아이콘 + 코랄 CTA("플랜 보기"→설문) 병행 유지.
  - 스크롤 elevation(상단 투명→스크롤 시 그림자) = 회차11 적용 완료.
- "수의사 전문가"(Vet Professionals) 링크 = 신규(→ /science 또는 전용). 현 nav 에 추가 검토.

## 홈페이지 섹션 순서 (실제 FD, 위→아래) — app/page.tsx 재배열 기준
1. **Hero** — 풀블리드 배경 이미지 + 큰 헤드라인 + 서브헤드 + 듀얼 CTA(주 CTA 설문 + 보조). 모션: 진입 fade/lift.
2. **Trust strip** — 신뢰 로고/지표 캐러셀 + 인용 타일. (우리: 사실 타일 or PhotoSlot, 가짜 보증 X). 모션: 가로 흐름(마퀴) 또는 정적 그리드.
3. **Value proposition** — 텍스트 블록 + "맞춤 플랜 만들기" CTA. 모션: reveal.
4. **Feature cards ×4** — 진짜 음식 / 사람 등급 안전 / 저온 조리 / 수의 설계 (아이콘+짧은 카피). 그리드. 모션: 스태거 reveal.
5. **Comparison** — 헤드라인 + **3컬럼 대비**(낡은 사료 방식 vs 우리 방식). 모션: reveal, 컬럼 스태거.
6. **How we make it healthy** — 3컬럼(사람등급 기준 / 맞춤 플랜 / 며칠 내 배송). 모션: 스태거.
7. **Complete meal plan** — 듀얼 제품 쇼케이스(신선 레시피 + 토퍼/간식) + CTA. 2업 카드. PhotoSlot.
8. **Benefits + How it works** — 혜택 4아이콘 + **3스텝 프로세스**(설문→맞춤설계→배송) + CTA. 모션: 스텝 순차.
9. **Science & expertise** — 헤드라인 + 불릿(영양사·수의 자문·표준 기준·근거) + /science 링크. (다크 섹션 후보)
10. **Vet testimonials** — 수의사 인용 **캐러셀**(3 타일). 우리: 후기 placeholder 슬라이더.
11. **Study / 근거** — 연구 개요 + 혜택 4콜아웃. 우리: "근거" 섹션(가이드라인, 날조 X).
12. **Social proof** — 고객 후기 **캐러셀**(반려견 이름 + 인용). 우리: 후기 placeholder 슬라이더 + PhotoSlot.
13. **Final CTA** — 코랄 밴드 큰 CTA + 신뢰 불릿.
14. **Footer** — 멀티컬럼(사이트맵 / 고객지원 / 연결 / 뉴스레터 이메일 가입) + 법정 SiteFooter.

## 인터랙션/모션 체크리스트 (전 페이지)
- 헤더 스크롤 elevation ✅(회차11).
- 섹션 진입 scroll-reveal fade-up + 카드 그리드 스태거(Reveal delay) — 점진 적용 중.
- **가로 캐러셀**(scroll-snap + 화살표/드래그) — 후기/수의사 후기/제품. → 신규 클라이언트 컴포넌트 `components/web/fd/FdSlider.tsx`.
- 모바일 sticky bottom CTA ✅(StickyCta).
- 신뢰 로고 마퀴(선택).
- reduced-motion 가드 ✅(globals 전역 net).

## 진행
- [완료] app/page.tsx = FD 14섹션 순서 1:1 일치(Hero→Trust→Value→Feature→Comparison→HowWeMakeIt→CompleteMealPlan→HowItWorks→Science→VetVoices→Evidence→SocialProof→FinalCta+Footer). 회차49 검증.
- [완료] FdSlider 캐러셀(scroll-snap+화살표/키보드 a11y) — 후기/수의사 후기 슬라이더 적용.
- [완료] 헤더 "수의사 전문가"→/science 링크(nav 5항목: 우리음식·후기·브랜드·FAQ·수의사 전문가). 회차60 확인.
- [완료] 하위 페이지 같은-깊이 재점검 — our-food·reviews·plans·science·brand·about·faq·blog·contact·newsletter·business 전수(회차51~53), 발견 갭(VetVoices 다크브레이크·StarDots 정직) 수정·나머지 클린.
- [참고] 이후 ②/③ 보강은 FD_CLONE_QUEUE.md Section E~N 로그 참조(옛색0 전 web 표면·OG 13/13·sitemap·nav 활성·드로어 a11y·skip-link·legal FD화 등).
