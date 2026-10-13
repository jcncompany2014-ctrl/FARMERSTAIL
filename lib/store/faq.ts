/**
 * 웹 가게 자주 묻는 질문 — '웹에서 살 때'(2026-10-10 웹 리뉴얼). 숫자는 전부 정본(lib/store/shipping·catalog)에서.
 * DB faqs 는 앱 정기배송 기준(화요일 발송·배송비 포함·카드 자동결제)이라 웹 가게 질문을 여기 따로 둔다 —
 * /faq 웹 화면이 이걸 맨 위에, DB 질문은 '앱 정기배송' 아래로 묶어 보여 준다.
 * 금지어: 처방·전문용어·정확한 %·"언제든"·도착 요일 약속(고객 문구 규칙).
 */
import { FREE_SHIPPING_MIN, SHIPPING_FEE, returnShippingFeeFor } from './shipping.ts'
import { REFUND_RULE_HAEYO } from './refund-copy.ts'
import { ONE_KG_DISCOUNT_PCT, PACK_G, SIZE_PACKS, TRIAL_ITEM, TRIAL_PACK_G } from './catalog.ts'
import { SUBSCRIPTION_DISCOUNT_PCT } from '../pricing.ts'

const won = (n: number) => n.toLocaleString('ko-KR')

export const STORE_FAQ: { q: string; a: string }[] = [
  {
    q: '언제 보내 주나요?',
    a: '화요일과 목요일에 냉동으로 출고해요. 출고 전날 밤 12시까지 주문하면 그 출고일에 나가요. 출고하고 지역에 따라 하루나 이틀이면 받아요.',
  },
  {
    q: '배송비는 얼마예요?',
    a: `${won(SHIPPING_FEE)}원이에요. 상품 금액이 ${FREE_SHIPPING_MIN / 10_000}만 원 이상이면 무료예요.`,
  },
  {
    q: '어떤 용량이 있나요?',
    // 팩 무게는 상수로 — 단품은 PACK_G(100g) 팩, 체험팩은 TRIAL_PACK_G(50g) 팩이라 숫자를 손으로 적으면 둘이 섞인다(2026-10-13).
    a: `레시피마다 500g(${PACK_G}g 팩 ${SIZE_PACKS['500g']}개)과 1kg(${PACK_G}g 팩 ${SIZE_PACKS['1kg']}개)이 있어요. 1kg은 500g 두 봉보다 ${ONE_KG_DISCOUNT_PCT}% 싸요. 처음이라면 4종을 ${TRIAL_PACK_G}g씩 맛보는 체험팩(${won(TRIAL_ITEM.price)}원)도 있어요.`,
  },
  {
    q: '어떻게 결제해요?',
    a: '신용·체크카드와 간편결제로 결제해요. 결제는 토스페이먼츠가 처리하고, 카드 번호는 저장하지 않아요.',
  },
  {
    q: '회원이어야 살 수 있나요?',
    a: '네, 카카오로 1초 만에 가입하고 주문해요. 같은 계정이라 나중에 앱에서도 주문이 그대로 보여요.',
  },
  {
    q: '환불은 어떻게 돼요?',
    // 환불 조건 해요체 정본(사장님 2026-10-13) — 환불정책·약관의 합니다체 문장과 같은 뜻. 반품 배송비는 정본 returnShippingFeeFor.
    a: `${REFUND_RULE_HAEYO} 단순 변심 반품 배송비는 편도 ${won(returnShippingFeeFor(SHIPPING_FEE))}원이에요(${FREE_SHIPPING_MIN / 10_000}만 원 이상 무료배송으로 받았다면 왕복 ${won(returnShippingFeeFor(0))}원). 상품에 문제가 있으면 사진 한 장을 보내 주세요. 확인하고 다시 보내드리거나 환불해 드리고, 이때 배송비는 저희가 내요.`,
  },
  {
    q: '하루에 얼마나 줘야 하나요?',
    a: '상품 페이지 계산기에 몸무게와 주는 방법을 넣으면 하루 양과 며칠분인지 알려 드려요. 나이와 체형까지 본 양은 앱에서 알려 드려요.',
  },
  {
    q: '앱 정기배송과 뭐가 달라요?',
    a: `웹에서는 500g 한 봉씩 정가에 사요. 앱 정기배송은 몸무게에 맞춘 양을 2주마다 ${SUBSCRIPTION_DISCOUNT_PCT}% 낮은 가격으로 보내드려요.`,
  },
]
