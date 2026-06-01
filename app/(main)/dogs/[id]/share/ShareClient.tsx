'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  ChevronLeft,
  Share2,
  Copy,
  Check,
  Sparkles,
  MessageCircle,
  Heart,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

/**
 * 공유 카드 — 강아지 프로필 + 추천 코드 통합 공유.
 *
 * 디자인:
 *  - Hero: 강아지 사진 + 이름 + breed (preview 카드 형식)
 *  - 한 줄 추천 메시지 편집 가능 (선택)
 *  - 추천 코드 + 가입 링크 (자동 생성)
 *  - 큰 "카카오톡으로 공유" CTA — Web Share API
 *  - 클립보드 복사 fallback
 *  - 미리보기 — 받는 친구가 보게 될 메시지
 */

type Dog = {
  id: string
  name: string
  breed: string | null
  photoUrl: string | null
  ageLabel: string | null
}

const DEFAULT_MESSAGE_TEMPLATES = [
  '진짜 잘 먹어요',
  '아이 컨디션 좋아졌어요',
  '믿을 만한 영양 처방이에요',
  '꼭 한번 써보세요',
] as const

export default function ShareClient({
  dog,
  referralCode,
}: {
  dog: Dog
  referralCode: string
}) {
  const toast = useToast()
  const [message, setMessage] = useState<string>(
    DEFAULT_MESSAGE_TEMPLATES[0],
  )
  const [copied, setCopied] = useState<'link' | 'code' | null>(null)

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return `/signup?ref=${referralCode}`
    return `${window.location.origin}/signup?ref=${referralCode}`
  }, [referralCode])

  const shareText = useMemo(
    () =>
      `🐾 [파머스테일] ${dog.name}의 보호자가 추천해요\n\n"${message}"\n\n친구 코드 ${referralCode} 로 가입하면 3,000P 적립!\n\n${shareUrl}`,
    [dog.name, message, referralCode, shareUrl],
  )

  async function copy(text: string, which: 'link' | 'code') {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(which)
      setTimeout(() => setCopied(null), 1500)
      toast.success(which === 'link' ? '링크를 복사했어요' : '코드를 복사했어요')
    } catch {
      window.prompt('복사해 주세요', text)
    }
  }

  async function share() {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: `🐾 [파머스테일] ${dog.name}의 보호자가 추천해요`,
          text: shareText,
          url: shareUrl,
        })
        return
      } catch {
        return
      }
    }
    // fallback — 전체 텍스트 복사
    void copy(shareText, 'link')
  }

  return (
    <div className="pb-10">
      <section className="px-5 pt-6 pb-3">
        <Link
          href={`/dogs/${dog.id}`}
          className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-terracotta font-semibold"
        >
          <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
          {dog.name}
        </Link>
      </section>

      {/* 미리보기 카드 — 받는 사람이 보게 될 모습 */}
      <section className="px-5">
        <div className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">
          PREVIEW · 미리보기
        </div>
        <div className="rounded-[12px] overflow-hidden shadow-lg bg-bg-3 border border-rule">
          {/* 강아지 사진 */}
          <div className="relative aspect-[4/3] bg-bg-2">
            {dog.photoUrl ? (
              <Image
                src={dog.photoUrl}
                alt={dog.name}
                fill
                sizes="(max-width: 768px) 100vw, 480px"
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Heart
                  className="w-12 h-12 text-muted"
                  strokeWidth={1.2}
                />
              </div>
            )}
            {/* 좌상단 워터마크 */}
            <div
              className="absolute top-3 left-3 px-2 py-1 rounded-full inline-flex items-center gap-1"
              style={{
                background: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(6px)',
              }}
            >
              <Sparkles
                className="w-3 h-3 text-terracotta"
                strokeWidth={2}
              />
              <span className="text-[10px] font-bold text-text">
                Farmer&apos;s Tail
              </span>
            </div>
          </div>

          {/* 강아지 정보 */}
          <div className="px-5 py-4">
            <div className="flex items-baseline gap-2">
              <h2
                className="font-sans"
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: 'var(--ink)',
                  letterSpacing: '-0.02em',
                }}
              >
                {dog.name}
              </h2>
              <span className="text-[11px] text-muted">
                {[dog.breed, dog.ageLabel].filter(Boolean).join(' · ')}
              </span>
            </div>
            <p
              className="mt-2 text-[13px] leading-relaxed"
              style={{ color: 'var(--text)' }}
            >
              &ldquo;{message}&rdquo;
            </p>

            {/* 추천 코드 + 가입 안내 */}
            <div
              className="mt-3 px-3 py-2.5 rounded flex items-center gap-2"
              style={{
                background: 'color-mix(in srgb, var(--terracotta) 8%, white)',
                border: '1px dashed var(--terracotta)',
              }}
            >
              <span className="text-[10px] font-bold text-terracotta">
                친구 코드
              </span>
              <span
                className="font-mono font-black tabular-nums"
                style={{
                  fontSize: 14,
                  color: 'var(--ink)',
                  letterSpacing: '0.08em',
                }}
              >
                {referralCode}
              </span>
              <span className="text-[10px] text-muted ml-auto">
                가입 시 3,000P
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 메시지 편집 */}
      <section className="px-5 mt-5">
        <div className="text-[10.5px] font-bold text-muted uppercase tracking-widest mb-2">
          메시지 편집
        </div>
        <div className="bg-bg-3 rounded border border-rule px-4 py-3">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 60))}
            maxLength={60}
            placeholder="우리 아이에 대한 한마디"
            className="w-full text-[13px] text-text placeholder:text-muted/60 focus:outline-none"
          />
          <div className="text-right text-[10px] text-muted mt-1">
            {message.length}/60
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {DEFAULT_MESSAGE_TEMPLATES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setMessage(t)}
              className="px-3 py-1.5 rounded-full text-[11px] text-text bg-bg-2 border border-rule hover:border-text transition"
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      {/* 큰 공유 CTA */}
      <section className="px-5 mt-5">
        <button
          type="button"
          onClick={share}
          className="w-full inline-flex items-center justify-center gap-2 py-4 rounded-full text-[14px] font-black active:scale-[0.98] transition shadow-lg"
          style={{
            background: '#FEE500', // KakaoTalk yellow
            color: '#191600',
            boxShadow: '0 8px 24px rgba(254,229,0,0.35)',
          }}
        >
          <MessageCircle className="w-4 h-4" strokeWidth={2.5} />
          카카오톡 / 메시지로 공유
        </button>
        <p className="text-[10px] text-muted text-center mt-2">
          공유 버튼이 작동 안 하는 환경에선 자동으로 클립보드 복사
        </p>
      </section>

      {/* 보조 — 링크 / 코드 따로 복사 */}
      <section className="px-5 mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => copy(shareUrl, 'link')}
          className="flex items-center justify-center gap-1.5 py-2.5 rounded border border-rule bg-bg-3 text-[12px] font-bold text-text hover:border-text transition"
        >
          {copied === 'link' ? (
            <>
              <Check className="w-3.5 h-3.5 text-moss" strokeWidth={2.5} />
              복사됨
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" strokeWidth={2} />
              링크만 복사
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => copy(referralCode, 'code')}
          className="flex items-center justify-center gap-1.5 py-2.5 rounded border border-rule bg-bg-3 text-[12px] font-bold text-text hover:border-text transition"
        >
          {copied === 'code' ? (
            <>
              <Check className="w-3.5 h-3.5 text-moss" strokeWidth={2.5} />
              복사됨
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" strokeWidth={2} />
              코드만 복사
            </>
          )}
        </button>
      </section>

      {/* 안내 */}
      <section className="px-5 mt-5">
        <div className="rounded bg-bg-2 px-4 py-3.5 text-[10.5px] text-text leading-relaxed">
          <p className="font-bold text-text mb-1.5 inline-flex items-center gap-1">
            <Share2 className="w-3 h-3" strokeWidth={2.5} />
            공유 효과
          </p>
          <ul className="space-y-1 text-text/80">
            <li>· 친구가 가입하고 코드 등록 시 둘 다 3,000P 받아요</li>
            <li>· 5명 / 10명 / 20명 달성마다 추가 보상</li>
            <li>· 강아지 사진은 OG 메타로만 노출 (체중·알러지 등 비공개)</li>
          </ul>
          <Link
            href="/mypage/referral"
            className="inline-flex items-center gap-1 mt-2 text-[10.5px] font-bold text-terracotta"
          >
            전체 추천 현황 보기 →
          </Link>
        </div>
      </section>
    </div>
  )
}
