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
 * app/admin/layout.tsx 가 쓰는 **실제** 어드민 내비다(2026-09-04 개편 완료). 시안 페이지
 * /dev/admin-preview 는 사장님 개인 메일이 박힌 채 공개돼 있어 2026-09-26 삭제했다(점검 8차).
 */
import { useState, type ReactNode } from 'react'
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
  ArrowLeft,
  ListChecks,
  Stamp,
  Link2,
  Gift,
  MessageSquare,
  Siren,
  type LucideIcon,
} from 'lucide-react'
import { ADMIN_PAGE_LABEL, type AdminPageHref } from '@/lib/admin/page-labels'
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

/** 메뉴 한 줄 — 이름은 이름표 하나(lib/admin/page-labels, 규칙319)에서. 화면 제목·탭과 같은 말. */
const nav = (href: AdminPageHref, icon: LucideIcon) => ({ href, label: ADMIN_PAGE_LABEL[href], icon })

/**
 * 메뉴 세 묶음(2026-10-24 어드민 2묶음 2-2) — 매일(늘 펼침) · 가끔 · 설정(기본 접힘).
 * 예전엔 다섯 묶음 37개가 다 펼쳐져 있었고 '찾기'는 맨 아래 '시스템'에 있었다.
 * ★이 표가 실제 어드민 내비의 유일한 정본이다 — 옛 components/admin/AdminNav.tsx 에만 넣었더니 사장님 화면엔 이틀간 안
 *   떴다(2026-09-26). 그 죽은 파일은 2026-10-24 지웠다.
 */
const NAV_GROUPS: Array<{ label: string; foldable?: boolean; items: Array<ReturnType<typeof nav>> }> = [
  {
    label: '매일',
    items: [
      nav('/admin', Home),
      nav('/admin/search-all', Search),
      nav('/admin/personalization/picking-list', ClipboardList),
      nav('/admin/orders', Package),
      nav('/admin/subscriptions', Repeat),
      nav('/admin/cs-inbox', Inbox),
      // 사장님이 직접 처리할 경보(2026-10-14 B1) — 홈 '오늘 할 일'의 '안 본 경보'가 여기로 온다.
      nav('/admin/alerts', Siren),
    ],
  },
  {
    label: '가끔',
    items: [
      nav('/admin/refunds', RotateCcw),
      nav('/admin/users', Users),
      // 서포터즈 등록 화면(2026-09-26).
      nav('/admin/trials', Stamp),
      // 이웃 할인 — 지인·쓰레드 유입 고객에게 첫 박스 할인율(2026-09-27).
      nav('/admin/neighbors', Gift),
      nav('/admin/promotions', Ticket),
      nav('/admin/personalization', Wand2),
      nav('/admin/products', ShoppingBasket),
      nav('/admin/surveys', ListChecks),
      nav('/admin/push-campaigns', BellRing),
      // 카카오 알림톡 준비 상태·발송 내역(2026-09-28, docs/MARKET_HUB_AND_ALIMTALK_PLAN_2026_10.md).
      nav('/admin/messages', MessageSquare),
      nav('/admin/blog', Newspaper),
      nav('/admin/faqs', HelpCircle),
      // 인스타 프로필 링크 페이지(/link) 콘텐츠 — 커버·배너(기간)·하루 사진(2026-09-26).
      nav('/admin/link', Link2),
      nav('/admin/subscriptions/charges', CreditCard),
      nav('/admin/finance', Wallet),
      nav('/admin/reports', LineChart),
    ],
  },
  {
    label: '설정',
    foldable: true,
    items: [
      nav('/admin/loyalty', Medal),
      nav('/admin/algorithm', FlaskConical),
      nav('/admin/cron-health', Activity),
      nav('/admin/automation', Workflow),
      nav('/admin/invention-flags', Lightbulb),
      nav('/admin/partners', Handshake),
      nav('/admin/funnel', Filter),
      nav('/admin/cohort', Grid3x3),
      nav('/admin/beta-cohort', PawPrint),
      nav('/admin/personalization-insights', Gauge),
      nav('/admin/push-stats', BarChart3),
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
      ? ADMIN_PAGE_LABEL['/admin']
      : (current?.label ?? crumbOnly?.label ?? '관리자')
  // '설정' 묶음은 기본 접힘 — 지금 보는 화면이 그 안에 있으면 펼친다.
  const [settingsOpen, setSettingsOpen] = useState(() =>
    NAV_GROUPS.some((g) => g.foldable && g.items.some((it) => it.href === activeHref)),
  )
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
              <span className="text-[12px] font-bold text-muted-foreground">관리자</span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          {NAV_GROUPS.map((g) => (
            <SidebarGroup key={g.label}>
              {g.foldable ? (
                <SidebarGroupLabel asChild>
                  <button type="button" aria-expanded={settingsOpen} onClick={() => setSettingsOpen((v) => !v)} className="flex w-full items-center justify-between">
                    {g.label}
                    <span aria-hidden="true">{settingsOpen ? '접기' : `펼치기 · ${g.items.length}`}</span>
                  </button>
                </SidebarGroupLabel>
              ) : (
                <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
              )}
              <SidebarGroupContent hidden={g.foldable && !settingsOpen}>
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
          {/* ★"일반 화면으로" — 2026-09-04 셸 교체 때 빠뜨린 것(사장님 제보 2026-09-15:
              "관리자 화면에서 나가기 버튼이 사라졌다"). 구 AdminShell 드로어 하단에
              있던 **유일한 탈출구**다. 앱에는 주소창이 없어서, 사장님이 폰 앱으로
              어드민에 들어오면 이 링크 말고는 고객 화면으로 돌아갈 길이 없다.
              위 메뉴처럼 <a> 로 그린다 — 풀 이동이라 모바일 드로어가 저절로 닫힌다. */}
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="일반 화면으로">
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- 풀 이동이 목적(드로어 닫힘·proxy 분기). 위 메뉴와 같은 이유 */}
                <a href="/">
                  {/* href="/" — 앱은 proxy 가 세션 유무로 /dashboard·/welcome 으로, 웹은
                      홈으로 보낸다. /dashboard 직링크는 데스크톱 브라우저의 관리자를
                      /app-required 설치 안내로 보냈다(2026-09-16 점검). */}
                  <ArrowLeft />
                  <span>일반 화면으로</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
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
        {/* 가로 넘침 막기(2026-10-15 F-b, 규칙280) — 7/25 옛 셸(.admin-body)에 넣었던 overflow-x: clip 이 9/4 이 셸로 바꿀 때
            빠져, 폰 홈이 옆으로 밀렸다. hidden 이 아니라 clip — 스크롤 컨테이너를 만들지 않아 안쪽 sticky 가 산다.
            min-w-0 = flex 자식이 내용 폭만큼 늘어나지 않게. */}
        <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-x-clip p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
    </TooltipProvider>
  )
}
