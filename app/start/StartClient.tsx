'use client'

// 트랙B B1b-2 — /start 익명 설문 스텝0(강아지 기본).
//
// NewDogClient 의 필수 8필드(name·breed·gender·neutered·ageValue·ageUnit·
// weight·activityLevel)를 1:1로 수집하되, **dogs insert/auth 없이** localStorage
// 초안(lib/autosignup-draft)에만 점진 저장한다. 디자인은 web FD 언어(--fd-*),
// app v3 컴포넌트 미사용(웹 라우트).
//
// '다음' = isDogDraftComplete 검증 후 초안 확정 → 현재는 done 안내(설문 엔진 B2
// 연결 전). B2 에서 done 분기를 익명 설문(SurveyClient 재사용)으로 교체 예정.

import { useEffect, useState } from 'react'
import { Check, X, Moon, Footprints, Zap, ArrowRight, AlertCircle } from 'lucide-react'
import { normalizePromoCode } from '@/lib/promotions'
import {
  loadAutosignupDraft,
  saveAutosignupDraft,
  isDogDraftComplete,
  type AutosignupDogDraft,
} from '@/lib/autosignup-draft'
import { useRouter } from 'next/navigation'
import BreedCombobox from '@/components/web/fd/BreedCombobox'

// 견종 목록은 lib/breeds/breed-names(종합 목록) + BreedCombobox(자동완성)로 이동.

const ACTIVITY: { v: 'low' | 'medium' | 'high'; Icon: typeof Moon; t: string; d: string }[] = [
  { v: 'low', Icon: Moon, t: '낮음', d: '거의 움직이지 않아요' },
  { v: 'medium', Icon: Footprints, t: '보통', d: '하루 1~2회 산책' },
  { v: 'high', Icon: Zap, t: '활동적', d: '뛰어다니기를 좋아해요' },
]

export default function StartClient() {
  const router = useRouter()

  // SSR 과 동일하게 빈 폼으로 init → 서버/클라 HTML 일치(hydration mismatch 0).
  // 초안 prefill 은 아래 마운트 effect 에서 복원(회차323 fix).
  const [name, setName] = useState('')
  const [breed, setBreed] = useState('')
  const [gender, setGender] = useState<'male' | 'female' | ''>('')
  const [neutered, setNeutered] = useState<boolean | null>(null)
  const [ageValue, setAgeValue] = useState('')
  const [ageUnit, setAgeUnit] = useState<'years' | 'months'>('years')
  const [weight, setWeight] = useState('')
  const [activityLevel, setActivityLevel] = useState<'low' | 'medium' | 'high' | ''>('')
  const [error, setError] = useState('')

  // ── 프로모션 링크 (2026-07-16) ──
  // `/start?p=busan1102` 로 들어오면 코드를 초안에 싣는다. 고객은 이 코드를 **보지도
  // 입력하지도 않는다** — 오프라인 QR·인스타 링크가 곧 코드다.
  // 초안에 싣는 이유: 링크→설문→가입까지 살아 있어야 하고, 초안이 이미 그 여정을
  // 통째로 나른다(수명이 정확히 맞는다). 가입 직후 claim_promotion 이 계정에 박는다.
  //
  // ⚠️ URL 에서 지우지 않는다 — 새로고침·뒤로가기로 다시 들어와도 같은 값이면 무해하고
  //   (먼저 박힌 게 이긴다), 주소를 몰래 바꾸면 사용자가 공유한 링크가 달라진다.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = new URLSearchParams(window.location.search).get('p')
    const code = normalizePromoCode(raw)
    if (code) saveAutosignupDraft({ promo: code })
  }, [])

  // 초안 prefill — 마운트 후 1회(클라이언트). SSR 은 빈 폼이라 mismatch 없음.
  // localStorage(외부 스토어) 동기화라 set-state-in-effect 의도적 허용.
  // 빈값 저장 race 는 아래 debounce effect 의 cleanup 이 취소(prefill 로 deps 변경 시).
  useEffect(() => {
    const d = loadAutosignupDraft()?.dog
    if (!d) return
    /* eslint-disable react-hooks/set-state-in-effect */
    if (d.name) setName(d.name)
    if (d.breed) setBreed(d.breed)
    if (d.gender) setGender(d.gender)
    if (typeof d.neutered === 'boolean') setNeutered(d.neutered)
    if (d.ageValue) setAgeValue(d.ageValue)
    if (d.ageUnit) setAgeUnit(d.ageUnit)
    if (d.weight) setWeight(d.weight)
    if (d.activityLevel) setActivityLevel(d.activityLevel)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  // 디바운스 초안 저장 — 입력 도중 새로고침/이탈에도 답 보존(7일).
  useEffect(() => {
    const t = setTimeout(() => {
      saveAutosignupDraft({
        dog: { name, breed, gender, neutered, ageValue, ageUnit, weight, activityLevel },
      })
    }, 400)
    return () => clearTimeout(t)
  }, [name, breed, gender, neutered, ageValue, ageUnit, weight, activityLevel])

  function handleNext() {
    const dog: AutosignupDogDraft = {
      name, breed, gender, neutered, ageValue, ageUnit, weight, activityLevel,
    }
    if (!isDogDraftComplete(dog)) {
      setError('모든 항목을 입력해 주세요')
      return
    }
    setError('')
    saveAutosignupDraft({ dog })
    // 스텝0 완료 → chrome 없는 클린 설문 페이지로 이동(사장님 회차322).
    router.push('/start/survey')
  }

  // FD input 스타일 (signup baseInput 패턴 — 16px 로 iOS focus zoom 방지).
  const inputCls = 'w-full px-4 py-3 rounded-lg border text-[16px] focus:outline-none transition'
  const inputStyle = {
    borderColor: 'var(--fd-line)' as const,
    background: '#FFFFFF',
    color: 'var(--fd-pine)',
  }
  const labelCls = 'block text-[11px] font-bold mb-1.5'
  const chipBase =
    'py-3 rounded-lg border text-[13px] font-bold transition flex items-center justify-center gap-1.5'
  function chipStyle(active: boolean) {
    return active
      ? { background: 'var(--fd-coral)', color: '#fff', borderColor: 'var(--fd-coral)' }
      : { background: 'var(--fd-offwhite)', color: 'var(--fd-pine)', borderColor: 'var(--fd-line)' }
  }

  return (
    <div className="space-y-5">
      {/* 이름 */}
      <div>
        <label className={labelCls} style={{ color: 'var(--fd-pine)' }}>아이 이름</label>
        <input
          type="text" value={name} maxLength={20} placeholder="예: 코코"
          aria-label="아이 이름"
          autoComplete="off" enterKeyHint="next"
          onChange={(e) => setName(e.target.value)}
          className={inputCls} style={inputStyle}
        />
      </div>

      {/* 견종 — 자동완성 콤보박스(타이핑 검색, 목록에 없으면 직접 입력) */}
      <div>
        <label className={labelCls} style={{ color: 'var(--fd-pine)' }}>견종</label>
        <BreedCombobox
          value={breed}
          onChange={setBreed}
          placeholder="견종을 입력하세요 (예: 말티즈)"
          inputClassName={inputCls}
          inputStyle={inputStyle}
          enterKeyHint="next"
        />
      </div>

      {/* 성별 */}
      <div>
        <label className={labelCls} style={{ color: 'var(--fd-pine)' }}>성별</label>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" aria-pressed={gender === 'male'} onClick={() => setGender('male')}
            className={chipBase} style={chipStyle(gender === 'male')}>남아</button>
          <button type="button" aria-pressed={gender === 'female'} onClick={() => setGender('female')}
            className={chipBase} style={chipStyle(gender === 'female')}>여아</button>
        </div>
      </div>

      {/* 중성화 */}
      <div>
        <label className={labelCls} style={{ color: 'var(--fd-pine)' }}>중성화</label>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" aria-pressed={neutered === true} onClick={() => setNeutered(true)}
            className={chipBase} style={chipStyle(neutered === true)}>
            <Check className="w-3.5 h-3.5" strokeWidth={2.5} />했어요
          </button>
          <button type="button" aria-pressed={neutered === false} onClick={() => setNeutered(false)}
            className={chipBase} style={chipStyle(neutered === false)}>
            <X className="w-3.5 h-3.5" strokeWidth={2.5} />안 했어요
          </button>
        </div>
      </div>

      {/* 나이 */}
      <div>
        <label className={labelCls} style={{ color: 'var(--fd-pine)' }}>나이</label>
        <div className="flex gap-2">
          <input
            type="number" min="0" max={ageUnit === 'months' ? 360 : 50} value={ageValue} placeholder="0"
            aria-label={ageUnit === 'months' ? '나이(개월)' : '나이(살)'}
            inputMode="numeric" enterKeyHint="next"
            onChange={(e) => setAgeValue(e.target.value)}
            className={`${inputCls} flex-1`} style={inputStyle}
          />
          <button type="button" aria-pressed={ageUnit === 'years'} onClick={() => setAgeUnit('years')}
            className="px-4 rounded-lg border text-[13px] font-bold transition" style={chipStyle(ageUnit === 'years')}>살</button>
          <button type="button" aria-pressed={ageUnit === 'months'} onClick={() => setAgeUnit('months')}
            className="px-4 rounded-lg border text-[13px] font-bold transition" style={chipStyle(ageUnit === 'months')}>개월</button>
        </div>
      </div>

      {/* 체중 */}
      <div>
        <label className={labelCls} style={{ color: 'var(--fd-pine)' }}>체중 (kg)</label>
        <input
          type="number" min="0.5" max="100" step="0.1" value={weight} placeholder="예: 4.5"
          aria-label="체중(kg)"
          inputMode="decimal" enterKeyHint="done"
          onChange={(e) => setWeight(e.target.value)}
          className={inputCls} style={inputStyle}
        />
      </div>

      {/* 활동량 */}
      <div>
        <label className={labelCls} style={{ color: 'var(--fd-pine)' }}>활동량</label>
        <div className="space-y-2">
          {ACTIVITY.map((a) => {
            const active = activityLevel === a.v
            return (
              <button key={a.v} type="button" aria-pressed={active}
                onClick={() => setActivityLevel(a.v)}
                className="w-full py-3 px-4 rounded-lg border text-left transition flex items-center gap-3"
                style={chipStyle(active)}>
                <a.Icon className="w-5 h-5" strokeWidth={1.8} color={active ? '#fff' : 'var(--fd-muted)'} />
                <span>
                  <span className="block font-bold text-[13.5px]">{a.t}</span>
                  <span className="block text-[11px]" style={{ color: active ? 'rgba(255,255,255,0.8)' : 'var(--fd-muted)' }}>{a.d}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: 'var(--fd-coral-text)' }}>
          <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={2.2} />
          <span>{error}</span>
        </div>
      )}

      <button
        type="button" onClick={handleNext}
        className="w-full flex items-center justify-center gap-1.5 font-bold text-[14px] active:translate-y-[1px] transition-all"
        style={{ height: 54, borderRadius: 9999, background: 'var(--fd-coral)', color: '#fff' }}
      >
        다음 — 생활·건강 설문으로
        <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
      </button>
    </div>
  )
}
