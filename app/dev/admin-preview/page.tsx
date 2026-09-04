import type { Metadata } from 'next'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import AdminShellNext from '@/components/adminui/admin-shell-next'
import { Badge } from '@/components/adminui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/adminui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/adminui/table'

/**
 * /dev/admin-preview — 어드민 개편 **시안 전용** 페이지 (2026-09-04 Phase 1).
 *
 * 실제 어드민은 로그인 가드 뒤라 시안을 보여줄 수 없어, 가드 밖에 가짜
 * 데이터로 새 셸을 렌더한다. 사장님 승인 후 Phase 2 에서 app/admin 에
 * 이식하고 이 페이지는 삭제한다.
 *
 * 처음엔 프로덕션 404 였으나 사장님이 폰으로 봐야 판단 가능해 공개로 전환
 * (2026-09-04). 실데이터 0·기능 0 인 순수 목업이라 노출 위험 없음. 색인만
 * 금지하고, 화면 상단 배너로 '시안·데모 데이터'를 명시한다.
 */
export const metadata: Metadata = {
  title: '어드민 개편 시안 (데모)',
  robots: { index: false, follow: false, nocache: true },
}

export default function AdminPreviewPage() {
  return (
    <div className="admin-scope min-h-screen bg-background font-sans text-foreground antialiased">
      <div className="bg-primary px-4 py-2 text-center text-[12.5px] font-bold text-primary-foreground">
        어드민 개편 시안 — 화면의 모든 수치는 데모 데이터입니다
      </div>
      <AdminShellNext userEmail="ian020529@gmail.com">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { t: '오늘 주문', v: '3건', d: '+2 어제 대비', up: true },
            { t: '발송 대기', v: '5박스', d: '화요일 마감 D-2', up: true },
            { t: '이번 주 매출', v: '₩487,600', d: '-4.1% 지난주 대비', up: false },
            { t: '활성 구독', v: '12', d: '+1 이번 주', up: true },
          ].map((s) => (
            <Card key={s.t} className="gap-2 py-4">
              <CardHeader className="px-4">
                <CardDescription>{s.t}</CardDescription>
                <CardTitle className="text-xl tabular-nums md:text-2xl">{s.v}</CardTitle>
              </CardHeader>
              <CardContent className="px-4">
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  {s.up ? (
                    <ArrowUpRight className="size-3.5 text-primary" />
                  ) : (
                    <ArrowDownRight className="size-3.5 text-destructive" />
                  )}
                  {s.d}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-base">최근 주문</CardTitle>
            <CardDescription>데모 데이터 — 실제 지표 아님</CardDescription>
          </CardHeader>
          <CardContent className="px-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>주문번호</TableHead>
                  <TableHead>고객</TableHead>
                  <TableHead>구성</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className="text-right">금액</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { no: 'FT-2609-0412', u: '김**', box: '소50 · 닭50 2주', st: '결제됨', tone: 'default' as const, amt: '₩93,600' },
                  { no: 'FT-2609-0411', u: '이**', box: '닭 단일 첫 박스', st: '발송 대기', tone: 'secondary' as const, amt: '₩79,560' },
                  { no: 'FT-2609-0410', u: '박**', box: '소50 · 오리50 2주', st: '부분환불', tone: 'destructive' as const, amt: '₩46,800' },
                  { no: 'FT-2609-0409', u: '최**', box: '소50 · 닭50 2주', st: '배송중', tone: 'outline' as const, amt: '₩93,600' },
                ].map((r) => (
                  <TableRow key={r.no}>
                    <TableCell className="font-medium tabular-nums">{r.no}</TableCell>
                    <TableCell>{r.u}</TableCell>
                    <TableCell className="text-muted-foreground">{r.box}</TableCell>
                    <TableCell>
                      <Badge variant={r.tone}>{r.st}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.amt}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </AdminShellNext>
    </div>
  )
}
