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
 */

import { useEffect } from 'react'

export default function LandingMotion() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let ctx: { revert: () => void } | undefined
    let cancelled = false

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
        })
      } catch {
        /* GSAP 로드 실패 → 정적 표시로 조용히 폴백 */
      }
    })()

    return () => {
      cancelled = true
      ctx?.revert()
    }
  }, [])

  return null
}
