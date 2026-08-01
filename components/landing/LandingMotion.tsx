'use client'

/**
 * LandingMotion — GSAP 오케스트레이터 (2026-08-02, 사장님 "GSAP 활용해서 업그레이드").
 *
 * # 왜 GSAP 인가
 * Webflow 인수 후 **전면 무료**가 됐다(ScrollTrigger·SplitText 포함 — 예전 유료
 * 플러그인 전부). 수제 프리미티브(Reveal/Parallax)로는 못 하는 두 가지가 열린다:
 *   · **스크럽** — 등장이 아니라 스크롤 위치에 묶인 변형. 스크롤을 되감으면
 *     애니메이션도 되감긴다. rAF 파랄락스보다 프레임 정확도가 높다.
 *   · **SplitText** — 글자 단위 분해. 줄 마스크(.fv-line)보다 한 급 위의 등장.
 *
 * # 로딩 원칙 — 앱 번들에 1바이트도 얹지 않는다
 * `import()` 동적 로드라 이 컴포넌트를 마운트한 페이지(웹 랜딩)에서만 내려받는다.
 * 앱(main)/어드민 라우트는 이 파일을 import 하지 않으므로 영향 0.
 *
 * # 폴백 사다리
 *   reduced-motion → 아무것도 안 함(정적 표시)
 *   JS 실패/크롤러 → 마크업은 평문 그대로라 콘텐츠 손실 0
 *   GSAP 로드 실패 → catch 로 조용히 정적 유지
 *
 * # 마크업 계약 (page.tsx 쪽 태그)
 *   data-gsap="hero-title"  → SplitText 글자 스태거 등장 (줄 마스크는 .gsap-line)
 *   data-gsap-y="-8"        → 섹션 스크롤 동안 yPercent -8 로 스크럽 이동
 *   data-gsap-marquee       → 등속 루프 + **스크롤 속도/방향 반응** (2차)
 *   data-gsap-img           → 액자 안에서 사진만 미끄러진다 (2차)
 */

import { useEffect } from 'react'

import { scrollSpeedFactor } from '@/lib/motion/scroll-speed'

export default function LandingMotion() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let ctx: { revert: () => void } | undefined
    let cancelled = false
    let idleTimer = 0
    const teardown: Array<() => void> = []

    void (async () => {
      try {
        const [{ gsap }, { ScrollTrigger }, { SplitText }] = await Promise.all([
          import('gsap'),
          import('gsap/ScrollTrigger'),
          import('gsap/SplitText'),
        ])
        if (cancelled) return
        gsap.registerPlugin(ScrollTrigger, SplitText)

        ctx = gsap.context(() => {
          // ① 히어로 헤드라인 — 글자 스태거. 줄 래퍼(.gsap-line)가 마스크가 된다.
          const title = document.querySelector('[data-gsap="hero-title"]')
          if (title) {
            const split = new SplitText(title, {
              type: 'lines,chars',
              linesClass: 'gsap-line',
            })
            gsap.from(split.chars, {
              yPercent: 112,
              duration: 0.85,
              ease: 'power4.out',
              stagger: 0.018,
              delay: 0.12,
            })
          }

          // ② 스크럽 파랄락스 — 요소가 속한 섹션이 뷰포트를 지나는 동안
          //    yPercent 를 스크롤에 1:1 로 묶는다(scrub). 되감으면 같이 되감긴다.
          document
            .querySelectorAll<HTMLElement>('[data-gsap-y]')
            .forEach((el) => {
              const y = Number(el.dataset.gsapY)
              if (!Number.isFinite(y) || y === 0) return
              gsap.fromTo(
                el,
                { yPercent: -y / 2 },
                {
                  yPercent: y / 2,
                  ease: 'none',
                  scrollTrigger: {
                    trigger: el.closest('section') ?? el,
                    start: 'top bottom',
                    end: 'bottom top',
                    scrub: true,
                  },
                },
              )
            })

          // ③ 재료 스트립 — 등속으로 흐르다가 **스크롤 속도·방향을 탄다**(2차).
          //    CSS 애니메이션(fvMarquee)을 끄고 GSAP 이 운전대를 잡는다. 트랙은
          //    재료 6장을 두 번 이어 붙였으므로 xPercent -50 이 정확히 한 바퀴.
          //    빠르게 내리면 재료가 휙 지나가고, 위로 올리면 **역주행**한다 —
          //    스크롤이 화면을 움직이는 게 아니라 화면과 대화하는 인상.
          const track = document.querySelector<HTMLElement>('[data-gsap-marquee]')
          if (track) {
            track.style.animation = 'none' // CSS 루프 해제 — 이제 GSAP 소유
            const loop = gsap.to(track, {
              xPercent: -50,
              duration: 36,
              ease: 'none',
              repeat: -1,
            })

            // 마우스를 올리면 멈춘다 — CSS 의 :hover play-state 를 대체한다
            //   (animation:none 이 되면 그 룰은 더 이상 걸리지 않는다).
            const frame = track.parentElement
            if (frame) {
              const stop = () => loop.pause()
              const go = () => loop.resume()
              frame.addEventListener('mouseenter', stop)
              frame.addEventListener('mouseleave', go)
              teardown.push(() => {
                frame.removeEventListener('mouseenter', stop)
                frame.removeEventListener('mouseleave', go)
              })
            }

            ScrollTrigger.create({
              trigger: frame ?? track,
              start: 'top bottom',
              end: 'bottom top',
              onUpdate: (self) => {
                // 속도 → 배속. 매핑은 lib/motion/scroll-speed 가 정본이고
                // 거기 테스트가 역주행·clamp·NaN 을 지킨다(브라우저로는 합성
                // 스크롤 속도가 튀어 역주행을 눈으로 판정할 수 없었다).
                const ts = scrollSpeedFactor(self.getVelocity())
                // ★즉시 반영. 0.35 초 트윈으로 쫓아가게 했더니 트윈이 도착하기
                //   전에 속도가 식어 매번 덮어써졌고, 목표가 -2.9 여도 실제로는
                //   0.43 까지밖에 안 내려갔다(실측) — 역주행이 영영 안 나온다.
                //   속도값은 ScrollTrigger 가 이미 다듬어 주므로 직접 넣어도 곱다.
                gsap.killTweensOf(loop) // 되돌리기 트윈이 돌고 있으면 먼저 멈춘다
                loop.timeScale(ts)
                // 스크롤이 멎으면 등속으로 되돌아온다 — 마지막 배속이 굳어
                // 영원히 빨리 도는 것을 막는 브레이크.
                window.clearTimeout(idleTimer)
                idleTimer = window.setTimeout(() => {
                  gsap.to(loop, { timeScale: 1, duration: 0.9, overwrite: true })
                }, 180)
              },
            })
          }

          // ④ 액자 안에서 사진만 미끄러진다(2차) — 카드는 제자리, 내용물이 살아
          //    있다. 카드가 통째로 움직이는 파랄락스보다 조용하면서 깊이는 더 난다.
          //    드리프트로 가장자리가 드러나지 않게 1.14 배 확대해 두고 시작한다.
          document
            .querySelectorAll<HTMLElement>('[data-gsap-img]')
            .forEach((el) => {
              const img = el.querySelector('img')
              if (!img) return
              gsap.fromTo(
                img,
                { yPercent: -6, scale: 1.14 },
                {
                  yPercent: 6,
                  scale: 1.14,
                  ease: 'none',
                  scrollTrigger: {
                    trigger: el,
                    start: 'top bottom',
                    end: 'bottom top',
                    scrub: true,
                  },
                },
              )
            })

          // ⑤ 3단계 섹션 = **핀 고정 + 순차 점등**(2차-B).
          //    스크롤이 타임라인이 되는, GSAP 을 쓰는 진짜 이유. 1→2→3 은 실제
          //    순서가 있는 내용이라(설문→분석→배송) 순차 진행이 장식이 아니다.
          //
          //    ★모바일 제외 — 스크롤을 잡아채는 연출은 좁은 화면에서 "멈췄나?"
          //    로 읽히고, 전환이 일어나는 곳이 모바일이다. 데스크톱에서만 만들고,
          //    창을 줄이면 GSAP 이 알아서 되돌린다.
          //
          //    ★API 주의: `ScrollTrigger.matchMedia({...})` 는 3.11 부터 폐기됐다
          //    (types/scroll-trigger.d.ts:271 "Deprecated in favor of
          //    gsap.matchMedia()"). 그걸로 짰더니 **핀 스페이서는 만들어지는데
          //    핀이 안 걸렸다** — 조용히 죽어서 더 위험했다. 현행은 gsap.matchMedia().
          const mm = gsap.matchMedia()
          teardown.push(() => mm.revert())
          mm.add('(min-width: 768px)', () => {
              // 핀 대상은 단계들이 든 <section>. 공유 <Section> 컴포넌트는 rest
              // props 를 안 넘기므로 거기에 data-* 를 달 수 없다 — 이 연출 하나
              // 때문에 web/app 공유 컴포넌트를 고치지 않는다. closest 로 찾는다.
              const steps = Array.from(
                document.querySelectorAll<HTMLElement>('[data-gsap-step]'),
              )
              const first = steps[0]
              if (!first) return
              const pinned = first.closest('section')
              if (!pinned) return

              const tl = gsap.timeline({
                scrollTrigger: {
                  trigger: pinned,
                  start: 'center center',
                  // 단계당 화면 절반씩 — 3단계면 1.5 화면. 짧게 잡아야
                  // "갇혔다"가 아니라 "천천히 읽는다"가 된다.
                  end: () => `+=${window.innerHeight * 0.5 * steps.length}`,
                  pin: true,
                  scrub: 0.6,
                  // 핀 하는 동안 앵커가 밀리므로, 이미지 로드 후 재계산.
                  invalidateOnRefresh: true,
                },
              })
              // 셋 다 어둡게 "도착"시켜 둔다. 타임라인 안에서 fromTo 로 하면
              // 1 단계는 타임라인 0 초에 걸려 스크럽이 시작되기도 전에 이미 밝아져
              // 있었다(최저 0.97 실측) — 3 단계 중 2 개만 켜지는 꼴이었다.
              gsap.set(steps, { opacity: 0.22, y: 18 })
              steps.forEach((step, i) => {
                tl.to(
                  step,
                  { opacity: 1, y: 0, ease: 'power2.out', duration: 1 },
                  i * 0.9 + 0.25, // 0.25 리드인 후 차례차례
                )
              })
          })
        })
      } catch {
        /* GSAP 로드 실패 → 정적 표시로 조용히 폴백 */
      }
    })()

    return () => {
      cancelled = true
      window.clearTimeout(idleTimer)
      teardown.forEach((fn) => fn())
      ctx?.revert()
    }
  }, [])

  return null
}
