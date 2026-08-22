import { test } from 'node:test'
import assert from 'node:assert/strict'
import capacitorConfig from '../capacitor.config.ts'

/**
 * capacitor.config.ts 의 allowNavigation 이 **실제 Capacitor 매칭 규칙으로**
 * 필요한 호스트를 전부 통과시키는지 — 문자열 존재가 아니라 **동작**을 고정.
 *
 * # 왜 (2026-08-22 — 주소검색 3번째 왕복)
 * `*.daum.net` 을 넣고 "AAB 안에 문자열이 들어갔다"까지 검산했는데도 앱에서
 * 주소검색 iframe 이 여전히 외부로 튕겼다. Capacitor 의 HostMask.Simple 은:
 *
 *   if (maskSize > 1 && hostSize != maskSize) return false;  // 단계 수 정확 일치
 *
 * 즉 `*` 는 **한 단계만** 대응한다 — `*.daum.net`(3단계)은
 * `postcode.map.daum.net`(4단계)과 매치되지 않는다. 존재 검산은 통과를
 * 보장하지 않는다. 이 테스트는 그 자바 알고리즘을 그대로 복제해
 * (split('.') → reverse → 단계수 검사 → 라벨별 '*'/대소문자무시 비교)
 * 필요한 호스트가 실제로 통과하는지 검사한다.
 *
 * ⚠️ 복제원본: @capacitor/android .../util/HostMask.java (Simple.matches +
 * Util.matches). Capacitor 메이저 업그레이드 시 원본과 대조할 것.
 */

function hostMaskMatches(mask: string, host: string): boolean {
  const maskParts = mask.split('.').reverse()
  const hostParts = host.split('.').reverse()
  if (maskParts.length > 1 && hostParts.length !== maskParts.length) {
    return false
  }
  const min = Math.min(maskParts.length, hostParts.length)
  for (let i = 0; i < min; i++) {
    const m = maskParts[i]
    const h = hostParts[i]
    if (m === undefined || h === undefined) return false // i < min 이라 실제론 불가
    if (m === '*') continue
    if (m.toUpperCase() !== h.toUpperCase()) return false
  }
  return true
}

const MASKS: readonly string[] = capacitorConfig.server?.allowNavigation ?? []

function allowed(host: string): boolean {
  return MASKS.some((m) => hostMaskMatches(m, host))
}

test('★앱 안에서 반드시 열려야 하는 호스트 — 하나라도 빠지면 외부 브라우저로 튕긴다', () => {
  const mustAllow: Array<[string, string]> = [
    // [host, 안 열리면 무슨 일이 나나]
    ['www.farmerstail.kr', '앱 자체'],
    ['farmerstail.kr', '앱 자체(리다이렉트 전)'],
    ['js.tosspayments.com', '결제창 — 카드 등록 첫 화면부터 안 열림'],
    ['adynmnrzffidoilnxutg.supabase.co', 'OAuth 중계 — 소셜 로그인 불능'],
    ['kauth.kakao.com', '카카오 동의 화면'],
    ['accounts.kakao.com', '카카오 계정'],
    ['appleid.apple.com', '애플 로그인'],
    ['postcode.map.daum.net', '주소검색 iframe — 선택 불가 외부앱 팝업(실제 3회 재현)'],
    ['t1.daumcdn.net', '주소검색 위젯 자원'],
  ]
  const blocked = mustAllow.filter(([host]) => !allowed(host))
  assert.deepEqual(
    blocked,
    [],
    'allowNavigation 이 실제 매칭 규칙으로 거르는 필수 호스트:\n  ' +
      blocked.map(([h, why]) => `${h} — ${why}`).join('\n  '),
  )
})

test('무관한 호스트는 여전히 막힌다 (목록이 과하게 넓어지지 않았는지)', () => {
  for (const host of [
    'evil.com',
    'daum.net.evil.com',
    'postcode.map.daum.net.evil.com', // 5단계 — 4단계 마스크와 불일치로 차단
    'tosspayments.com.evil.com',
    'google.com',
  ]) {
    assert.equal(allowed(host), false, `${host} 는 막혀야 한다`)
  }
})

test('매칭 복제가 원본 의미와 같은지 자기검사 — 단계수·와일드카드·대소문자', () => {
  assert.equal(hostMaskMatches('*.daum.net', 'map.daum.net'), true)
  // 이것이 이번 사고의 전부: 한 단계 더 깊으면 와일드카드도 소용없다.
  assert.equal(hostMaskMatches('*.daum.net', 'postcode.map.daum.net'), false)
  assert.equal(hostMaskMatches('postcode.map.daum.net', 'POSTCODE.MAP.DAUM.NET'), true)
  assert.equal(hostMaskMatches('*.kakao.com', 'kauth.kakao.com'), true)
})
