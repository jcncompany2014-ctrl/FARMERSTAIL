'use client'

/**
 * 차세대 어드민 셸 (2026-09-04 어드민 개편 Phase 1 — shadcn/ui 기반).
 *
 * 현행 AdminShell 의 문제(실측): 39개 라우트 중 내비에 4개만 노출 — 나머지는
 * URL 직접 입력으로만 도달. 이 셸은 전 라우트를 업무 그룹으로 조직한다.
 *
 * ⚠️ 반드시 `.admin-scope` 래퍼 안에서만 사용 — shadcn 팔레트가 그 서브트리
 *   에서만 유효하다(globals.css 하단 참조). 웹/앱 화면에 import 금지.
 *
 * 현재는 /dev/admin-preview 데모에서만 사용. 사장님 승인 후 Phase 2 에서
 * app/admin/layout.tsx 의 AdminShell 을 이것으로 교체한다.
 */
import type { ReactNode } from 'react'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  Home,
  Package,
  ClipboardList,
  Repeat,
  CreditCard,
  RotateCcw,
  Wallet,
  Users,
  Inbox,
  BellRing,
  BarChart3,
  Medal,
  ShoppingBasket,
  FlaskConical,
  Wand2,
  Newspaper,
  HelpCircle,
  Ticket,
  LineChart,
  Filter,
  Grid3x3,
  Activity,
  Workflow,
  Handshake,
  Search,
  PawPrint,
  Lightbulb,
  Gauge,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/adminui/sidebar'
import { Separator } from '@/components/adminui/separator'
import { TooltipProvider } from '@/components/adminui/tooltip'
import { Avatar, AvatarFallback } from '@/components/adminui/avatar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/adminui/breadcrumb'

/** 내비에는 안 띄우지만 브레드크럼 라벨이 필요한 딥링크 화면. */
const CRUMB_ONLY: Array<{ href: string; label: string }> = [
  { href: '/admin/label', label: '라벨 인쇄' },
]

/** 실제 39개 라우트를 업무 그룹으로 — Phase 2 에서 이 표가 정본이 된다. */
const NAV_GROUPS = [
  {
    label: '운영',
    items: [
      { href: '/admin', label: '홈', icon: Home },
      { href: '/admin/orders', label: '주문', icon: Package },
      { href: '/admin/personalization/picking-list', label: '피킹 리스트', icon: ClipboardList },
      { href: '/admin/subscriptions', label: '구독', icon: Repeat },
      { href: '/admin/subscriptions/charges', label: '결제·청구', icon: CreditCard },
      { href: '/admin/refunds', label: '환불', icon: RotateCcw },
      { href: '/admin/finance', label: '재무', icon: Wallet },
    ],
  },
  {
    label: '고객',
    items: [
      { href: '/admin/users', label: '고객', icon: Users },
      { href: '/admin/cs-inbox', label: 'CS 인박스', icon: Inbox },
      { href: '/admin/push-campaigns', label: '푸시 캠페인', icon: BellRing },
      { href: '/admin/push-stats', label: '푸시 지표', icon: BarChart3 },
      { href: '/admin/loyalty', label: '스탬프·등급', icon: Medal },
    ],
  },
  {
    label: '상품·콘텐츠',
    items: [
      { href: '/admin/products', label: '상품', icon: ShoppingBasket },
      { href: '/admin/algorithm', label: '처방 알고리즘', icon: FlaskConical },
      { href: '/admin/personalization', label: '개인화', icon: Wand2 },
      { href: '/admin/blog', label: '매거진', icon: Newspaper },
      { href: '/admin/faqs', label: 'FAQ', icon: HelpCircle },
      { href: '/admin/promotions', label: '프로모션', icon: Ticket },
    ],
  },
  {
    label: '분석',
    items: [
      { href: '/admin/reports', label: '리포트', icon: LineChart },
      { href: '/admin/funnel', label: '퍼널', icon: Filter },
      { href: '/admin/cohort', label: '코호트', icon: Grid3x3 },
      { href: '/admin/beta-cohort', label: '베타 현황', icon: PawPrint },
      { href: '/admin/personalization-insights', label: '맞춤 분석 품질', icon: Gauge },
    ],
  },
  {
    label: '시스템',
    items: [
      { href: '/admin/cron-health', label: '크론 상태', icon: Activity },
      { href: '/admin/automation', label: '자동화', icon: Workflow },
      { href: '/admin/invention-flags', label: '발명 보호', icon: Lightbulb },
      { href: '/admin/partners', label: '파트너', icon: Handshake },
      { href: '/admin/search-all', label: '통합 검색', icon: Search },
    ],
  },
]

export default function AdminShellNext({
  userEmail,
  bell,
  defaultOpen = true,
  children,
}: {
  userEmail: string
  /** 실시간 주문 벨(서버 컴포넌트) — 헤더 우측 슬롯 */
  bell?: ReactNode
  /** 사이드바 접힘 유지 — layout 이 sidebar_state 쿠키를 읽어 넘긴다. */
  defaultOpen?: boolean
  children: ReactNode
}) {
  const pathname = usePathname()
  // 가장 긴 접두 매치가 활성 메뉴·브레드크럼 라벨의 정본.
  // ★'/admin'(홈)은 정확 일치만 (2026-09-06 수정) — 접두 매치를 허용하면
  //   모든 하위 경로에 걸려, 내비에 없는 라우트가 전부 '홈' 활성/크럼으로
  //   표시됐다(베타 현황·발명 보호 화면에서 실측).
  const flat = NAV_GROUPS.flatMap((g) => g.items)
  const current = flat
    .filter(
      (it) =>
        pathname === it.href ||
        (it.href !== '/admin' && pathname.startsWith(it.href + '/')),
    )
    .sort((a, b) => b.href.length - a.href.length)[0]
  // 내비에 안 띄우는 딥링크 화면의 크럼 라벨.
  const crumbOnly = CRUMB_ONLY.find(
    (it) => pathname === it.href || pathname.startsWith(it.href + '/'),
  )
  const activeHref = current?.href ?? '/admin'
  const crumb =
    pathname === '/admin'
      ? '대시보드'
      : (current?.label ?? crumbOnly?.label ?? '관리자')
  return (
    <TooltipProvider>
    <SidebarProvider defaultOpen={defaultOpen}>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          {/* 정본 로고 — 라이트 사이드바엔 mark(그린 워드마크), 아이콘 접힘
              상태엔 stamp(원형 도장). "이상한 FT" 지적(2026-09-04) 수정. */}
          <div className="flex h-12 items-center gap-2 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            <Image
              src="/logo-stamp.png"
              alt=""
              width={36}
              height={36}
              priority
              className="hidden shrink-0 group-data-[collapsible=icon]:block"
            />
            <div className="grid gap-1 leading-none group-data-[collapsible=icon]:hidden">
              <Image src="/logo-mark.png" alt="FARMER'S TAIL" width={118} height={20} priority className="h-5 w-auto" />
              <span className="text-[10.5px] font-bold tracking-[0.08em] text-muted-foreground">관리자 콘솔</span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          {NAV_GROUPS.map((g) => (
            <SidebarGroup key={g.label}>
              <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {g.items.map((it) => (
                    <SidebarMenuItem key={it.href}>
                      <SidebarMenuButton asChild isActive={it.href === activeHref} tooltip={it.label}>
                        <a href={it.href}>
                          <it.icon />
                          <span>{it.label}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Avatar className="size-7">
              <AvatarFallback className="text-[11px] font-bold">
                {userEmail.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
              {userEmail}
            </span>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/admin">관리자</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>{crumb}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex items-center gap-1.5">{bell}</div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
    </TooltipProvider>
  )
}
