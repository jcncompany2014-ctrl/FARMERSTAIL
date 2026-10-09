/**
 * GreetingSection — 앱 홈 맨 위 인사.
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 캔버스 AppHome): 머리말 = 머스타드 네모 + 오늘 날짜(강아지가 없으면 "환영해요"),
 *   제목 = 시간대 인사 + 줄바꿈 + 보호자 이름(제목 글꼴 34), 아래 한 줄 = "오늘도 건강한 한 끼를 정성스럽게."(머스타드 밑줄).
 *   예전 우상단 서명 블록(이름 + 가족 N명)은 뺐다 — 이름이 제목으로 올라왔다.
 *
 * timeOfDay 는 KST 시간 기준 자동 분기:
 *   05-11 → morning / 12-16 → afternoon / 17-20 → evening / 21-04 → night
 *
 * # 멘트 다양화 (사용자 요청 2026-05-25)
 * 같은 시간대에서도 5가지 멘트 중 day-of-year 기반 deterministic rotation.
 * 새로고침 시 안 바뀜 (혼란 방지). 다음날 자동 변경.
 */

import { V3 } from '@/lib/design/tokens'
import { currentKstHour, nowKstMs } from '@/lib/datetime-kst'

interface GreetingSectionProps {
  /** 보호자 이름. */
  userName: string
  /** 가족(강아지) 수 — 0 이면 머리말이 "환영해요". */
  familyCount: number
  /** 머리말을 "환영해요"로 — 주면 familyCount 보다 우선(조회 실패는 0마리가 아니다). */
  welcome?: boolean
  /** 강제 timeOfDay override (테스트·점검 화면용). 일반적으로 prop 안 줌. */
  forceTimeOfDay?: TimeOfDay
  /** 멘트 variant override (테스트용). 0-based index. */
  forceVariant?: number
  /** 머리말 날짜 override (점검 화면용 — "10월 7일 수요일"). */
  forceDateLabel?: string
  /** 하단 카피. 기본 "오늘도 건강한 한 끼를 정성스럽게." */
  subCopy?: { lead: string; mark: string }
}

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night'

/**
 * 시간대별 헤딩 5종 — day-of-year mod 5 로 rotation.
 * 사용자 요청 2026-05-25: 항상 같은 멘트 X.
 */
const HEADINGS_BY_TIME: Record<TimeOfDay, string[]> = {
  morning: [
    '좋은 아침이에요,',
    '상쾌한 아침이에요,',
    '활기찬 시작이에요,',
    '오늘도 좋은 하루,',
    '잘 일어나셨어요,',
  ],
  afternoon: [
    '좋은 오후예요,',
    '점심은 챙기셨죠,',
    '따뜻한 오후예요,',
    '오후도 활기차게,',
    '오늘은 어떠세요,',
  ],
  evening: [
    '좋은 저녁이에요,',
    '오늘도 수고하셨어요,',
    '따뜻한 저녁이에요,',
    '하루 잘 마무리해요,',
    '저녁은 편안하게,',
  ],
  night: [
    '좋은 밤이에요,',
    '늦은 시간 고생 많아요,',
    '푹 쉬는 밤 되세요,',
    '오늘도 함께해 주셔서 고마워요,',
    '편안한 밤 보내요,',
  ],
}

function computeTimeOfDay(): TimeOfDay {
  // ★ KST 시각으로 판정(2026-07-16 사장님: 늦은 밤인데 '오후'로 떴다). new Date().getHours()
  //   는 서버(Vercel=UTC)에서 UTC hour 라 한국시간과 9시간 어긋났다. currentKstHour 로 고정.
  const h = currentKstHour()
  if (h >= 5 && h < 12) return 'morning'
  if (h >= 12 && h < 17) return 'afternoon'
  if (h >= 17 && h < 21) return 'evening'
  return 'night'
}

/**
 * day-of-year (1-366) — KST 기준 매일 다른 값(자정 KST 에 멘트 rotation).
 * 같은 날엔 새로고침해도 같은 멘트, 다음 날엔 새 멘트.
 */
function dayOfYear(): number {
  // KST 보정 timestamp 를 UTC 벽시계로 읽어 KST 달력일을 얻는다(서버 UTC 무관 결정적).
  const kst = new Date(nowKstMs())
  const start = Date.UTC(kst.getUTCFullYear(), 0, 0)
  return Math.floor((kst.getTime() - start) / 86400000)
}

/**
 * 한국어 이름에 "님" 자동 부착. 이미 끝이 "님" 이면 중복 X.
 * 영문 이름은 그대로 (대문자 시작 + 영문자 only 휴리스틱).
 */
function withHonorific(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return ''
  if (trimmed.endsWith('님')) return trimmed
  if (/^[A-Za-z][A-Za-z\s'-]*$/.test(trimmed)) return trimmed
  return `${trimmed}님`
}

export default function GreetingSection({
  userName,
  familyCount,
  welcome,
  forceTimeOfDay,
  forceVariant,
  forceDateLabel,
  subCopy = { lead: '오늘도 건강한 한 끼를 ', mark: '정성스럽게.' },
}: GreetingSectionProps) {
  const tod = forceTimeOfDay ?? computeTimeOfDay()
  const variants = HEADINGS_BY_TIME[tod]
  const idx = forceVariant ?? dayOfYear() % variants.length
  const headingText = variants[idx] ?? variants[0]!
  // 머리말 = 오늘 날짜·요일(KST). 강아지가 아직 없으면 "환영해요"(캔버스 T05).
  const kickerLabel =
    (welcome ?? familyCount === 0)
      ? '환영해요'
      : (forceDateLabel ??
        new Intl.DateTimeFormat('ko-KR', {
          timeZone: 'Asia/Seoul',
          month: 'long',
          day: 'numeric',
          weekday: 'long',
        }).format(new Date()))
  const name = withHonorific(userName)

  return (
    <section style={{ padding: '24px 20px 0', display: 'flex', flexDirection: 'column' }}>
      <span
        style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: V3.inkMute }}
      >
        <span aria-hidden style={{ width: 8, height: 8, background: V3.mustard, flexShrink: 0 }} />
        {kickerLabel}
      </span>
      <h1 style={{ margin: '10px 0 0', fontSize: 34, lineHeight: 1.15, color: V3.ink, wordBreak: 'keep-all' }}>
        {headingText}
        {name && (
          <>
            <br />
            {name}
          </>
        )}
      </h1>
      <p style={{ margin: '10px 0 0', fontSize: 17, color: V3.inkSoft, lineHeight: 1.5 }}>
        {subCopy.lead}
        <strong style={{ fontWeight: 800, color: V3.ink, borderBottom: `4px solid ${V3.mustard}` }}>
          {subCopy.mark}
        </strong>
      </p>
    </section>
  )
}
