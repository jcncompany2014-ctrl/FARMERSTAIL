# 파머스테일 출시 E2E 테스트 시나리오

목적: **첫 실 고객 주문이 들어왔을 때 끊김 없이 받아낼 수 있는가** 검증.
모든 시나리오는 production 환경에서 본인 계정으로 직접 실행.

테스트 신용카드: Toss 대시보드 → 결제 → 테스트 키 환경에서만 사용. 운영
키로 전환된 후엔 **본인 카드로 1,000원 미만 상품 결제 → 즉시 취소**로 검증.

---

## 시나리오 A — 신규 가입 → 첫 결제 (해피 패스)

### A-1. 회원가입
| 단계 | 기대 결과 | 실패 시 |
|---|---|---|
| `/signup` 진입 | AuthHero kicker + 폼 노출 | layout/CSS 깨짐 → 빌드 로그 확인 |
| 모든 필드 입력 (만 14세 이상) | 제출 버튼 활성화 | birthYear validation 디버그 |
| 가입 완료 | `/dashboard` 리다이렉트, 환영 toast | Supabase Auth 로그 확인 |
| **환영 메일 수신 (1분 이내)** | Resend 로그에 'welcome' tag | API key, 도메인 인증 |
| 마이페이지 → 쿠폰 | 환영 쿠폰 자동 발급 | seed_welcome_birthday_coupons 마이그레이션 |

### A-2. 강아지 등록
| 단계 | 기대 결과 |
|---|---|
| `/dogs/new` → 폼 입력 | 자동저장 (새로고침해도 입력값 살아있음) |
| 사진 업로드 | 미리보기 → 저장 → 상세 페이지 |
| 자동 측정도구 업그레이드 | "정확한 도구로 바꿔주신 응원 포인트" toast |
| 점수 확인 | `/mypage/points` 에서 +500/+1,000P 적립 확인 |

### A-3. 설문 → 분석
| 단계 | 기대 결과 |
|---|---|
| `/dogs/{id}/survey` 진입 | 첫 step 노출 |
| 모든 step 완료 | "분석 중" 로딩 → `/dogs/{id}/analysis` |
| 분석 결과 | 매크로 합 100%, BCS chip, 만성질환 chip |
| **설문 응원 +1,000P** | 마이페이지 포인트 +1,000 |
| 두 번째 강아지 설문 | 또 +1,000P (연 5,000P 한도까지) |
| 6번째 설문 | "올해 한도 도달" 안내, +0P (audit 1-3 확인) |

### A-4. 카트 → 결제 (테스트 카드)
| 단계 | 기대 결과 |
|---|---|
| 상품 PDP → 장바구니 담기 | "담았어요" toast |
| `/cart` → "결제하기" | 체크아웃 페이지 |
| 자동 적용 쿠폰 | 환영 쿠폰 적용된 상태 |
| 포인트 사용 (100P 단위) | 차감 미리보기 정확 |
| 카드 결제 (Toss 테스트 카드 4330-2002-0000-0007) | 결제 성공 페이지 |
| **주문 확인 메일 (1분 이내)** | Resend 'order-placed' tag |
| **웹푸시 (등록한 경우)** | "결제가 끝났어요" |
| `/mypage/orders/{id}` | 결제 완료 상태 |
| 포인트 적립 | tier earnRate 적용 (씨앗 1%) |
| 사용한 쿠폰 | redemption 기록 + per_user_limit 적용 |

### A-5. 주문 취소 + 환불
| 단계 | 기대 결과 |
|---|---|
| 주문 상세 → "주문 취소" | 사유 입력 sheet |
| 취소 완료 | Toss cancelPayment 호출 → 환불 |
| **취소 알림 메일** | Resend 'order-cancelled' tag |
| 포인트 환원 | 사용한 포인트 +적립 | (`order_refund_credit`) |
| 적립 포인트 회수 | 적립된 포인트 -회수 (`order_refund_revoke`) |
| 쿠폰 used_count 감소 | `revokeCouponRedemption` |
| 재고 복원 | `restore_stock` RPC |

---

## 시나리오 B — 가상계좌 결제 (실 운영 빈도 30~40%)

### B-1. 가상계좌 발급
| 단계 | 기대 결과 |
|---|---|
| 결제 페이지 → 가상계좌 선택 | 현금영수증 옵션 노출 |
| 현금영수증 (휴대폰) 입력 | 010 검증, 11자리 |
| 결제 진행 | 가상계좌 발급 페이지 |
| **입금 대기 메일** | Resend 'virtual-account-waiting' |
| `/mypage/orders/{id}` | 입금 정보 카드 (은행/계좌/예금주/기한) |
| "복사" 버튼 | 계좌번호 클립보드 복사 |

### B-2. 입금 → paid 전환
| 단계 | 기대 결과 |
|---|---|
| Toss 대시보드에서 수동 "입금 확인" | 웹훅 발사 |
| 1분 이내 자동 동기 | order.payment_status='paid' |
| **결제 완료 메일** | (입금 시점에 발송) |
| 포인트 적립 | webhook 라우트에서 (audit 2-4 멱등성) |

### B-3. 입금 만료
| 단계 | 기대 결과 |
|---|---|
| 24시간 입금 안 함 | Toss 자동 EXPIRED 웹훅 |
| order.payment_status='failed' | 자동 전환 |
| 재고 복원 | `/api/cron/order-expire` |

---

## 시나리오 C — 정기배송

### C-1. 구독 등록
| 단계 | 기대 결과 |
|---|---|
| 정기구독 상품 PDP → "정기배송" | `/subscribe/{slug}` |
| 주기/수량 선택 | 카드 등록 (Toss 빌링) |
| 빌링 키 등록 성공 | `/subscribe/billing-success` |
| 구독 row 생성 | `subscriptions` 테이블 active |

### C-2. 자동 결제 (cron)
| 단계 | 기대 결과 |
|---|---|
| `next_delivery_date` 도달 | `/api/cron/subscription-charge` 7일 전 결제 |
| 결제 성공 | order 생성 + 메일 |
| 결제 실패 (카드만료) | `subscription-charge-failed` 메일 (permanent) |
| 결제 실패 (잔액부족) | transient 메일 + 24h 자동 재시도 |
| 3회 연속 실패 | 자동 paused + 알림 메일 |

---

## 시나리오 D — 어뷰징 시도 (보안 검증)

### D-1. 가격 위변조
| 시도 | 기대 결과 |
|---|---|
| Chrome DevTools 에서 orders.total_amount 강제 변경 | confirm 라우트에서 amount mismatch 400 |
| order_items unit_price 변경 (subtotal 불일치) | "상품 금액이 일치하지 않아요" 400 |
| points_earned 부풀려서 insert | confirm 시 등급 기준으로 자동 보정 |

### D-2. 적립 어뷰징
| 시도 | 기대 결과 |
|---|---|
| 설문 RPC 직접 호출 | 서버 cap 으로 6번째부터 +0P |
| 측정도구 5종 가짜 업그레이드 | 연 3,000P 한도 도달 후 +0 |
| photo-upload 토큰으로 100번 업로드 | 분당 6회 / 시간 30회 rate limit 429 |
| photo-request 토큰 무한 발급 | 분당 6회 rate limit 429 |

### D-3. 쿠폰 race
| 시도 | 기대 결과 |
|---|---|
| 같은 1회용 쿠폰을 2개 탭에서 동시 결제 | 두 번째는 RPC 에서 "이미 사용하신 쿠폰" |

### D-4. 결제 confirm 실패 시 자동 환불
| 시도 | 기대 결과 |
|---|---|
| Toss 승인 후 DB update 실패 (수동 시뮬레이션) | `cancelPayment` 즉시 호출 |
| cancel 도 실패 | `payment_refund_queue` row 추가 |
| 15분 후 cron `/api/cron/refund-retry` 호출 | 자동 재시도 → 성공 시 status='succeeded' |

---

## 시나리오 E — 모바일 PWA

### E-1. iOS 설치
- Safari 로 https://farmerstail.kr 접근
- 공유 → 홈 화면에 추가
- 아이콘 + 시작 페이지 (/dashboard) 확인
- 푸시 권한 요청 흐름

### E-2. Android 설치
- Chrome 로 접근 → install prompt
- 매니페스트 shortcuts (주문/정기배송/내아이들/장바구니) 동작
- back gesture / hardware back 버튼

### E-3. Capacitor 네이티브 (선택)
- Capacitor sync + 빌드 → 실기기 설치
- iOS push 토큰 등록 (`/api/push/native-register`)
- 결제 흐름이 in-app browser 에서 Toss 정상 동작

---

## 측정 지표 (출시 후 첫 7일)

| 지표 | 임계 |
|---|---|
| 결제 confirm 성공률 | ≥ 95% |
| 가상계좌 입금률 | 30% 이상이면 정상 |
| 메일 발송 성공률 (Resend) | ≥ 98% |
| Cron 실패율 | < 1% |
| Sentry 에러 율 (사용자당) | < 0.5% |
| 첫 페이지 LCP (모바일) | < 2.5s |
| Lighthouse PWA 점수 | ≥ 90 |
