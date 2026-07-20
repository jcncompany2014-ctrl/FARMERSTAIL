'use client'

// 앱 Phase B — 강아지정보 입력 직후 '바로 회원가입' 단계(사장님 2026-07-20).
//
// 앱 흐름: /start(강아지 기본, StartClient) → [여기] 가입 → /start/onboard
//   (강아지만 생성) → 앱내 설문(/dogs/[id]/survey). 웹은 이 페이지를 거치지 않고
//   기존 흐름(설문 먼저 → 결과직전 가입) 유지 — StartClient 가 앱 컨텍스트에서만
//   여기로 보낸다.
//
// ★증분1(현재): 카카오/애플 = 새 순서 완결(next=/start/onboard). 이메일은 아직
//   기존 설문끝 가입 흐름(/start/survey)으로 — 이메일을 가입-먼저 순서로 옮기는
//   것은 공유 로그인 훅을 건드려야 해 다음 증분에서. 한국 유저 대다수가 카카오라
//   주 경로부터 확정.

import Link from 'next/link'
import StartAppShell from '@/components/start/StartAppShell'
import KakaoLoginButton from '@/components/KakaoLoginButton'
import AppleLoginButton from '@/components/AppleLoginButton'

export default function StartJoinPage() {
  return (
    <StartAppShell>
      <main className="px-5 pt-8 pb-20">
        <h1
          className="font-sans"
          style={{
            fontSize: 27,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
            lineHeight: 1.22,
          }}
        >
          회원가입하고
          <br />
          분석 이어가기
        </h1>
        <p
          className="mt-2.5 text-[13.5px]"
          style={{ color: 'var(--muted)', lineHeight: 1.65 }}
        >
          가입하면 우리 아이 맞춤 분석을 이어갈 수 있어요. 몇 가지 설문만 더
          답하면 끝이에요.
        </p>

        {/* 카카오·애플 — 원탭·이름 자동. 복귀 착지 = /start/onboard(강아지 생성→설문). */}
        <div className="mt-7 space-y-3">
          <KakaoLoginButton variant="login" next="/start/onboard" />
          <AppleLoginButton variant="login" next="/start/onboard" />
        </div>

        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px" style={{ background: 'var(--rule)' }} />
          <span style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 600 }}>
            또는
          </span>
          <div className="flex-1 h-px" style={{ background: 'var(--rule)' }} />
        </div>

        <Link
          href="/start/survey"
          className="block text-center font-bold text-[14px] active:translate-y-[1px] transition-all"
          style={{
            padding: '15px 24px',
            borderRadius: 9999,
            border: '1.5px solid var(--rule)',
            color: 'var(--ink)',
            background: 'transparent',
          }}
        >
          이메일로 가입하기
        </Link>
        <p
          className="mt-3 text-center text-[11px]"
          style={{ color: 'var(--muted)', lineHeight: 1.5 }}
        >
          가입하면 이용약관·개인정보처리방침에 동의하게 됩니다.
        </p>
      </main>
    </StartAppShell>
  )
}
