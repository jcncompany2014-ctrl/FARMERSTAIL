'use client'

// 트랙B (개정 2026-06-16) — /start 웹 라이트 설문 + "카카오 우선 + 이메일 보조" 저장.
//
// 사장님 지시: 한국 전환율을 위해 결과 저장 = **카카오 OAuth 가 메인**, 이메일
// 가입은 작은 보조 폴백. 그래서 설문은 **완전 익명(라이트 5문항)** 으로만 두고,
// 가입/저장은 결과 화면에서 한다.
//   body · allergy · taste · food · health → 간결 티저 → [카카오로 시작하기]
//                                                        └ 보조: [이메일로 가입]
//
// ★카카오 경로: KakaoLoginButton(next=/start/claim) → /auth/callback → (출생연도
//   없으면) /onboarding/age-gate → /start/claim 에서 localStorage 초안→계정 이관.
//   설문 답(answers)·강아지 기본(dog)은 이미 초안에 있음 → 추가 입력 0(이름은
//   카카오 프로필에서 옴). 가장 마찰 적은 길.
// ★이메일 경로(보조): 기존 (auth)/signup 과 동일한 auth.signUp(이메일확인 ON →
//   session=null → 메일 인증 후 첫 로그인 시 login 훅이 이관). 파일 미수정·재사용.
// ★보안: 이메일 가입 필드(이름·이메일·비번·출생연도·동의)는 전부 메모리 state only.
//   설문 답(answers)만 localStorage 초안에 저장 — 비번이 draft 에 흘러갈 여지 0.
// ★출생연도: 만14세 트리거가 birth_year NULL 이면 통과 → 이메일 경로는 수집 필수.
//   (카카오 경로는 age-gate 가 강제하므로 여기서 안 받아도 됨.)

import { useEffect, useState } from 'react'
import { ArrowRight, Check, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import {
  loadAutosignupDraft,
  saveAutosignupDraft,
} from '@/lib/autosignup-draft'
import { computeStartTeaser, draftToNutritionInput } from '@/lib/start-teaser'
import { computeStartPlan } from '@/lib/start-plan'
import type { WebRecipe } from '@/lib/web-recipes'
import { petName } from '@/lib/korean'
import { calculateNutrition } from '@/lib/nutrition'
import { createClient } from '@/lib/supabase/client'
import KakaoLoginButton from '@/components/KakaoLoginButton'
import { PhotoSlot } from '@/components/web/fd/ui'
import FdRecipeSheet from '@/components/web/fd/FdRecipeSheet'

type Opt = { v: string; label: string; illust?: string; src?: string; imgW?: number; flip?: boolean; desc?: string }
/** 한 페이지 안의 개별 질문(내용 적은 질문들을 한 스텝에 묶을 때 — 입맛+식사). */
type SubQ = {
  key: string
  title: string
  sub?: string
  multi: boolean
  required: boolean
  visual?: boolean
  gridCols?: number
  options: Opt[]
}
type StepDef = {
  key: string
  label: string
  title: (n: string) => string
  sub?: string
  multi: boolean
  required: boolean
  /** true 면 옵션마다 누끼 카드(보고 고르는 시각 선택). false 면 텍스트 카드. */
  visual?: boolean
  /** >1 이면 옵션을 압축 그리드(세로 미니카드, 여러 개씩 한 줄)로 — 스크롤 최소화. 없으면 가로 행. */
  gridCols?: number
  /** 있으면 이 스텝은 여러 질문을 한 페이지에 묶어서 보여줌(답안 key 는 각 질문 key 로 독립). */
  questions?: SubQ[]
  /** 통합 페이지 맨 위에 박스 없이 넣는 누끼 일러스트 경로. */
  heroSrc?: string
  options: Opt[]
}

// 옵션별 누끼 일러스트 라벨(사장님 제공 대기) — PhotoSlot placeholder, 실제 누끼는 src 주입.
const STEPS: StepDef[] = [
  {
    key: 'body', label: '체형', title: (n) => `${n}의 체형은 어떤가요?`,
    sub: '지금 몸 상태에 가장 가까운 걸 골라주세요.', multi: false, required: true, visual: true,
    options: [
      { v: 'skinny', label: '많이 말랐어요', desc: '갈비뼈·골반이 그대로 드러나요', illust: '저체중 강아지 누끼 (갈비뼈·골반 뚜렷)', src: '/survey/body/skinny.png' },
      { v: 'slim', label: '약간 말랐어요', desc: '갈비뼈 윤곽이 보이고 허리가 잘록해요', illust: '마른 체형 강아지 누끼 (갈비뼈 윤곽)', src: '/survey/body/slim.png' },
      { v: 'ideal', label: '적당해요', desc: '갈비뼈가 만져지고 옆구리가 적당해요', illust: '이상 체형 강아지 누끼 (옆구리 곡선)', src: '/survey/body/ideal.png' },
      { v: 'chubby', label: '약간 통통해요', desc: '갈비뼈가 잘 안 만져지고 통통해요', illust: '통통한 체형 강아지 누끼 (둥근 몸통)', src: '/survey/body/chubby.png' },
      { v: 'obese', label: '많이 통통해요', desc: '갈비뼈가 안 만져지고 배가 처져요', illust: '비만 체형 강아지 누끼 (갈비뼈 안 보임)', src: '/survey/body/obese.png' },
    ],
  },
  {
    key: 'allergy', label: '알레르기', title: () => '피하고 싶은 단백질이 있나요?',
    sub: '없으면 없어요를 선택해 주세요. (복수 선택)', multi: true, required: true, visual: true, gridCols: 3,
    options: [
      { v: 'chicken', label: '닭', illust: '닭고기 원물 누끼', src: '/survey/protein/chicken.png', imgW: 74 },
      { v: 'beef', label: '소', illust: '소고기 원물 누끼', src: '/survey/protein/beef.png', imgW: 100 },
      { v: 'duck', label: '오리', illust: '오리고기 원물 누끼', src: '/survey/protein/duck.png', imgW: 78 },
      { v: 'salmon', label: '연어', illust: '연어 원물 누끼', src: '/survey/protein/salmon.png', imgW: 102 },
      { v: 'lamb', label: '양', illust: '양고기 원물 누끼', src: '/survey/protein/lamb.png', imgW: 94 },
      { v: 'pork', label: '돼지', illust: '돼지고기 원물 누끼', src: '/survey/protein/pork.png', imgW: 98 },
      { v: 'none', label: '없어요' },
    ],
  },
  {
    // 입맛 + 현재 식사 — 각각 내용이 적어 한 페이지로 통합. 답안 key 는 taste·food 그대로 보존.
    key: 'meal', label: '식사 습관', title: () => '식사 습관이 궁금해요', multi: false, required: true, heroSrc: '/survey/meal-hero.png', options: [],
    questions: [
      {
        key: 'taste', title: '입맛은 어떤 편인가요?', multi: false, required: true,
        options: [
          { v: 'good', label: '뭐든 잘 먹어요' }, { v: 'normal', label: '보통이에요' }, { v: 'picky', label: '까다로워요' },
        ],
      },
      {
        key: 'food', title: '지금은 주로 뭘 먹나요?', multi: false, required: true,
        options: [
          { v: 'kibble', label: '사료 (건식)' },
          { v: 'fresh', label: '화식·자연식' },
          { v: 'mix', label: '사료 + 토핑' },
          { v: 'unknown', label: '잘 모르겠어요' },
        ],
      },
    ],
  },
  {
    key: 'health', label: '관심사', title: () => '특별히 신경 쓰는 부분이 있나요?',
    sub: '해당되는 걸 모두 골라주세요. (복수 선택)', multi: true, required: true,
    options: [
      { v: 'joint', label: '관절' }, { v: 'skin', label: '피부·털' }, { v: 'digest', label: '소화' },
      { v: 'dental', label: '치아' }, { v: 'weight', label: '체중' }, { v: 'none', label: '해당 없어요' },
    ],
  },
]

// 비주얼 아닌 스텝의 상단 사진(실제 이미지 경로).
const QUESTION_PHOTO: Record<string, string> = {
  health: '/survey/health.jpg',
}

const emailValid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())

// (auth)/signup 의 humanizeSignupError 는 export 안 됨 → 동일 매핑 복제(카피 일관성).
// enumeration-safe: "이미 가입됨" 류를 일반화.
function humanizeSignupError(raw: string): string {
  const m = raw.toLowerCase()
  if (m.includes('already') || m.includes('registered') || m.includes('duplicate') || m.includes('exists'))
    return '가입을 완료하지 못했어요. 입력 정보를 확인하시거나, 이미 계정이 있다면 로그인을 시도해 주세요.'
  if (m.includes('password') || m.includes('weak'))
    return '비밀번호가 정책에 맞지 않아요. 영문·숫자 포함 6자 이상으로 다시 입력해 주세요.'
  if (m.includes('rate') || m.includes('too many')) return '잠시 후 다시 시도해 주세요.'
  if (m.includes('email') && m.includes('invalid')) return '이메일 형식이 올바르지 않아요.'
  return '가입에 실패했어요. 잠시 후 다시 시도해 주세요.'
}

export default function StartSurvey({ dogName }: { dogName: string }) {
  const [idx, setIdx] = useState(0)
  // 설문 답 — localStorage 초안에 저장(PII 아님).
  const [answers, setAnswers] = useState<Record<string, string | string[]>>(
    () => (loadAutosignupDraft()?.answers as Record<string, string | string[]>) ?? {},
  )
  // ── 이메일 보조 가입 필드: 전부 메모리 state only (draft 절대 미저장) ──
  const [guardianName, setGuardianName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [agreeRequired, setAgreeRequired] = useState(false)
  const [agreeMarketing, setAgreeMarketing] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [openRecipe, setOpenRecipe] = useState<WebRecipe | null>(null)
  const [saving, setSaving] = useState(false)
  const [signupError, setSignupError] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const supabase = createClient()

  // 설문 답만 디바운스 저장.
  useEffect(() => {
    const t = setTimeout(() => saveAutosignupDraft({ answers }), 400)
    return () => clearTimeout(t)
  }, [answers])

  const cur = STEPS[idx]!
  const last = idx === STEPS.length - 1
  const pct = ((idx + 1) / STEPS.length) * 100

  // 만14세(이메일 경로) — 기존 signup 과 동일(출생연도 ≤ 올해-14).
  const currentYear = new Date().getFullYear()
  const birthYearNum = birthYear ? Number(birthYear) : NaN
  const birthYearValid =
    Number.isInteger(birthYearNum) &&
    birthYearNum >= currentYear - 100 &&
    birthYearNum <= currentYear - 14

  // 옵션 토글 — key·multi 를 인자로(한 페이지에 질문 여러 개여도 각 질문 key 로 독립 저장).
  function toggle(key: string, multi: boolean, v: string) {
    setAnswers((prev) => {
      if (multi) {
        const arr = Array.isArray(prev[key]) ? (prev[key] as string[]) : []
        if (v === 'none') return { ...prev, [key]: arr.includes('none') ? [] : ['none'] }
        const base = arr.filter((x) => x !== 'none')
        return { ...prev, [key]: base.includes(v) ? base.filter((x) => x !== v) : [...base, v] }
      }
      return { ...prev, [key]: prev[key] === v ? '' : v }
    })
  }
  function isActive(key: string, v: string, multi: boolean) {
    const c = answers[key]
    return multi ? Array.isArray(c) && c.includes(v) : c === v
  }
  const answered = (key: string, multi: boolean, required: boolean) => {
    if (!required) return true
    const c = answers[key]
    return multi ? Array.isArray(c) && c.length > 0 : !!c
  }

  const canNext = cur.questions
    ? cur.questions.every((q) => answered(q.key, q.multi, q.required))
    : answered(cur.key, cur.multi, cur.required)

  // 한 질문의 옵션 영역 렌더. fill=true 면 남는 세로공간을 채움(단일 질문 페이지),
  // false 면 자연 높이(한 페이지에 질문 여러 개 — 입맛+식사 통합).
  function renderQuestion(
    q: { key: string; multi: boolean; visual?: boolean; gridCols?: number; options: Opt[] },
    fill: boolean,
  ) {
    const grow = fill ? { flex: 1, minHeight: 0 } : {}
    const autoRows = fill ? 'minmax(min-content, 1fr)' : 'min-content'
    return q.visual ? (
      // 시각 선택 — 옵션마다 누끼 카드(보고 탭). 없음/모름은 하단 풀폭 텍스트.
      <div style={{ display: 'flex', flexDirection: 'column', ...grow }}>
        {q.gridCols ? (
          // 압축 그리드 — 간단 옵션(단백질·식사)을 여러 개씩 한 줄. 스크롤 최소화.
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${q.gridCols}, 1fr)`, gridAutoRows: autoRows, gap: 10, ...grow }}>
            {q.options.filter((o) => o.illust).map((o) => {
              const active = isActive(q.key, o.v, q.multi)
              return (
                <button
                  key={o.v}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggle(q.key, q.multi, o.v)}
                  style={{
                    appearance: 'none', cursor: 'pointer', fontFamily: 'inherit', position: 'relative',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
                    padding: '16px 8px', borderRadius: 12, border: '1.5px solid',
                    borderColor: active ? 'var(--fd-coral)' : 'var(--fd-line)',
                    background: active ? 'color-mix(in srgb, var(--fd-coral) 6%, #FFFFFF)' : '#FFFFFF',
                    transition: 'border-color .12s, background .12s',
                  }}
                >
                  <div style={{ width: o.imgW ?? 88, maxWidth: '64%' }}>
                    {o.src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.src} alt={o.label} loading="lazy" decoding="async" style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'contain', display: 'block', transform: o.flip ? 'scaleX(-1)' : undefined }} />
                    ) : (
                      <div aria-hidden style={{ width: '100%', aspectRatio: '1 / 1', borderRadius: 8, background: 'var(--fd-cream)' }} />
                    )}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, textAlign: 'center', lineHeight: 1.2, color: active ? 'var(--fd-coral-text)' : 'var(--fd-pine)' }}>{o.label}</span>
                  {active && (
                    <span style={{ position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 999, background: 'var(--fd-coral)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check className="w-3 h-3" strokeWidth={3} color="#fff" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ) : (
          <div style={{ display: 'grid', gridAutoRows: autoRows, gap: 9, ...grow }}>
            {q.options.filter((o) => o.illust).map((o) => {
              const active = isActive(q.key, o.v, q.multi)
              return (
                <button
                  key={o.v}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggle(q.key, q.multi, o.v)}
                  style={{
                    appearance: 'none', cursor: 'pointer', fontFamily: 'inherit', width: '100%',
                    // 옵션당 단일 카드 1개(구분감 유지) — 내부 사진타일 없앰(이중 박스 방지).
                    padding: '11px 14px', borderRadius: 14, border: '1.5px solid',
                    borderColor: active ? 'var(--fd-coral)' : 'var(--fd-line)',
                    background: active ? 'color-mix(in srgb, var(--fd-coral) 6%, #FFFFFF)' : '#FFFFFF',
                    transition: 'border-color .12s, background .12s',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}
                >
                  <div style={{ width: 78, flexShrink: 0, alignSelf: 'center' }}>
                    {o.src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.src} alt={o.label} loading="lazy" decoding="async" style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'contain', display: 'block', transform: o.flip ? 'scaleX(-1)' : undefined }} />
                    ) : (
                      <PhotoSlot label={o.illust!} ratio="1 / 1" tone="cream" rounded={9} className="w-full" />
                    )}
                  </div>
                  {/* 사진 ↔ 텍스트 세로 구분선 */}
                  <div aria-hidden style={{ width: 1, alignSelf: 'stretch', flexShrink: 0, background: active ? 'var(--fd-coral)' : 'var(--fd-line)', opacity: active ? 0.4 : 1 }} />
                  <div style={{ flex: 1, textAlign: 'left', paddingLeft: 2 }}>
                    <div style={{ fontSize: 15.5, fontWeight: 800, color: active ? 'var(--fd-coral-text)' : 'var(--fd-pine)' }}>{o.label}</div>
                    {o.desc && <div style={{ marginTop: 3, fontSize: 11.5, fontWeight: 500, color: 'var(--fd-muted)', lineHeight: 1.35 }}>{o.desc}</div>}
                  </div>
                  {/* 우측 선택 라디오 — 항상 노출 */}
                  <span aria-hidden style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 999, border: '1.5px solid', borderColor: active ? 'var(--fd-coral)' : 'var(--fd-line)', background: active ? 'var(--fd-coral)' : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all .12s' }}>
                    {active && <Check className="w-3.5 h-3.5" strokeWidth={3} color="#fff" />}
                  </span>
                </button>
              )
            })}
          </div>
        )}
        {q.options.filter((o) => !o.illust).map((o) => {
          const active = isActive(q.key, o.v, q.multi)
          return (
            <button
              key={o.v}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(q.key, q.multi, o.v)}
              style={{
                appearance: 'none', cursor: 'pointer', fontFamily: 'inherit', width: '100%',
                marginTop: 10, padding: '13px 16px', borderRadius: 12, border: '1.5px solid',
                borderColor: active ? 'var(--fd-coral)' : 'var(--fd-line)',
                background: active ? 'var(--fd-cream)' : 'var(--fd-offwhite)',
                color: active ? 'var(--fd-coral-text)' : 'var(--fd-pine)',
                fontSize: 13.5, fontWeight: 700, transition: 'all .12s',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {active && <Check className="w-4 h-4 shrink-0" strokeWidth={3} />}
              {o.label}
            </button>
          )
        })}
      </div>
    ) : (
      // 텍스트 선택 — 입맛·관심사 (큰 카드)
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gridAutoRows: autoRows, gap: 9, ...grow }}>
        {q.options.map((o) => {
          const active = isActive(q.key, o.v, q.multi)
          return (
            <button
              key={o.v}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(q.key, q.multi, o.v)}
              style={{
                appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
                padding: '14px 14px', borderRadius: 12, border: '1.5px solid',
                borderColor: active ? 'var(--fd-coral)' : 'var(--fd-line)',
                background: active ? 'var(--fd-cream)' : '#FFFFFF',
                color: active ? 'var(--fd-coral-text)' : 'var(--fd-pine)',
                fontSize: 14, fontWeight: 700, transition: 'all .12s',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {active && <Check className="w-4 h-4 shrink-0" strokeWidth={3} />}
              {o.label}
            </button>
          )
        })}
      </div>
    )
  }

  const emailFormValid =
    guardianName.trim().length >= 2 &&
    emailValid(email) &&
    password.length >= 6 &&
    birthYearValid &&
    agreeRequired

  function goNext() {
    if (!canNext) return
    if (!last) {
      setIdx(idx + 1)
      return
    }
    // 마지막 질문 → 결과. 초안(answers) 즉시 저장 — 카카오 클릭 전 영속 보장
    // (디바운스 누락 방지). dog 기본은 StartClient 가 이미 저장함.
    saveAutosignupDraft({ answers })
    setShowResult(true)
  }

  // 이메일 보조 가입 — (auth)/signup 의 signUp 인자 형태 그대로(파일 미수정·API 재사용).
  async function handleEmailSignup() {
    if (saving || !emailFormValid) return
    setSignupError('')
    setSaving(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password, // 메모리 state
      options: {
        data: {
          signup_profile: {
            // ★ top-level 'name' 금지 — 반드시 중첩(handle_new_user 복원신호 보존).
            name: guardianName.trim(),
            phone: '', zip: '', address: '', address_detail: '',
            birth_year: Number.isFinite(birthYearNum) ? birthYearNum : null, // ★ 만14세 트리거 발동
            birth_month: null, birth_day: null,
            agree_email: agreeMarketing, agree_sms: agreeMarketing,
          },
        },
      },
    })
    if (error) {
      setSaving(false)
      setSignupError(humanizeSignupError(error.message ?? ''))
      return
    }
    // 비밀번호 즉시 폐기(메모리 잔류 최소화).
    setPassword('')
    // 이메일확인 ON → data.session === null. draft(dog+answers)는 localStorage
    // 유지 → 메일 인증 후 첫 로그인 시 login 훅이 이관(B5). 여기선 DB write 안 함.
    if (data.user && !data.session) setEmailSent(true)
    setSaving(false)
  }

  function back() {
    if (showResult) { setShowResult(false); setShowEmailForm(false); return }
    if (idx > 0) setIdx(idx - 1)
  }

  // FD 입력 스타일(signup baseInput 패턴 — 16px iOS zoom 방지).
  const inputCls = 'w-full px-4 py-3 rounded-lg border text-[16px] focus:outline-none transition'
  const inputStyle = { borderColor: 'var(--fd-line)' as const, background: '#FFFFFF', color: 'var(--fd-pine)' }
  const labelCls = 'block text-[11px] font-bold mb-1.5'

  // ───────────────────────── 결과(티저 + 저장) ─────────────────────────
  if (showResult) {
    const teaser = computeStartTeaser()
    if (!teaser) {
      return (
        <div className="rounded-[12px] px-5 py-7 text-center" style={{ background: 'var(--fd-cream)', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}>
          <p className="text-[13.5px]" style={{ color: 'var(--fd-muted)', lineHeight: 1.65 }}>결과를 계산하지 못했어요. 강아지 기본 정보를 다시 확인해 주세요.</p>
          <button type="button" onClick={back} className="mt-4 text-[12.5px] font-bold underline underline-offset-2" style={{ color: 'var(--fd-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>이전으로</button>
        </div>
      )
    }
    // 빈약한 티저 → 충실한 결과(사장님 2026-06-16): 전체 분석 재계산(티저와 동일 입력).
    const draft = loadAutosignupDraft()
    const m = draft ? draftToNutritionInput(draft) : null
    const nu = m ? calculateNutrition(m.dogInfo, m.answers) : null
    const plan = computeStartPlan(draft)
    return (
      <div>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: 'var(--fd-green)', textTransform: 'uppercase' }}>Result · 맞춤 분석</span>
        <h2 className="pt-3" style={{ fontSize: 24, fontWeight: 800, color: 'var(--fd-pine)', letterSpacing: '-0.02em', lineHeight: 1.25 }}>{petName(teaser.dogName)}의 맞춤 분석</h2>
        <p className="pt-2" style={{ fontSize: 13.5, color: 'var(--fd-muted)', lineHeight: 1.6 }}>{teaser.bodyComment}</p>
        {/* 📸 결과 대표 이미지 (강아지 or 상품 누끼) */}
        <div style={{ marginTop: 14 }}>
          <PhotoSlot label="맞춤 결과 대표 이미지 (강아지·상품 누끼)" ratio="16 / 6" tone="green" rounded={14} className="w-full" />
        </div>
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: '하루 권장 칼로리', val: teaser.merKcal.toLocaleString(), unit: 'kcal' },
            { label: '하루 권장 급여량', val: teaser.feedG.toLocaleString(), unit: 'g' },
          ].map((m) => (
            <div key={m.label} className="rounded-[12px] px-4 py-5" style={{ background: 'var(--fd-cream)', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fd-muted)' }}>{m.label}</div>
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <span style={{ fontSize: 28, fontWeight: 900, color: 'var(--fd-pine)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{m.val}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fd-muted)' }}>{m.unit}</span>
              </div>
            </div>
          ))}
        </div>
        {nu && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--fd-muted)', textTransform: 'uppercase', marginBottom: 8 }}>권장 영양 구성</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { label: '단백질', val: nu.protein.pct },
                { label: '지방', val: nu.fat.pct },
                { label: '탄수화물', val: nu.carb.pct },
              ].map((x) => (
                <div key={x.label} className="rounded-[10px] px-2 py-3 text-center" style={{ background: 'var(--fd-offwhite)', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--fd-pine)', fontVariantNumeric: 'tabular-nums' }}>{Math.round(x.val)}%</div>
                  <div style={{ fontSize: 11, color: 'var(--fd-muted)', fontWeight: 700, marginTop: 2 }}>{x.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="rounded-[12px] px-4 py-4" style={{ marginTop: 10, background: 'var(--fd-offwhite)', boxShadow: 'inset 0 0 0 1px var(--fd-line)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Check className="w-4 h-4 shrink-0" strokeWidth={2.5} color="var(--fd-green)" />
          <span style={{ fontSize: 13.5, color: 'var(--fd-pine)', fontWeight: 700 }}>추천 단백질 <span style={{ color: 'var(--fd-coral-text)' }}>{teaser.proteins.join(' · ')}</span></span>
        </div>
        <div className="rounded-[12px] px-4 py-4" style={{ marginTop: 10, background: 'var(--fd-cream)', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--fd-pine)' }}>추천 식단</div>
          <p style={{ marginTop: 5, fontSize: 12.5, color: 'var(--fd-muted)', lineHeight: 1.6 }}>
            {petName(teaser.dogName)}에게는 <b style={{ color: 'var(--fd-pine)' }}>{teaser.proteins.join('·')} 기반 신선 화식</b>을 권장해요. 하루 권장량 {teaser.feedG.toLocaleString()}g을 1~2회로 나눠 급여하면 좋아요.
          </p>
          {nu?.vetConsult && (
            <p style={{ marginTop: 6, fontSize: 11.5, color: 'var(--fd-coral-text)', fontWeight: 600 }}>※ 입력하신 정보를 보면 수의사 상담도 함께 권해 드려요.</p>
          )}
        </div>
        <p style={{ marginTop: 10, fontSize: 11.5, color: 'var(--fd-muted)', lineHeight: 1.55 }}>
          입력하신 정보로 계산한 참고용 추정치예요. 실제 급여량은 아이 상태에 따라 달라질 수 있어요.
        </p>

        {emailSent ? (
          // ── 이메일 경로 완료(인증 메일 발송) ──
          <>
            <div className="rounded-[12px] px-5 py-5 text-center" style={{ marginTop: 18, background: 'var(--fd-pine)', color: 'var(--fd-offwhite)' }}>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(245,240,230,0.9)' }}>
                <b>{email}</b>로 인증 메일을 보냈어요.
                <br />메일 속 링크를 누른 뒤 로그인하면 정밀 분석을 앱에서 저장하고 볼 수 있어요.
              </p>
            </div>
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Link href="/login" className="text-[12.5px] font-bold underline underline-offset-2" style={{ color: 'var(--fd-muted)' }}>
                이메일 인증을 마쳤다면 로그인하기 →
              </Link>
            </div>
          </>
        ) : (
          // ── 저장 섹션: 카카오 메인 + 이메일 보조 ──
          <>
            {/* Your Plan(FD식, 사장님 2026-06-16 + 레시피 v3.1) — 추천 레시피 카드 +
                실 하루단가. 레시피=이름·컨셉·주재료만(영업비밀 미노출). 가격=앱과
                동일 모델(잠정). 실결제는 토스 PG 통과 후. */}
            {plan && (
              <div style={{ marginTop: 18 }}>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: 'var(--fd-green)', textTransform: 'uppercase' }}>Your Plan · 맞춤 플랜</span>
                <h3 style={{ marginTop: 8, fontSize: 18, fontWeight: 800, color: 'var(--fd-pine)', letterSpacing: '-0.02em' }}>{teaser.dogName} 맞춤 신선식 플랜</h3>
                <p style={{ marginTop: 4, fontSize: 12.5, color: 'var(--fd-muted)' }}>
                  {plan.noSafeRecipe
                    ? `하루 약 ${plan.dailyKrw.toLocaleString()}원부터 · 맞춤 레시피는 상담으로 안내해 드려요`
                    : `추천 레시피 ${plan.recipes.length}종 · 하루 약 ${plan.dailyKrw.toLocaleString()}원부터`}
                </p>
                {/* 📸 신선식 상품 사진 — 랜딩과 동일 실사진 재사용(2026-07-03 UX 감사,
                    placeholder 해소). 실촬영 누끼 밀팩 나오면 교체. */}
                <div style={{ marginTop: 12 }}>
                  <PhotoSlot label="신선식 상품 사진" src="/meal-recipe.webp" alt="파머스테일 신선 화식 레시피" ratio="16 / 7" tone="cream" rounded={12} className="w-full" />
                </div>
                {plan.noSafeRecipe ? (
                  // 선택한 알레르기로 추천 가능한 레시피가 0종 — 알레르겐을 가짜로
                  // 추천하지 않고 맞춤 상담으로 정직하게 안내.
                  <div className="rounded-[12px]" style={{ marginTop: 12, padding: '15px 16px', background: 'var(--fd-cream)', boxShadow: 'inset 0 0 0 1px var(--fd-line)', display: 'flex', gap: 10 }}>
                    <AlertCircle className="w-5 h-5 flex-shrink-0" strokeWidth={2.2} style={{ color: 'var(--fd-coral)' }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--fd-pine)' }}>맞춤 상담이 필요해요</div>
                      <p style={{ marginTop: 4, fontSize: 12, color: 'var(--fd-muted)', lineHeight: 1.6 }}>
                        선택하신 알레르기 정보로는 자동 추천이 어려워요. 가입하시면 단백질을 바꾼 맞춤 레시피를 함께 찾아드릴게요.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                    {plan.recipes.map((r, i) => (
                      <div key={r.protein} className="rounded-[12px]" style={{ padding: '13px 15px', background: '#FFFFFF', boxShadow: i === 0 ? 'inset 0 0 0 1.5px var(--fd-coral)' : 'inset 0 0 0 1px var(--fd-line)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--fd-pine)' }}>{r.name}</span>
                          {i === 0 && <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: 'var(--fd-coral)', padding: '2px 7px', borderRadius: 999 }}>추천</span>}
                          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: 'var(--fd-green)' }}>{r.concept}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setOpenRecipe(r)}
                          style={{ marginTop: 8, appearance: 'none', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 700, color: 'var(--fd-coral-text)' }}
                        >
                          자세히 보기
                          <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {/* 가격 바 — 구독가 기준 잠정 단가(첫 주문 시 확정). 블랭킷 첫주문 50%
                    폐지(2026-07-17): 이벤트 할인은 이벤트 페이지 신규가입자에게만 적용. */}
                <div className="rounded-[12px]" style={{ marginTop: 10, padding: '13px 16px', background: 'var(--fd-cream)', boxShadow: 'inset 0 0 0 1px var(--fd-line)', display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--fd-pine)' }}>하루</span>
                  <span style={{ fontSize: 15, fontWeight: 900, color: 'var(--fd-coral-text)' }}>약 {plan.dailyKrw.toLocaleString()}원부터</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--fd-muted)' }}>구독가</span>
                </div>
                <p style={{ marginTop: 7, fontSize: 11, color: 'var(--fd-muted)', textAlign: 'center', lineHeight: 1.5 }}>
                  배송 2주마다 · 가입 후 변경 가능. 예상가이며 첫 주문 시 확정돼요.
                </p>
              </div>
            )}

            {/* 레시피 상세 = 공유 FD 제품정보 퀵뷰 시트(compare 와 동일 컴포넌트).
                a11y(ESC·스크롤락·포커스트랩·복귀)·성분분석·영업비밀 미노출 전부 시트가
                담당. 이미 설문 퍼널 안이라 CTA 숨김(ctaHref=null) — 닫기만. */}
            <FdRecipeSheet
              recipe={openRecipe}
              onClose={() => setOpenRecipe(null)}
              ctaHref={null}
            />

            {/* 다음 단계 — 앱 정밀 설문/분석표 유도 (웹=맛보기 → 앱=정밀 퍼널) */}
            <div className="rounded-[14px]" style={{ marginTop: 14, padding: '18px 18px', background: 'var(--fd-offwhite)', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: 'var(--fd-green)', textTransform: 'uppercase' }}>Next · 가입하면</span>
              <h3 style={{ marginTop: 7, fontSize: 16.5, fontWeight: 800, color: 'var(--fd-pine)', letterSpacing: '-0.02em', lineHeight: 1.35 }}>
                지금은 <b style={{ color: 'var(--fd-coral-text)' }}>2분 맛보기</b> 결과예요.
                <br />앱에서 더 자세히 이어가요.
              </h3>
              <ul style={{ marginTop: 12, display: 'grid', gap: 10, listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
                {[
                  ['더 자세한 건강 설문', '만성질환·소화 민감도·생활습관까지 — 웹에서 못 채운 부분을 이어서.'],
                  ['38개 영양소 정밀 분석표', '단백질·지방을 넘어 미네랄·비타민까지 전체 균형을 한눈에.'],
                  ['우리 아이 맞춤 레시피', '정밀 분석을 바탕으로 한 2종 화식 박스 구성.'],
                ].map(([t, d]) => (
                  <li key={t} style={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: 9, alignItems: 'start' }}>
                    <Check className="w-4 h-4 shrink-0" strokeWidth={2.6} style={{ color: 'var(--fd-coral)', marginTop: 1 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--fd-pine)' }}>{t}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--fd-muted)', lineHeight: 1.5, marginTop: 1 }}>{d}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[12px] px-5 py-5" style={{ marginTop: 12, background: 'var(--fd-pine)' }}>
              <p style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--fd-offwhite)', lineHeight: 1.45, textAlign: 'center' }}>
                이 맞춤 플랜으로<br />시작해 보세요
              </p>
              <p style={{ marginTop: 6, fontSize: 11.5, color: 'rgba(245,240,230,0.72)', lineHeight: 1.5, textAlign: 'center' }}>
                가입은 3초면 끝나요. 구독가로 바로 시작할 수 있어요.
              </p>
              <div style={{ marginTop: 14 }}>
                {/* 카카오 = 메인 저장 경로. 복귀 시 /start/claim 이 초안을 계정으로 이관. */}
                <KakaoLoginButton variant="login" next="/start/claim" />
              </div>
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowEmailForm((s) => !s)}
                  aria-expanded={showEmailForm}
                  style={{ appearance: 'none', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: 'rgba(245,240,230,0.85)', textDecoration: 'underline', textUnderlineOffset: 2 }}
                >
                  {showEmailForm ? '이메일 가입 접기' : '카카오 대신 이메일로 가입할게요'}
                </button>
              </div>
            </div>

            {/* 보조: 이메일 가입 폼(토글) */}
            {showEmailForm && (
              <div className="rounded-[12px] px-5 py-5" style={{ marginTop: 12, background: 'var(--fd-offwhite)', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}>
                <div className="space-y-4">
                  <div>
                    <label className={labelCls} style={{ color: 'var(--fd-pine)' }}>보호자 이름</label>
                    <input type="text" value={guardianName} maxLength={20} placeholder="예: 홍길동" autoComplete="name"
                      onChange={(e) => setGuardianName(e.target.value)} className={inputCls} style={inputStyle} />
                  </div>
                  <div>
                    <label className={labelCls} style={{ color: 'var(--fd-pine)' }}>이메일</label>
                    <input type="email" value={email} placeholder="example@email.com" autoComplete="email"
                      inputMode="email" autoCapitalize="off" autoCorrect="off" spellCheck={false}
                      onChange={(e) => setEmail(e.target.value)} className={inputCls} style={inputStyle} />
                  </div>
                  <div>
                    <label className={labelCls} style={{ color: 'var(--fd-pine)' }}>비밀번호</label>
                    <input type="password" value={password} placeholder="영문·숫자 포함 6자 이상" autoComplete="new-password"
                      onChange={(e) => setPassword(e.target.value)} className={inputCls} style={inputStyle} />
                  </div>
                  <div>
                    <label className={labelCls} style={{ color: 'var(--fd-pine)' }}>보호자 출생연도 <span style={{ color: 'var(--fd-muted)' }}>(만 14세 이상)</span></label>
                    <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={4} value={birthYear}
                      placeholder={`예: ${currentYear - 30}`} onChange={(e) => setBirthYear(e.target.value.replace(/[^0-9]/g, ''))}
                      className={inputCls} style={{ ...inputStyle, borderColor: birthYear && !birthYearValid ? 'var(--sale)' : 'var(--fd-line)', fontVariantNumeric: 'tabular-nums' }} />
                    {birthYear && !birthYearValid && (
                      <p className="mt-1 flex items-center gap-1" style={{ fontSize: 11, fontWeight: 600, color: 'var(--fd-coral-text)' }}>
                        <AlertCircle className="w-3 h-3" strokeWidth={2.5} />만 14세 이상만 가입할 수 있어요
                      </p>
                    )}
                  </div>
                  <div className="rounded-lg px-4 py-3.5 space-y-2.5" style={{ background: 'var(--fd-cream)', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input type="checkbox" checked={agreeRequired} onChange={(e) => setAgreeRequired(e.target.checked)} className="mt-0.5 w-4 h-4" style={{ accentColor: 'var(--fd-pine)' }} />
                      <span style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--fd-pine)' }}>
                        <b style={{ color: 'var(--fd-coral)' }}>[필수]</b> 만 14세 이상이며,{' '}
                        <Link href="/legal/terms" target="_blank" className="underline underline-offset-2 font-bold" style={{ color: 'var(--fd-pine)' }}>이용약관</Link>·
                        <Link href="/legal/privacy" target="_blank" className="underline underline-offset-2 font-bold" style={{ color: 'var(--fd-pine)' }}>개인정보처리방침</Link>
                        에 동의합니다
                      </span>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input type="checkbox" checked={agreeMarketing} onChange={(e) => setAgreeMarketing(e.target.checked)} className="mt-0.5 w-4 h-4" style={{ accentColor: 'var(--fd-muted)' }} />
                      <span style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--fd-muted)' }}>
                        <span className="font-bold">[선택]</span> 혜택·이벤트 소식 수신에 동의합니다
                      </span>
                    </label>
                  </div>

                  {signupError && (
                    <div role="alert" className="flex items-start gap-2" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fd-coral-text)' }}>
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={2.5} />
                      <span>{signupError}</span>
                    </div>
                  )}

                  <button type="button" onClick={handleEmailSignup} disabled={!emailFormValid || saving}
                    style={{ appearance: 'none', border: 'none', background: 'var(--fd-coral)', color: '#fff', padding: '13px 22px', borderRadius: 99, fontSize: 13.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: emailFormValid && !saving ? 1 : 0.5, transition: 'opacity .15s' }}>
                    {saving ? '가입 중...' : '이메일로 가입하고 저장'}
                  </button>
                </div>
              </div>
            )}

            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button type="button" onClick={back} className="text-[12.5px] font-bold underline underline-offset-2" style={{ color: 'var(--fd-muted)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                ← 답변 다시 고르기
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  // ───────────────────────── 진행 중(라이트 설문) ─────────────────────────
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* 진행바 */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: 'var(--fd-green)', textTransform: 'uppercase' }}>
            {cur.label}
          </span>
          <span style={{ fontSize: 11, color: 'var(--fd-muted)', fontVariantNumeric: 'tabular-nums' }}>{idx + 1} / {STEPS.length}</span>
        </div>
        <div style={{ height: 3, borderRadius: 99, background: 'var(--fd-line)' }}>
          <div style={{ height: '100%', borderRadius: 99, background: 'var(--fd-coral)', width: `${pct}%`, transition: 'width .25s' }} />
        </div>
      </div>

      {/* 비주얼 아닌 스텝(관심사 등) 상단 사진 */}
      {!cur.visual && QUESTION_PHOTO[cur.key] && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={QUESTION_PHOTO[cur.key]!}
          alt=""
          aria-hidden
          className="w-full mb-4"
          style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 12 }}
        />
      )}

      {cur.questions ? (
        // 입맛 + 현재 식사 — 한 페이지에 두 질문(답안 key 는 각각 taste·food 로 독립 저장).
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 24, marginTop: 4 }}>
          {cur.heroSrc && (
            // 페이지 상단 누끼 일러스트 — 박스 없이 그대로.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cur.heroSrc} alt="" aria-hidden style={{ alignSelf: 'center', display: 'block', width: 210, maxWidth: '64%', height: 'auto' }} />
          )}
          {cur.questions.map((q) => (
            <div key={q.key}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--fd-pine)', letterSpacing: '-0.01em', lineHeight: 1.3 }}>{q.title}</h2>
              {q.sub && <p style={{ marginTop: 6, fontSize: 12.5, color: 'var(--fd-muted)', lineHeight: 1.55 }}>{q.sub}</p>}
              <div style={{ marginTop: 12 }}>{renderQuestion(q, false)}</div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* 질문 */}
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fd-pine)', letterSpacing: '-0.02em', lineHeight: 1.25 }}>{cur.title(dogName)}</h2>
          {cur.sub && <p style={{ marginTop: 8, fontSize: 13.5, color: 'var(--fd-muted)', lineHeight: 1.6 }}>{cur.sub}</p>}

          {/* 옵션 영역 — 시각 스텝은 공간 채움, 텍스트 스텝(관심사)은 자연 높이로 compact. */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', marginTop: 16 }}>
            {renderQuestion(cur, !!cur.visual)}
          </div>
        </>
      )}

      {/* nav — 항상 화면 하단 고정(스텝마다 같은 위치). 위 옵션 영역(flex:1)이 공간을 채워 밀어냄. */}
      <div style={{ display: 'flex', gap: 10, paddingTop: 18 }}>
        {idx > 0 && (
          <button type="button" onClick={back}
            style={{ appearance: 'none', border: '1px solid var(--fd-line)', background: 'transparent', color: 'var(--fd-pine)', padding: '13px 20px', borderRadius: 99, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            이전
          </button>
        )}
        <button type="button" onClick={goNext} disabled={!canNext}
          style={{ appearance: 'none', border: 'none', background: 'var(--fd-coral)', color: '#fff', padding: '13px 22px', borderRadius: 99, fontSize: 13.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: canNext ? 1 : 0.5, transition: 'opacity .15s' }}>
          {last ? '결과 보기' : '다음'}
          {!last && <ArrowRight className="w-4 h-4" strokeWidth={2.5} />}
        </button>
      </div>
    </div>
  )
}
