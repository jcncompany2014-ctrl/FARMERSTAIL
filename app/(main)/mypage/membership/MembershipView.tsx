/**
 * MembershipView — /mypage/membership 의 그리는 부분 (2026-10-09 앱 새 디자인 'A 포스터', 시안 M05 · I12).
 *
 * 조회(profiles·dogs)와 로그인 확인은 page.tsx 가 그대로 하고, 여기는 받은 값으로 그리기만 한다 — 점검 화면
 * (/design-check/me)이 예시 값으로 같은 화면을 그리려고 뺐다(로직 변경 없음).
 *
 * 순서 = 도장판 → 내 혜택 → 전체 등급 → (나무면) 강아지 등록증 → 등급 규칙. 큰 등급 히어로 카드를 걷어내고
 * Stamp → My Benefits → All Tiers 순서로 한 것은 사장님 확정(2026-07-16) 그대로.
 * 말은 '스탬프' 대신 '도장'으로 통일(앱시안 결정 — 멤버십·등급 화면). 도장판 카드가 이 화면의 도장 그림자 한 곳.
 */

import Link from 'next/link'
import type { ComponentType } from 'react'
import { V3, V3Radius } from '@/lib/design/tokens'
import { cardProgressFloored, STAMP_CARD_SIZE, STAMP_REWARD_LABEL } from '@/lib/stamps'
import {
  TIERS,
  tierMeta,
  resolveTierKey,
  tierRank,
  stampsToFirstTier,
  type TierBenefit,
  type TierMeta,
} from '@/lib/tiers'
import { formatKstLongDate } from '@/lib/datetime-kst'
import {
  Chip,
  IconDisc,
  PlainTitle,
  RuleList,
  SCREEN_ROOT,
  STAMP_CARD,
  SectionTitle,
  StampGrid,
  TierSquare,
} from '@/components/v3/me/MeParts'
import {
  AwardIcon,
  BoxIcon,
  CheckIcon,
  ChevronRightIcon,
  CrownIcon,
  GiftIcon,
  HeartIcon,
  LeafIcon,
  LockIcon,
  PawFillIcon,
  TicketIcon,
  type MeIconProps,
} from '@/components/v3/me/MeIcons'

/** 혜택 그림 — 등급 정본(lib/tiers)의 Icon 키 → 이 묶음 선 그림. 시안에 있는 건 하트 하나라 나머지는 같은 굵기로. */
const ICON_MAP: Record<TierBenefit['Icon'], ComponentType<MeIconProps>> = {
  coins: TicketIcon,
  truck: BoxIcon,
  ticket: TicketIcon,
  crown: CrownIcon,
  gift: GiftIcon,
  sparkles: GiftIcon,
  cake: GiftIcon,
  leaf: LeafIcon,
  flower: LeafIcon,
  heart: HeartIcon,
  paw: HeartIcon,
  certificate: AwardIcon,
}

export type MembershipDog = {
  id: string
  name: string
  breed: string | null
  photo_url: string | null
}

export default function MembershipView({
  stampCount,
  tier,
  tierUpdatedAt,
  dogs,
}: {
  /** 살아 있는 도장 개수(profiles.stamp_count) — 도장판·진행률 계산용. */
  stampCount: number
  /** profiles.tier(ratcheted floor) — 등급 배지 정본. */
  tier: string | null | undefined
  tierUpdatedAt: string | null | undefined
  dogs: MembershipDog[]
}) {
  // 등급 배지 정본 = profiles.tier(ratcheted floor, 강등 없음 2026-07-22). resolveTierKey
  // 가 profiles.tier 와 살아있는 stamp_count 파생 중 높은 쪽을 취해 만료로 인한 오강등을 막는다.
  const meta = tierMeta(resolveTierKey(tier, stampCount))
  // 현재 판 — 등급이 잠근 완성 판(floor) 위로만 얹힌다(StampCard 와 같은 정본).
  const card = cardProgressFloored(stampCount, meta?.threshold ?? 0)
  const justCompleted = card.filled === 0 && card.completedCards > 0
  const a11y = justCompleted
    ? `도장판 ${card.completedCards}장 완성. ${STAMP_REWARD_LABEL}이 도착했어요.`
    : `도장 ${card.filled}개, ${STAMP_CARD_SIZE}개 중. ${card.remaining}개 더 모으면 ${STAMP_REWARD_LABEL}.`
  const first = TIERS[0]!

  return (
    <div style={SCREEN_ROOT}>
      {/* 도장판 — 등급의 기준이 도장 개수라 이 화면의 첫 칸. */}
      <section aria-labelledby="ms-stamp" style={{ padding: '24px 20px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SectionTitle id="ms-stamp" size={24}>
          도장판
        </SectionTitle>
        <div style={{ ...STAMP_CARD, display: 'flex', flexDirection: 'column', background: V3.cream, color: V3.ink }}>
          <div style={{ padding: '16px 16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ whiteSpace: 'nowrap' }}>
                <span className="ft-num" style={{ fontSize: 46, lineHeight: 1 }}>
                  {card.filled}
                </span>
                <span className="ft-num" style={{ fontSize: 24, color: V3.inkMute }}>
                  {' '}/ {STAMP_CARD_SIZE}
                </span>
              </span>
              {/* 판을 막 채웠으면(0칸 + 완성 1장 이상) 보상 도착을 먼저 말한다. */}
              <span style={{ fontSize: 15, fontWeight: 800, color: justCompleted ? V3.ink : V3.inkMute }}>
                {justCompleted ? `${STAMP_REWARD_LABEL} 도착!` : `${card.cardNumber}번째 판`}
              </span>
            </div>
            <StampGrid filled={card.filled} emptyBorder="#BDBDBD" size={STAMP_CARD_SIZE} label={a11y} />
          </div>
          <p
            style={{
              margin: 0,
              padding: '12px 16px 14px',
              borderTop: '1px solid rgba(20,20,20,0.10)',
              fontSize: 15,
              lineHeight: 1.55,
              color: V3.inkMute,
            }}
          >
            정기배송 결제 1번에 도장 하나가 찍혀요. {STAMP_CARD_SIZE}개를 모으면 {STAMP_REWARD_LABEL}을 드려요. 도장은 찍힌 날부터
            1년 동안 유효해요(등급은 내려가지 않아요).
          </p>
        </div>
      </section>

      {/* 현재 등급 혜택 */}
      <section aria-labelledby="ms-mine" style={{ padding: '36px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <SectionTitle id="ms-mine" size={24}>
          내 혜택
        </SectionTitle>
        {/* 등급이 없으면(도장 10개 미만) 혜택 목록 대신 유도 — 사장님 확정
            2026-07-16. 빈 목록을 보여주느니 "채우면 시작된다"고 말하는 게 낫다. */}
        {!meta ? (
          <div
            style={{
              marginTop: 12,
              padding: '18px 16px',
              borderRadius: V3Radius.sm,
              background: V3.soft,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <p style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>아직 혜택이 없어요</p>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: V3.inkSoft }}>
              도장 {first.threshold}개를 모으면 <strong style={{ fontWeight: 800, color: V3.ink }}>{first.label}</strong> 등급으로
              멤버십이 시작돼요.
              <br />
              <span style={{ fontWeight: 800, color: V3.ink }}>{stampsToFirstTier(stampCount)}개</span> 남았어요.
            </p>
          </div>
        ) : (
          <RuleList style={{ marginTop: 12 }}>
            {meta.benefits.map((b, i) => {
              const Icon = ICON_MAP[b.Icon]
              return (
                <div
                  key={`${meta.key}-${i}`}
                  style={{
                    padding: '16px 0',
                    borderBottom: `1px solid ${V3.rule}`,
                    display: 'grid',
                    gridTemplateColumns: '44px 1fr',
                    columnGap: 14,
                    alignItems: 'start',
                  }}
                >
                  <IconDisc>
                    <Icon size={20} color={V3.ink} />
                  </IconDisc>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 17, fontWeight: 800 }}>{b.label}</span>
                    <span style={{ fontSize: 15, lineHeight: 1.5, color: V3.inkMute }}>{b.detail}</span>
                  </span>
                </div>
              )
            })}
          </RuleList>
        )}
      </section>

      {/* 모든 등급 비교 */}
      <section aria-labelledby="ms-all" style={{ padding: '36px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <SectionTitle id="ms-all" size={24}>
          전체 등급
        </SectionTitle>
        <RuleList style={{ marginTop: 12 }}>
          {TIERS.map((t, i) => (
            <TierRow
              key={t.key}
              t={t}
              currentTier={meta?.key ?? null}
              toFirst={!meta && i === 0 ? stampsToFirstTier(stampCount) : null}
            />
          ))}
        </RuleList>
      </section>

      {/* 나무 등록증 입구 — 나무(mate) 등급 + 강아지 1마리 이상일 때만 */}
      {meta?.key === 'mate' && dogs.length > 0 && (
        <section aria-labelledby="ms-cert" style={{ padding: '36px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <SectionTitle id="ms-cert" size={24}>
            강아지 등록증
          </SectionTitle>
          <p style={{ margin: '8px 0 0', fontSize: 15, lineHeight: 1.55, color: V3.inkSoft }}>
            나무 등급에 오른 증표예요. 저장하거나 공유해 보세요.
          </p>
          <RuleList style={{ marginTop: 12 }}>
            {dogs.map((d) => (
              <Link
                key={d.id}
                href={`/mypage/certificate/${d.id}`}
                style={{
                  minHeight: 72,
                  padding: '12px 0',
                  boxSizing: 'border-box',
                  borderBottom: `1px solid ${V3.rule}`,
                  display: 'grid',
                  gridTemplateColumns: '48px 1fr auto',
                  columnGap: 14,
                  alignItems: 'center',
                  color: V3.ink,
                  textDecoration: 'none',
                }}
              >
                <span
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    overflow: 'hidden',
                    background: V3.soft,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {d.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <PawFillIcon size={24} color={V3.inkMute} />
                  )}
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  <span style={{ fontSize: 17, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.name}
                  </span>
                  {d.breed && (
                    <span style={{ fontSize: 14, color: V3.inkMute, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.breed}
                    </span>
                  )}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 15, fontWeight: 800 }}>
                  등록증 보기
                  <ChevronRightIcon size={18} strokeWidth={2.2} />
                </span>
              </Link>
            ))}
          </RuleList>
        </section>
      )}

      {/* 등급 산정 안내 */}
      <section
        aria-labelledby="ms-rule"
        style={{
          margin: '32px 20px 0',
          padding: 18,
          borderRadius: V3Radius.sm,
          background: V3.soft,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <PlainTitle id="ms-rule">등급은 이렇게 정해져요</PlainTitle>
        <Bullet>정기배송 결제 1번마다 도장 1개, 결제하면 바로 찍혀요</Bullet>
        <Bullet>결제 금액과 상관없어요. 아이 덩치가 아니라 함께한 횟수예요</Bullet>
        <Bullet>
          도장 {STAMP_CARD_SIZE}개마다 도장판 한 장이 채워지고 {STAMP_REWARD_LABEL}을 드려요
        </Bullet>
        <Bullet>
          <span>
            도장은 찍힌 날부터 1년 동안 유효해요. 지나면 지금 판의 칸만 비고,{' '}
            <strong style={{ fontWeight: 800 }}>등급은 내려가지 않아요</strong>
          </span>
        </Bullet>
        <Bullet>결제가 취소·환불되면 그 도장은 회수돼요</Bullet>
        {tierUpdatedAt ? (
          <span style={{ marginTop: 4, fontSize: 14, color: V3.inkMute }}>
            마지막 등급 업데이트: {formatKstLongDate(tierUpdatedAt)}
          </span>
        ) : !meta ? (
          <span style={{ marginTop: 4, fontSize: 14, color: V3.inkMute }}>아직 등급이 없어요</span>
        ) : null}
      </section>
    </div>
  )
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: 'flex', gap: 8, fontSize: 15, lineHeight: 1.55 }}>
      <span aria-hidden style={{ flexShrink: 0, width: 6, height: 6, marginTop: 9, background: V3.mustard }} />
      {children}
    </span>
  )
}

function TierRow({
  t,
  currentTier,
  toFirst,
}: {
  t: TierMeta
  /** 지금 등급(ratcheted floor). **null = 아직 등급 없음**(도장 10개 미만). */
  currentTier: string | null
  /** 등급 전일 때 첫 등급(씨앗) 줄에만 — 남은 도장 수(시안 I12 "7개 남음"). */
  toFirst: number | null
}) {
  // 달성 = 도달한 등급 이하 전부(강등 없음 2026-07-22). 만료로 stamp_count 가 줄어도
  // 이미 지난 등급은 '달성'으로 남는다 — 살아있는 개수 임계 비교가 아니라 등급 랭크 비교.
  const reached = tierRank(currentTier) >= tierRank(t.key)
  const isCurrent = currentTier === t.key
  const noTier = currentTier === null
  // 등급 전(시안 I12)엔 모든 줄을 같은 굵기로 — 잠금 표시 없이 첫 줄에만 남은 수.
  const dim = !noTier && !reached
  return (
    <div
      style={{
        minHeight: 72,
        padding: isCurrent ? 12 : '12px 0',
        margin: isCurrent ? '0 -12px' : 0,
        boxSizing: 'border-box',
        borderBottom: isCurrent ? 0 : `1px solid ${V3.rule}`,
        borderLeft: isCurrent ? `6px solid ${V3.mustard}` : 0,
        borderRadius: isCurrent ? V3Radius.sm : 0,
        background: isCurrent ? V3.soft : 'transparent',
        display: 'grid',
        gridTemplateColumns: '16px 1fr auto',
        columnGap: 14,
        alignItems: 'center',
      }}
    >
      <TierSquare color={t.bg} />
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18, fontWeight: dim ? 700 : 800, color: dim ? V3.inkSoft : V3.ink }}>{t.label}</span>
          {isCurrent && (
            <Chip height={24} fontSize={12}>
              지금 등급
            </Chip>
          )}
        </span>
        <span style={{ fontSize: 14, color: V3.inkMute }}>
          도장 {t.threshold}개 · {t.benefit}
        </span>
      </span>
      {/* '적립률' → '달성 여부' (2026-07-16 포인트 폐기). 우리 혜택은 자동할인
          이라 등급마다 보여줄 숫자가 적립률이 아니다. */}
      {noTier ? (
        <span style={{ fontSize: 15, fontWeight: 800, color: toFirst != null ? V3.ink : '#8A8A8A', whiteSpace: 'nowrap' }}>
          {toFirst != null ? `${toFirst}개 남음` : ''}
        </span>
      ) : reached ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 15, fontWeight: 800 }}>
          <CheckIcon size={18} strokeWidth={2.8} />
          달성
        </span>
      ) : (
        <span role="img" aria-label="아직" style={{ color: '#8A8A8A' }}>
          <LockIcon size={18} />
        </span>
      )}
    </div>
  )
}
