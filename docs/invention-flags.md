# 발명 핵심 feature flag (PCT 출원 전 kill switch)

## 목적

발명 명세서 9개 모듈 중 **핵심 청구항 알고리즘**이 GitHub public repo
(`FARMERSTAIL`) 에 들어가면 PCT 출원 시 **신규성(novelty)** 주장이 약화될 수
있다. 코드는 작성하되 환경변수 한 줄로 즉시 OFF 할 수 있게 한 kill switch.

## 사용

### 정상 동작 (개발/스테이징)
```
NEXT_PUBLIC_INVENTION_CORE=on
```

### PCT 출원 전 — 완전 OFF
```
NEXT_PUBLIC_INVENTION_CORE=off
# (또는 빈 값, 'on' 이외 값 모두 OFF)
```
→ 모든 발명 sub feature 자동 OFF (cascade).

### 일부만 OFF — 세분화
```
NEXT_PUBLIC_INVENTION_CORE=on
NEXT_PUBLIC_INVENTION_META_LEARNING=off   # 메타학습만 끄기
```

## flag 목록

| 환경변수 | 기능 | OFF 시 동작 |
|---------|------|------|
| `NEXT_PUBLIC_INVENTION_CORE` | 전체 master | 모든 sub 자동 OFF |
| `NEXT_PUBLIC_INVENTION_META_LEARNING` | 모듈 H | `/api/cron/meta-weights` skip |
| `NEXT_PUBLIC_INVENTION_COUNTERFACTUAL` | 모듈 G | `sensitivityAnalysis()` 빈 array / cron skip |
| `NEXT_PUBLIC_INVENTION_PERSONA` | 4 페르소나 | `computePersona()` dominant=null → UI 자동 hide |
| `NEXT_PUBLIC_INVENTION_W_IMAGE` | 모듈 B | (P23 이후 추가) 카메라 평가 함수 비활성 |

## 빠른 OFF 절차 (2분)

1. Vercel Dashboard → Project → Settings → Environment Variables
2. `NEXT_PUBLIC_INVENTION_CORE` 를 `off` 로 변경
3. Production redeploy (`Deployments → ⋯ → Redeploy`)
4. 약 60~90 초 후 모든 발명 기능 비활성

## 가시화

`/admin/invention-flags` 페이지에서 현재 flag 상태 확인.

## 코드 가드 패턴

```ts
import { isInventionEnabled } from '@/lib/invention-flags'

// 1. lib 함수
export function someInventionAlgorithm() {
  if (!isInventionEnabled('counterfactual')) return null
  // ... 본격 계산
}

// 2. server component
if (!isInventionEnabled('persona')) {
  return null // 또는 fallback UI
}

// 3. cron route
if (!isInventionEnabled('meta_learning')) {
  return NextResponse.json({ ok: true, skipped: true, reason: 'DISABLED' })
}
```

## 주의

- `NEXT_PUBLIC_*` env var 는 빌드 시 inline 됨. 변경 후 **redeploy 필수**.
- 코드 자체는 GitHub 에 노출됨. flag 는 **실행 차단**만 가능. 청구항 보호의
  궁극 방법은 (a) repo private 또는 (b) 알고리즘 핵심 상수·수식을 별도 private
  서비스로 분리.
- 이 flag 시스템은 **출원 전 시간 벌기 + 테스트** 용도. 그 후엔 공개 가능.
