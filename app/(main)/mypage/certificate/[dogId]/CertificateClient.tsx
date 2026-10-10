'use client'

import Image from 'next/image'
import { useToast } from '@/components/ui/Toast'
import { captureNodeToCanvas, saveCanvasImage, SAVE_IMAGE_UNSUPPORTED_MESSAGE } from '@/lib/save-image'
import { petName, withHonorific } from '@/lib/korean'
import { TIERS } from '@/lib/tiers'
import { V3, V3Radius } from '@/lib/design/tokens'
import { SCREEN_ROOT, STAMP_CARD, TierSquare, outlineButton, primaryButton } from '@/components/v3/me/MeParts'
import { PawFillIcon, SaveIcon, ShareIcon } from '@/components/v3/me/MeIcons'

type Dog = {
  id: string
  name: string
  breed: string | null
  birth_date: string | null
  photo_url: string | null
  created_at: string | null
}

/** 나무(mate) 등급 정본 — 안내문의 도장 개수와 등록증 등급 색을 여기서 읽는다(lib/tiers). */
const MATE = TIERS.find((t) => t.key === 'mate')!

/**
 * 나무 등급 강아지 등록증 (클라이언트 — 이미지 저장 + 공유 액션).
 *
 * 저장 / 공유
 * ──────────
 * - "이미지 저장": html2canvas 로 PNG — 대용량 라이브러리라 동적 import 로 첫 진입엔 안 받음.
 *   앱에서도 동작하는 저장 정본(saveCanvasImage)으로 — 결과가 실제로 저장일 때만 "저장했어요".
 * - "공유": Web Share API + fallback (URL 복사).
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 시안 M06):
 *   · '인쇄·PDF' 버튼을 뺐다(앱시안 결정). 이 화면은 앱 전용인데 앱(WebView)에선 인쇄 창이 뜨지 않아, 예전
 *     버튼은 "앱에서는 인쇄가 안 돼요" 안내만 띄웠다(2026-09-25). 저장은 '이미지 저장'이 맡는다.
 *   · 아래 안내문의 옛 기준("누적 결제 300만원 이상")과 없는 약속("SNS 에 공유하면 다음 가족에게 선물")을
 *     등급 정본(lib/tiers — 나무 = 도장 50개)으로 고쳤다.
 *   · 영어 머리말("Farmer's Tail" · "Certificate of Companion" · "나무 · TREE")·명조 글꼴·이모지 자리를 뺐다.
 *     등록증 카드가 이 화면의 도장 그림자 한 곳 — 흰 바탕이라 저장 그림 바탕도 흰색으로.
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

  async function handleDownloadImage() {
    try {
      const el = document.getElementById('cert-card')
      if (!el) return
      // 그림 뜨기 정본(lib/save-image) — html2canvas 는 거기서 그때 불러온다(첫 진입 비용 없음). 직접 부르면 Tailwind 의
      // img block 때문에 그림 속 글자가 아래로 밀리고, 강아지 사진(저장소 주소)은 useCORS 가 없어 그림이 막힐 수 있었다.
      const canvas = await captureNodeToCanvas(el)
      // ★저장이 실제로 된 경우에만 성공이라고 말한다 (2026-09-25). 앱에서는 예전
      //   <a download> 가 아무 일도 안 했는데 "이미지를 저장했어요" 가 떴다.
      const result = await saveCanvasImage(canvas, `farmerstail-${dog.name}-${serial}.png`)
      if (result === 'downloaded') toast.success('이미지를 저장했어요')
      else if (result === 'unsupported') toast.info(SAVE_IMAGE_UNSUPPORTED_MESSAGE)
    } catch (err) {
      console.error('certificate download failed', err)
      // 2026-10-09: '인쇄 메뉴를 사용해 주세요' — 인쇄 버튼을 뺐으니 없는 메뉴를 가리키지 않는다.
      toast.error('이미지를 저장하지 못했어요. 잠시 후 다시 시도해 주세요')
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
    <div style={SCREEN_ROOT}>
      <section style={{ padding: '22px 20px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 28, lineHeight: 1.15 }}>{petName(dog.name)}의 등록증</h2>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: V3.inkSoft }}>
          나무 등급에 오른 증표예요. 저장하거나 공유해 보세요.
        </p>
      </section>

      {/* 등록증 본체 — 이미지 저장 대상 */}
      <section
        id="cert-card"
        aria-label="강아지 등록증"
        style={{
          ...STAMP_CARD,
          position: 'relative',
          margin: '20px 20px 0',
          padding: '28px 22px 22px',
          background: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        {/* 모서리 4개 */}
        {(['tl', 'tr', 'bl', 'br'] as const).map((pos) => (
          <span
            key={pos}
            aria-hidden
            style={{
              position: 'absolute',
              width: 14,
              height: 14,
              ...(pos === 'tl' && { top: 10, left: 10, borderTop: `2px solid ${V3.ink}`, borderLeft: `2px solid ${V3.ink}` }),
              ...(pos === 'tr' && { top: 10, right: 10, borderTop: `2px solid ${V3.ink}`, borderRight: `2px solid ${V3.ink}` }),
              ...(pos === 'bl' && { bottom: 10, left: 10, borderBottom: `2px solid ${V3.ink}`, borderLeft: `2px solid ${V3.ink}` }),
              ...(pos === 'br' && { bottom: 10, right: 10, borderBottom: `2px solid ${V3.ink}`, borderRight: `2px solid ${V3.ink}` }),
            }}
          />
        ))}

        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.3em', color: V3.inkSoft }}>파머스테일</span>
        <span className="ft-poster" style={{ marginTop: 6, fontSize: 26 }}>
          강아지 등록증
        </span>
        <span aria-hidden style={{ marginTop: 12, width: 60, height: 2, background: V3.mustard }} />

        <span
          style={{
            marginTop: 22,
            width: 110,
            height: 110,
            boxSizing: 'border-box',
            borderRadius: 55,
            border: `3px solid ${V3.ink}`,
            overflow: 'hidden',
            position: 'relative',
            background: V3.soft,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {dog.photo_url ? (
            <Image src={dog.photo_url} alt={`${dog.name} 사진`} fill sizes="110px" className="object-cover" unoptimized />
          ) : (
            <PawFillIcon size={44} color={V3.inkMute} />
          )}
        </span>
        <span className="ft-poster" style={{ marginTop: 14, fontSize: 36, lineHeight: 1 }}>
          {dog.name}
        </span>
        {dog.breed && <span style={{ marginTop: 6, fontSize: 15, color: V3.inkMute }}>{dog.breed}</span>}

        {/* 본문 — 인증 문구 */}
        <p
          style={{
            margin: '22px 0 0',
            alignSelf: 'stretch',
            padding: '16px 8px',
            borderTop: `1px solid ${V3.rule}`,
            borderBottom: `1px solid ${V3.rule}`,
            fontSize: 15,
            lineHeight: 1.7,
            color: V3.inkSoft,
          }}
        >
          위 강아지는
          <br />
          <strong style={{ fontWeight: 800, color: V3.ink }}>파머스테일 산지 가족</strong>의 구성원으로
          <br />그 정성과 한 끼를 함께해 왔음을 증명합니다.
        </p>

        {/* 메타 정보 — 2단 */}
        <dl
          style={{
            margin: '18px 0 0',
            alignSelf: 'stretch',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '14px 12px',
            textAlign: 'left',
          }}
        >
          <Row label="보호자" value={withHonorific(ownerName)} />
          <Row
            label="등급"
            value={
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <TierSquare color={MATE.bg} size={10} />
                {MATE.label}
              </span>
            }
          />
          <Row label="가입일" value={memberSinceLabel} />
          <Row label="발급일" value={issueDate} />
          <Row label="발급자" value="안성민 · 이준호" />
          <Row label="일련번호" value={serial} wide />
        </dl>

        {/* 산지 인장 */}
        <div
          style={{
            marginTop: 18,
            alignSelf: 'stretch',
            paddingTop: 12,
            borderTop: `1px solid ${V3.rule}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 13, color: '#8A8A8A', textAlign: 'left' }}>farmerstail.kr / {serial}</span>
          <Image
            src="/logo-stamp.png"
            alt="파머스테일 인장"
            width={60}
            height={60}
            loading="eager"
            style={{ width: 60, height: 60, objectFit: 'contain', transform: 'rotate(-8deg)', display: 'block', flexShrink: 0 }}
          />
        </div>
      </section>

      {/* 저장 · 공유 */}
      <div style={{ margin: '24px 20px 0', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        <button
          type="button"
          onClick={handleDownloadImage}
          style={{ ...primaryButton(68, 15), minHeight: 68, height: 'auto', flexDirection: 'column', gap: 4 }}
        >
          <SaveIcon size={22} />
          <span style={{ fontSize: 15, fontWeight: 800 }}>이미지 저장</span>
        </button>
        <button
          type="button"
          onClick={handleShare}
          style={{ ...outlineButton(68, 15), minHeight: 68, height: 'auto', flexDirection: 'column', gap: 4 }}
        >
          <ShareIcon size={22} />
          <span style={{ fontSize: 15, fontWeight: 800 }}>공유</span>
        </button>
      </div>

      <p
        style={{
          margin: '16px 20px 0',
          padding: '14px 16px',
          borderRadius: V3Radius.sm,
          background: V3.soft,
          fontSize: 15,
          lineHeight: 1.55,
          color: V3.inkSoft,
        }}
      >
        {MATE.label} 등급은 도장 {MATE.threshold}개를 모은 가족에게 드리는 가장 높은 등급이에요.
      </p>
    </div>
  )
}

function Row({ label, value, wide }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div style={wide ? { gridColumn: '1 / -1' } : undefined}>
      <dt style={{ fontSize: 13, fontWeight: 700, color: V3.inkMute }}>{label}</dt>
      <dd
        style={{
          margin: '2px 0 0',
          fontSize: 16,
          fontWeight: 800,
          color: V3.ink,
          ...(wide ? { letterSpacing: '0.02em', whiteSpace: 'nowrap' } : { wordBreak: 'keep-all' }),
        }}
      >
        {value}
      </dd>
    </div>
  )
}
