// 제품 뒷면 QR 레시피 상세(/recipe/[protein]) 전용 마케팅 데이터.
//
// 출처: 화식 마스터 레시피 v3.0 페르소나(모찌·코코·토토·바람이) + 마케팅 메시지.
// lib/web-recipes(공개 최소 수준)를 확장하되, 여기 카피는 **임의 초안** —
// 사장님이 검토 후 우리 제품에 안 맞는 부분은 빼고 필요한 건 추가한다.
// ★영업비밀(배합%·프리믹스 CAS·원가) 미포함. 효능 단정·질병 치료 표현 금지
// (식품 표시광고 가드) — "케어/도움/설계" 톤 유지.

import type { WebRecipe } from './web-recipes'

export type RecipeHero = {
  /** 제품 표기명 — 검정증명서 명칭과 정합. */
  displayName: string
  /** 영문 캐릭터명(페르소나). */
  persona: string
  /** 히어로 eyebrow(영문 소형 라벨). */
  eyebrow: string
  /** 히어로 헤드라인(2줄, <br/> 분리). */
  headline: [string, string]
  /** 히어로 서브카피. */
  lede: string
  /** 히어로 사진 경로(힉스필드 생성). */
  heroImg: string
  /** 이런 아이에게 — 페르소나 3개 태그. */
  forWho: string[]
  /** 핵심 원물 3종 (이름 + 한 줄 역할). */
  keyIngredients: { name: string; role: string }[]
  /** "왜 이 레시피" 3포인트 (제목 + 설명). */
  points: { title: string; body: string }[]
}

export const RECIPE_DETAIL: Record<WebRecipe['protein'], RecipeHero> = {
  chicken: {
    displayName: '치킨 레시피',
    persona: 'Mochi',
    eyebrow: 'Chicken · 체중관리',
    headline: ['가볍게 먹어도', '영양은 가득하게'],
    lede:
      '활동량이 적어 살이 쉽게 찌는 아이를 위한 저지방·고단백 데일리 레시피예요. 닭가슴살의 가장 담백한 부위에 강황을 더해, 매일 먹어도 부담 없는 균형 잡힌 한 끼로 설계했어요.',
    heroImg: '/recipe-chicken.jpg',
    forWho: ['실내·소형견', '체중 관리가 필요한 아이', '순한 첫 화식을 찾는 아이'],
    keyIngredients: [
      { name: '닭가슴살', role: '저지방 고단백 — 담백한 데일리 단백질' },
      { name: '강황', role: '커큐민 — 관절·노화 케어를 돕는 컨셉 토핑' },
      { name: '심장', role: '자연 타우린 — 심장 건강을 위한 아미노산' },
    ],
    points: [
      { title: '가장 담백한 부위', body: '닭의 가장 기름기 적은 가슴살 위주로, 살찌지 않으면서 단백질은 충분하게 채웠어요.' },
      { title: '전 필수 아미노산 균형', body: '자연 원물만으로 성견 유지에 필요한 아미노산을 고르게 담았어요.' },
      { title: '4종 중 가장 낮은 열량대', body: '활동량 적은 아이의 하루 칼로리에 맞춰 가볍게 설계했어요.' },
    ],
  },
  duck: {
    displayName: '오리 레시피',
    persona: 'Coco',
    eyebrow: 'Duck · 알러지·장 케어',
    headline: ['닭도 소도 안 맞는', '예민한 아이를 위해'],
    lede:
      '피부 가려움·잦은 묽은 변으로 사료를 바꿔봐도 잘 안 맞던 민감한 아이를 위한 단일 단백질 레시피예요. 닭과 소를 완전히 배제하고, 사과 펙틴으로 장 환경까지 함께 살폈어요.',
    heroImg: '/recipe-duck.jpg',
    forWho: ['닭·소 알러지 의심 아이', '피부·장이 예민한 아이', '단일 단백질이 필요한 아이'],
    keyIngredients: [
      { name: '오리 안심', role: '닭·소 배제한 단일 단백질 — 알러지 케어' },
      { name: '사과(펙틴)', role: '장내 환경을 부드럽게 돕는 컨셉 토핑' },
      { name: '오리 간', role: '철·구리 풍부 — 순한 단백질에 영양 보완' },
    ],
    points: [
      { title: '완전한 단일 단백질', body: '닭·소를 한 톨도 넣지 않아, 흔한 알러지원을 피해야 하는 아이에게 안전한 선택이에요.' },
      { title: '장을 함께 살피는 설계', body: '사과 펙틴으로 장내 환경을 부드럽게 — 예민한 아이의 매일을 편안하게.' },
      { title: '순하지만 영양은 그대로', body: '오리 간의 철·구리로, 담백한 단백질에도 영양이 빠지지 않게 채웠어요.' },
    ],
  },
  pork: {
    displayName: '흑돼지 레시피',
    persona: 'Toto',
    eyebrow: 'Pork · 기호성·신경 케어',
    headline: ['입 짧은 아이도', '한 그릇 뚝딱'],
    lede:
      '사료를 자주 거부하고 사람 음식만 찾는 까다로운 입맛, 그리고 나이 든 아이를 위한 기호성 레시피예요. 풍미 좋은 흑돼지 안심에 소화를 돕는 무를 더했어요.',
    heroImg: '/recipe-pork.jpg',
    forWho: ['입맛 까다로운 아이', '7세 이상 노령기 아이', '소화가 약한 아이'],
    keyIngredients: [
      { name: '흑돼지 안심', role: '풍미 좋은 저지방 부위 — 기호성' },
      { name: '무(디아스타제)', role: '소화 효소 — 위장이 약한 노견을 위한 토핑' },
      { name: '심장', role: '자연 타우린 — 나이 든 아이의 심장 케어' },
    ],
    points: [
      { title: '거부하기 힘든 풍미', body: '돼지 안심 특유의 진한 풍미로, 사료를 밀어내던 까다로운 입맛도 사로잡아요.' },
      { title: '4종 중 신경 케어 최강', body: '돼지 안심에 자연 함유된 비타민 B1(티아민)이 4종 레시피 중 가장 풍부해요.' },
      { title: '노견의 소화를 배려', body: '무의 소화 효소로 위장 부담을 덜어, 나이 든 아이가 편하게 먹을 수 있게 했어요.' },
    ],
  },
  beef: {
    displayName: '한우 레시피',
    persona: 'Barami',
    eyebrow: 'Hanwoo · 활력·프리미엄',
    headline: ['많이 뛰는 아이에게', '가장 좋은 한우 한 끼'],
    lede:
      '매일 산책하고 주말이면 함께 달리는, 활동량 많은 아이를 위한 프리미엄 레시피예요. 무항생제 한우 목심의 헴철과 비타민 B12로 활력을 채우고, 블루베리로 운동 뒤 회복까지 살폈어요.',
    heroImg: '/recipe-beef.jpg',
    forWho: ['활동량 많은 중대형견', '함께 운동하는 아이', '프리미엄을 찾는 보호자'],
    keyIngredients: [
      { name: '무항생제 한우 목심', role: '헴철·B12 — 산소 운반과 활력' },
      { name: '블루베리', role: '안토시아닌 — 운동 뒤 항산화 회복' },
      { name: '심장', role: '타우린·CoQ10 — 활동견의 심장 케어' },
    ],
    points: [
      { title: '내가 먹는 한우, 내 아이에게도', body: '무항생제 한우 목심으로, 활동량 많은 아이의 하루를 프리미엄 단백질로 채웠어요.' },
      { title: '활력의 핵심, 헴철', body: '한우의 헴철과 비타민 B12가 산소 운반과 신경 전달을 도와 활력을 뒷받침해요.' },
      { title: '달린 만큼 회복하게', body: '블루베리의 항산화 성분으로, 많이 움직인 날의 회복까지 함께 살폈어요.' },
    ],
  },
}
