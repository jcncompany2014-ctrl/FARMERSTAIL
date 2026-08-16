import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  contrastRatio,
  luminance,
  passesAA,
  passesAAA,
  V3_CONTRAST_PAIRS,
} from './contrast.ts'
import { billingMethod } from '../payments/billing-methods.ts'

describe('contrast', () => {
  it('luminance black/white', () => {
    assert.ok(Math.abs(luminance('#000000') - 0) < 1e-5)
    assert.ok(Math.abs(luminance('#ffffff') - 1) < 1e-5)
  })

  it('contrast ratio black on white', () => {
    const r = contrastRatio('#000000', '#ffffff')
    assert.ok(r > 20.5 && r < 21.5, `expected ~21, got ${r}`)
  })

  it('ink on paper passes AAA body', () => {
    const r = contrastRatio('#16140f', '#f4ede0')
    assert.ok(r > 7, `expected >7, got ${r}`)
    assert.equal(passesAAA('#16140f', '#f4ede0'), true)
  })

  it('inkMute on paper passes AA body (P1-A2 darken)', () => {
    // 마스터피스 P1-A2: app 라이트 mute 를 #7d7460(3.97, AA large only) →
    // #706854(4.75, AA body) 로 darken. ≤13.5px 본문 ~859곳 AA 충족.
    const r = contrastRatio('#706854', '#f4ede0')
    assert.equal(passesAA('#706854', '#f4ede0'), true)
    assert.ok(r >= 4.5, `expected >=4.5, got ${r}`)
  })

  it('inkSoft on paper passes AA body', () => {
    assert.equal(passesAA('#3a342a', '#f4ede0'), true)
  })

  it('all standard pairs computed without error', () => {
    for (const pair of V3_CONTRAST_PAIRS) {
      const r = contrastRatio(pair.fg, pair.bg)
      assert.ok(r > 1, `${pair.name} ratio too low: ${r}`)
      assert.ok(r <= 21, `${pair.name} ratio too high: ${r}`)
    }
  })

  it("★ use:'text' 조합은 전부 AA(4.5:1) 통과", () => {
    // 예전 이 테스트는 `1 < r <= 21` 만 봤다 — **AA 미달을 잡을 수 없는 검사**였다.
    // 그래서 '시작 전' 칩이 1.69:1 인 채로, 토스페이 버튼이 3.72:1 인 채로 통과했다.
    // 표는 이제 토큰에서 파생되므로, 토큰을 낮추면 여기서 바로 깨진다.
    const failed = V3_CONTRAST_PAIRS.filter(
      (p) => p.use === 'text' && contrastRatio(p.fg, p.bg) < 4.5,
    ).map((p) => `${p.name} = ${contrastRatio(p.fg, p.bg).toFixed(2)}:1 (${p.purpose})`)
    assert.deepEqual(
      failed,
      [],
      '글자색으로 쓰는 조합이 AA 미달이다. 색을 어둡게 하거나, 텍스트로 쓰지 ' +
        "않는다면 use:'deco' 로 옮기고 이유를 적을 것.\n" + failed.join('\n'),
    )
  })

  it("use:'deco' 조합은 텍스트 기준을 넘지 않는다고 표시돼 있다", () => {
    // deco 로 빼놓고 실제로는 AA 를 넉넉히 통과하는 색이면, 텍스트로 못 쓴다고
    // 잘못 표시해 둔 것이다(쓸 수 있는 색을 못 쓰게 만든다) → 분류를 고친다.
    const misfiled = V3_CONTRAST_PAIRS.filter(
      (p) => p.use === 'deco' && contrastRatio(p.fg, p.bg) >= 4.5,
    ).map((p) => p.name)
    assert.deepEqual(
      misfiled,
      [],
      `AA 를 통과하는데 deco 로 분류돼 있다: ${misfiled.join(', ')}`,
    )
  })

  it('토스페이 버튼의 흰 글씨가 AA 통과 (브랜드색 회귀 방지)', () => {
    // 처음 Blue 500(#3182F6)을 썼다가 3.72:1 로 AA 미달이었다. 버튼 라벨이
    // 14px bold 라 large-text 예외(18.66px bold↑)에도 못 든다.
    const tosspay = billingMethod('tosspay')
    assert.ok(tosspay.brandColor, '토스페이는 브랜드색을 가진다')
    const r = contrastRatio('#ffffff', tosspay.brandColor!)
    assert.ok(r >= 4.5, `흰 글씨 대비 ${r.toFixed(2)}:1 — 4.5 이상이어야 한다`)
  })

  it('handles invalid hex gracefully', () => {
    assert.doesNotThrow(() => contrastRatio('bogus', '#fff'))
  })

  it('★FD 웹 컨트롤 경계 — globals.css 실측값으로 3:1 (1.4.11)', () => {
    /**
     * # 왜 (2026-08-17 접근성 감사)
     * 설문 화면의 선택지 카드(라디오 역할)·라디오 원·입력칸이 전부
     * --fd-line(#DCD6C4)으로 그려져 있었다. white 위 1.45:1 — 미선택
     * 선택지의 유일한 식별 단서가 그 테두리인데 사실상 안 보이는 수준이다.
     * V3_CONTRAST_PAIRS 는 앱(V3) 토큰만 열거해 이 화면을 아무도 안 봤다.
     *
     * # 왜 hex 를 안 적고 globals.css 를 파싱하나
     * 위 V3 표의 교훈 그대로다 — hex 를 손으로 적으면 토큰이 바뀔 때 표만
     * 낡는다. FD 토큰의 정본은 globals.css 하나이므로 **그 파일을 읽어서**
     * 검사한다. 토큰을 바꾸면 이 테스트가 즉시 따라온다.
     */
    const css = readFileSync(join(process.cwd(), 'app', 'globals.css'), 'utf8')
    const token = (name: string): string => {
      // String.raw — 일반 문자열로 쓰면 '\s' 가 그냥 's' 로 죽는다(같은 함정을
      // audit-rules 규칙52 에서도 밟았다 — reference_shell_backslash_trap).
      const m = css.match(new RegExp('--' + name + String.raw`:\s*(#[0-9A-Fa-f]{6})`))
      assert.ok(m, 'globals.css 에 --' + name + ' 토큰이 있어야 한다')
      return m![1]!
    }
    const lineStrong = token('fd-line-strong')
    const coral = token('fd-coral')
    const bgs: Array<[string, string]> = [
      ['white', '#FFFFFF'],
      ['offwhite', token('fd-offwhite')],
      ['cream', token('fd-cream')],
    ]
    // 컨트롤 경계(미선택 상태) — 세 배경 전부 3:1
    for (const [bgName, bg] of bgs) {
      const r = contrastRatio(lineStrong, bg)
      assert.ok(
        r >= 3,
        'fd-line-strong/' + bgName + ' = ' + r.toFixed(2) + ':1 — 컨트롤 경계는 3:1 이상이어야 한다',
      )
    }
    // 선택 상태 경계(coral) — white 위 3:1
    const rc = contrastRatio(coral, '#FFFFFF')
    assert.ok(rc >= 3, 'fd-coral/white = ' + rc.toFixed(2) + ':1 — 선택 상태 경계 3:1 미달')
    // 그리고 --fd-line 이 왜 컨트롤에 못 쓰이는지 근거를 남긴다(장식 전용 확인).
    const rl = contrastRatio(token('fd-line'), '#FFFFFF')
    assert.ok(rl < 3, 'fd-line 이 3:1 을 넘게 됐다면 line-strong 이원화가 더는 필요 없다 — 주석 갱신할 것')
  })

})
