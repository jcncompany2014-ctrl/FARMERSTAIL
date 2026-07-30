/**
 * 토스 키가 **테스트용인지 운영용인지** 판정 (2026-07-26 결제 경로 감사).
 *
 * # 왜 필요한가
 * 지금까지 코드 어디에도 이 구분이 없었다. 그런데 출시일에 이렇게 터진다:
 *
 *   ① 시크릿 키만 운영키로 바꾸고 **결제창 키(클라이언트 키)를 안 바꿈**
 *      → 고객이 결제창에서 카드까지 긁은 뒤 승인 단계에서 거부당한다.
 *        제일 나쁜 타이밍에 실패한다.
 *   ② 테스트 키인 채로 출시
 *      → 화면상 "결제 완료" 인데 **돈이 안 들어온다.** 한참 뒤에 안다.
 *   ③ 반대로 개발/미리보기 환경에 운영 키가 들어감
 *      → 테스트하다가 **진짜 돈이 빠져나간다.**
 *
 * 셋 다 "첫 실결제 때 딱 한 번" 드러나는 종류라, 코드로 미리 잡아야 한다.
 *
 * # 판정 기준
 * 토스 키는 접두사로 환경이 구분된다: `test_...` / `live_...`
 * (`test_ck_` · `test_sk_` · `test_gck_` · `live_ck_` · `live_sk_` · `live_gck_`)
 * 접두사만 보면 되고 키 값 자체는 절대 로그·화면에 노출하지 않는다.
 */

export type TossKeyMode = 'test' | 'live' | 'unknown' | 'missing'

/** 키 하나의 환경을 접두사로 판정. 값 자체는 반환하지 않는다. */
export function keyMode(key: string | undefined | null): TossKeyMode {
  if (!key || key.trim() === '') return 'missing'
  if (key.startsWith('test_')) return 'test'
  if (key.startsWith('live_')) return 'live'
  return 'unknown'
}

export type TossKeyStatus = {
  client: TossKeyMode
  secret: TossKeyMode
  /** 결제창 키와 시크릿 키의 환경이 서로 다름 — **항상 잘못된 설정**이다. */
  mismatched: boolean
  /** 실제로 돈이 오가는 설정인가 (둘 다 live). */
  isLive: boolean
  /** 둘 중 하나라도 없어서 결제 자체가 불가능한가. */
  incomplete: boolean
}

export function tossKeyStatus(
  clientKey: string | undefined | null,
  secretKey: string | undefined | null,
): TossKeyStatus {
  const client = keyMode(clientKey)
  const secret = keyMode(secretKey)
  const incomplete = client === 'missing' || secret === 'missing'
  // 둘 다 정상적으로 판정된 경우에만 불일치를 따진다(없는 건 불일치가 아니라 미설정).
  const known = (m: TossKeyMode) => m === 'test' || m === 'live'
  const mismatched = known(client) && known(secret) && client !== secret
  return {
    client,
    secret,
    mismatched,
    isLive: client === 'live' && secret === 'live',
    incomplete,
  }
}

/** 사장님이 읽을 한 줄 요약. 키 값은 절대 포함하지 않는다. */
export function describeTossKeyStatus(s: TossKeyStatus): {
  tone: 'ok' | 'warn' | 'danger'
  title: string
  detail: string
} {
  if (s.incomplete) {
    return {
      tone: 'danger',
      title: '결제 설정이 덜 됐어요',
      detail:
        s.client === 'missing' && s.secret === 'missing'
          ? '결제창 키와 시크릿 키가 둘 다 없어요. 지금은 결제를 받을 수 없어요.'
          : s.client === 'missing'
            ? '결제창 키가 없어요. 고객에게 결제창이 안 뜹니다.'
            : '시크릿 키가 없어요. 결제창은 떠도 승인이 안 됩니다.',
    }
  }
  if (s.mismatched) {
    return {
      tone: 'danger',
      title: '결제 키가 서로 짝이 안 맞아요',
      detail:
        '결제창 키와 시크릿 키가 서로 다른 환경(테스트/운영)이에요. ' +
        '이 상태로 두면 고객이 카드를 긁은 다음에 승인이 거부돼요. ' +
        '둘 다 운영키로 맞춰 주세요.',
    }
  }
  if (s.isLive) {
    return {
      tone: 'ok',
      title: '실결제 모드예요',
      detail: '지금 결제하면 진짜 돈이 오갑니다.',
    }
  }
  return {
    tone: 'warn',
    title: '테스트 모드예요',
    detail:
      '지금은 테스트 키라 결제가 성공해도 실제 입금이 없어요. ' +
      '토스 심사가 끝나면 운영키로 바꿔야 해요.',
  }
}
