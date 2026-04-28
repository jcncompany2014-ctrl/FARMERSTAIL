import Link from 'next/link'
import { MessageSquare, CheckCircle2, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import ProductQAForm from './ProductQAForm'

/**
 * ProductQA — PDP 의 상품 문의 섹션.
 *
 * - DB (`product_qna`) 에서 공개된 Q&A 를 가져와 리스트.
 * - 비공개 문의는 작성자 본인 + admin 에게만 보인다 (RLS 가 처리).
 * - 비로그인 → 로그인 유도 / 로그인 → 문의 작성 폼.
 *
 * 서버 컴포넌트 — 폼 자체는 client (`ProductQAForm`) 가 담당.
 */
export default async function ProductQA({
  productId,
  productSlug,
  isAuthed,
}: {
  productId: string
  productSlug: string
  isAuthed: boolean
}) {
  const supabase = await createClient()

  // RLS 가 (is_private=false OR auth.uid()=user_id OR admin) 만 노출.
  // anon 으로 호출하면 자동으로 공개 Q&A 만 떨어진다.
  const { data: qna } = await supabase
    .from('product_qna')
    .select('id, question, answer, answered_at, is_private, created_at, user_id')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(20)

  // 작성자 이름 (마스킹)
  const userIds = Array.from(
    new Set((qna ?? []).map((q) => q.user_id).filter(Boolean)),
  )
  const profileMap = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', userIds)
    for (const p of (profiles ?? []) as Array<{ id: string; name: string | null }>) {
      // "홍길동" → "홍**", "abc" → "a**"
      const name = p.name ?? ''
      const masked =
        name.length <= 1 ? name : name[0] + '*'.repeat(Math.max(1, name.length - 1))
      profileMap.set(p.id, masked || '익명')
    }
  }

  return (
    <section
      id="qna"
      className="ft-anchor-under-chrome px-5 md:px-6 mt-10 md:mt-14"
    >
      <div
        className="rounded-2xl px-5 py-6 md:px-8 md:py-10"
        style={{
          background: 'var(--bg-2)',
          boxShadow: 'inset 0 0 0 1px var(--rule)',
        }}
      >
        <div className="flex items-center justify-between mb-5 md:mb-7 gap-3">
          <span
            className="font-mono text-[10px] md:text-[11px] tracking-[0.22em] uppercase"
            style={{ color: 'var(--muted)' }}
          >
            Q&amp;A · 상품 문의 ({qna?.length ?? 0})
          </span>
          {!isAuthed && (
            <Link
              href={`/login?next=${encodeURIComponent(`/products/${productSlug}#qna`)}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] md:text-[12px] font-bold transition active:scale-[0.97]"
              style={{
                background: 'var(--ink)',
                color: 'var(--bg)',
                letterSpacing: '-0.01em',
              }}
            >
              <MessageSquare className="w-3 h-3 md:w-3.5 md:h-3.5" strokeWidth={2.25} />
              로그인 후 문의
            </Link>
          )}
        </div>

        {/* 문의 작성 폼 (로그인 사용자만) */}
        {isAuthed && (
          <ProductQAForm productId={productId} productSlug={productSlug} />
        )}

        {/* 리스트 */}
        {!qna || qna.length === 0 ? (
          <div className="flex flex-col items-center text-center py-6 md:py-10">
            <div
              className="w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center mb-3 md:mb-4"
              style={{ background: 'var(--bg)' }}
            >
              <MessageSquare
                className="w-5 h-5 md:w-6 md:h-6"
                strokeWidth={1.5}
                color="var(--muted)"
              />
            </div>
            <p
              className="font-serif text-[14px] md:text-[16px] font-black"
              style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
            >
              아직 등록된 문의가 없어요
            </p>
            <p
              className="mt-2 text-[11.5px] md:text-[13px] leading-relaxed max-w-sm"
              style={{ color: 'var(--muted)' }}
            >
              제품 / 정기배송 / 알레르기 등 궁금한 점이 있으면 언제든
              문의해 주세요. 평일 영업일 기준 24시간 내에 답변드려요.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {qna.map((q) => (
              <li
                key={q.id}
                className="rounded-xl px-4 py-4 md:px-5 md:py-5"
                style={{
                  background: 'var(--bg)',
                  boxShadow: 'inset 0 0 0 1px var(--rule-2)',
                }}
              >
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      q.answer
                        ? 'bg-moss text-white'
                        : 'text-gold border border-gold/30'
                    }`}
                    style={
                      q.answer ? undefined : { background: 'rgba(212,169,74,0.08)' }
                    }
                  >
                    {q.answer ? (
                      <>
                        <CheckCircle2 className="w-2.5 h-2.5" strokeWidth={2.5} />
                        답변 완료
                      </>
                    ) : (
                      '답변 대기'
                    )}
                  </span>
                  {q.is_private && (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--rule)', color: 'var(--muted)' }}
                    >
                      <Lock className="w-2.5 h-2.5" strokeWidth={2.5} />
                      비공개
                    </span>
                  )}
                  <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
                    {profileMap.get(q.user_id) ?? '익명'}
                  </span>
                  <span
                    className="text-[10px] font-mono"
                    style={{ color: 'var(--muted)' }}
                  >
                    {new Date(q.created_at).toLocaleDateString('ko-KR')}
                  </span>
                </div>

                <p
                  className="text-[13px] md:text-[14px] leading-relaxed"
                  style={{ color: 'var(--ink)' }}
                >
                  Q. {q.question}
                </p>

                {q.answer && (
                  <div
                    className="mt-3 px-3 py-3 rounded text-[12.5px] md:text-[13.5px] leading-relaxed"
                    style={{
                      background: 'var(--bg-2)',
                      color: 'var(--text)',
                      borderLeft: '2px solid var(--moss)',
                    }}
                  >
                    <span
                      className="font-bold text-[10.5px]"
                      style={{ color: 'var(--moss)' }}
                    >
                      A. FT 운영팀
                    </span>{' '}
                    <br />
                    {q.answer}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <div
          className="mt-5 pt-4 md:pt-5 text-[10.5px] md:text-[12px] leading-relaxed"
          style={{
            color: 'var(--muted)',
            borderTop: '1px solid var(--rule-2)',
          }}
        >
          * 배송 / 결제 / 환불 같은 일반 문의는{' '}
          <Link
            href="/business"
            className="font-bold underline underline-offset-2"
            style={{ color: 'var(--terracotta)' }}
          >
            고객센터
          </Link>
          로 더 빠르게 도와드려요.
        </div>
      </div>
    </section>
  )
}
