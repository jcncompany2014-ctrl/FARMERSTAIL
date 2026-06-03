/**
 * Farmer's Tail — 대시보드 "오늘 할 일" 결정 로직.
 *
 * 사용자가 매일 들렀을 때 "지금 뭐 해야 하지?" 한 줄 답을 주기 위한 단일
 * action 카드. 우선순위 기반 결정 함수 — 가장 높은 우선순위 1개만 노출.
 *
 * # 우선순위 (높은 것부터)
 *  1) onboarding   — 강아지 미등록  → 강아지 등록하기
 *  2) analyze      — 분석 미실행    → 무료 분석 받기
 *  3) approve      — 처방 승인 대기 → 처방 확인 + 승인
 *  4) checkin      — 첫 박스 7일+ & 미응답 → 첫 체크인 (리텐션 핵심)
 *  5) weigh-in     — 체중 14d+ 미기록 → 체중 기록
 *  6) delivery     — 활성 정기배송 D-3 이내 → 도착 예정 안내
 *  7) subscribe    — 처방 승인 후 정기배송 미신청 → 정기배송 신청
 *  8) null         — 모든 게 정상 (NextActionCard 안 그림)
 *
 * # 디자인
 * - tone: 우선순위 4-6 은 부드러운 톤 (gold / moss). 1-2 는 강한 톤 (terracotta).
 *   "오늘 꼭 해야 한다" vs "이렇게 하면 좋아요" 의 시각적 위계.
 * - href: 한 번 클릭으로 액션 진입.
 * - dismissible: false — "오늘 할 일" 은 닫기 버튼 없음. 처리하면 사라짐.
 *
 * # 입력
 * dashboard server component 가 user-scoped 쿼리 결과를 합쳐서 한 객체로 전달.
 * pure 함수라 unit test 가능 (server I/O 없음).
 */

export type NextActionInput = {
  hasDogs: boolean
  /** 강아지 1+, but 분석 0 인 가장 오래된 강아지. */
  unanalyzedDog?: { id: string; name: string } | null
  /** approval_status='pending_approval' 인 가장 오래된 처방. */
  pendingFormula?: {
    dogId: string
    dogName: string
    formulaId: string
  } | null
  /** weight_logs 가 14일+ 미기록인 가장 오래된 강아지. */
  staleWeightDog?: {
    id: string
    name: string
    daysSinceLastWeight: number | null
  } | null
  /** 활성 구독 + next_delivery_date 가 3일 이내. */
  upcomingDelivery?: {
    daysUntil: number
    productLabel: string
  } | null
  /** 분석은 받았는데 정기배송 0 인 강아지 (선택). */
  noSubDogId?: string | null
  /** 첫 박스 baseline(first_order) 7일+ 경과 & 첫 체크인 미응답 강아지. */
  firstCheckinDog?: { id: string; name: string } | null
}

export type NextAction =
  | {
      type: 'onboarding'
      title: string
      subtitle: string
      cta: string
      href: string
      tone: 'terracotta'
    }
  | {
      type: 'analyze'
      title: string
      subtitle: string
      cta: string
      href: string
      tone: 'terracotta'
    }
  | {
      type: 'approve'
      title: string
      subtitle: string
      cta: string
      href: string
      tone: 'gold'
    }
  | {
      type: 'checkin'
      title: string
      subtitle: string
      cta: string
      href: string
      tone: 'moss'
    }
  | {
      type: 'weigh-in'
      title: string
      subtitle: string
      cta: string
      href: string
      tone: 'moss'
    }
  | {
      type: 'delivery'
      title: string
      subtitle: string
      cta: string
      href: string
      tone: 'moss'
    }
  | {
      type: 'subscribe'
      title: string
      subtitle: string
      cta: string
      href: string
      tone: 'gold'
    }

export function computeNextAction(input: NextActionInput): NextAction | null {
  // 1) 강아지 등록 — 가장 강한 우선순위. 다른 모든 데이터는 강아지가 있어야 의미.
  if (!input.hasDogs) {
    return {
      type: 'onboarding',
      title: '먼저 강아지를 등록해주세요',
      subtitle: '체중·BCS·식이 정보로 맞춤 영양 분석을 무료로 보내드려요',
      cta: '강아지 등록하기',
      href: '/dogs/new',
      tone: 'terracotta',
    }
  }

  // 2) 분석 미실행 강아지가 있으면 분석 우선 권장.
  if (input.unanalyzedDog) {
    return {
      type: 'analyze',
      title: `${input.unanalyzedDog.name}의 맞춤 분석`,
      subtitle: '5분 설문으로 NRC2006 기반 정밀 영양 처방 — 무료',
      cta: '분석 시작',
      href: `/dogs/${input.unanalyzedDog.id}/survey`,
      tone: 'terracotta',
    }
  }

  // 3) 처방 승인 대기 — pending_approval 상태. 사용자 한 번 검토 후 active 로 적용.
  if (input.pendingFormula) {
    return {
      type: 'approve',
      title: `${input.pendingFormula.dogName}의 새 처방 도착`,
      subtitle: '확인하시고 적용하시면 다음 배송분부터 반영돼요',
      cta: '처방 확인하기',
      href: `/dogs/${input.pendingFormula.dogId}/approve?formulaId=${input.pendingFormula.formulaId}`,
      tone: 'gold',
    }
  }

  // 4) 첫 박스 체크인 — baseline(first_order) 7일+ 경과 & 미응답. 첫 박스
  //    경험 만족도가 재구독을 좌우하는 리텐션 핵심 순간. push 외에 대시보드
  //    "오늘 할 일" 로도 한 번 더 surface. 부드러운 톤(moss) + 100P 유인.
  if (input.firstCheckinDog) {
    return {
      type: 'checkin',
      title: `${input.firstCheckinDog.name} 첫 박스 한 주, 어땠나요?`,
      subtitle: '30초 체크인하고 100P 받으세요 — 다음 처방에도 반영돼요',
      cta: '체크인하기',
      href: `/dogs/${input.firstCheckinDog.id}/first-checkin`,
      tone: 'moss',
    }
  }

  // 5) 체중 미기록 — 14일 이상. 정기배송 진행 중인 강아지일수록 체중 변화가
  //    급여량 산정에 직접 영향. 부드러운 톤 (의무감 X) 으로 유도.
  if (input.staleWeightDog) {
    const days = input.staleWeightDog.daysSinceLastWeight
    const subtitle = days
      ? `${days}일째 미기록 — 1분이면 충분해요`
      : '아직 체중 기록이 없어요. 1분이면 충분해요'
    return {
      type: 'weigh-in',
      title: `${input.staleWeightDog.name} 체중 기록`,
      subtitle,
      cta: '체중 입력',
      // ?weight=open 으로 강아지 page 의 체중 모달 자동 open.
      href: `/dogs/${input.staleWeightDog.id}?weight=open`,
      tone: 'moss',
    }
  }

  // 5) 정기배송 D-day 임박. D-3 이내만 카드로 강조.
  if (input.upcomingDelivery && input.upcomingDelivery.daysUntil <= 3) {
    const days = input.upcomingDelivery.daysUntil
    const title =
      days <= 0
        ? '오늘 정기배송 도착'
        : days === 1
          ? '내일 정기배송 도착'
          : `D-${days} · 정기배송`
    return {
      type: 'delivery',
      title,
      subtitle: input.upcomingDelivery.productLabel,
      cta: '구독 관리',
      href: '/mypage/subscriptions',
      tone: 'moss',
    }
  }

  // 6) 분석 받았는데 정기배송 미신청 — 가벼운 권유. tone gold.
  if (input.noSubDogId) {
    return {
      type: 'subscribe',
      title: '정기배송으로 받아보세요',
      subtitle: '맞춤 처방을 매주/4주마다 자동으로 보내드려요',
      cta: '정기배송 신청',
      href: `/dogs/${input.noSubDogId}/order`,
      tone: 'gold',
    }
  }

  return null
}
