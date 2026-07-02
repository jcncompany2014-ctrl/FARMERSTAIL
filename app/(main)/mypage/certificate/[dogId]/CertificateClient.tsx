'use client'

import Image from 'next/image'
import { Award, Printer, Download, Share2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

type Dog = {
  id: string
  name: string
  breed: string | null
  birth_date: string | null
  photo_url: string | null
  created_at: string | null
}

/**
 * 단짝 등급 강아지 등록증 (클라이언트 — 인쇄 + 공유 액션).
 *
 * 인쇄 / 저장
 * ──────────
 * - "인쇄 / PDF 저장": window.print() — 브라우저 print dialog 에서
 *   "PDF로 저장" 선택 가능 (iOS Safari / Chrome 모두 지원).
 * - "이미지 저장": html2canvas 로 PNG 다운로드 — 대용량 라이브러리라
 *   동적 import 로 첫 진입엔 안 받음.
 * - "공유": Web Share API + fallback (URL 복사).
 */
export default function CertificateClient({
  dog,
  ownerName,
  memberSince,
}: {
  dog: Dog
  ownerName: string
  memberSince: string | null
}) {
  const toast = useToast()

  // 일련번호 — dogId 의 첫 8자리 hex (UUID 의 첫 segment) 대문자 + 연도.
  // 결정론적이라 같은 등록증 = 같은 번호. 위조 검증용.
  const year = memberSince
    ? new Date(memberSince).getFullYear()
    : new Date().getFullYear()
  const serial = `FT-${year}-${dog.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`

  const issueDate = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const memberSinceLabel = memberSince
    ? new Date(memberSince).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '-'

  function handlePrint() {
    window.print()
  }

  async function handleDownloadImage() {
    try {
      const el = document.getElementById('cert-card')
      if (!el) return
      // html2canvas — dynamic import. lib 큼지만 첫 진입 cost 없음.
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(el, {
        backgroundColor: '#F5F0E6',
        scale: 2, // 고해상도 — 인쇄 / 공유 품질
      })
      const dataUrl = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `farmerstail-${dog.name}-${serial}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      toast.success('이미지를 저장했어요')
    } catch (err) {
      console.error('certificate download failed', err)
      toast.error('이미지를 저장하지 못했어요. 인쇄 메뉴를 사용해 주세요')
    }
  }

  async function handleShare() {
    const shareUrl = window.location.href
    const shareText = `${dog.name} · 파머스테일 등록증 (나무 등급)`
    if (navigator.share) {
      try {
        await navigator.share({ title: shareText, url: shareUrl })
      } catch {
        /* user cancelled */
      }
      return
    }
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('링크를 복사했어요')
    } catch {
      toast.error('공유하지 못했어요')
    }
  }

  return (
    <div className="pb-12 print:pb-0">
      {/* 상단 — 인쇄 시 숨김 */}
      <section className="px-5 pt-6 pb-3 print:hidden">
        <div className="mt-3">
          <span className="kicker">Certificate</span>
          <h1
            className="font-sans mt-1.5"
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
            }}
          >
            {dog.name}의 등록증
          </h1>
          <p className="text-[12px] text-muted mt-1.5 leading-relaxed">
            나무 등급 도달의 증표. 저장하거나 공유해 보세요.
          </p>
        </div>
      </section>

      {/* 등록증 본체 — 인쇄 / 이미지 저장 대상 */}
      <section className="px-5 print:px-0">
        <div
          id="cert-card"
          className="relative mx-auto"
          style={{
            maxWidth: 520,
            background: 'var(--paper-hi)',
            border: '2px solid #2A2118',
            borderRadius: 12,
            padding: '32px 28px 36px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* 모서리 4개 — 빈티지 ornament */}
          {(['tl', 'tr', 'bl', 'br'] as const).map((pos) => (
            <span
              key={pos}
              aria-hidden
              style={{
                position: 'absolute',
                width: 14,
                height: 14,
                ...(pos === 'tl' && {
                  top: 10,
                  left: 10,
                  borderTop: '2px solid var(--accent-deep)',
                  borderLeft: '2px solid var(--accent-deep)',
                }),
                ...(pos === 'tr' && {
                  top: 10,
                  right: 10,
                  borderTop: '2px solid var(--accent-deep)',
                  borderRight: '2px solid var(--accent-deep)',
                }),
                ...(pos === 'bl' && {
                  bottom: 10,
                  left: 10,
                  borderBottom: '2px solid var(--accent-deep)',
                  borderLeft: '2px solid var(--accent-deep)',
                }),
                ...(pos === 'br' && {
                  bottom: 10,
                  right: 10,
                  borderBottom: '2px solid var(--accent-deep)',
                  borderRight: '2px solid var(--accent-deep)',
                }),
              }}
            />
          ))}

          {/* Header — magazine masthead */}
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontFamily: "'Archivo Black', Arial, sans-serif",
                fontSize: 10.5,
                letterSpacing: '0.32em',
                wordSpacing: '-0.12em',
                color: 'var(--accent-deep)',
                textTransform: 'uppercase',
              }}
            >
              Farmer&apos;s Tail · 파머스테일
            </div>
            <div
              style={{
                marginTop: 6,
                fontFamily: 'serif',
                fontSize: 22,
                fontWeight: 900,
                color: 'var(--ink)',
                letterSpacing: '-0.02em',
              }}
            >
              강아지 등록증
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 10.5,
                color: 'var(--ink-mute)',
                fontStyle: 'italic',
              }}
            >
              Certificate of Companion
            </div>
            <div
              style={{
                marginTop: 12,
                width: 60,
                height: 1.5,
                background: 'var(--accent-deep)',
                margin: '12px auto 0',
              }}
            />
          </div>

          {/* 사진 + 이름 */}
          <div style={{ textAlign: 'center', marginTop: 22 }}>
            <div
              style={{
                width: 110,
                height: 110,
                margin: '0 auto',
                borderRadius: '50%',
                overflow: 'hidden',
                background: '#EDE6D8',
                border: '3px solid #2A2118',
                position: 'relative',
              }}
            >
              {dog.photo_url ? (
                <Image
                  src={dog.photo_url}
                  alt={dog.name}
                  fill
                  sizes="110px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 36,
                  }}
                >
                  🐾
                </div>
              )}
            </div>
            <div
              style={{
                marginTop: 14,
                fontFamily: 'serif',
                fontSize: 30,
                fontWeight: 900,
                color: 'var(--ink)',
                letterSpacing: '-0.025em',
              }}
            >
              {dog.name}
            </div>
            {dog.breed && (
              <div
                style={{
                  marginTop: 2,
                  fontSize: 12,
                  color: 'var(--ink-mute)',
                }}
              >
                {dog.breed}
              </div>
            )}
          </div>

          {/* 본문 — 인증 문구 */}
          <div
            style={{
              marginTop: 24,
              padding: '16px 14px',
              background: 'rgba(255,255,255,0.55)',
              borderTop: '1px solid #D7CFBC',
              borderBottom: '1px solid #D7CFBC',
              textAlign: 'center',
              fontSize: 12,
              lineHeight: 1.7,
              color: '#2A2118',
            }}
          >
            위 강아지는
            <br />
            <strong style={{ color: 'var(--accent-deep)' }}>파머스테일 산지 가족</strong>의
            구성원으로
            <br />그 정성과 한 끼를 함께해 왔음을 증명합니다.
          </div>

          {/* 메타 정보 — 2단 */}
          <div
            style={{
              marginTop: 18,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 14,
              fontSize: 10.5,
              color: '#3A3128',
            }}
          >
            <Row label="보호자" value={ownerName} />
            <Row label="등급" value="나무 · TREE" />
            <Row label="가입일" value={memberSinceLabel} />
            <Row label="발급일" value={issueDate} />
            <Row
              label="일련번호"
              value={serial}
              mono
            />
            <Row
              label="발급자"
              value="안성민 · 이준호"
            />
          </div>

          {/* 산지 인장 */}
          <div
            style={{
              marginTop: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: '1px solid #D7CFBC',
              paddingTop: 14,
            }}
          >
            <div
              style={{
                fontSize: 9.5,
                color: '#9C9282',
                letterSpacing: '0.05em',
              }}
            >
              farmerstail.kr / {serial}
            </div>
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: '50%',
                border: '2px solid var(--accent-deep)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 8,
                color: 'var(--accent-deep)',
                fontWeight: 800,
                lineHeight: 1.15,
                textAlign: 'center',
                letterSpacing: '0.05em',
              }}
            >
              FARMER&apos;S
              <br />
              SEAL
            </div>
          </div>
        </div>
      </section>

      {/* 액션 버튼 — 인쇄 시 숨김 */}
      <section className="px-5 mt-5 grid grid-cols-3 gap-2 print:hidden max-w-[520px] mx-auto">
        <button
          onClick={handlePrint}
          className="flex flex-col items-center gap-1 py-3 rounded border border-rule bg-bg-3 hover:border-text transition"
        >
          <Printer className="w-4 h-4" strokeWidth={2} />
          <span className="text-[10.5px] font-bold">인쇄·PDF</span>
        </button>
        <button
          onClick={handleDownloadImage}
          className="flex flex-col items-center gap-1 py-3 rounded bg-ink text-bg hover:opacity-95 transition"
        >
          <Download className="w-4 h-4" strokeWidth={2} />
          <span className="text-[10.5px] font-bold">이미지 저장</span>
        </button>
        <button
          onClick={handleShare}
          className="flex flex-col items-center gap-1 py-3 rounded border border-rule bg-bg-3 hover:border-text transition"
        >
          <Share2 className="w-4 h-4" strokeWidth={2} />
          <span className="text-[10.5px] font-bold">공유</span>
        </button>
      </section>

      <section className="px-5 mt-5 print:hidden max-w-[520px] mx-auto">
        <div
          className="flex items-start gap-2 px-4 py-3 rounded"
          style={{ background: 'var(--bg-2)' }}
        >
          <Award
            className="w-3.5 h-3.5 text-terracotta mt-0.5 shrink-0"
            strokeWidth={2}
          />
          <p className="text-[10.5px] text-text leading-relaxed">
            나무 등급은 누적 결제 300만원 이상 가족에게 발급되는 최상위 등급
            이에요. SNS 에 공유해 주시면 다음 나무 등급 가족에게 작은 선물이 갈 수
            있어요.
          </p>
        </div>
      </section>

      {/* 인쇄 전용 스타일 — print dialog 에서 카드만 보이게. */}
      <style jsx global>{`
        @media print {
          body {
            background: #fff !important;
          }
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  )
}

function Row({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 9,
          color: '#9C9282',
          letterSpacing: '0.18em',
          wordSpacing: '-0.12em',
          textTransform: 'uppercase',
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 2,
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--ink)',
          fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit',
          letterSpacing: mono ? '0.05em' : '-0.005em',
          wordBreak: 'break-all',
        }}
      >
        {value}
      </div>
    </div>
  )
}
