'use client'

/**
 * 새 첫 화면(앱 /start) — 2026-10-09 앱 새 디자인('A 포스터'), 캔버스 '새 첫 화면' Y1~Y6 · Y5b·Y5c. 앱시안 결정
 * '새 첫 화면'·22번(사진 단계). 온보딩 캐러셀(/welcome)을 대체한다 — 캐러셀은 앱스토어 사진용으로만 남는다.
 *
 *   이름 → 생일(휠) → 견종(밑줄 검색 + 줄 목록) → 성별·중성화 → 몸무게(휠) → 사진(건너뛰기 가능)
 *   → 도장 '쾅' + 가입(카카오·애플 / 이메일) → 가입 직후 바로 설문(/start/onboard → /dogs/[id]/survey)
 *
 * 데이터 길은 예전 앱 /start(StartClient)와 같다 — 강아지 정보는 익명 초안(lib/autosignup-draft)에 조금씩 저장하고,
 * 가입 뒤 createDogFromDraft 가 강아지를 만든다. 사진은 가입 전이라 폰에 잠깐 들고 있다가(lib/start-photo) 그때 올린다.
 * 틀(빛 바탕·위 줄·고정 카드·선택 막대·주 버튼)은 설문 새 틀(survey/steps/Frame + survey.css)을 그대로 같이 쓴다.
 *
 * 단계는 주소(?step=N)에 싣는다 — 폰의 '뒤로'가 이전 단계로 가고, 새로 고쳐도 그 단계에 머문다(앞 단계가 비었으면
 * 빈 단계로 되돌린다). 첫 화면에 들어오면 첫 실행 표식(ft_onboarded)을 남겨, 다음 실행엔 다시 이리로 끌려오지 않게 한다.
 *
 * 시안에 없던 것 하나: 첫 단계 카드 아래 '이미 계정이 있어요' — 첫 실행이 이 화면이 되면서 기존 회원(새 폰·재설치)이
 * 로그인으로 갈 길이 필요하다(예전 캐러셀 마지막 장의 '이미 계정이 있어요' 자리).
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { SurveyAlert, SurveyFrame } from '@/app/(main)/dogs/[id]/survey/steps/Frame'
import '@/app/(main)/dogs/[id]/survey/survey.css'
import './first-screen.css'
import { WheelColumn, WheelFrame, WheelUnit, type WheelOption } from '@/components/v3/flow/WheelPicker'
import KakaoLoginButton from '@/components/KakaoLoginButton'
import AppleLoginButton from '@/components/AppleLoginButton'
import { BREED_NAMES } from '@/lib/breeds/breed-names'
import { BREEDS } from '@/lib/breeds/registry'
import { deriveAgeFromBirth } from '@/lib/dog-age'
import { todayKstIsoDate } from '@/lib/datetime-kst'
import { petName } from '@/lib/korean'
import { normalizePromoCode } from '@/lib/promotions'
import { isDogDraftComplete, loadAutosignupDraft, saveAutosignupDraft, type AutosignupDogDraft } from '@/lib/autosignup-draft'
import { clearHeldStartPhoto, holdStartPhoto, readHeldStartPhoto, shrinkPhoto } from '@/lib/start-photo'
import { markOnboarded } from '@/lib/onboarding'

type Gender = 'male' | 'female' | ''
// 단계: 0 이름 · 1 생일 · 2 견종 · 3 성별·중성화 · 4 몸무게 · 5 사진 · 6 도장·가입
const STAMP_STEP = 6

// ── 날짜 ────────────────────────────────────────────────────────────────
function parseIso(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null
}
const toIso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()
/** 오늘(KST)에서 years 년·months 개월 전 날짜 — 월말은 그 달 마지막 날로. */
function shiftIso(todayIso: string, years: number, months: number): string {
  const t = parseIso(todayIso)!
  let y = t.y - years
  let m = t.m - months
  while (m < 1) {
    m += 12
    y -= 1
  }
  return toIso(y, m, Math.min(t.d, daysIn(y, m)))
}
function ageText(birthIso: string): string {
  const a = deriveAgeFromBirth(birthIso, Date.now())
  if (!a) return ''
  return a.unit === 'years' ? `${a.value}살` : `${a.value}개월`
}

// ── 견종 ────────────────────────────────────────────────────────────────
/** '셔틀랜드 쉽독(셸티)' → { name: '셔틀랜드 쉽독', alias: '셸티' }. 저장값은 원래 글자 그대로(영양 레지스트리 정확 일치). */
function splitBreed(b: string): { name: string; alias: string | null } {
  const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(b)
  return m ? { name: m[1]!, alias: m[2]! } : { name: b, alias: null }
}
const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase()

// ── 아이콘(시안의 단계 표시 — 52 먹색 네모 안 흰 선) ─────────────────────────
// 선 굵기·모양은 시안 원본 SVG 그대로(Y1~Y5b 전부 선 2.1).
const ICON = { width: 26, height: 26, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.1, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
const STEP_ICONS: Record<number, ReactNode> = {
  0: (
    <svg {...ICON} aria-hidden>
      <path d="M3 12V4h8l10 10-8 8z" />
      <circle cx="7.5" cy="8.5" r="1.4" />
    </svg>
  ),
  1: (
    <svg {...ICON} aria-hidden>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  ),
  2: (
    <svg {...ICON} aria-hidden>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4-4" />
    </svg>
  ),
  // 성별·중성화 = 발바닥(시안 Y4 — 빈 발가락 넷 + 발바닥).
  3: (
    <svg {...ICON} aria-hidden>
      <ellipse cx="6.2" cy="10" rx="1.9" ry="2.4" />
      <ellipse cx="9.8" cy="6.4" rx="1.9" ry="2.5" />
      <ellipse cx="14.2" cy="6.4" rx="1.9" ry="2.5" />
      <ellipse cx="17.8" cy="10" rx="1.9" ry="2.4" />
      <path d="M12 11.2c-2.6 0-5 2.8-5 5.2 0 1.7 1.3 2.6 2.7 2.6 1 0 1.6-.5 2.3-.5s1.3.5 2.3.5c1.4 0 2.7-.9 2.7-2.6 0-2.4-2.4-5.2-5-5.2z" />
    </svg>
  ),
  4: (
    <svg {...ICON} aria-hidden>
      <path d="M5 20h14l-1.6-11H6.6z" />
      <path d="M9.5 9a2.5 2.5 0 0 1 5 0" />
    </svg>
  ),
  5: (
    <svg {...ICON} aria-hidden>
      <path d="M4 8h3l1.6-2.5h6.8L17 8h3v11H4z" />
      <circle cx="12" cy="13.2" r="3.4" />
    </svg>
  ),
}
function CheckMark({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

function Head({ step, title, sub }: { step: number; title: ReactNode; sub: string }) {
  return (
    <div className="fs-head">
      <span className="fs-icon" aria-hidden>
        {STEP_ICONS[step]}
      </span>
      <h1 className="fs-title">{title}</h1>
      <p className="fs-sub">{sub}</p>
    </div>
  )
}

export default function FirstScreenFlow() {
  const sp = useSearchParams()
  const requested = Math.min(STAMP_STEP, Math.max(0, Number.parseInt(sp.get('step') ?? '0', 10) || 0))

  const today = todayKstIsoDate()
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [approx, setApprox] = useState(false)
  const [breed, setBreed] = useState('')
  const [breedQuery, setBreedQuery] = useState('')
  const [breedCustom, setBreedCustom] = useState(false)
  const [gender, setGender] = useState<Gender>('')
  const [neutered, setNeutered] = useState<boolean | null>(null)
  const [weight, setWeight] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [alert, setAlert] = useState('')
  const [ready, setReady] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // 첫 실행 표식 · 프로모션 링크(?p=) · 초안 이어 쓰기 · 들고 있던 사진 — 마운트 뒤 한 번(폰 저장소 = 바깥 상태).
  useEffect(() => {
    markOnboarded()
    const code = normalizePromoCode(new URLSearchParams(window.location.search).get('p'))
    if (code) saveAutosignupDraft({ promo: code })
    const d = loadAutosignupDraft()?.dog
    if (d) {
      if (d.name) setName(d.name)
      if (d.breed) {
        setBreed(d.breed)
        if (!BREED_NAMES.includes(d.breed)) {
          setBreedCustom(true)
          setBreedQuery(d.breed)
        }
      }
      if (d.gender) setGender(d.gender)
      if (typeof d.neutered === 'boolean') setNeutered(d.neutered)
      if (d.birthDate) setBirthDate(d.birthDate)
      if (d.weight) setWeight(d.weight)
    }
    const held = readHeldStartPhoto()
    if (held) setPhoto(held)
    setReady(true)
  }, [])

  // 조금씩 저장 — 중간에 앱을 닫아도 이어서(7일). 생일 → 나이 파생을 같이(칼로리 계산이 age_value/age_unit 을 읽는다).
  // surveyDeferred = 설문은 가입 뒤 앱에서(이 화면은 설문 답을 모으지 않는다). 이 표식이 없으면 첫 단계의
  // '로그인'으로 나간 사람의 초안을 로그인 화면이 '설문 끝난 웹 초안'으로 읽어(applyAutosignupDraft) 답하지
  // 않은 기본값으로 분석을 만든다 — 표식이 있으면 강아지만 만들고 설문으로 보낸다(createDogFromDraft).
  const dogDraft = useMemo<AutosignupDogDraft>(() => {
    const age = deriveAgeFromBirth(birthDate, Date.now())
    return {
      name: name.trim(),
      breed,
      gender,
      neutered,
      weight,
      birthDate,
      ageValue: age ? String(age.value) : '',
      ageUnit: age ? age.unit : 'years',
    }
  }, [name, breed, gender, neutered, weight, birthDate])
  useEffect(() => {
    if (!ready) return
    const t = setTimeout(() => saveAutosignupDraft({ dog: dogDraft, surveyDeferred: true }), 400)
    return () => clearTimeout(t)
  }, [dogDraft, ready])

  // 비어 있는 첫 단계 — 주소로 바로 뒤 단계에 들어와도 거기서 멈춘다.
  const firstEmpty = useMemo(() => {
    if (!name.trim()) return 0
    if (!birthDate) return 1
    if (!breed.trim()) return 2
    if (!gender || neutered === null) return 3
    if (!(Number.parseFloat(weight) >= 0.5)) return 4
    return STAMP_STEP
  }, [name, birthDate, breed, gender, neutered, weight])
  const step = ready ? Math.min(requested, firstEmpty) : 0

  const goto = useCallback((next: number) => {
    setAlert('')
    const q = new URLSearchParams(window.location.search)
    q.set('step', String(next))
    window.history.pushState(null, '', `?${q.toString()}`)
  }, [])
  const back = () => {
    setAlert('')
    window.history.back()
  }

  // 단계에 들어올 때 빈 휠 값 채우기(휠은 늘 한 값을 가리킨다) — 생일 = 2년 전 오늘, 몸무게 = 견종 평균(없으면 5kg).
  useEffect(() => {
    if (!ready) return
    if (step === 1 && !birthDate) setBirthDate(shiftIso(today, 2, 0))
    if (step === 4 && !weight) {
      const avg = BREEDS.find((b) => b.label === breed)?.avgWeight
      setWeight((avg && avg > 0 ? avg : 5).toFixed(1))
    }
  }, [step, ready, birthDate, weight, breed, today])

  // 도장 화면 직전 — 초안을 바로(디바운스 없이) 확정해 둔다. 카카오·애플은 화면 밖으로 나갔다 온다.
  useEffect(() => {
    if (step === STAMP_STEP && isDogDraftComplete(dogDraft)) saveAutosignupDraft({ dog: dogDraft, surveyDeferred: true })
  }, [step, dogDraft])

  function next() {
    if (step === 0 && !name.trim()) return setAlert('이름을 적어 주세요')
    if (step === 2 && !breed.trim()) return setAlert(breedCustom ? '견종을 적어 주세요' : '견종을 골라 주세요')
    if (step === 3 && (!gender || neutered === null)) return setAlert(!gender ? '성별을 골라 주세요' : '중성화 여부를 골라 주세요')
    if (step === 4 && !(Number.parseFloat(weight) >= 0.5)) return setAlert('몸무게를 0.5kg 이상으로 골라 주세요')
    if (step === 1 && birthDate > today) return setAlert('생일이 오늘보다 늦을 수 없어요')
    goto(step + 1)
  }

  async function onPhotoPicked(file: File | undefined) {
    if (!file) return
    setPhotoBusy(true)
    setAlert('')
    try {
      const dataUrl = await shrinkPhoto(file)
      setPhoto(dataUrl)
      if (!holdStartPhoto(dataUrl)) setAlert('사진을 잠깐 보관하지 못했어요. 가입한 뒤 정보 수정에서 올려 주세요.')
    } catch {
      setAlert('이 사진은 열 수 없어요. 다른 사진을 골라 주세요.')
    } finally {
      setPhotoBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const who = petName(name.trim()) || '우리 아이'

  // ── 생일 휠 값 ──
  const b = parseIso(birthDate) ?? parseIso(shiftIso(today, 2, 0))!
  const t = parseIso(today)!
  const yearOpts: WheelOption[] = useMemo(
    () => Array.from({ length: 26 }, (_, i) => t.y - 25 + i).map((y) => ({ value: String(y), label: `${y}년` })),
    [t.y],
  )
  const monthOpts: WheelOption[] = useMemo(() => {
    const max = b.y === t.y ? t.m : 12
    return Array.from({ length: max }, (_, i) => ({ value: String(i + 1), label: `${i + 1}월` }))
  }, [b.y, t.y, t.m])
  const dayOpts: WheelOption[] = useMemo(() => {
    const max = b.y === t.y && b.m === t.m ? t.d : daysIn(b.y, b.m)
    return Array.from({ length: max }, (_, i) => ({ value: String(i + 1), label: `${i + 1}일` }))
  }, [b.y, b.m, t.y, t.m, t.d])
  const setYmd = (y: number, m: number, d: number) => {
    const mm = y === t.y ? Math.min(m, t.m) : m
    const maxD = y === t.y && mm === t.m ? t.d : daysIn(y, mm)
    setBirthDate(toIso(y, mm, Math.min(d, maxD)))
  }
  const approxAge = (() => {
    const a = deriveAgeFromBirth(birthDate, Date.now())
    return !a || a.unit === 'months' ? '0' : String(Math.min(20, a.value))
  })()
  const ageOpts: WheelOption[] = useMemo(
    () => [{ value: '0', label: '1살 미만' }, ...Array.from({ length: 20 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}살` }))],
    [],
  )

  // ── 몸무게 휠 값 ──
  const w = Number.parseFloat(weight) || 0
  const wInt = Math.min(80, Math.floor(w))
  const wDec = Math.round((w - Math.floor(w)) * 10) % 10
  const intOpts: WheelOption[] = useMemo(() => Array.from({ length: 81 }, (_, i) => ({ value: String(i), label: String(i) })), [])
  const decOpts: WheelOption[] = useMemo(() => Array.from({ length: 10 }, (_, i) => ({ value: String(i), label: `.${i}` })), [])

  // ── 견종 목록 ──
  const breedRows = useMemo(() => {
    const q = squash(breedQuery)
    const pool = q ? BREED_NAMES.filter((x) => squash(x).includes(q)) : breed && BREED_NAMES.includes(breed) ? [breed, ...BREED_NAMES.filter((x) => x !== breed)] : BREED_NAMES
    // 3줄(시안 Y3) — 그 아래 '목록에 없어요 · 직접 적을게요'가 카드 안에 보이게. 더 찾으려면 글자를 친다.
    return pool.slice(0, 3)
  }, [breedQuery, breed])

  // ── 위 줄 ──
  const topBar =
    step === STAMP_STEP ? null : (
      <>
        {step === 0 ? (
          <span className="fs-back-spacer" aria-hidden />
        ) : (
          <button type="button" className="s-back" onClick={back} aria-label="이전 단계로">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
        )}
        <span className="fs-segbar" role="progressbar" aria-label={`6단계 중 ${step + 1}단계`} aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={6}>
          {Array.from({ length: 6 }, (_, i) => (
            <i key={i} className={i <= step ? 'is-on' : undefined} />
          ))}
        </span>
      </>
    )

  const below = alert ? (
    <SurveyAlert>{alert}</SurveyAlert>
  ) : step === 0 ? (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 22, display: 'flex', justifyContent: 'center' }}>
      <Link href="/login" className="s-tlink" style={{ alignSelf: 'center' }}>
        이미 계정이 있어요 · 로그인
      </Link>
    </div>
  ) : null

  // ── 도장 + 가입(시안 Y6) ──
  if (step === STAMP_STEP) {
    const bd = parseIso(birthDate)
    const isApproxBirth = approx
    const facts: Array<[string, string]> = [
      ['생일', bd ? (isApproxBirth ? `대략 ${ageText(birthDate)}` : `${bd.y}년 ${bd.m}월 ${bd.d}일 · ${ageText(birthDate)}`) : '—'],
      ['견종', splitBreed(breed).name || '—'],
      ['성별', `${gender === 'male' ? '남아' : '여아'} · 중성화 ${neutered ? '했어요' : '안 했어요'}`],
      ['몸무게', `${Number.parseFloat(weight).toFixed(1).replace(/\.0$/, '')}kg`],
    ]
    return (
      <div className="fs-root" data-ft-chrome="app">
        <div className="s-frame">
          <div className="s-glow s-glow-a" aria-hidden />
          <div className="s-glow s-glow-b" aria-hidden />
          <div className="s-top">
            <button type="button" className="s-back" onClick={back} aria-label="이전 단계로">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
          </div>
          <section className="fs-stampcard fs-shake" aria-label={`${who} 정보`}>
            <div className="fs-dog">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element -- 폰에 들고 있는 사진(data URL)
                <img className="fs-dog-photo" src={photo} alt="" />
              ) : (
                <span className="fs-dog-photo" aria-hidden>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                    <ellipse cx="6.2" cy="10" rx="1.9" ry="2.4" />
                    <ellipse cx="9.8" cy="6.4" rx="1.9" ry="2.5" />
                    <ellipse cx="14.2" cy="6.4" rx="1.9" ry="2.5" />
                    <ellipse cx="17.8" cy="10" rx="1.9" ry="2.4" />
                    <path d="M12 11.2c-2.6 0-5 2.8-5 5.2 0 1.7 1.3 2.6 2.7 2.6 1 0 1.6-.5 2.3-.5s1.3.5 2.3.5c1.4 0 2.7-.9 2.7-2.6 0-2.4-2.4-5.2-5-5.2z" />
                  </svg>
                </span>
              )}
              <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <span className="fs-dog-kicker">우리 아이</span>
                <span className="fs-dog-name ft-poster">{name.trim()}</span>
              </span>
            </div>
            <dl className="fs-facts" style={{ margin: '16px 0 0' }}>
              {facts.map(([k, v]) => (
                <div key={k} className="fs-fact">
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <div className="fs-up">
              <h1 className="fs-ready-title">
                {who} 맞춤 설문이
                <br />
                준비됐어요
              </h1>
              <p className="fs-ready-sub">가입하면 바로 설문으로 이어져요</p>
            </div>
            <div className="fs-join fs-up">
              {/* 가입 뒤 착지 = /start/onboard(강아지 생성 → 설문). 애플 버튼은 애플 기기에서만 보인다(부품 안 판정). */}
              <KakaoLoginButton variant="signup" next="/start/onboard" look="flow" label="카카오로 가입하고 시작" />
              <AppleLoginButton variant="signup" next="/start/onboard" look="flow" label="Apple로 가입하고 시작" />
              <Link href="/start/join" className="fs-join-email">
                이메일로 가입할게요
              </Link>
            </div>
            <span className="fs-ring" aria-hidden />
            {[
              { left: 330, top: -46, s: 7 },
              { left: 268, top: 74, s: 5 },
              { left: 352, top: 40, s: 6 },
              { left: 250, top: -18, s: 4 },
            ].map((d, i) => (
              <span key={i} className="fs-dust" aria-hidden style={{ left: `calc(100% - ${358 - d.left}px)`, top: d.top, width: d.s, height: d.s }} />
            ))}
            <span className="fs-stamp" role="img" aria-label="파머스테일 도장" />
          </section>
        </div>
      </div>
    )
  }

  // ── 입력 단계(Y1~Y5c) ──
  let body: ReactNode = null
  let cta: ReactNode = (
    <button type="button" className="s-btn-primary" onClick={next}>
      다음
    </button>
  )

  if (step === 0) {
    body = (
      <>
        <Head
          step={0}
          title={
            <>
              우리 아이
              <br />
              이름이 뭐예요?
            </>
          }
          sub="앞으로 이 이름으로 불러 드릴게요"
        />
        <input
          className="fs-name"
          data-filled={name.trim() ? 'true' : undefined}
          value={name}
          maxLength={20}
          placeholder="예: 땅콩"
          aria-label="아이 이름"
          autoComplete="off"
          enterKeyHint="next"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') next()
          }}
        />
      </>
    )
  } else if (step === 1) {
    body = (
      <>
        <Head
          step={1}
          title={
            <>
              {who} 생일이
              <br />
              언제예요?
            </>
          }
          sub="나이에 맞춰 하루에 먹을 양을 계산해요"
        />
        <span className="s-lbar" style={{ marginTop: 24 }}>
          {approx ? '대략 나이' : '생일'}
        </span>
        <div style={{ marginTop: 16 }}>
          {approx ? (
            <WheelFrame columns="1fr" ariaLabel="대략 나이 고르기">
              <WheelColumn
                label="나이"
                options={ageOpts}
                value={approxAge}
                onChange={(v) => setBirthDate(v === '0' ? shiftIso(today, 0, 6) : shiftIso(today, Number(v), 0))}
              />
            </WheelFrame>
          ) : (
            <WheelFrame columns="1.35fr 1fr 1fr" ariaLabel="생일 고르기">
              <WheelColumn label="년" options={yearOpts} value={String(b.y)} onChange={(v) => setYmd(Number(v), b.m, b.d)} />
              <WheelColumn label="월" options={monthOpts} value={String(b.m)} onChange={(v) => setYmd(b.y, Number(v), b.d)} />
              <WheelColumn label="일" options={dayOpts} value={String(b.d)} onChange={(v) => setYmd(b.y, b.m, Number(v))} />
            </WheelFrame>
          )}
        </div>
        <p className="fs-note">
          지금 <strong>{ageText(birthDate)}</strong>이에요
        </p>
        <button
          type="button"
          className="s-tlink fs-center-link"
          aria-pressed={approx}
          onClick={() => setApprox((v) => !v)}
        >
          {approx ? '생일로 고를게요' : '정확히 몰라요 · 대략 나이로 할게요'}
        </button>
      </>
    )
  } else if (step === 2) {
    body = (
      <>
        <Head
          step={2}
          title={
            <>
              {who}는
              <br />
              어떤 아이예요?
            </>
          }
          sub="견종에 맞춰 알맞은 체형을 봐요"
        />
        <label className="fs-search">
          <input
            value={breedQuery}
            placeholder={breedCustom ? '견종을 적어 주세요' : '견종 찾기 (예: 말티즈)'}
            aria-label={breedCustom ? '견종 직접 적기' : '견종 찾기'}
            autoComplete="off"
            enterKeyHint={breedCustom ? 'next' : 'search'}
            onChange={(e) => {
              setBreedQuery(e.target.value)
              if (breedCustom) setBreed(e.target.value.trim())
            }}
          />
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#141414" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="6.5" />
            <path d="M20 20l-4.2-4.2" />
          </svg>
        </label>
        {breedCustom ? (
          <p className="fs-hint">목록에 없는 견종은 적은 그대로 저장해요.</p>
        ) : (
          <div className="fs-breeds" role="radiogroup" aria-label="견종">
            {breedRows.length === 0 && <p className="fs-hint">찾는 견종이 없어요. 아래에서 직접 적어 주세요.</p>}
            {breedRows.map((x, i) => {
              const on = x === breed
              const { name: nm, alias } = splitBreed(x)
              return (
                <div key={x} style={{ display: 'contents' }}>
                  {i > 0 && <span className="fs-breed-sep" aria-hidden />}
                  <button type="button" role="radio" aria-checked={on} className="fs-breed" onClick={() => setBreed(x)}>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                      <span className="fs-breed-name">{nm}</span>
                      {alias && <span className="fs-breed-alias">{alias}</span>}
                    </span>
                    <span className="fs-radio" aria-hidden>
                      {on && <CheckMark />}
                    </span>
                  </button>
                </div>
              )
            })}
          </div>
        )}
        <button
          type="button"
          className="s-tlink"
          style={{ marginTop: 12 }}
          aria-pressed={breedCustom}
          onClick={() => {
            if (breedCustom) {
              setBreedCustom(false)
              setBreed(BREED_NAMES.includes(breed) ? breed : '')
            } else {
              setBreedCustom(true)
              setBreed(breedQuery.trim())
            }
          }}
        >
          {breedCustom ? '목록에서 고를게요' : '목록에 없어요 · 직접 적을게요'}
        </button>
      </>
    )
  } else if (step === 3) {
    body = (
      <>
        <Head
          step={3}
          title={
            <>
              성별과 중성화를
              <br />
              알려주세요
            </>
          }
          sub="중성화하면 필요한 열량이 조금 줄어요"
        />
        <span className="s-lbar" style={{ marginTop: 24 }}>
          성별
        </span>
        <div className="s-seg" role="group" aria-label="성별" style={{ marginTop: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          {(['male', 'female'] as const).map((g) => (
            <button key={g} type="button" aria-pressed={gender === g} onClick={() => setGender(g)}>
              {g === 'male' ? '남아' : '여아'}
            </button>
          ))}
        </div>
        <span className="s-lbar" style={{ marginTop: 16 }}>
          중성화
        </span>
        <div className="s-seg" role="group" aria-label="중성화" style={{ marginTop: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          {([true, false] as const).map((n) => (
            <button key={String(n)} type="button" aria-pressed={neutered === n} onClick={() => setNeutered(n)}>
              {n ? '했어요' : '안 했어요'}
            </button>
          ))}
        </div>
      </>
    )
  } else if (step === 4) {
    body = (
      <>
        <Head
          step={4}
          title={
            <>
              {who} 몸무게는
              <br />
              얼마예요?
            </>
          }
          sub="대략이라도 괜찮아요"
        />
        <span className="s-lbar" style={{ marginTop: 24 }}>
          몸무게
        </span>
        <div style={{ marginTop: 16 }}>
          <WheelFrame columns="1fr auto 1fr" ariaLabel="몸무게 고르기">
            <WheelColumn label="킬로그램" align="end" options={intOpts} value={String(wInt)} onChange={(v) => setWeight(`${v}.${wDec}`)} />
            <WheelColumn label="소수점" align="start" options={decOpts} value={String(wDec)} onChange={(v) => setWeight(`${wInt}.${v}`)} />
            <WheelUnit>kg</WheelUnit>
          </WheelFrame>
        </div>
        <p className="fs-note">저울이 없으면 마지막으로 잰 몸무게로</p>
      </>
    )
  } else if (step === 5) {
    body = (
      <>
        <Head
          step={5}
          title={
            <>
              {who} 사진도
              <br />
              올려 볼까요?
            </>
          }
          sub="얼굴이 잘 보이는 사진 한 장이면 돼요"
        />
        {photo ? (
          <>
            <div className="fs-photo-chosen">
              {/* eslint-disable-next-line @next/next/no-img-element -- 폰에 들고 있는 사진(data URL) */}
              <img src={photo} alt={`${name.trim()} 사진`} />
              <span className="fs-photo-check" aria-hidden>
                <CheckMark size={18} />
              </span>
            </div>
            <p className="fs-photo-cap">이 사진으로 등록할게요</p>
          </>
        ) : (
          <>
            <button type="button" className="fs-photo-pick" onClick={() => fileRef.current?.click()} disabled={photoBusy}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#8A867F" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 8h3l1.6-2.4h6.8L17 8h3v11H4z" />
                <circle cx="12" cy="13.2" r="3.4" />
              </svg>
              {photoBusy ? '여는 중…' : '사진 고르기'}
            </button>
            <p className="fs-note" style={{ marginTop: 14 }}>
              나중에 정보 수정에서 올려도 돼요
            </p>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => void onPhotoPicked(e.target.files?.[0])}
        />
      </>
    )
    cta = photo ? (
      <>
        <button type="button" className="s-btn-primary" onClick={() => goto(STAMP_STEP)}>
          다 됐어요
        </button>
        <button type="button" className="s-btn-secondary" onClick={() => fileRef.current?.click()} disabled={photoBusy}>
          다시 고르기
        </button>
      </>
    ) : (
      <>
        <button type="button" className="s-btn-primary" onClick={() => fileRef.current?.click()} disabled={photoBusy}>
          사진 고르기
        </button>
        <button
          type="button"
          className="s-btn-secondary"
          onClick={() => {
            clearHeldStartPhoto()
            goto(STAMP_STEP)
          }}
        >
          나중에 할게요
        </button>
      </>
    )
  }

  return (
    <div className="fs-root" data-ft-chrome="app">
      <SurveyFrame top={topBar} cta={cta} below={below} scrollKey={`first-${step}`}>
        <div style={{ paddingBottom: 4 }}>{body}</div>
      </SurveyFrame>
    </div>
  )
}

