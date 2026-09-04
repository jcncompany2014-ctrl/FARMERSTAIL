import { notFound } from 'next/navigation'
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
 * ⚠️ 프로덕션에서는 404 — 데모 수치가 진짜 지표로 오인되면 안 된다.
 */
export default function AdminPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <div className="admin-scope min-h-screen bg-background font-sans text-foreground antialiased">
      <AdminShellNext userEmail="ian020529@gmail.com" crumb="대시보드">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {[
            { t: '오늘 주문', v: '3건', d: '+2 어제 대비', up: true },
            { t: '발송 대기', v: '5박스', d: '화요일 마감 D-2', up: true },
            { t: '이번 주 매출', v: '₩487,600', d: '-4.1% 지난주 대비', up: false },
            { t: '활성 구독', v: '12', d: '+1 이번 주', up: true },
          ].map((s) => (
            <Card key={s.t}>
              <CardHeader className="pb-2">
                <CardDescription>{s.t}</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{s.v}</CardTitle>
              </CardHeader>
              <CardContent>
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">최근 주문</CardTitle>
            <CardDescription>데모 데이터 — 실제 지표 아님</CardDescription>
          </CardHeader>
          <CardContent>
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
