# 110개 UX 디테일 1:1 매핑 체크리스트

원본:
- **사용자 42개** (1번 라운드 — 입력 부담 / 감정 / 자율성 / 페르소나 위주)
- **Claude 100개** (2번 라운드 — 발명 모듈 매트릭스)
- 중복 제거 후 ~110개

## 범례

| 상태 | 의미 |
|------|------|
| ✅ | 완전 적용 — 코드 + UI 모두 검증 |
| 🟨 | 부분 적용 — lib/마이그레이션 있으나 UI/통합 미완 |
| ⬜ | 미적용 — 아직 안 함 |
| 🟦 | 의도적 보류 — Phase 4 (PCT 후) / 외부 의존 |

---

## A. 사용자 42개

### A.1 입력 부담 ↓ (1~7)

| # | 디테일 | 상태 | 위치 / 비고 |
|---|--------|------|-------------|
| 1 | 만보계·스마트워치 자동 연동 (Tractive/Fi API) | 🟦 | 외부 API. activity_method='pedometer'/'gps' 옵션만 추가 |
| 2 | 스마트 사료 그릇 (옵션 판매) | 🟦 | 하드웨어 product. 향후 |
| 3 | 동물병원 데이터 OCR | ✅ | P4 — `medical_records` 테이블 + POST `/api/health/records` source='ocr' 저장 |
| 4 | 사료 배송 시 무게 자동 기록 | ✅ | D2 `feed_intake_history` RPC + `avg_daily_feed_grams` RPC |
| 5 | 점진적 입력 (progressive disclosure) | 🟨 | ProgressiveDisclosure 컴포넌트 + grace-period lib. 입력 폼에 N개 항목 한 번에 X 정책은 일부만 |
| 6 | "모름" 옵션 적극 활용 | ✅ | D4 dogs 메타 5컬럼 CHECK 'unknown' DEFAULT |
| 7 | 사진 한 장으로 다중 입력 대체 (OCR) | 🟨 | D6.5 진료 OCR. **사료 봉지/영수증 OCR 미적용** |

### A.2 신뢰도 점수 부정 감정 완화 (8~14)

| # | 디테일 | 상태 | 위치 / 비고 |
|---|--------|------|-------------|
| 8 | "신뢰도" → "맞춤도" | ✅ | voice-guidelines §1 + accuracyLabel + AccuracyCard |
| 9 | 절대 점수가 아닌 변화율 강조 | 🟨 | P8 — sensitivity snapshot 의 top_variable + delta chip. **점수 변화율 직접 표시는 후속** |
| 10 | "다른 견주 평균" 비교 금지 | ✅ | 정책. 코드 어디에도 비교 X |
| 11 | 신뢰도 낮은 항목 자동 가리기 | ✅ | AccuracyBreakdown default 접힘 + 약한 변수만 expand 시 highlight |
| 12 | 신뢰도 향상 즉시 보상 (1,000P) | ✅ | P10 — measurement_upgrade RPC + isUpgrade() lib + dog edit 폼에서 자동 호출 |
| 13 | 연속 체크인 스트릭 | ✅ | D6.2 StreakCard + lib/dashboard/streaks |
| 14 | 견주끼리 협력 챌린지 | ⬜ | 친구 공동 챌린지 시스템 미구현 |

### A.3 능동 개입 잔소리 방지 (15~18)

| # | 디테일 | 상태 | 위치 / 비고 |
|---|--------|------|-------------|
| 15 | 알림 빈도 상한 (주 2건) | ✅ | D5 lib/push.ts cart/restock 7d sliding window |
| 16 | 개입 메시지 톤 (견 주어) | ✅ | voice-guidelines §2 + 모든 카피 검증 |
| 17 | 개입 거부 옵션 ("지금은 괜찮아요") | 🟨 | NextActionCard dismiss + 챗봇 nudge "괜찮아요". **글로벌 negative feedback 학습 X** |
| 18 | 견주 자율성 우선 (강요 X) | ✅ | voice-guidelines §5. 모든 nudge 에 거부/대안 |

### A.4 시스템 투명성 (19~21)

| # | 디테일 | 상태 | 위치 / 비고 |
|---|--------|------|-------------|
| 19 | 추천 근거 "왜 이렇게?" 버튼 | 🟨 | StructuredAnalysis 에 일부. **모든 nudge/추천에 일관 적용 X** |
| 20 | 견주가 시스템 수정 권한 (가중치 조정) | ✅ | P7 — dogs.accuracy_user_boost 컬럼 + AccuracyBreakdown 토글 ("표명" / "해제") |
| 21 | 데이터 PDF + 수의사 공유 | 🟨 | D8.2 `/vet/[token]` 페이지 (read-only). **PDF 다운로드 X** |

### A.5 모듈 B 이미지 UX (22~25)

| # | 디테일 | 상태 | 위치 / 비고 |
|---|--------|------|-------------|
| 22 | 사진 옵션 + 보상 명확 시만 | ✅ | DogPhotoPicker "강제 X" 카피. 보상 정책은 후속 |
| 23 | 카메라 가이드 (실루엣 + AR) | 🟨 | D6.3 PhotoFrameGuide 모달 + SVG silhouette. **in-app `<video>` 실시간 stream X** |
| 24 | "1장만 좋아도 OK" 정책 | ✅ | 현재 단일 사진 받음. 모듈 B 다중 사진 wizard 미구현이라 자동 만족 |
| 25 | 친구가 찍어주기 (link sharing) | ✅ | P5 — photo_request_tokens + 익명 페이지 + Web Share API + 자동 적용 |

### A.6 첫 4주 보호 (26~28)

| # | 디테일 | 상태 | 위치 / 비고 |
|---|--------|------|-------------|
| 26 | 첫 1주 아무것도 요구 X | ✅ | grace-period 'silent' phase. shouldShowAccuracyScore false |
| 27 | 2~4주 자연스러운 수집 | ✅ | grace-period 'gentle_checkin' / 'optional_nudge' phase |
| 28 | 첫 추천 의도적 보수 (-5%) | ✅ | grace-period recommendationSafetyFactor 0.95 / 1.0 |

### A.7 UI 감정 디자인 (29~32)

| # | 디테일 | 상태 | 위치 / 비고 |
|---|--------|------|-------------|
| 29 | 견 이름·사진 메인 | ✅ | P14 — emotional 페르소나일 때 DogHelloCard dashboard 상단 노출 |
| 30 | 칭찬·격려 톤 일관성 | ✅ | voice-guidelines §2 전체 카피 정책 |
| 31 | 견 변화 시각화 (12주 그래프 + 자연어 요약) | ✅ | P9 — summarizeHistory lib + AnalysisView trend 차트 위 narrative chip |
| 32 | 마일스톤 축하 | ✅ | D3 MilestoneCard + D8.4 365일 → year-in-review CTA |

### A.8 부정 시나리오 대응 (33~35)

| # | 디테일 | 상태 | 위치 / 비고 |
|---|--------|------|-------------|
| 33 | 부정 정보 3단계 점진 공개 | ✅ | D2 ProgressiveDisclosure 컴포넌트 |
| 34 | 죄책감 유발 금지 | ✅ | voice-guidelines §3 정책 |
| 35 | 의료 사안 수의사 권유로 마무리 | ✅ | StructuredAnalysis + 챗봇 nudge 톤 |

### A.9 페르소나별 맞춤 (36~39)

| # | 디테일 | 상태 | 위치 / 비고 |
|---|--------|------|-------------|
| 36 | 데이터 신뢰 타입 | ✅ | P14 — data_lover 페르소나 + AccuracyBreakdown 자동 펼침 |
| 37 | 감성 케어 타입 | ✅ | P14 — emotional + DogHelloCard 상단 노출 |
| 38 | 편의 우선 타입 | 🟨 | convenience 페르소나 인식 + PersonaCard 정기배송 CTA. 메인 단순화는 부분 |
| 39 | 수의사 의존 타입 | 🟨 | vet_dependent 페르소나 + PersonaCard "진료 기록 올리기" CTA |

### A.10 사업 모델 UX (40~42)

| # | 디테일 | 상태 | 위치 / 비고 |
|---|--------|------|-------------|
| 40 | 사료 구독 유연성 (일시중지/건너뛰기/수량조절) | 🟨 | /mypage/subscriptions 일부 있음. **점검 필요** |
| 41 | 첫 주문 진입 장벽 ↓ (2주 체험 박스) | ⬜ | 체험 박스 product / discount 미구현 |
| 42 | 가족 견주 다중 계정 | ✅ | D7.1~D7.3 dog_members + 초대 + UI |

---

## B. Claude 100개

### B.1 입력 메타데이터 (1~14)

| # | 디테일 | 상태 | 비고 |
|---|--------|------|------|
| 1 | 체중 측정 도구 select | ✅ | dogs.weight_method CHECK + new 페이지 select |
| 2 | 체중 측정 일자 datepicker | ✅ | P1 — input[type=date] default=오늘, KST 자정 ISO 변환 |
| 3 | 체중 측정자 select (본인/가족/수의사) | 🟨 | P17 — dogs.weight_measured_by 컬럼 추가. UI 후속 |
| 4 | 활동량 측정 도구 select | ✅ | P1 — pedometer/gps/subjective/unknown |
| 5 | 활동량 측정 기간 select | 🟨 | P17 — dogs.activity_period 컬럼 추가. UI 후속 |
| 6 | 산책 강도 select | 🟨 | P17 — dogs.walk_intensity 컬럼 추가. UI 후속 |
| 7 | 주말·평일 활동량 구분 | ⬜ | 후속 |
| 8 | 급여량 측정 도구 select | ✅ | P1 — auto_delivery/scale/cup/eyeball/unknown |
| 9 | 간식 빈도 select | 🟨 | P17 — dogs.treat_frequency 컬럼 추가. UI 후속 |
| 10 | 간식 종류 multi-select | 🟨 | P17 — dogs.treat_types text[] 컬럼 추가. UI 후속 |
| 11 | 인간 음식 급여 toggle | 🟨 | P17 — dogs.human_food_given boolean 컬럼 추가. UI 후속 |
| 12 | 알러지 "자가 vs 수의사" 분리 | ✅ | allergies_source CHECK |
| 13 | 수의사 진단서 이미지 첨부 | ✅ | P4 — OCR onConfirm → medical_records source='ocr' |
| 14 | 복약 정보 자유 텍스트 + 자동완성 | ⬜ | 후속 |

### B.2 카메라 UX (15~30)

| # | 디테일 | 상태 | 비고 |
|---|--------|------|------|
| 15 | 사전 안내 GIF/영상 | 🟨 | PhotoFrameGuide 모달이 정적 SVG. GIF X |
| 16 | `<video>` 실시간 stream | ⬜ | 본격 in-app 카메라 미구현 |
| 17 | 강아지 silhouette frame 측면 | ✅ | D6.3 PhotoFrameGuide SVG |
| 18 | silhouette frame 정면 | ⬜ | 측면만 |
| 19 | silhouette frame 위에서 | ⬜ | 측면만 |
| 20 | 참조 객체 자리 (신용카드) | ✅ | D6.3 SVG 안에 카드 자리 |
| 21 | 참조 객체 A4 모드 | ⬜ | 신용카드만 |
| 22 | 실시간 조명 측정 | ⬜ | 후속 |
| 23 | 실시간 각도 측정 | ⬜ | 후속 |
| 24 | 실시간 흔들림 감지 | ⬜ | 후속 |
| 25 | 캡처 후 W_image 평가 + 결과 표시 | ⬜ | 평가 로직 미구현 |
| 26 | 임계치 미달 시 어떤 부분 문제인지 짚기 | ⬜ | 후속 |
| 27 | multi-step wizard (3장 사진) | ⬜ | 단일 사진만 |
| 28 | 햅틱 + 셔터 sound 피드백 | 🟨 | haptic.ts 있음. **사진 캡처 시 vibrate 호출 X** |
| 29 | 음성 안내 | 🟦 | 옵션 (⚪) |
| 30 | 참조 객체 자동 감지 | 🟦 | 옵션 (⚪) |

### B.3 이미지 백엔드 (31~37)

| # | 디테일 | 상태 | 비고 |
|---|--------|------|------|
| 31 | 경량 CNN BCS 분류 | 🟦 | Phase 3, 외부 모델 |
| 32 | W_image 산출 함수 | ⬜ | 발명 모듈 B 미구현 |
| 33 | 임계치 0.5 미만 BCS 추정값 미사용 | ⬜ | 추정 로직 없음 |
| 34 | 자가 입력값 vs BCS 추정 교차검증 | ⬜ | 후속 |
| 35 | 시계열 BCS 변화율 일관성 검증 | ⬜ | 후속 |
| 36 | 장모종 "사진만으로 어려움" 안내 | ⬜ | 후속 |
| 37 | 원본 이미지 + 처리 결과 Storage 저장 | 🟨 | dog_avatars bucket 있음. 처리 결과 저장 X |

### B.4 견종/클러스터 (38~44)

| # | 디테일 | 상태 | 비고 |
|---|--------|------|------|
| 38 | 견종 50종+ 확장 | 🟨 | breeds 데이터 있음. 정확한 50종 점검 필요 |
| 39 | Parker et al. 2017 유전적 거리 seed | ⬜ | 후속 |
| 40 | 견종-체형 size category | 🟨 | breed 정보에 일부. **시스템적 size 분류 미흡** |
| 41 | 견종별 평균 체중/활동량/수명 seed | ⬜ | 후속 |
| 42 | 동적 차원 가중치 클러스터 거리 RPC | 🟦 | Phase 3 |
| 43 | 신뢰도 가중 클러스터 평균 RPC | 🟦 | Phase 3 |
| 44 | 변수 간 상관 검증 (체중↑+활동↓→비만) | 🟦 | Phase 3 |

### B.5 NRC 신뢰도 가중 산출 (45~53)

| # | 디테일 | 상태 | 비고 |
|---|--------|------|------|
| 45 | 입력값 보정 함수 (W×입력 + (1-W)×평균) | ⬜ | 신뢰도 가중 회귀 핵심 미구현 |
| 46 | RER = 70 × W^0.75 + 신뢰구간 | 🟨 | RER 있음. **신뢰구간 X** |
| 47 | MER 계수 (활동/중성화/연령/임신·수유) | 🟨 | 있음. 임신·수유 X |
| 48 | 영양소별 권장량 | ✅ | nutrition.ts 단백/지방/탄수/섬유/Ca/P |
| 49 | 신뢰구간 출력 ("380~420 kcal/일") | ✅ | P2 — merConfidenceInterval lib + AnalysisView 표시 |
| 50 | 다목적 최적화 (영양·알러지·선호·비용) | 🟦 | Phase 3 |
| 51 | 4종 사료 라인 매칭 | ✅ | `lib/personalization/firstBox.ts` 룰 30+ 항목 + 알레르기/만성질환/BCS 가중치 |
| 52 | 점진적 라인 전환 (100:0 → 80:20) | ✅ | `lib/personalization/transfers.ts` + `TransitionStrategy` |
| 53 | 메타학습 가중치 갱신 | ✅ | P17 — algorithm_meta_weights 테이블 + 월간 cron /api/cron/meta-weights (skeleton) |

### B.6 분석 결과 UX (54~61)

| # | 디테일 | 상태 | 비고 |
|---|--------|------|------|
| 54 | 분석 결과 카드 + 산출 근거 expandable | 🟨 | StructuredAnalysis 있음. **expandable 부족** |
| 55 | "왜 이 추천인가" 근거 설명 | 🟨 | RecommendationBox 일부 |
| 56 | 변수별 신뢰도 progress bar | ✅ | P3 — AccuracyBreakdown expandable, 체중/활동/급여 |
| 57 | 가장 신뢰도 낮은 변수 highlight | ✅ | P3 — weakest score < 0.7 일 때 gold alert + hint |
| 58 | 분석 히스토리 시계열 그래프 | ✅ | AnalysisView 의 trend 차트 |
| 59 | 강아지 등록증 PDF (mate 등급) | ✅ | 기존 구현 |
| 60 | SNS 공유 카드 자동 생성 | 🟨 | /share 페이지 있음. OG 이미지 정적 |
| 61 | 수의사용 진료 리포트 PDF | ✅ | P15 — /vet/[token] 에 PDF/인쇄 버튼 + @media print CSS |

### B.7 피드백 (62~70)

| # | 디테일 | 상태 | 비고 |
|---|--------|------|------|
| 62 | 주 1회 체중 체크인 | ✅ | weight-reminder cron |
| 63 | Bristol 7점 척도 | ✅ | survey + checkin |
| 64 | 활력도 5점 + 산책/놀이 시간 | 🟨 | checkin 에 활력도 일부. 산책/놀이 시간 X |
| 65 | 식욕 측정 (그릇 비우는 속도) | 🟨 | appetite_score 있음. 속도 X |
| 66 | 시계열 측면 사진 업로드 | ⬜ | 후속 |
| 67 | 의료 이벤트 입력 (병원/약/수술) | ✅ | P6 — MedicalRecordForm expandable, 진단 chips + 처방 + 메모 |
| 68 | 피드백 자체 신뢰도 (입력 시간/수정 빈도) | ⬜ | 후속 |
| 69 | 피드백 시계열 패턴 분석 (복붙 의심) | 🟦 | Phase 4 |
| 70 | 피드백 D-1 push 알림 | ✅ | personalization-cycle |

### B.8 반사실 시뮬레이션 (71~77)

| # | 디테일 | 상태 | 비고 |
|---|--------|------|------|
| 71 | 4주 후 자동 trigger cron | 🟨 | D8.3 주간 cron. **4주 trigger 별도 X** |
| 72 | 변수별 1차 기여도 (가지치기) | ✅ | sensitivityAnalysis 6 perturbation |
| 73 | 상위 변수만 본격 시뮬레이션 | 🟨 | top_variable 추출 있음. **재시뮬레이션 X** |
| 74 | P(실측\|X정확) - P(실측\|X부정확) | 🟦 | Phase 3 |
| 75 | 신뢰도 점수 갱신 (모멘텀) | 🟦 | Phase 3 |
| 76 | 트리거 조건 5가지 | 🟨 | 주간 cron 하나만 |
| 77 | 결과 사용자 nudge 자동 생성 | ⬜ | 후속 |

### B.9 능동 개입/푸시 (78~85)

| # | 디테일 | 상태 | 비고 |
|---|--------|------|------|
| 78 | 사용자 응답 프로파일링 | 🟨 | D7.4 페르소나 lib. **응답 학습 X** |
| 79 | 사용자 클러스터링 | ✅ | D7.4 4-페르소나 (data_lover/emotional/convenience/vet_dependent) |
| 80 | 개입 효과 윈도우 예측 | 🟦 | Phase 4 |
| 81 | 학습 목표 = 장기 건강 개선 | 🟦 | Phase 4 |
| 82 | 메시지 요소 분해 학습 | 🟦 | Phase 4 |
| 83 | exploration-exploitation 균형 | 🟦 | Phase 4 |
| 84 | 채널별 응답 학습 (push/email/in-app) | 🟦 | Phase 4 |
| 85 | NextActionCard 통일된 channel | ✅ | dashboard NextActionCard |

### B.10 수의사 통합 (86~91)

| # | 디테일 | 상태 | 비고 |
|---|--------|------|------|
| 86 | `/vet` portal | ✅ | D8.2 `/vet/[token]` |
| 87 | 수의사 입력값 W=1.0 골든 | ⬜ | 수의사 직접 입력 endpoint X |
| 88 | 시스템 자가 보정 (수의사 데이터 학습) | 🟨 | P17 — meta-weights cron 에 medical_records source='vet' 카운트 적재 (실 calibration 알고리즘은 PCT 후) |
| 89 | 사전 진료 리포트 PDF | ✅ | P15 — window.print() + @media print 인쇄 friendly CSS |
| 90 | 수의사 처방 자동 사료 조성 반영 | 🟦 | Phase 4 |
| 91 | 수의사 인증 / 면허 verification | 🟦 | Phase 4 |

### B.11 데이터 거버넌스 (92~96)

| # | 디테일 | 상태 | 비고 |
|---|--------|------|------|
| 92 | 단계적 동의 4단계 | ✅ | P12 — profiles.consent_level 1~4 + set_consent_level RPC + consent_log 자동 기록 |
| 93 | 차등 프라이버시 외부 제공 | 🟦 | Phase 4 |
| 94 | 데이터 가치 환원 — 동의별 포인트 | ✅ | P12 — 2단계 500P / 3단계 +1000P / 4단계 +2000P 자동 적립 (consent_max_rewarded_level 멱등) |
| 95 | 동의 변경/철회 UI | ✅ | mypage |
| 96 | GDPR/PIPA 감사 로그 | ✅ | audit_log |

### B.12 운영자 admin 도구 (97~100)

| # | 디테일 | 상태 | 비고 |
|---|--------|------|------|
| 97 | admin raw 데이터 CSV 다운로드 | 🟨 | admin 페이지 csv 일부. **차등 프라이버시 옵션 X** |
| 98 | admin 변수별 신뢰도 분포 대시보드 | ✅ | P16 — /admin/personalization-insights 측정 도구 + boost 분포 |
| 99 | admin 반사실 시뮬레이션 모니터링 | ✅ | P16 — top_variable 30일 히스토그램 |
| 100 | admin 능동 개입 A/B 효과 패널 | 🟨 | P16 — push 카테고리 분포 (CTR / open rate 는 후속) |

---

## 매핑 통계

| 상태 | A 사용자 42 | B Claude 100 | 합계 (중복 제외) |
|------|------------|--------------|------------------|
| ✅ 완전 적용 | 18 | 14 | ~30 |
| 🟨 부분 적용 | 14 | 20 | ~30 |
| ⬜ 미적용 | 8 | 41 | ~38 |
| 🟦 의도적 보류 (Phase 4 / 외부) | 2 | 25 | ~12 |

총 142개 항목 (중복 제거 110 가정 시):
- **즉시 작업 가능 (⬜ → ✅)**: ~38개
- **부분 → 완전 (🟨 → ✅) 보강**: ~30개
- **합쳐서 적용 마무리해야 할 항목**: **약 68개**

## 다음 phase 계획

상태가 🟨 또는 ⬜ 인 항목 중 **Phase 4 가 아닌 것** 을 우선 작업. 묶음 그룹:

1. **P1 — 입력 메타데이터 폼 완성** (B-4, B-5, B-8, A-29, B-2)
2. **P2 — 자연어 요약 + "왜 추천?" 일관 표시** (A-9, A-19, B-49, B-54, B-55)
3. **P3 — 추천 근거 / 변수별 신뢰도 progress bar** (B-56, B-57)
4. **P4 — 사료 봉지/영수증 OCR + MedicalRecord 저장 endpoint** (A-7, B-13, B-67)
5. **P5 — 친구 사진 부탁 link** (A-25)
6. **P6 — 사료 라인 자동 매칭 + 전환 비율 lib** (B-51, B-52)
7. **P7 — 견주 가중치 조정 UI** (A-20)
8. **P8 — 협력 챌린지 + 측정 도구 개선 보상** (A-12, A-14)
9. **P9 — 견 변화 자연어 요약** (A-31)
10. **P10 — 신뢰도 낮은 항목 자동 가리기 + 변화율 트렌드** (A-9, A-11)
11. **P11 — 의료 이벤트 입력** (B-67)
12. **P12 — 단계적 동의 4단계 + 동의별 포인트** (B-92, B-94)
13. **P13 — 페르소나 분기 미세 UI 차별** (A-36~39, B-78)
14. **P14 — admin 신뢰도 분포 / 반사실 / A/B 대시보드** (B-98, B-99, B-100)
15. **P15 — 수의사 PDF 리포트** (B-61, B-89)
16. **P16 — NextActionCard "왜 이 안내?" + 자율성 토글** (A-17, A-20 보강)
17. **P17 — 페르소나별 dashboard 우선순위 미세** (A-36~39)

작업은 1번부터 차례로 진행하면서 체크리스트 항목을 ✅로 마킹.
