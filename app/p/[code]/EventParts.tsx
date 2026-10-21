/**
 * 이벤트 화면 공용 조각 — 안내서(EventFlow)와 가입 완료(done/EventDone)가 같이 쓴다.
 * 첫 질문 부품(FirstScreenFlow)을 끌어오지 않게 따로 둔다(완료 화면이 첫 질문 묶음을 받지 않게).
 */
import Image from 'next/image'
import DogHero from '@/components/web/DogHero'
import type { HeroDog } from '@/lib/supporters'
import s from './event.module.css'

export function Logo() {
  return (
    <header className={s.header}>
      <Image src="/logo-ink.png" alt="파머스테일" width={111} height={19} priority />
    </header>
  )
}

/**
 * 맨 위 실사진 — 흑백만이라 딱딱하다(사장님 10/19, 시안 A '사진 + 머스터드' 채택) + 사진 속 아이 이름표("강아지 이름 넣고").
 * 서포터즈 코드면 그 아이(lib/supporters), 아니면 기본(땅콩) — page.tsx 가 고른다. 칸은 링크 모음과 같은 DogHero.
 */
export function EventHero({ dog, tag }: { dog: HeroDog; tag: string }) {
  return <DogHero dog={dog} tag={tag} className={s.heroBleed} />
}

/** 받는 순서 — 안내서와 가입 완료 화면이 같은 약속을 같은 말로 한다. */
export function EventSteps({ ratePct, capText = null }: { ratePct: number; capText?: string | null }) {
  const rows: Array<[string, React.ReactNode]> = [
    ['우리 아이 정보 넣기', '이름·생일·견종·성별·몸무게, 1분이면 돼요'],
    ['카카오로 가입하기', `가입하는 순간 첫 박스 ${ratePct}% 혜택이 계정에 저장돼요`],
    [
      '앱 깔고 로그인하기',
      <>
        앱 첫 화면 맨 아래
        <span className={s.loginChip}>이미 계정이 있어요 · 로그인</span>
      </>,
    ],
    ['남은 설문 2분', `정기배송을 시작하면 첫 결제가 ${ratePct}% 할인돼요${capText ? `(최대 ${capText})` : ''}`],
  ]
  return (
    <ol className={s.steps}>
      {rows.map(([title, sub], i) => (
        <li key={i} className={s.step}>
          <span className={s.stepNum} aria-hidden>
            {i + 1}
          </span>
          <span>
            <span className={s.stepTitle}>{title}</span>
            <span className={s.stepSub}>{sub}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

export function Footer() {
  return (
    <footer className={s.foot}>
      <span>파머스테일</span>
      <a href="/business">사업자 정보</a>
      <a href="/legal/terms">이용약관</a>
      <a href="/legal/privacy">개인정보처리방침</a>
    </footer>
  )
}
