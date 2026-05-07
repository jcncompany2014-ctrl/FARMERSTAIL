# Sentry Alert Rule 운영 가이드

코드 측에서 Sentry 통합은 모두 끝났음 — 자동 라우트 트레이싱, 비즈니스 span,
captureBusinessEvent, user.id / route.domain 태깅. 남은 건 Sentry Dashboard
에서 **알람 룰을 실제 채널 (텔레그램 / 이메일) 에 연결** 하는 것.

## 1. Issue Alert (자동 생성된 Sentry issue)

Dashboard → Alerts → Create Alert → Issues 선택:

### 룰 A — 매출 영향 critical
| 항목 | 값 |
|---|---|
| Conditions (any of) | event.tags 가 `business.event=1` AND `level=warning` 이상 |
| Filter | `route.domain` startsWith `subscription` OR `order` |
| Action | Slack / Email / Telegram (운영자 alias) |

→ 결제 실패 / 정기배송 paused / billing renewal_required 같은 매출 직결 이벤트만
실시간 알림.

### 룰 B — 인프라 장애
| 항목 | 값 |
|---|---|
| Conditions | new issue 발생 OR issue 가 1h 안에 50회+ |
| Filter | environment=production |
| Action | 운영자 alias |

→ unexpected exception (timeout / DB connection 등) 알람.

## 2. Metric Alert (트랜잭션 latency)

Dashboard → Alerts → Create Alert → Metrics 선택:

### 룰 C — 결제 confirm latency
| 항목 | 값 |
|---|---|
| Metric | transaction.duration |
| Filter | transaction:`POST /api/payments/confirm` |
| Trigger | p95 > 8s 가 5분 지속 |
| Action | 운영자 alias |

→ Toss API 지연 / 사이드 시스템 부하 조기 감지.

## 3. Cron 모니터링 (앱 자체 cron_health 와 병행)

Sentry Crons 기능 사용 시 vercel.json 의 cron 들을 monitor 로 등록 가능.
하지만 무료 티어에선 제한적 — 우선은 앱 측 `cron_health` 테이블 + admin 대시보드
ActionsPanel "24h cron 실패" 카드에서 모니터링.

비용 OK 면 Sentry Crons 추가:
1. Sentry Dashboard → Crons → Add Monitor
2. Slug = vercel cron path (예: subscription-charge)
3. Schedule = vercel.json 의 cron expression
4. Failure / missed alert → 운영자 alias

## 4. 채널 추천

- 가장 critical (매출 영향): **텔레그램** — 즉시 푸시
- 일반 issue: **이메일** — 일별 다이제스트 OK
- 무료 옵션: Sentry → Slack 무료 통합 (워크스페이스 1개)

## 5. 코드 측 태그 메모

이미 적용된 태깅 (서버):
- `business.event=1` — 비즈니스 이벤트 (매출 직결)
- `route.domain=subscription.charge` 류 — 라우트 도메인 분류
- `user.id` — 자동 첨부 (PII 미포함, UUID 만)
- `app.region=kr`, `app.platform=web` — 글로벌 태그
- `segment=admin/checkout/main` — error boundary 별

룰 만들 때 Filter 에 위 태그 활용.
